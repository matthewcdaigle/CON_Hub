import axios, { AxiosInstance } from "axios";
import {
  FolderListingRequest,
  FolderListingEntry,
  CrawledDocument,
} from "./types";

const BASE_URL = "https://weblink.dch.georgia.gov/WebLink";
const LISTING_ENDPOINT = `${BASE_URL}/FolderListingService.aspx/GetFolderListing2`;
const PAGE_SIZE = 200;
const REQUEST_DELAY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDocUrl(entryId: number): string {
  return `${BASE_URL}/DocView.aspx?id=${entryId}&dbid=1&repo=HealthPlanning`;
}

export class Crawler {
  private client: AxiosInstance;
  private documents: CrawledDocument[] = [];
  private requestCount = 0;

  constructor(sessionCookie: string) {
    this.client = axios.create({
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: `WebLinkSession=${sessionCookie}; AcceptsCookies=1`,
        Origin: "https://weblink.dch.georgia.gov",
        "x-lf-suppress-login-redirect": "1",
      },
      timeout: 30000,
    });
  }

  async crawl(folderId: number, label: string): Promise<CrawledDocument[]> {
    this.documents = [];
    this.requestCount = 0;
    console.log(`\n--- Crawling: ${label} (folder ${folderId}) ---`);
    await this.crawlFolder(folderId, label);
    console.log(
      `Finished "${label}": ${this.documents.length} documents found (${this.requestCount} requests made)`
    );
    return this.documents;
  }

  private async crawlFolder(folderId: number, path: string): Promise<void> {
    let start = 0;
    let totalEntries = 0;

    do {
      const end = start + PAGE_SIZE;
      const body: FolderListingRequest = {
        repoName: "HealthPlanning",
        folderId,
        getNewListing: true,
        start,
        end,
        sortColumn: "",
        sortAscending: true,
      };

      if (this.requestCount > 0) {
        await sleep(REQUEST_DELAY_MS);
      }

      let entries: FolderListingEntry[];
      let total: number;
      try {
        this.requestCount++;
        const res = await this.client.post(LISTING_ENDPOINT, body);
        const raw = res.data;

        // Unwrap ASP.NET { d: ... } if present
        let payload = raw?.d ?? raw;
        if (typeof payload === "string") {
          payload = JSON.parse(payload);
        }

        // Extract entries from known response shapes
        const parsed = this.extractEntries(payload);
        if (!parsed) {
          // Diagnostic: find all arrays in the response to locate entries
          console.error(`  Could not find entries in response for folder ${folderId}.`);
          console.error(`  Top-level keys: [${Object.keys(payload ?? {}).join(", ")}]`);
          this.dumpArrays(payload, "root", 0);
          return;
        }
        entries = parsed.entries;
        total = parsed.total;
      } catch (err: any) {
        const status = err?.response?.status;
        if (err?.response?.data) {
          console.error(
            `  Response body (first 1000 chars): ${JSON.stringify(err.response.data).slice(0, 1000)}`
          );
        }
        console.error(
          `  Error fetching folder ${folderId} (start=${start}): HTTP ${status ?? "unknown"} - ${err.message}`
        );
        return;
      }

      totalEntries = total;

      console.log(
        `  Folder ${folderId} [${path}]: fetched ${entries.length} entries (${start}-${end} of ${totalEntries})`
      );

      for (const entry of entries) {
        await this.processEntry(entry, path);
      }

      start = end;
    } while (start < totalEntries);
  }

  private extractEntries(
    payload: any
  ): { entries: FolderListingEntry[]; total: number } | null {
    // Shape 1: { entries: [...], totalEntries: N }
    if (payload?.entries && typeof payload.totalEntries === "number") {
      return { entries: payload.entries, total: payload.totalEntries };
    }
    // Shape 2: plain array
    if (Array.isArray(payload)) {
      return { entries: payload, total: payload.length };
    }
    // Shape 3: { data: { ..., rows/items/listing/children: [...] } }
    const inner = payload?.data ?? payload;
    for (const key of ["rows", "items", "listing", "children", "entries"]) {
      if (Array.isArray(inner?.[key])) {
        const totalKey = ["totalEntries", "totalCount", "total", "count"].find(
          (k) => typeof inner[k] === "number"
        );
        return {
          entries: inner[key],
          total: totalKey ? inner[totalKey] : inner[key].length,
        };
      }
    }
    return null;
  }

  /** Recursively find and log all arrays in the response (max depth 3) */
  private dumpArrays(obj: any, path: string, depth: number): void {
    if (depth > 3 || !obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const fullPath = `${path}.${key}`;
      if (Array.isArray(val)) {
        console.error(
          `  ARRAY at ${fullPath}: length=${val.length}` +
            (val.length > 0
              ? `, first item keys: [${Object.keys(val[0] ?? {}).join(", ")}]`
              : "")
        );
        if (val.length > 0) {
          console.error(
            `    First item: ${JSON.stringify(val[0]).slice(0, 300)}`
          );
        }
      } else if (typeof val === "object" && val !== null) {
        console.error(`  OBJECT at ${fullPath}: keys=[${Object.keys(val).join(", ")}]`);
        this.dumpArrays(val, fullPath, depth + 1);
      } else if (typeof val === "number") {
        console.error(`  NUMBER at ${fullPath}: ${val}`);
      }
    }
  }

  private async processEntry(
    entry: FolderListingEntry,
    parentPath: string
  ): Promise<void> {
    if (entry.type === 0) {
      // Folder — recurse
      const folderPath = `${parentPath}/${entry.name}`;
      await this.crawlFolder(entry.entryId, folderPath);
    } else if (entry.type === -2) {
      // Document — collect
      const doc: CrawledDocument = {
        entryId: entry.entryId,
        name: entry.name,
        path: parentPath,
        lastModified: entry.lastModified,
        pageCount: entry.pageCount ?? 0,
        url: buildDocUrl(entry.entryId),
      };
      this.documents.push(doc);
    }
  }
}
