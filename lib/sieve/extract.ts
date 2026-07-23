/**
 * Link metadata extraction — item-1 scope: title / site / description for the
 * citation line. Full Readability + open-graph-scraper arrives in item 2.
 *
 * Server-side only. Three hard rules, all learned from the red team:
 *   1. Time-boxed. A hanging fetch is worse than a failed one.
 *   2. Byte-capped. We read the <head>, not the internet.
 *   3. SSRF-guarded. Every hop's resolved IP is checked against private
 *      ranges BEFORE we connect, and redirects are followed manually so a
 *      302 to 169.254.169.254 cannot smuggle us into a metadata endpoint.
 *
 * Failure returns a structured error — the catch is already saved; enrichment
 * failing is cosmetic, never fatal.
 */

import dns from "node:dns";
import net from "node:net";
// undici's OWN fetch, not the global. Node 22's global fetch is backed by an
// internal copy of undici and rejects a dispatcher built from this package
// ("invalid onRequestStart method"), which would silently disable the guard.
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";

export interface ExtractResult {
  ok: boolean;
  title?: string;
  siteName?: string;
  description?: string;
  error?: string;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;

/** RFC1918 + loopback + link-local + CGNAT + benchmarking + reserved. */
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // unparseable → refuse
  const [a, b] = p;
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // IPv4-mapped (::ffff:127.0.0.1) — check the embedded v4 address
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const head = lower.split(":")[0];
  if (/^f[cd]/.test(head)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(head)) return true; // fe80::/10 link-local
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not an IP we understand → refuse
}

/**
 * SSRF guard that closes DNS rebinding.
 *
 * A resolve-then-fetch check is defeatable: `fetch` re-resolves the hostname
 * independently, so an attacker's nameserver can answer the safety check and
 * the real connection differently — deterministically, since the check always
 * queries first. The guard has to run at CONNECT time, on the address actually
 * being dialled.
 *
 * This lookup hook is handed to undici's connector, so every address the socket
 * would use is validated in the same operation that uses it. There is no window.
 * Handles decimal/octal/short-form encodings for free, because getaddrinfo has
 * already normalised them by the time we see an address.
 */
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  addresses: dns.LookupAddress[],
) => void;

function guardedLookup(
  hostname: string,
  options: dns.LookupAllOptions,
  callback: LookupCallback,
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (addresses.length === 0) {
      return callback(new Error("could not resolve host"), []);
    }
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        return callback(new Error("BLOCKED_PRIVATE_ADDRESS"), []);
      }
    }
    callback(null, addresses);
  });
}

const safeAgent = new Agent({
  connect: { lookup: guardedLookup as never },
});

/**
 * Layer two, and it is NOT redundant.
 *
 * undici skips DNS resolution entirely when the host is already a literal
 * address, so the connector guard above never fires for `http://127.0.0.1/`,
 * `http://2130706433/` (decimal) or `http://0177.0.0.1/` (octal). Verified by
 * probe: all three reached a local decoy server with the connector guard
 * installed. Only a real hostname like `localhost` was caught.
 *
 * So every URL is also pre-checked here before the request is made. getaddrinfo
 * normalises decimal/octal/short-form encodings, which is what makes this catch
 * them all with one code path.
 *
 * Neither layer is sufficient alone: this one has a rebinding window, the
 * connector one has a literal-IP hole. Together they close both.
 */
async function assertPublicHost(hostname: string): Promise<string | null> {
  return new Promise((resolve) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err || addresses.length === 0) return resolve("could not resolve host");
      for (const { address } of addresses) {
        if (isPrivateAddress(address)) {
          return resolve("refusing to fetch a private address");
        }
      }
      resolve(null);
    });
  });
}

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
  let current: URL;
  try {
    current = new URL(url);
    if (!/^https?:$/.test(current.protocol)) throw new Error("unsupported protocol");
  } catch {
    return { ok: false, error: "not a valid http(s) url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let res: UndiciResponse | null = null;

    // Manual redirect following — every hop is re-validated. `redirect: follow`
    // would let an external-looking URL 302 us straight into the private range.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const blocked = await assertPublicHost(current.hostname);
      if (blocked) return { ok: false, error: blocked };

      const r: UndiciResponse = await undiciFetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; SieveBot/0.1; +https://nervahous.com)",
          accept: "text/html,application/xhtml+xml",
        },
        // The guard lives in the connector, so it validates the address the
        // socket actually dials. Every redirect hop goes through it too.
        dispatcher: safeAgent,
      });

      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return { ok: false, error: "redirect without location" };
        let next: URL;
        try {
          next = new URL(loc, current);
        } catch {
          return { ok: false, error: "bad redirect target" };
        }
        if (!/^https?:$/.test(next.protocol)) {
          return { ok: false, error: "redirect to unsupported protocol" };
        }
        current = next;
        continue;
      }

      res = r;
      break;
    }

    if (!res) return { ok: false, error: "too many redirects" };
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
        if (html.includes("</head>")) break;
      }
      html += decoder.decode(); // flush any trailing partial multi-byte char
      reader.cancel().catch(() => {});
    }

    const title = metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);

    const siteName =
      metaContent(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
      ]) ?? current.hostname.replace(/^www\./, "");

    const description = metaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]);

    if (!title) return { ok: false, siteName, error: "no title found" };
    return { ok: true, title, siteName, description };
  } catch (e) {
    const chain: string[] = [];
    for (let err: unknown = e; err; err = (err as { cause?: unknown }).cause) {
      if (err instanceof Error) chain.push(err.message, err.name);
    }
    const joined = chain.join(" ");
    const msg = joined.includes("BLOCKED_PRIVATE_ADDRESS")
      ? "refusing to fetch a private address"
      : joined.includes("could not resolve host")
        ? "could not resolve host"
        : chain.includes("AbortError")
          ? "timed out"
          : "unreachable";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
