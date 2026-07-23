/**
 * Link metadata extraction — item-1 scope: title / site / description for the
 * citation line. Full Readability + open-graph-scraper arrives in item 2.
 *
 * Server-side only. Time-boxed hard: a hanging fetch is worse than a failed
 * one (Voss). Failure returns a structured error — the catch is already
 * saved; enrichment failing is cosmetic, never fatal.
 */

export interface ExtractResult {
  ok: boolean;
  title?: string;
  siteName?: string;
  description?: string;
  error?: string;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024; // read at most 512KB of HTML

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function metaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return undefined;
}

export async function extractLinkMeta(url: string): Promise<ExtractResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("unsupported protocol");
  } catch {
    return { ok: false, error: "not a valid http(s) url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SieveBot/0.1; +https://nervahous.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return { ok: false, error: `fetch failed: ${res.status}` };

    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let received = 0;
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
        // stop early once </head> is in hand — meta lives there
        if (html.includes("</head>")) break;
      }
      reader.cancel().catch(() => {});
    }

    const title =
      metaContent(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
      ]) ?? undefined;

    const siteName =
      metaContent(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
      ]) ?? parsed.hostname.replace(/^www\./, "");

    const description = metaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]);

    if (!title) return { ok: false, siteName, error: "no title found" };
    return { ok: true, title, siteName, description };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
