// ============================================================
// KAVACH — News Ingestion API Route
// POST /api/ingestion/news
// Accepts raw news text → runs Gemini risk analysis → returns
// structured threat intelligence JSON.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { parseRiskFromNews } from "@/lib/agents/riskParser";
import { SCENARIOS } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { news, scenarioId } = body as {
      news?: string;
      scenarioId?: string;
    };

    // If a scenario ID is provided, use pre-defined scenario description
    let newsText = news;
    if (!newsText && scenarioId && scenarioId in SCENARIOS) {
      const scenario = SCENARIOS[scenarioId as keyof typeof SCENARIOS];
      newsText = `SCENARIO ALERT: ${scenario.label}. ${scenario.description} Threat level: ${scenario.threat_level}. Risk score: ${scenario.risk_score}.`;
    }

    if (!newsText || newsText.trim().length < 10) {
      return NextResponse.json(
        { error: "Provide either a 'news' string or a valid 'scenarioId'" },
        { status: 400 }
      );
    }

    const assessment = await parseRiskFromNews(newsText);

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        source: news ? "user_input" : "scenario_preset",
        assessment,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error("[KAVACH] News ingestion error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
