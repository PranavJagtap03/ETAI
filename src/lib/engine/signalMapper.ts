// ============================================================
// KAVACH — Signal Mapper
// Translates a RiskAssessment.impacted_chokepoint value into
// the actual blocked_nodes[] IDs used by network.json /
// the Digital Twin, so a live news signal can feed directly
// into the rerouter without human intervention.
// ============================================================

import type { RiskAssessment } from "@/lib/agents/riskParser";

// ── Chokepoint → Node ID map ─────────────────────────────────

const CHOKEPOINT_NODE_MAP: Record<string, string[]> = {
  Strait_of_Hormuz: ["strait_of_hormuz"],
  Bab_el_Mandeb: ["bab_el_mandeb"],
  Suez_Canal: ["suez_canal"],
  // Cape of Good Hope is the fallback route — blockage is not modeled
  Cape_of_Good_Hope: [],
  // Multiple: block both primary chokepoints
  Multiple: ["strait_of_hormuz", "bab_el_mandeb"],
  None: [],
};

// ── Keyword hints for "Multiple" disambiguation ──────────────
// If the event_summary mentions only one specific chokepoint,
// we can narrow "Multiple" to just that one set.

const SUMMARY_HINTS: Array<{ keywords: string[]; nodes: string[] }> = [
  {
    keywords: ["hormuz", "persian gulf", "ras tanura", "das island"],
    nodes: ["strait_of_hormuz"],
  },
  {
    keywords: ["bab", "mandeb", "red sea", "houthi", "aden", "hodeidah"],
    nodes: ["bab_el_mandeb"],
  },
  {
    keywords: ["suez", "egypt", "mediterranean"],
    nodes: ["suez_canal"],
  },
];

// ── Main mapping function ─────────────────────────────────────

/**
 * Derive the list of blocked node IDs from a structured RiskAssessment.
 *
 * Rules:
 *  1. Use CHOKEPOINT_NODE_MAP as the primary lookup.
 *  2. For "Multiple", scan event_summary + affected_suppliers for
 *     keyword hints to see if we can be more precise; fall back to
 *     ["strait_of_hormuz", "bab_el_mandeb"] if ambiguous.
 *  3. "None" / "Cape_of_Good_Hope" → [] (baseline, no blockage).
 *
 * @param assessment  Structured risk output from parseRiskFromNews
 * @returns           Array of node IDs to pass to rerouter.computeRerouting()
 */
export function chokepointToNodeIds(assessment: RiskAssessment): string[] {
  const cp = assessment.impacted_chokepoint;

  // Fast-path: known static mapping
  if (cp !== "Multiple") {
    return CHOKEPOINT_NODE_MAP[cp] ?? [];
  }

  // "Multiple" — try to narrow down via event text
  const textToScan = [
    assessment.event_summary ?? "",
    assessment.recommended_action ?? "",
    ...(assessment.affected_suppliers ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const matchedNodes = new Set<string>();

  for (const hint of SUMMARY_HINTS) {
    if (hint.keywords.some((kw) => textToScan.includes(kw))) {
      hint.nodes.forEach((n) => matchedNodes.add(n));
    }
  }

  // If we found specific nodes via hints, use those; otherwise fall back
  return matchedNodes.size > 0
    ? Array.from(matchedNodes)
    : (CHOKEPOINT_NODE_MAP["Multiple"] as string[]);
}

/**
 * Returns a human-readable label for a dynamic scenario derived from a
 * RiskAssessment, suitable for display in the UI.
 */
export function buildDynamicScenarioLabel(assessment: RiskAssessment): string {
  const cp = assessment.impacted_chokepoint.replace(/_/g, " ");
  return `Live Signal: ${cp} — ${assessment.threat_level}`;
}
