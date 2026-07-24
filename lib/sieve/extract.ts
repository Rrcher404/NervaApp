/**
 * Link extraction — title / site / description for the citation line, plus
 * article text (Mozilla Readability) for the claim + embedding pipeline.
 *
 * Server-side only. Four hard rules, all learned from the red team:
 *   1. Time-boxed. A hanging fetch is worse than a failed one.
 *   2. Byte-capped. We read enough for the article, not the internet.
 *   3. SSRF-guarded, two layers. Every hop's resolved IP is checked against
 *      private ranges BEFORE we connect (connector lookup + per-hop pre-check,
 *      neither sufficient alone), and redirects are followed manually so a 302
 *      to 169.254.169.254 cannot smuggle us into a metadata endpoint.
 *   4. Jina Reader fallback when our own extraction yields nothing — a paywall
 *      or JS-only page the raw HTML can't give us.
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
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractResult {
  ok: boolean;
  title?: string;
  siteName?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
  /** Readability's cleaned article text, capped — feeds claims + embeddings. */
  articleText?: string;
  error?: string;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 1_500_000; // enough for the article body, not the whole site
const MAX_REDIRECTS = 5;
const MAX_ARTICLE_CHARS = 20_000; // cap what we keep from Readability

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

/** Expand any IPv6 textual form to its 8 numeric hextets. */
function hextets(ip: string): number[] | null {
  let s = ip.toLowerCase();
  // A trailing dotted-quad (::ffff:127.0.0.1) — rewrite it as two hextets.
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const q = dotted[2].split(".").map(Number);
    if (q.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
    s = `${dotted[1]}${((q[0] << 8) | q[1]).toString(16)}:${((q[2] << 8) | q[3]).toString(16)}`;
  }
  const [head, tail, ...extra] = s.split("::");
  if (extra.length > 0) return null;
  const parse = (part: string) =>
    part ? part.split(":").filter(Boolean).map((h) => parseInt(h, 16)) : [];
  const a = parse(head);
  const b = tail === undefined ? [] : parse(tail);
  if (tail === undefined) return a.length === 8 ? a : null;
  const fill = 8 - a.length - b.length;
  if (fill < 0) return null;
  const out = [...a, ...Array(fill).fill(0), ...b];
  return out.length === 8 && out.every((n) => !Number.isNaN(n) && n >= 0 && n <= 0xffff)
    ? out
    : null;
}

function isPrivateIPv6(ip: string): boolean {
  const h = hextets(ip);
  if (!h) return true; // unparseable → refuse

  // ::1 loopback and :: unspecified
  if (h.every((x, i) => (i < 7 ? x === 0 : true)) && (h[7] === 1 || h[7] === 0)) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 — check NUMERICALLY, not by text pattern.
  // The WHATWG URL parser canonicalises "[::ffff:127.0.0.1]" into
  // "[::ffff:7f00:1]" before any guard sees it, so a regex against the
  // dotted-decimal form never matches and the entire range walks straight
  // through. This bypass was live and reached an internal service.
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0) {
    // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (deprecated compatible)
    if (h[5] === 0xffff || h[5] === 0) {
      const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
      return isPrivateIPv4(v4);
    }
  }

  // NAT64 / well-known prefix 64:ff9b::/96 wrapping a private v4
  if (h[0] === 0x64 && h[1] === 0xff9b) {
    const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
    return isPrivateIPv4(v4);
  }

  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
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
/**
 * Node's LookupFunction contract is polymorphic: the CALLER decides whether it
 * wants a single address or an array, via `options.all`, and that in turn
 * depends on `autoSelectFamily`. Always forcing `all: true` internally and
 * always answering with an array works only by accident of today's Node
 * defaults — flip `autoSelectFamily` and Node throws ERR_INVALID_IP_ADDRESS,
 * which surfaces as a generic "unreachable" and silently disables enrichment
 * entirely. So: answer in the shape that was actually asked for.
 */
function guardedLookup(
  hostname: string,
  options: dns.LookupOneOptions | dns.LookupAllOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number,
  ) => void,
): void {
  const wantsAll = options?.all === true;
  dns.lookup(unbracket(hostname), { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, [], 0);
    if (addresses.length === 0) {
      return callback(new Error("could not resolve host"), [], 0);
    }
    // Refuse if ANY resolved address is private — never "trust the first one".
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        return callback(new Error("BLOCKED_PRIVATE_ADDRESS"), [], 0);
      }
    }
    if (wantsAll) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const safeAgent = new Agent({ connect: { lookup: guardedLookup } });

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
/**
 * `new URL("http://[::1]/").hostname` keeps the brackets, and getaddrinfo
 * cannot resolve "[::1]" — so every IPv6-literal URL died with "could not
 * resolve host" and the entire isPrivateIPv6 branch was unreachable. It failed
 * safe, but for the wrong reason, and a legitimate public IPv6 link could never
 * be enriched.
 */
