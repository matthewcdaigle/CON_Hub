/**
 * Laserfiche Repository API client stub.
 *
 * This client is designed to be activated once Laserfiche credentials are obtained.
 * All methods throw a clear error if the client is not configured.
 */

export interface LaserficheEntry {
  entryId: number;
  name: string;
  entryType: "Folder" | "Document";
  parentId: number;
  createdDate: string;
  modifiedDate: string;
  templateName?: string;
  fieldValues?: Record<string, any>;
}

interface LaserficheConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export class LaserficheClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: Partial<LaserficheConfig>) {
    this.baseUrl = (config.baseUrl ?? "").replace(/\/+$/, "");
    this.clientId = config.clientId ?? "";
    this.clientSecret = config.clientSecret ?? "";
  }

  /**
   * Check whether all required credentials are present.
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.clientId && this.clientSecret);
  }

  /**
   * Ensure the client is configured before making API calls.
   */
  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        "Laserfiche client is not configured. Set LASERFICHE_BASE_URL, " +
          "LASERFICHE_CLIENT_ID, and LASERFICHE_CLIENT_SECRET environment variables."
      );
    }
  }

  /**
   * Authenticate using OAuth2 client credentials flow.
   * Tokens are cached until expiry.
   */
  async authenticate(): Promise<void> {
    if (!this.isConfigured()) {
      console.warn(
        "Laserfiche authentication skipped: client is not configured. " +
          "Set LASERFICHE_BASE_URL, LASERFICHE_CLIENT_ID, and LASERFICHE_CLIENT_SECRET."
      );
      return;
    }

    // Reuse valid token
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return;
    }

    const tokenUrl = `${this.baseUrl}/OAuth/Token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Laserfiche authentication failed (${response.status}): ${body}`
      );
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  }

  /**
   * Make an authenticated API request.
   */
  private async request<T>(
    method: string,
    path: string,
    options?: { body?: any; responseType?: "json" | "buffer" }
  ): Promise<T> {
    this.assertConfigured();
    await this.authenticate();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    };

    if (options?.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Laserfiche API error ${response.status} ${method} ${path}: ${errorBody}`
      );
    }

    if (options?.responseType === "buffer") {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer) as unknown as T;
    }

    return (await response.json()) as T;
  }

  /**
   * List the children of a folder by entry ID.
   */
  async listFolderContents(entryId: number): Promise<LaserficheEntry[]> {
    const data = await this.request<{ value: LaserficheEntry[] }>(
      "GET",
      `/v2/Repositories/entries/${entryId}/children`
    );
    return data.value ?? [];
  }

  /**
   * Get metadata for a specific entry.
   */
  async getEntry(entryId: number): Promise<LaserficheEntry> {
    return this.request<LaserficheEntry>(
      "GET",
      `/v2/Repositories/entries/${entryId}`
    );
  }

  /**
   * Search entries in the repository using Laserfiche search syntax.
   */
  async searchEntries(query: string): Promise<LaserficheEntry[]> {
    const data = await this.request<{ value: LaserficheEntry[] }>(
      "POST",
      `/v2/Repositories/searches`,
      { body: { searchCommand: query } }
    );
    return data.value ?? [];
  }

  /**
   * Download the content of a document entry as a Buffer.
   */
  async downloadDocument(entryId: number): Promise<Buffer> {
    return this.request<Buffer>("GET", `/v2/Repositories/entries/${entryId}/content`, {
      responseType: "buffer",
    });
  }

  /**
   * Build a public WebLink URL for viewing a document in the browser.
   */
  buildWebLinkUrl(entryId: number): string {
    this.assertConfigured();
    // Standard Laserfiche WebLink URL pattern
    const webLinkBase = this.baseUrl.replace(/\/api$/i, "").replace(/\/v2$/i, "");
    return `${webLinkBase}/WebLink/Browse/doc/${entryId}`;
  }
}

// Singleton initialized from environment variables
export const laserfiche = new LaserficheClient({
  baseUrl: process.env.LASERFICHE_BASE_URL,
  clientId: process.env.LASERFICHE_CLIENT_ID,
  clientSecret: process.env.LASERFICHE_CLIENT_SECRET,
});
