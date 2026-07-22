// ============================================================
// KAVACH — Gemini Risk Intelligence Agent
// Processes raw news/scenario text and returns structured
// JSON threat assessment using Google Gemini API.
// ============================================================

import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, GEMINI_API_KEY, ThreatLevel } from "@/lib/config";
import networkData from "@/data/network.json";

// ── Supplier node list helper ──────────────────────────────────

/**
 * Returns the current list of supplier node labels from network.json.
 * Injected into the Gemini prompt so recommendations are always
 * grounded in the actual graph — never hallucinated.
 */
export function getAvailableSupplierNames(): string[] {
  return (networkData.nodes as Array<{ type: string; label: string }>)
    .filter((n) => n.type === "supplier")
    .map((n) => n.label);
}

// ── Output Schema ─────────────────────────────────────────────

export interface RiskAssessment {
  impacted_chokepoint:
    | "Strait_of_Hormuz"
    | "Bab_el_Mandeb"
    | "Suez_Canal"
    | "Cape_of_Good_Hope"
    | "Multiple"
    | "None";
  threat_level: ThreatLevel;
  risk_score: number; // 0.0 – 1.0
  event_summary: string;
  recommended_action: string;
  affected_suppliers: string[];
  estimated_disruption_days: number;
  india_impact_severity: "MINIMAL" | "MODERATE" | "SEVERE" | "CRISIS";
}

// ── Prompt Template ───────────────────────────────────────────

function buildPrompt(newsText: string, availableSuppliers?: string[]): string {
  const supplierList = availableSuppliers?.join(", ") ??
    "Saudi Arabia (Ras Tanura), UAE (Das Island), Russia (Novorossiysk), Iraq (Basra Terminal), Nigeria (Bonny Terminal), Angola (Cabinda/Nemba Terminal), USA (Houston/Corpus Christi)";

  return `You are KAVACH, an AI risk analyst for India's energy security command center.

Analyze the following news/scenario and extract structured intelligence about its impact on India's crude oil supply chain.

India imports 88% of its crude oil. Key chokepoints:
- Strait of Hormuz: ~42.5% of India's oil transits here
- Bab-el-Mandeb / Red Sea: Alternative route, Houthi threat zone
- Suez Canal: Egypt shortcut, can be blocked
- Cape of Good Hope: Fallback bypass route (+12 days)

Currently modeled suppliers (ONLY use these in your recommendations):
${supplierList}

Main Indian refineries: Jamnagar (Reliance, 1.24M BPD), MRPL Mangalore (300K BPD), IOCL Koyali (274K BPD)

NEWS/SCENARIO:
"""
${newsText}
"""

Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "impacted_chokepoint": "<Strait_of_Hormuz|Bab_el_Mandeb|Suez_Canal|Cape_of_Good_Hope|Multiple|None>",
  "threat_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "risk_score": <0.0 to 1.0>,
  "event_summary": "<2-3 sentence summary of the event and its direct impact on India>",
  "recommended_action": "<specific actionable recommendation for India's energy ministry, referencing ONLY the suppliers listed above>",
  "affected_suppliers": ["<supplier name from the list above>"],
  "estimated_disruption_days": <integer 0-180>,
  "india_impact_severity": "<MINIMAL|MODERATE|SEVERE|CRISIS>"
}`;
}

// ── Risk Parser Agent ─────────────────────────────────────────

export async function parseRiskFromNews(
  newsText: string
): Promise<RiskAssessment> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local file."
    );
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Inject live supplier list into prompt
  const availableSuppliers = getAvailableSupplierNames();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(newsText, availableSuppliers),
    config: {
      temperature: 0.1, // Low temperature for deterministic structured output
      maxOutputTokens: 1024,
    },
  });

  const rawText = response.text ?? "";

  // Extract JSON from response (handles cases where model adds markdown fences)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Gemini returned non-JSON response: ${rawText}`);
  }

  let parsed: RiskAssessment;
  try {
    parsed = JSON.parse(jsonMatch[0]) as RiskAssessment;
  } catch (e) {
    throw new Error(`Failed to parse Gemini JSON: ${jsonMatch[0]}`);
  }

  // Validate and clamp risk_score
  parsed.risk_score = Math.min(1, Math.max(0, parsed.risk_score ?? 0));

  // Ensure estimated_disruption_days is a number
  if (typeof parsed.estimated_disruption_days !== "number") {
    parsed.estimated_disruption_days = 0;
  }

  return parsed;
}

