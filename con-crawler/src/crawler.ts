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
        const data = res.data;

        // ASP.NET may wrap in { d: ... } or { d: "json-string" } or return directly
        let payload = data?.d ?? data;
        if (typeof payload === "string") {
          payload = JSON.parse(payload);
        }

        // Normalize: look for entries/totalEntries at top level or nested
        if (payload?.entries && typeof payload.totalEntries === "number") {
          entries = payload.entries;
          total = payload.totalEntries;
        } else if (Array.isArray(payload)) {
          entries = payload;
          total = payload.length;
        } else {
          // Log the actual shape so we can diagnose
          const keys = Object.keys(payload ?? {});
          console.error(
            `  Unexpected response shape for folder ${folderId} (start=${start}). Keys: [${keys.join(", ")}]`
          );
          console.error(
            `  First 500 chars: ${JSON.stringify(payload).slice(0, 500)}`
          );
          return;
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (err?.response?.data) {
          console.error(
            `  Response body (first 500 chars): ${JSON.stringify(err.response.data).slice(0, 500)}`
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
