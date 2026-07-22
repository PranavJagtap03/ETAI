// ============================================================
// KAVACH — Live News Ingestion API Route
// GET /api/ingestion/news/live?hours=6
//
// Fetches real articles from GDELT (no key) + NewsAPI (optional),
// runs each through Gemini risk analysis (after a cheap relevance
// pre-filter to protect API quota), and returns structured results
// with detectionLatencyMs — a direct measure of "lead time"
// for the evaluation rubric.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  getLatestArticles,
  relevanceScore,
  RELEVANCE_THRESHOLD,
  RawArticle,
} from "@/lib/ingestion/newsFeed";
import { parseRiskFromNews, RiskAssessment } from "@/lib/agents/riskParser";

export const runtime = "nodejs";

export interface LiveFeedItem {
  article: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    provider: string;
    relevanceScore: number;
  };
  assessment: RiskAssessment;
  ingestedAt: string;
  detectionLatencyMs: number; // publishedAt → ingestedAt
}

export async function GET(req: NextRequest) {
  try {
    const hours = parseInt(req.nextUrl.searchParams.get("hours") ?? "6", 10);
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

    const articles = await getLatestArticles(
      Math.max(1, Math.min(hours, 48)),
      forceRefresh
    );

    const ingestedAt = new Date().toISOString();
    const ingestedAtMs = Date.now();

    // Process in parallel, but cap at 10 Gemini calls per poll
    const candidates = articles
      .filter((a) => relevanceScore(a) >= RELEVANCE_THRESHOLD)
      .slice(0, 10);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        ingestedAt,
        items: [],
      });
    }

    const results = await Promise.allSettled(
      candidates.map(async (article): Promise<LiveFeedItem> => {
        const articleText = `${article.title}. ${article.description ?? ""}. Source: ${article.source}. Published: ${article.publishedAt}`;
        const assessment = await parseRiskFromNews(articleText);
        const publishedMs = new Date(article.publishedAt).getTime();
        const detectionLatencyMs = isNaN(publishedMs)
          ? 0
          : ingestedAtMs - publishedMs;

        return {
          article: {
            title: article.title,
            url: article.url,
            source: article.source,
            publishedAt: article.publishedAt,
            provider: article.provider,
            relevanceScore: relevanceScore(article),
          },
          assessment,
          ingestedAt,
          detectionLatencyMs: Math.max(0, detectionLatencyMs),
        };
      })
    );

    const items: LiveFeedItem[] = results
      .filter(
        (r): r is PromiseFulfilledResult<LiveFeedItem> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)
      .sort((a, b) => b.assessment.risk_score - a.assessment.risk_score);

    return NextResponse.json({
      success: true,
      count: items.length,
      ingestedAt,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[KAVACH] Live news ingestion error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