// ── Executive Brief Generator ─────────────────────────────────

export async function generateExecutiveBrief(params: {
  scenarioId: string;
  riskAssessment: RiskAssessment;
  supplyDeficitPct: number;
  activeBPD: number;
  sprRemainingDays: number;
  avgRerouteCostIncrease: number;
  fuelPriceSpikeLabel: string;
  gdpLossLabel: string;
}): Promise<string> {
  if (!GEMINI_API_KEY) {
    return generateFallbackBrief(params);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `You are KAVACH, India's AI energy security analyst. Write a concise, high-stakes executive brief for senior policy makers.

SCENARIO: ${params.scenarioId.replace(/_/g, " ")}
THREAT LEVEL: ${params.riskAssessment.threat_level}
RISK SCORE: ${(params.riskAssessment.risk_score * 100).toFixed(0)}%
IMPACTED CHOKEPOINT: ${params.riskAssessment.impacted_chokepoint.replace(/_/g, " ")}

SUPPLY METRICS:
- Supply Deficit: ${(params.supplyDeficitPct * 100).toFixed(1)}% of daily demand
- Active Supply: ${(params.activeBPD / 1_000_000).toFixed(2)}M BPD flowing
- SPR Cover Remaining: ~${params.sprRemainingDays.toFixed(1)} days
- Rerouting Cost Increase: +$${params.avgRerouteCostIncrease}/barrel

ECONOMIC IMPACT:
- Domestic Fuel Price Spike: ${params.fuelPriceSpikeLabel}
- Daily GDP Loss Estimate: ${params.gdpLossLabel}

AI RECOMMENDED ACTION: ${params.riskAssessment.recommended_action}

Write a 200-250 word executive brief with:
1. SITUATION ASSESSMENT (2-3 sentences)
2. SUPPLY CHAIN STATUS (what's blocked, what's rerouted)
3. ECONOMIC RISK WINDOW (SPR timeline, cost)
4. RECOMMENDED RESPONSE ACTIONS (3 bullet points)
5. STRATEGIC OUTLOOK (1 closing sentence)

Use crisp, ministerial-level language. Be direct and data-driven.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.4,
      maxOutputTokens: 512,
    },
  });

  return response.text ?? generateFallbackBrief(params);
}

// ── Fallback Brief (no API key) ───────────────────────────────

function generateFallbackBrief(params: {
  scenarioId: string;
  riskAssessment: RiskAssessment;
  supplyDeficitPct: number;
  activeBPD: number;
  sprRemainingDays: number;
  avgRerouteCostIncrease: number;
  fuelPriceSpikeLabel: string;
  gdpLossLabel: string;
}): string {
  return `## KAVACH Executive Brief — ${params.scenarioId.replace(/_/g, " ")}

**SITUATION ASSESSMENT**
A ${params.riskAssessment.threat_level} threat has been detected at the ${params.riskAssessment.impacted_chokepoint.replace(/_/g, " ")}. The risk score is ${(params.riskAssessment.risk_score * 100).toFixed(0)}%, indicating ${params.riskAssessment.india_impact_severity} impact severity for India's energy security.

**SUPPLY CHAIN STATUS**
Active import supply stands at ${(params.activeBPD / 1_000_000).toFixed(2)}M BPD — a ${(params.supplyDeficitPct * 100).toFixed(1)}% deficit from baseline demand. Alternate routing via Cape of Good Hope is being evaluated, adding $${params.avgRerouteCostIncrease.toFixed(2)}/barrel in logistics cost.

**ECONOMIC RISK WINDOW**
With SPR cover at approximately ${params.sprRemainingDays.toFixed(1)} days, the economic pressure window is narrow. Domestic fuel prices are projected to spike ${params.fuelPriceSpikeLabel} under current supply conditions. Estimated daily GDP friction: ${params.gdpLossLabel}.

**RECOMMENDED ACTIONS**
• Activate SPR drawdown protocol for Vizag and Padur reserves immediately
• Authorize emergency procurement from West African (Nigeria) and Latin American (Venezuela) suppliers
• Expedite diplomatic clearance for Cape of Good Hope bypass routing

**STRATEGIC OUTLOOK**
${params.riskAssessment.recommended_action}`;
}
