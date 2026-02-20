import * as dotenv from "dotenv";
import * as path from "path";
import * as cron from "node-cron";
import { Crawler } from "./crawler";
import { loadSnapshot, saveSnapshot, diffSnapshots, printChanges } from "./snapshot";
import { DocketsConfig } from "./types";

// Load .env from con-crawler root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Load docket folder config
// eslint-disable-next-line @typescript-eslint/no-var-requires
const docketsConfig: DocketsConfig = require("../config/dockets.json");

async function runCrawl(): Promise<void> {
  const session = process.env.WEBLINKSSESSION;
  if (!session) {
    console.error("ERROR: WEBLINKSSESSION environment variable is not set.");
    console.error("Set it in con-crawler/.env or export it in your shell.");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`CON Crawler — ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}`);

  const crawler = new Crawler(session);
  const allDocuments = [];

  for (const folder of docketsConfig.folders) {
    const docs = await crawler.crawl(folder.folderId, folder.label);
    allDocuments.push(...docs);
  }

  console.log(`\nTotal documents crawled: ${allDocuments.length}`);

  // Load previous snapshot and compare
  const previousSnapshot = loadSnapshot();
  const diff = diffSnapshots(allDocuments, previousSnapshot);
  printChanges(diff);

  // Save new snapshot
  saveSnapshot(allDocuments);
}

// Check if running as one-shot (e.g., `npm run crawl` or `--once` flag)
const isOneShot = process.argv.includes("--once");

if (isOneShot) {
  runCrawl()
    .then(() => {
      console.log("\nOne-shot crawl complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Crawl failed:", err);
      process.exit(1);
    });
} else {
  // Run immediately on startup
  runCrawl().catch((err) => console.error("Initial crawl failed:", err));

  // Schedule to run every 6 hours
  cron.schedule("0 */6 * * *", () => {
    console.log("\n[cron] Scheduled crawl triggered.");
    runCrawl().catch((err) => console.error("Scheduled crawl failed:", err));
  });

  console.log("Scheduler active: crawl runs every 6 hours. Press Ctrl+C to stop.");
}
