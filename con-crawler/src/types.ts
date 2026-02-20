export interface DocketFolder {
  folderId: number;
  label: string;
}

export interface DocketsConfig {
  folders: DocketFolder[];
}

export interface FolderListingRequest {
  repoName: string;
  folderId: number;
  getNewListing: boolean;
  start: number;
  end: number;
  sortColumn: string;
  sortAscending: boolean;
}


export interface CrawledDocument {
  entryId: number;
  name: string;
  path: string;
  lastModified: string;
  pageCount: number;
  url: string;
}

export interface Snapshot {
  crawledAt: string;
  documents: Record<number, CrawledDocument>;
}
