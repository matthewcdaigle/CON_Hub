import * as dotenv from "dotenv";
import * as path from "path";
import * as cron from "node-cron";
import { Crawler, SessionExpiredError } from "./crawler";
import { loadSnapshot, saveSnapshot, diffSnapshots, printChanges } from "./snapshot";
import { DocketsConfig } from "./types";

// Load .env from con-crawler root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Load docket folder config
// eslint-disable-next-line @typescript-eslint/no-var-requires
const docketsConfig: DocketsConfig = require("../config/dockets.json");

function getSession(): string {
  // Re-read .env each time so a refreshed cookie is picked up on resume
  dotenv.config({
    path: path.resolve(__dirname, "..", ".env"),
    override: true,
  });

  const session = process.env.WEBLINKSSESSION;
  if (!session) {
    console.error("ERROR: WEBLINKSSESSION environment variable is not set.");
    console.error("Set it in con-crawler/.env or export it in your shell.");
    process.exit(1);
  }
  return session;
}

async function runCrawl(resume: boolean): Promise<void> {
  const session = getSession();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`CON Crawler — ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}`);

  const crawler = new Crawler(session);
  let allDocuments: any[] = [];

  try {
    if (resume && Crawler.hasCheckpoint()) {
      allDocuments = await crawler.resume();
    } else {
      if (resume) {
        console.log("No checkpoint found — starting fresh crawl.");
      }
      for (const folder of docketsConfig.folders) {
        const docs = await crawler.crawl(folder.folderId, folder.label);
        allDocuments.push(...docs);
      }
    }
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      console.error(`\n${"!".repeat(60)}`);
      console.error(err.message);
      console.error(`\nTo resume:`);
      console.error(`  1. Get a fresh session cookie from your browser`);
      console.error(`  2. Update WEBLINKSSESSION in con-crawler/.env`);
      console.error(`  3. Run: node dist/index.js --once --resume`);
      console.error(`${"!".repeat(60)}`);
      process.exit(2);
    }
    throw err;
  }

  console.log(`\nTotal documents crawled: ${allDocuments.length}`);

  // Load previous snapshot and compare
  const previousSnapshot = loadSnapshot();
  const diff = diffSnapshots(allDocuments, previousSnapshot);
  printChanges(diff);

  // Save new snapshot
  saveSnapshot(allDocuments);
}

// Check flags
const isOneShot = process.argv.includes("--once");
const isResume = process.argv.includes("--resume");

if (isOneShot) {
  runCrawl(isResume)
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
  runCrawl(isResume).catch((err) => console.error("Initial crawl failed:", err));

  // Schedule to run every 6 hours
  cron.schedule("0 */6 * * *", () => {
    console.log("\n[cron] Scheduled crawl triggered.");
    runCrawl(false).catch((err) => console.error("Scheduled crawl failed:", err));
  });

  console.log("Scheduler active: crawl runs every 6 hours. Press Ctrl+C to stop.");
}
