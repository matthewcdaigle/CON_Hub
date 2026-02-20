import * as fs from "fs";
import * as path from "path";
import { CrawledDocument, Snapshot } from "./types";

const SNAPSHOT_PATH = path.resolve(__dirname, "..", "data", "snapshot.json");

export function loadSnapshot(): Snapshot | null {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    return null;
  }
  const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
  return JSON.parse(raw) as Snapshot;
}

export function saveSnapshot(documents: CrawledDocument[]): void {
  const dir = path.dirname(SNAPSHOT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const snapshot: Snapshot = {
    crawledAt: new Date().toISOString(),
    documents: {},
  };

  for (const doc of documents) {
    snapshot.documents[doc.entryId] = doc;
  }

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`Snapshot saved: ${documents.length} documents → ${SNAPSHOT_PATH}`);
}

export interface DiffResult {
  newDocs: CrawledDocument[];
  modifiedDocs: CrawledDocument[];
}

export function diffSnapshots(
  current: CrawledDocument[],
  previous: Snapshot | null
): DiffResult {
  if (!previous) {
    return { newDocs: current, modifiedDocs: [] };
  }

  const newDocs: CrawledDocument[] = [];
  const modifiedDocs: CrawledDocument[] = [];

  for (const doc of current) {
    const prev = previous.documents[doc.entryId];
    if (!prev) {
      newDocs.push(doc);
    } else if (prev.lastModified !== doc.lastModified) {
      modifiedDocs.push(doc);
    }
  }

  return { newDocs, modifiedDocs };
}

export function printChanges(diff: DiffResult): void {
  if (diff.newDocs.length === 0 && diff.modifiedDocs.length === 0) {
    console.log("\nNo new or modified documents since last crawl.");
    return;
  }

  if (diff.newDocs.length > 0) {
    console.log(`\n=== NEW DOCUMENTS (${diff.newDocs.length}) ===`);
    for (const doc of diff.newDocs) {
      printDoc(doc);
    }
  }

  if (diff.modifiedDocs.length > 0) {
    console.log(`\n=== MODIFIED DOCUMENTS (${diff.modifiedDocs.length}) ===`);
    for (const doc of diff.modifiedDocs) {
      printDoc(doc);
    }
  }
}

function printDoc(doc: CrawledDocument): void {
  console.log(`  Name:         ${doc.name}`);
  console.log(`  Path:         ${doc.path}`);
  console.log(`  Last Modified: ${doc.lastModified}`);
  console.log(`  Page Count:   ${doc.pageCount}`);
  console.log(`  URL:          ${doc.url}`);
  console.log("");
}
