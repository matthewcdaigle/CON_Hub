import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import * as path from "path";
import { FolderListingRequest, CrawledDocument } from "./types";

const BASE_URL = "https://weblink.dch.georgia.gov/WebLink";
const LISTING_ENDPOINT = `${BASE_URL}/FolderListingService.aspx/GetFolderListing2`;
const PAGE_SIZE = 200;
const REQUEST_DELAY_MS = 2500;
const CHECKPOINT_DIR = path.resolve(__dirname, "..", "data");
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, "checkpoint.json");

/** Save a checkpoint every N folders */
const CHECKPOINT_INTERVAL = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDocUrl(entryId: number): string {
  return `${BASE_URL}/DocView.aspx?id=${entryId}&dbid=1&repo=HealthPlanning`;
}

/**
 * Entry type constants from the WebLink API.
 * type 0 = Folder, type 1 = Document (edoc/non-edoc).
 */
const ENTRY_TYPE_FOLDER = 0;

/** Raw entry from the WebLink API response.data.results[] */
interface RawEntry {
  entryId: number;
  name: string;
  type: number;
  isEdoc: boolean;
  thumbnailPageCount?: number;
  extension?: string;
  entryProperties?: Record<string, any>;
  metadata?: Record<string, any>;
  [key: string]: any;
}

/** A folder waiting to be crawled */
interface PendingFolder {
  folderId: number;
  path: string;
}

/** Checkpoint saved to disk for resume support */
export interface CrawlCheckpoint {
  savedAt: string;
  documents: CrawledDocument[];
  pendingFolders: PendingFolder[];
  foldersVisited: number;
  requestCount: number;
}

export class Crawler {
  private client: AxiosInstance;
  private sessionCookie: string;
  private documents: CrawledDocument[] = [];
  private requestCount = 0;
  private foldersVisited = 0;
  private startTime = 0;
  private foldersSinceCheckpoint = 0;

  constructor(sessionCookie: string) {
    this.sessionCookie = sessionCookie;
    this.client = this.buildClient(sessionCookie);
  }

  private buildClient(sessionCookie: string): AxiosInstance {
    return axios.create({
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

  /**
   * Update the session cookie (e.g. after the user refreshes it in .env).
   */
  updateSession(newCookie: string): void {
    this.sessionCookie = newCookie;
    this.client = this.buildClient(newCookie);
  }

  /**
   * Start a fresh crawl from the given root folder.
   */
  async crawl(folderId: number, label: string): Promise<CrawledDocument[]> {
    this.documents = [];
    this.requestCount = 0;
    this.foldersVisited = 0;
    this.foldersSinceCheckpoint = 0;
    this.startTime = Date.now();

    const queue: PendingFolder[] = [{ folderId, path: label }];
    console.log(`\n--- Crawling: ${label} (folder ${folderId}) ---`);
    await this.processQueue(queue);
    this.printSummary(label);
    return this.documents;
  }

  /**
   * Resume a crawl from a saved checkpoint.
   */
  async resume(): Promise<CrawledDocument[]> {
    const cp = Crawler.loadCheckpoint();
    if (!cp) {
      throw new Error("No checkpoint file found to resume from.");
    }

    this.documents = cp.documents;
    this.requestCount = cp.requestCount;
    this.foldersVisited = cp.foldersVisited;
    this.foldersSinceCheckpoint = 0;
    this.startTime = Date.now();

    console.log(
      `\n--- Resuming crawl: ${cp.documents.length} docs already collected, `
      + `${cp.pendingFolders.length} folders remaining ---`
    );

    await this.processQueue(cp.pendingFolders);
    this.printSummary("resumed crawl");
    Crawler.deleteCheckpoint();
    return this.documents;
  }

  /**
   * Iterative BFS over the folder queue.  Each folder is fully paginated
   * before moving to the next.  Sub-folders discovered are appended to the
   * end of the queue.
   */
  private async processQueue(queue: PendingFolder[]): Promise<void> {
    while (queue.length > 0) {
      const folder = queue.shift()!;
      const subFolders = await this.crawlFolder(folder.folderId, folder.path);

      if (subFolders === null) {
        // Auth failure — save checkpoint with this folder back in the queue
        queue.unshift(folder);
        this.saveCheckpoint(queue);
        throw new SessionExpiredError(
          `Session expired after ${this.requestCount} requests. `
          + `Checkpoint saved with ${this.documents.length} docs and ${queue.length} folders remaining.`
        );
      }

      // Append discovered sub-folders to the queue
      queue.push(...subFolders);

      this.foldersSinceCheckpoint++;
      if (this.foldersSinceCheckpoint >= CHECKPOINT_INTERVAL) {
        this.saveCheckpoint(queue);
        this.foldersSinceCheckpoint = 0;
      }
    }
  }

  /**
   * Crawl a single folder, paginating through all entries.
   * Returns discovered sub-folders, or null if the session expired.
   */
  private async crawlFolder(
    folderId: number,
    folderPath: string
  ): Promise<PendingFolder[] | null> {
    this.foldersVisited++;
    const subFolders: PendingFolder[] = [];
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
          return subFolders;
        }

        results = inner.results;
        total = typeof inner.totalEntries === "number" ? inner.totalEntries : results.length;
      } catch (err: any) {
        const status = err?.response?.status;

        // Detect session expiry (401, 403, or redirect to login)
        if (status === 401 || status === 403) {
          console.error(
            `\n  Session expired (HTTP ${status}) while fetching folder ${folderId}`
          );
          return null;
        }

        if (err?.response?.data) {
          console.error(
            `  Response body (first 1000 chars): ${JSON.stringify(err.response.data).slice(0, 1000)}`
          );
        }
        console.error(
          `  Error fetching folder ${folderId} (start=${start}): HTTP ${status ?? "unknown"} - ${err.message}`
        );
        return subFolders;
      }

      totalEntries = total;

      // The results array may be padded beyond totalEntries; only process valid entries
      const validCount = Math.min(results.length, total - start);
      const validResults = results.slice(0, validCount);

      const folderCount = validResults.filter((e) => e.type === ENTRY_TYPE_FOLDER).length;
      const docCount = validResults.length - folderCount;
      // Clear progress line before printing folder details
      process.stdout.write("\r" + " ".repeat(100) + "\r");
      console.log(
        `  Folder ${folderId} [${folderPath}]: ${validResults.length} entries (${folderCount} folders, ${docCount} documents) `
        + `[${start}-${start + validResults.length} of ${totalEntries}]`
      );

      for (const entry of validResults) {
        if (entry.type === ENTRY_TYPE_FOLDER) {
          subFolders.push({
            folderId: entry.entryId,
            path: `${folderPath}/${entry.name}`,
          });
        } else {
          const doc: CrawledDocument = {
            entryId: entry.entryId,
            name: entry.name,
            path: folderPath,
            lastModified: Crawler.extractLastModified(entry),
            pageCount: entry.thumbnailPageCount ?? 0,
            url: buildDocUrl(entry.entryId),
          };
          this.documents.push(doc);
        }
      }

      this.logProgress();
      start = end;
    } while (start < totalEntries);

    return subFolders;
  }

