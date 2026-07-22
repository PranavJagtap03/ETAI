// ============================================================
// KAVACH — Live News Feed Module
// Fetches real-world maritime/energy articles from:
//   Primary:   GDELT DOC 2.0 API (no auth required)
//   Secondary: NewsAPI.org (optional NEWSAPI_KEY env var)
// Deduplicates, pre-filters, and caches results to avoid
// hammering external APIs on every render.
// ============================================================

import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// ── Types ────────────────────────────────────────────────────

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO string
  description?: string;
  provider: "gdelt" | "newsapi";
}

// ── Constants ─────────────────────────────────────────────────

const CACHE_FILE = path.join(process.cwd(), "src/data/news_cache.json");
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Chokepoint / tanker attack keywords — queries both sources
const QUERY_KEYWORDS = [
  "Strait of Hormuz",
  "Bab-el-Mandeb",
  "Houthi",
  "Suez Canal",
  "tanker attack",
  "Red Sea shipping",
  "Ras Tanura",
  "Novorossiysk export",
  "crude oil disruption",
];

// Pre-filter relevance keywords (cheap check before Gemini call)
const RELEVANCE_KEYWORDS = [
  "hormuz", "bab", "mandeb", "houthi", "suez", "tanker",
  "crude", "oil", "ras tanura", "novorossiysk", "red sea",
  "shipping", "disruption", "attack", "blockade", "chokepoint",
  "persian gulf", "arabian sea", "india", "refinery",
];

// ── Cache helpers ─────────────────────────────────────────────

interface NewsCache {
  cachedAt: number;
  articles: RawArticle[];
}

function readCache(): NewsCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const stats = fs.statSync(CACHE_FILE);
    if (Date.now() - stats.mtimeMs > CACHE_DURATION_MS) return null;
    const content = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(content) as NewsCache;
  } catch {
    return null;
  }
}

function writeCache(articles: RawArticle[]): void {
  try {
    const cache: NewsCache = { cachedAt: Date.now(), articles };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (err) {
    console.error("[KAVACH] Failed to write news cache:", err);
  }
}

// ── GDELT DOC 2.0 Fetcher (no auth required) ─────────────────

export async function fetchGdeltArticles(hoursBack: number = 6): Promise<RawArticle[]> {
  try {
    const query = encodeURIComponent(
      QUERY_KEYWORDS.slice(0, 5).join(" OR ")
    );
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}` +
      `&mode=artlist&maxrecords=25&format=json&timespan=${hoursBack}h` +
      `&sort=datedesc&sourcelang=english`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "KAVACH-EnergySecurityPlatform/1.0" },
    });

    if (!res.ok) {
      console.error(`[KAVACH] GDELT returned ${res.status}`);
      return [];
    }

    const json = await res.json();
    const articles: GdeltArticle[] = json.articles ?? [];

    return articles.map((a) => ({
      title: a.title ?? "",
      url: a.url ?? "",
      source: a.domain ?? "GDELT",
      publishedAt: a.seendate
        ? parseGdeltDate(a.seendate)
        : new Date().toISOString(),
      description: a.title ?? "",
      provider: "gdelt" as const,
    }));
  } catch (err) {
    console.error("[KAVACH] GDELT fetch error:", err);
    return [];
  }
}

interface GdeltArticle {
  url?: string;
  title?: string;
  domain?: string;
  seendate?: string; // YYYYMMDDTHHMMSSZ
}

function parseGdeltDate(gdeltDate: string): string {
  // Format: "20240715T143000Z" → ISO
  try {
    const y = gdeltDate.slice(0, 4);
    const mo = gdeltDate.slice(4, 6);
    const d = gdeltDate.slice(6, 8);
    const h = gdeltDate.slice(9, 11);
    const mi = gdeltDate.slice(11, 13);
    const s = gdeltDate.slice(13, 15);
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ── NewsAPI.org Fetcher (optional NEWSAPI_KEY) ────────────────

export async function fetchNewsApiArticles(hoursBack: number = 6): Promise<RawArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey || apiKey === "your_newsapi_key_here") {
    // Graceful skip — not a hard failure
    return [];
  }

  try {
    const from = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
    const q = encodeURIComponent(
      "Hormuz OR Bab-el-Mandeb OR Houthi OR Suez OR tanker OR \"crude oil\""
    );
    const url =
      `https://newsapi.org/v2/everything?q=${q}&from=${from}` +
      `&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.error(`[KAVACH] NewsAPI returned ${res.status}`);
      return [];
    }

    const json = await res.json();
    const articles: NewsApiArticle[] = json.articles ?? [];

    return articles.map((a) => ({
      title: a.title ?? "",
      url: a.url ?? "",
      source: a.source?.name ?? "NewsAPI",
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      description: a.description ?? a.title ?? "",
      provider: "newsapi" as const,
    }));
  } catch (err) {
    console.error("[KAVACH] NewsAPI fetch error:", err);
    return [];
  }
}

interface NewsApiArticle {
  title?: string;
  url?: string;
  source?: { name?: string };
  publishedAt?: string;
  description?: string;
}

// ── Deduplication ─────────────────────────────────────────────

export function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: RawArticle[] = [];

  for (const article of articles) {
    const normUrl = article.url.toLowerCase().split("?")[0];
    const normTitle = article.title.toLowerCase().slice(0, 60);

    if (seenUrls.has(normUrl) || seenTitles.has(normTitle)) continue;
    if (!article.url || !article.title || article.title === "[Removed]") continue;

    seenUrls.add(normUrl);
    seenTitles.add(normTitle);
    result.push(article);
  }

  return result;
}

// ── Pre-filter (cheap relevance check before Gemini) ─────────

/**
 * Returns a relevance score 0.0–1.0 based on keyword matches in
 * title + description. Articles below 0.2 are skipped to avoid
 * burning Gemini quota on low-signal content.
 */
export function relevanceScore(article: RawArticle): number {
  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();
  const hits = RELEVANCE_KEYWORDS.filter((kw) => text.includes(kw)).length;
  return Math.min(1, hits / 4); // 4 hits = score 1.0
}

export const RELEVANCE_THRESHOLD = 0.2;

// ── Main orchestrator ─────────────────────────────────────────

/**
 * Fetch, merge, dedup, and return all candidate articles.
 * Uses file cache with 30-minute TTL to avoid hammering external APIs.
 *
 * @param hoursBack  How far back to look for articles (default 6h)
 * @param forceRefresh  Bypass cache and fetch fresh
 */
export async function getLatestArticles(
  hoursBack: number = 6,
  forceRefresh = false
): Promise<RawArticle[]> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      console.log("[KAVACH] Serving news from cache");
      return cached.articles;
    }
  }

  console.log("[KAVACH] Fetching fresh news articles…");

  const [gdelt, newsapi] = await Promise.all([
    fetchGdeltArticles(hoursBack),
    fetchNewsApiArticles(hoursBack),
  ]);

  const merged = deduplicateArticles([...gdelt, ...newsapi]);

  // Sort by publishedAt descending
  merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  writeCache(merged);
  return merged;
}
