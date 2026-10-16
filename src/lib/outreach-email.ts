// Outreach: finding a business's PUBLIC contact email. Server only.
// Order: the email OpenStreetMap already has -> their own website (homepage + up to 2 contact
// pages) -> a Tavily web search (only if the monthly guard allows). Only public business contact
// info; social media sites are never fetched (their links are kept as fallbacks).

import { lookup } from "node:dns/promises";
import net from "node:net";
import { USER_AGENT } from "./outreach-osm";

const MAX_BYTES = 500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
export const MAX_PAGES = 3;

// ---------- Safe fetching (blocks localhost, private and link-local addresses) ----------

export class BlockedUrl extends Error {}

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 || // this-network, private, loopback, multicast/reserved
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local (cloud metadata lives here)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // 192.0.0.0/24 and 192.0.2.0/24
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}

function ipv6Private(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  const mapped = s.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s) || s.startsWith("2001:db8");
}

export function isPrivateAddress(ip: string): boolean {
  return net.isIPv4(ip) ? ipv4Private(ip) : net.isIPv6(ip) ? ipv6Private(ip) : true;
}

/** Throws BlockedUrl unless the URL is public http(s) on a normal port and resolves only to public addresses. */
export async function checkUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrl("not a web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrl("only http and https");
  if (url.username || url.password) throw new BlockedUrl("no logins in addresses");
  if (url.port && url.port !== "80" && url.port !== "443") throw new BlockedUrl("unusual port");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host) || !host.includes(".") && !net.isIP(host))
    throw new BlockedUrl("private host name");
  const addresses = net.isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new BlockedUrl("address not found");
  if (addresses.some(isPrivateAddress)) throw new BlockedUrl("private address");
  return url;
}

/** GET a public web page: checked address, at most 3 redirects (each checked), 8s, ~500KB, HTML/text only. */
export async function safeFetch(raw: string): Promise<{ url: string; html: string }> {
  let current = await checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location || hop === MAX_REDIRECTS) throw new BlockedUrl("too many redirects");
      current = await checkUrl(new URL(location, current).toString());
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`HTTP ${res.status}`);
    }
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      await res.body?.cancel();
      throw new Error("not a web page");
    }
    return { url: current.toString(), html: await readCapped(res) };
  }
  throw new BlockedUrl("too many redirects");
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const all = new Uint8Array(Math.min(size, MAX_BYTES));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, all.length - at));
    all.set(part, at);
    at += part.length;
    if (at >= all.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

// ---------- Finding and choosing emails ----------

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
const JUNK_DOMAINS =
  /(^|\.)(example\.(com|org|net)|domain\.com|email\.com|yourdomain\.com|yoursite\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|wix\.com|squarespace\.com|godaddy\.com|schema\.org|w3\.org|wordpress\.(com|org)|sentry\.wixpress\.com|mysite\.com|test\.com)$/i;
const JUNK_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|abuse|root|webmaster|example|your-?email|name|user|test|email)$/i;
const FILE_LIKE = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mp4|webm|pdf)$/i;

/** False for placeholders, system addresses, tracking ids and image file names. */
export function isGoodEmail(raw: string): boolean {
  const email = raw.toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  if (FILE_LIKE.test(email) || /@\d+x\./.test(email) || /@2x/.test(email)) return false;
  if (JUNK_DOMAINS.test(domain) || JUNK_LOCAL.test(local)) return false;
  if (/^[a-f0-9]{16,}$/.test(local)) return false; // tracking / error-reporting ids
  if (local.length > 64 || email.length > 254) return false;
  return true;
}

