import type { WineLookupResult } from "../types.js";

/**
 * Identifying a wine brand purely from a photo (no barcode) ultimately needs
 * a real web/wine-database search. We don't ship a hardcoded API key (there
 * isn't one to ship responsibly), so this is a pluggable provider: configure
 * GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX (a Google Programmable Search Engine)
 * and lookups go live. Without configuration we say so explicitly instead of
 * silently returning nothing, so the UI can prompt for manual entry.
 */
export interface WineLookupProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string): Promise<WineLookupResult[]>;
}

class GoogleCustomSearchProvider implements WineLookupProvider {
  readonly name = "google-custom-search";

  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX);
  }

  async search(query: string): Promise<WineLookupResult[]> {
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    if (!apiKey || !cx) return [];

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", `${query} ワイン 銘柄`);
    url.searchParams.set("num", "5");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Custom Search request failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      items?: Array<{ title: string; snippet?: string; link?: string }>;
    };

    return (data.items ?? []).map((item) => ({
      title: item.title,
      snippet: item.snippet,
      source: this.name,
      url: item.link,
    }));
  }
}

class NullProvider implements WineLookupProvider {
  readonly name = "none";
  isConfigured(): boolean {
    return true; // always "available", just returns nothing
  }
  async search(): Promise<WineLookupResult[]> {
    return [];
  }
}

const googleProvider = new GoogleCustomSearchProvider();
const nullProvider = new NullProvider();

export function getWineLookupProvider(): WineLookupProvider {
  return googleProvider.isConfigured() ? googleProvider : nullProvider;
}