  private logProgress(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    process.stdout.write(
      `\r  [${elapsed}s] ${this.documents.length} docs | ${this.foldersVisited} folders | ${this.requestCount} requests`
    );
  }

  private printSummary(label: string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    process.stdout.write("\r" + " ".repeat(100) + "\r");
    console.log(
      `\nFinished "${label}": ${this.documents.length} documents, `
      + `${this.foldersVisited} folders visited, `
      + `${this.requestCount} API requests in ${elapsed}s`
    );
  }

  /**
   * Extract a last-modified date from the entry.  The API does not provide a
   * top-level `lastModified` field; the value lives inside `entryProperties`
   * or `metadata`.  We try several common locations and fall back to "".
   */
  private static extractLastModified(entry: RawEntry): string {
    // Direct field (in case future API versions add it)
    if (entry.lastModified) return String(entry.lastModified);

    // entryProperties often contains { lastModifiedDate, modifyDate, ... }
    const ep = entry.entryProperties;
    if (ep) {
      const candidate =
        ep["lastModifiedDate"] ?? ep["modifyDate"] ?? ep["LastModifiedDate"] ?? ep["ModifyDate"];
      if (candidate) return String(candidate);
    }

    // metadata bag
    const md = entry.metadata;
    if (md) {
      const candidate =
        md["lastModifiedDate"] ?? md["modifyDate"] ?? md["LastModifiedDate"] ?? md["ModifyDate"];
      if (candidate) return String(candidate);
    }

    return "";
  }

  // ---------- Checkpoint persistence ----------

  private saveCheckpoint(pendingFolders: PendingFolder[]): void {
    if (!fs.existsSync(CHECKPOINT_DIR)) {
      fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    }
    const cp: CrawlCheckpoint = {
      savedAt: new Date().toISOString(),
      documents: this.documents,
      pendingFolders,
      foldersVisited: this.foldersVisited,
      requestCount: this.requestCount,
    };
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp), "utf-8");
    process.stdout.write("\r" + " ".repeat(100) + "\r");
    console.log(
      `  [checkpoint] Saved: ${this.documents.length} docs, ${pendingFolders.length} folders remaining → ${CHECKPOINT_PATH}`
    );
  }

  static loadCheckpoint(): CrawlCheckpoint | null {
    if (!fs.existsSync(CHECKPOINT_PATH)) return null;
    const raw = fs.readFileSync(CHECKPOINT_PATH, "utf-8");
    return JSON.parse(raw) as CrawlCheckpoint;
  }

  static deleteCheckpoint(): void {
    if (fs.existsSync(CHECKPOINT_PATH)) {
      fs.unlinkSync(CHECKPOINT_PATH);
    }
  }

  static hasCheckpoint(): boolean {
    return fs.existsSync(CHECKPOINT_PATH);
  }
}

/**
 * Thrown when the session cookie has expired.
 * The caller should catch this, prompt for a new cookie, and resume.
 */
export class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionExpiredError";
  }
}