function decodeEntities(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

export type FoundEmail = { email: string; mailto: boolean };

/**
 * Only what a visitor can see (plus the business details some sites add for search engines).
 * Style code, scripts and hidden comments carry addresses that aren't the business's, like a
 * font designer's email in a font license.
 */
export function visibleHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, " ")
    .replace(/<(noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ");
}

/** Emails from mailto: links and email-shaped text (also "name [at] site [dot] com"). */
export function extractEmails(html: string): FoundEmail[] {
  const text = decodeEntities(visibleHtml(html));
  const found = new Map<string, FoundEmail>();
  for (const m of text.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    let e = m[1];
    try {
      e = decodeURIComponent(e);
    } catch {
      /* keep as is */
    }
    e = e.trim().toLowerCase();
    if (EMAIL.test(e) && isGoodEmail(e)) found.set(e, { email: e, mailto: true });
    EMAIL.lastIndex = 0;
  }
  const deobfuscated = text.replace(/\s*[[(]\s*at\s*[\])]\s*/gi, "@").replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, ".");
  for (const m of deobfuscated.matchAll(EMAIL)) {
    const e = m[0].toLowerCase();
    if (isGoodEmail(e) && !found.has(e)) found.set(e, { email: e, mailto: false });
  }
  return [...found.values()];
}

const baseDomain = (host: string) => host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");

/** Higher is better: same domain as their website, then info@/hello@/contact@, then from a mailto link. */
export function scoreEmail(e: FoundEmail, siteHost: string | null): number {
  const [local, domain] = e.email.split("@");
  let score = 0;
  if (siteHost && baseDomain(domain) === baseDomain(siteHost)) score += 5;
  if (/^(info|hello|hi|contact|booking|bookings|book|reservations|appointments|studio|shop|team|office)$/.test(local)) score += 2;
  if (/^(marketing|press|media|pr|jobs|careers|hr|billing|accounts|invoices|sales|admin|support|privacy|legal|webmaster)$/.test(local)) score -= 2;
  if (e.mailto) score += 1;
  return score;
}

export function bestEmail(found: FoundEmail[], siteHost: string | null): FoundEmail | null {
  return [...found].sort((a, b) => scoreEmail(b, siteHost) - scoreEmail(a, siteHost))[0] ?? null;
}

/** Up to 2 likely contact pages on the same site: links that say "contact", then /contact, /contact-us, /about. */
export function contactPages(html: string, base: string): string[] {
  const origin = new URL(base);
  const out: string[] = [];
  const add = (href: string) => {
    try {
      const u = new URL(href, origin);
      if (u.hostname.replace(/^www\./, "") !== origin.hostname.replace(/^www\./, "")) return;
      u.hash = "";
      const s = u.toString();
      if (s !== origin.toString() && !out.includes(s)) out.push(s);
    } catch {
      /* skip bad links */
    }
  };
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, " ");
    if (/contact|get in touch|reach us/i.test(text) || /\/contact/i.test(m[1])) add(m[1]);
  }
  for (const path of ["/contact", "/contact-us", "/about"]) add(path);
  return out.slice(0, 2);
}

// ---------- Tavily (only when the website gave nothing; guarded to 900 a month for everyone) ----------

const NOT_THEIR_SITE =
  /(^|\.)(yelp|tripadvisor|facebook|instagram|google|goo\.gl|yellowpages|bbb|mapquest|foursquare|opentable|doordash|ubereats|grubhub|seamless|tiktok|twitter|x|linkedin|nextdoor|wikipedia|groupon|zomato|restaurantguru|menupix|allmenus|chamberofcommerce|manta|bizapedia|patch|nj|loopnet|zillow|angi|thumbtack|booksy|vagaro|mindbody|styleseat|apple|bing|yahoo|youtube|pinterest|reddit|sirved|menuweb|waze|birdeye|toasttab|order\.online|beyondmenu)\.[a-z.]+$/i;

export type TavilyResult = { url: string; title: string; content: string };

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("no tavily key");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 5 }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const json = (await res.json()) as { results?: TavilyResult[] };
  return (json.results ?? []).filter((r) => typeof r.url === "string");
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4);

/** The first result that looks like the business's own website (not a directory or social site). */
export function ownSiteFrom(results: TavilyResult[], name: string): string | null {
  const nameWords = words(name);
  for (const r of results) {
    try {
      const u = new URL(r.url);
      if (NOT_THEIR_SITE.test(u.hostname)) continue;
      const host = u.hostname.toLowerCase();
      const title = r.title?.toLowerCase() ?? "";
      if (nameWords.some((w) => host.includes(w) || title.includes(w))) return `${u.protocol}//${u.hostname}/`;
    } catch {
      /* skip */
    }
  }
  return null;
}

