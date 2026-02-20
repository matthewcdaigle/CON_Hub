import axios, { AxiosInstance } from "axios";
import { FolderListingRequest, CrawledDocument } from "./types";

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

/** Raw entry from the WebLink API response.data.results[] */
interface RawEntry {
  entryId: number;
  name: string;
  type: number;
  isEdoc: boolean;
  thumbnailPageCount?: number;
  lastModified?: string;
  extension?: string;
  [key: string]: any;
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

      let results: RawEntry[];
      let total: number;
      try {
        this.requestCount++;
        const res = await this.client.post(LISTING_ENDPOINT, body);
        const payload = res.data;

        // Response shape: { data: { results: [...], totalEntries: N, ... } }
        const inner = payload?.data;
        if (!inner || !Array.isArray(inner.results)) {
          console.error(
            `  Unexpected response for folder ${folderId}. Keys: [${Object.keys(payload ?? {}).join(", ")}]`
          );
          if (inner) {
            console.error(
              `  data keys: [${Object.keys(inner).join(", ")}]`
            );
          }
          console.error(
            `  Full response (first 2000 chars): ${JSON.stringify(payload).slice(0, 2000)}`
          );
          return;
        }

        results = inner.results;
        total = typeof inner.totalEntries === "number" ? inner.totalEntries : results.length;
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

      // The results array may be padded beyond totalEntries; only process valid entries
      const validCount = Math.min(results.length, total - start);
      const validResults = results.slice(0, validCount);

      console.log(
        `  Folder ${folderId} [${path}]: ${validResults.length} entries (${start}-${start + validResults.length} of ${totalEntries})`
      );

      for (const entry of validResults) {
        await this.processEntry(entry, path);
      }

      start = end;
    } while (start < totalEntries);
  }

  private async processEntry(
    entry: RawEntry,
    parentPath: string
  ): Promise<void> {
    if (entry.isEdoc) {
      // Document
      const doc: CrawledDocument = {
        entryId: entry.entryId,
        name: entry.name,
        path: parentPath,
        lastModified: entry.lastModified ?? "",
        pageCount: entry.thumbnailPageCount ?? 0,
        url: buildDocUrl(entry.entryId),
      };
      this.documents.push(doc);
    } else if (entry.type === 0) {
      // Folder — recurse
      const folderPath = `${parentPath}/${entry.name}`;
      await this.crawlFolder(entry.entryId, folderPath);
    }
  }
}