function unbracket(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

async function assertPublicHost(rawHostname: string): Promise<string | null> {
  const hostname = unbracket(rawHostname);
  // A literal address needs no resolution — check it directly, since
  // dns.lookup on a bare IPv6 literal is not guaranteed across platforms.
  if (net.isIP(hostname)) {
    return isPrivateAddress(hostname) ? "refusing to fetch a private address" : null;
  }
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

const MAX_DOM_DEPTH = 250;

/**
 * Whether the REAL parsed tree nests past `limit`. Readability.parse() is cubic
 * in nesting depth, so a deep DOM is what hangs it.
 *
 * A regex tag-counter (the first, naive attempt) was defeated by two
 * characters: `<div></span>` — an unmatched `</span>` is ignored per the HTML5
 * "any other end tag" rule, so a name-blind counter decrements on it and
 * undercounts to "safe" while the real DOM stays 1500 deep. This walks the tree
 * linkedom already built, so it measures what Readability will actually
 * traverse. Iterative DFS with early-exit — O(nodes visited until the limit).
 */
function domDepthExceeds(root: unknown, limit: number): boolean {
  if (!root) return false;
  const stack: Array<{ el: { children?: ArrayLike<unknown> }; d: number }> = [
    { el: root as { children?: ArrayLike<unknown> }, d: 1 },
  ];
  while (stack.length) {
    const { el, d } = stack.pop()!;
    if (d > limit) return true;
    const kids = el.children;
    if (kids) {
      for (let i = 0; i < kids.length; i++) {
        stack.push({ el: kids[i] as { children?: ArrayLike<unknown> }, d: d + 1 });
      }
    }
  }
  return false;
}

/** Exported for tests: parse and check real DOM depth. Refuses unparseable input. */
export function htmlTooDeeplyNested(html: string, limit = MAX_DOM_DEPTH): boolean {
  try {
    const { document } = parseHTML(html);
    return domDepthExceeds(
      (document as unknown as { documentElement?: unknown }).documentElement,
      limit,
    );
  } catch {
    return true;
  }
}

function metaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return undefined;
}

/**
 * Jina Reader fallback (r.jina.ai). Jina fetches the URL server-side and
 * returns clean text, so it rescues JS-only and awkwardly-marked-up pages our
 * raw HTML read can't. The URL goes to a third party — acceptable for a link
 * the user deliberately captured. r.jina.ai is a fixed public host, so this
 * uses the plain fetch, not the SSRF dispatcher (which guards user-controlled
 * hosts, not this one).
 */
async function jinaFallback(url: string): Promise<ExtractResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { accept: "text/plain", "x-return-format": "text" },
    });
    if (!res.ok) return { ok: false, error: `jina: ${res.status}` };
    const text = (await res.text()).trim();
    if (!text) return { ok: false, error: "jina: empty" };
    // Jina prefixes "Title: ...\nURL Source: ...\nMarkdown Content:\n<body>".
    const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    const body = text
      .replace(/^Title:.*$/m, "")
      .replace(/^URL Source:.*$/m, "")
      .replace(/^Markdown Content:\s*/m, "")
      .replace(/\s+/g, " ")
      .trim();
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return undefined;
      }
    })();
    if (!titleLine && body.length < 200) return { ok: false, error: "jina: nothing usable" };
    return {
      ok: true,
      title: titleLine ?? host ?? "Untitled",
      siteName: host,
      articleText: body ? body.slice(0, MAX_ARTICLE_CHARS) : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "jina: timed out" : "jina: unreachable";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
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
      // Read the whole document (up to the cap), not just <head> — Readability
      // needs the body. The byte cap keeps a hostile giant page bounded.
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
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

    const author = metaContent(html, [
      /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const publishedAt = metaContent(html, [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<time[^>]+datetime=["']([^"']+)["']/i,
    ]);

    // Readability for the article body. Two dangers, both handled:
    //   - it can THROW on malformed DOM (caught below), and
    //   - it can HANG: Readability.parse() is cubic in DOM nesting depth, so a
    //     ~9KB page nested 1500-deep pinned a CPU for 21s and the 1.5MB cap
    //     allowed 300s+. The synchronous parse can't be interrupted in-thread
    //     (a worker with terminate() is the alternative, but a spawned worker
    //     file is fragile under serverless bundling), so we PREVENT the input:
    //     a cheap O(n) depth scan skips Readability on a pathological DOM,
    //     degrading to meta-only extraction — the citation still stands.
    let articleText: string | undefined;
    try {
      const { document } = parseHTML(html); // fast (~2-3ms) at any depth
      // Gate on the REAL parsed tree, not a regex approximation of it.
      if (
        !domDepthExceeds(
          (document as unknown as { documentElement?: unknown }).documentElement,
          MAX_DOM_DEPTH,
        )
      ) {
        const parsed = new Readability(document as unknown as Document).parse();
        const text = parsed?.textContent?.replace(/\s+/g, " ").trim();
        if (text && text.length > 200) articleText = text.slice(0, MAX_ARTICLE_CHARS);
      }
    } catch {
      articleText = undefined; // body extraction is a bonus, never load-bearing
    }

    if (!title) {
      // Our own read gave nothing usable — try Jina Reader as a fallback for
      // JS-only or awkward pages. This sends the URL to a third party, which is
      // acceptable for a link the user chose to capture.
      const viaJina = await jinaFallback(current.toString());
      if (viaJina.ok) return viaJina;
      return { ok: false, siteName, error: "no title found" };
    }
    return { ok: true, title, siteName, description, author, publishedAt, articleText };
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
