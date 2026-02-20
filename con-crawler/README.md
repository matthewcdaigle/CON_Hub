# con-crawler

Crawls the Georgia DCH Laserfiche WebLink repository for Certificate of Need (CON) documents. Detects new and modified documents compared to the previous snapshot and logs them with direct download URLs.

## Setup

```bash
cd con-crawler
npm install
```

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and set your session cookie value:

```
WEBLINKSSESSION=your_session_cookie_value_here
```

## Usage

### One-shot crawl

Run a single crawl and exit:

```bash
npm run crawl
```

### Scheduled mode

Run immediately then repeat every 6 hours:

```bash
npm run start
```

### Build and run compiled JS

```bash
npm run build
npm run crawl:built   # one-shot
npm run start:built   # scheduled
```

## Adding new docket folder IDs

Edit `config/dockets.json` and add an entry to the `folders` array:

```json
{
  "folders": [
    { "folderId": 202, "label": "CON Tracking Reports" },
    { "folderId": 1053224, "label": "2026 Certificate of Need" },
    { "folderId": 999999, "label": "Your New Folder" }
  ]
}
```

To find a folder ID, navigate to it in the WebLink browser at `https://weblink.dch.georgia.gov/WebLink/Browse.aspx?dbid=1&repo=HealthPlanning` and note the folder ID from the URL or network requests.

## Refreshing the session cookie

The `WEBLINKSSESSION` cookie expires periodically. To refresh it:

1. Open https://weblink.dch.georgia.gov/WebLink/Browse.aspx?dbid=1&repo=HealthPlanning in your browser.
2. Open DevTools (F12) → Application tab → Cookies.
3. Copy the value of the `WebLinkSession` cookie.
4. Paste it into your `.env` file as the `WEBLINKSSESSION` value.

If the crawler returns HTTP 401 or login-redirect errors, the cookie has likely expired and needs to be refreshed.

## Output

- **Snapshot**: Saved to `data/snapshot.json` after each crawl.
- **Console**: New and modified documents are printed with name, path, lastModified, pageCount, and a direct URL.

## How it works

1. Reads folder IDs from `config/dockets.json`.
2. For each folder, makes POST requests to the Laserfiche WebLink API.
3. Recursively enters subfolders (type 0) and collects documents (type -2).
4. Paginates when a folder has more than 200 entries.
5. Waits 2500ms between each HTTP request to avoid rate limiting.
6. Compares results against the previous `data/snapshot.json` to detect changes.
7. Saves the new snapshot for the next run.