export const socialLinks = (results: TavilyResult[]) => ({
  instagram: results.find((r) => /(^|\.)instagram\.com$/i.test(new URL(r.url).hostname))?.url ?? null,
  facebook: results.find((r) => /(^|\.)facebook\.com$/i.test(new URL(r.url).hostname))?.url ?? null,
});

// ---------- The lookup ----------

export type LookupResult = {
  email: string | null;
  emailSource: string | null;
  website: string | null;
  contactPage: string | null;
  instagram: string | null;
  facebook: string | null;
  pagesFetched: number;
  usedTavily: boolean;
};

/** Steps 2 and 3 (step 1, an email from the map, is handled before this). */
export async function lookupEmail(
  lead: { name: string; website: string | null; instagram: string | null; facebook: string | null; town: string },
  claimTavily: () => Promise<boolean>,
  /** skipWebsite: their website was already checked recently, go straight to the web search */
  opts: { skipWebsite?: boolean } = {},
): Promise<LookupResult> {
  const out: LookupResult = { email: null, emailSource: null, website: lead.website, contactPage: null, instagram: lead.instagram, facebook: lead.facebook, pagesFetched: 0, usedTavily: false };

  const scanSite = async (site: string) => {
    let home: { url: string; html: string };
    try {
      if (out.pagesFetched >= MAX_PAGES) return;
      out.pagesFetched++;
      home = await safeFetch(site);
    } catch {
      return;
    }
    const host = new URL(home.url).hostname;
    let best = bestEmail(extractEmails(home.html), host);
    let source = home.url;
    const pages = contactPages(home.html, home.url);
    out.contactPage = out.contactPage ?? pages[0] ?? null;
    // Stop at a good email on their own domain; otherwise try the contact pages.
    if (!best || scoreEmail(best, host) < 5) {
      for (const page of pages) {
        if (out.pagesFetched >= MAX_PAGES) break;
        out.pagesFetched++;
        try {
          const p = await safeFetch(page);
          const candidate = bestEmail(extractEmails(p.html), host);
          if (candidate && (!best || scoreEmail(candidate, host) > scoreEmail(best, host))) {
            best = candidate;
            source = p.url;
            out.contactPage = p.url;
          }
          if (best && scoreEmail(best, host) >= 5) break;
        } catch {
          /* page missing or blocked: try the next one */
        }
      }
    }
    if (best) {
      out.email = best.email;
      out.emailSource = source;
    }
  };

  if (out.website && !opts.skipWebsite) await scanSite(out.website);

  if (!out.email && (await claimTavily())) {
    out.usedTavily = true;
    try {
      const results = await tavilySearch(`"${lead.name}" ${lead.town} email`);
      const social = socialLinks(results);
      out.instagram = out.instagram ?? social.instagram;
      out.facebook = out.facebook ?? social.facebook;
      const site = out.website ? null : ownSiteFrom(results, lead.name);
      // Emails in the search snippets, preferring ones on the business's own domain.
      const siteHost = site ? new URL(site).hostname : out.website ? new URL(out.website).hostname : null;
      const fromSnippets = results.flatMap((r) => extractEmails(`${r.title} ${r.content}`).map((e) => ({ ...e, url: r.url })));
      const pick = bestEmail(fromSnippets, siteHost) as (FoundEmail & { url: string }) | null;
      if (pick && (!siteHost || scoreEmail(pick, siteHost) >= 0)) {
        out.email = pick.email;
        out.emailSource = pick.url;
      }
      if (site) {
        out.website = site;
        if (!out.email) await scanSite(site);
      }
    } catch (error) {
      console.error("outreach: tavily failed", error instanceof Error ? error.message.slice(0, 40) : "unknown");
    }
  }
  return out;
}
