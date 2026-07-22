// ============================================================
// KAVACH — Full Scenario Simulation API Route
// POST /api/engine/simulate
//
// Accepts two modes:
//   "preset"  — one of 5 hardcoded ScenarioIds (unchanged)
//   "dynamic" — raw blocked_nodes[] derived from a live
//               RiskAssessment via signalMapper.ts
//
// Also accepts optional assumptionOverrides to override the
// default simulation constants for sensitivity testing.
//
// Returns signalToRecommendationMs and sensitivityBand.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { DigitalTwin } from "@/lib/engine/digitalTwin";
import { Rerouter, RouteOption } from "@/lib/engine/rerouter";
import { SPRSimulator } from "@/lib/engine/sprSimulator";
import { MacroImpactCalculator } from "@/lib/engine/macroImpact";
import { SCENARIOS, ScenarioId, ThreatLevel } from "@/lib/config";

export const runtime = "nodejs";

// ── Input types ──────────────────────────────────────────────

interface AssumptionOverrides {
  rerouteRecoveryPct?: number;          // default 0.60
  domesticProductionPct?: number;       // default 0.12
  gdpFrictionUsdPerBarrel?: number;     // default 42
  fuelPriceSpikeMultiplier?: number;    // default 1.45
  refineryRunrateMultiplier?: number;   // default 0.85
}

interface DynamicInput {
  blocked_nodes: string[];
  risk_score: number;
  threat_level: ThreatLevel;
  label: string;
  description: string;
  source_article_url?: string;
}

interface SimulateRequestBody {
  mode?: "preset" | "dynamic";
  scenarioId?: ScenarioId;
  dynamicInput?: DynamicInput;
  assumptionOverrides?: AssumptionOverrides;
  signalTimestamp?: number; // ms since epoch — when RiskAssessment was produced
}

// ── Route handlers ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestReceivedAt = Date.now();

  try {
    const body = (await req.json()) as SimulateRequestBody;
    const mode = body.mode ?? "preset";

    // ── Resolve scenario parameters ─────────────────────────
    let scenarioId: string;
    let blockedNodes: string[];
    let scenarioMeta: {
      label: string;
      description: string;
      threat_level: ThreatLevel;
      risk_score: number;
      blocked_nodes: string[];
      source_article_url?: string;
    };

    if (mode === "preset") {
      const sid = body.scenarioId;
      if (!sid || !(sid in SCENARIOS)) {
        return NextResponse.json(
          {
            error: `Invalid scenarioId. Valid options: ${Object.keys(SCENARIOS).join(", ")}`,
          },
          { status: 400 }
        );
      }
      const scenario = SCENARIOS[sid];
      scenarioId = sid;
      blockedNodes = [...scenario.blocked_nodes];
      scenarioMeta = {
        label: scenario.label,
        description: scenario.description,
        threat_level: scenario.threat_level,
        risk_score: scenario.risk_score,
        blocked_nodes: blockedNodes,
      };
    } else {
      // dynamic mode
      const di = body.dynamicInput;
      if (!di) {
        return NextResponse.json(
          { error: "dynamicInput is required when mode='dynamic'" },
          { status: 400 }
        );
      }
      scenarioId = `DYNAMIC_${Date.now()}`;
      blockedNodes = di.blocked_nodes ?? [];
      scenarioMeta = {
        label: di.label,
        description: di.description,
        threat_level: di.threat_level,
        risk_score: di.risk_score,
        blocked_nodes: blockedNodes,
        source_article_url: di.source_article_url,
      };
    }

    const overrides = body.assumptionOverrides ?? {};

    // ── 1. Digital Twin + Rerouter ─────────────────────────
    const twin = new DigitalTwin();
    const rerouter = new Rerouter(twin);

    const rerouteResult = rerouter.computeRerouting(scenarioId, blockedNodes);

    // ── 2. SPR Drawdown Simulation ─────────────────────────
    const sprSim = new SPRSimulator();

    const unmitigatedSupply = SPRSimulator.worstCaseSupplyBPD(
      overrides.domesticProductionPct
    );
    const reroutedSupply = SPRSimulator.reroutedSupplyBPD(
      rerouteResult.supplyDeficitPct,
      overrides.rerouteRecoveryPct,
      overrides.domesticProductionPct
    );

    const sprResult = sprSim.simulate(
      unmitigatedSupply,
      reroutedSupply,
      scenarioId,
      new Date(),
      {
        domesticProductionPct: overrides.domesticProductionPct,
      }
    );

    // ── 3. Macro-Economic Impact ───────────────────────────
    const macroCalc = new MacroImpactCalculator();

    const macroResult = macroCalc.compute(
      rerouteResult.supplyDeficitPct,
      rerouteResult.avgRerouteCostIncrease,
      rerouteResult.avgRerouteDelayDays,
      scenarioId,
      new Date(),
      {
        gdpFrictionUsdPerBarrel: overrides.gdpFrictionUsdPerBarrel,
        fuelPriceSpikeMultiplier: overrides.fuelPriceSpikeMultiplier,
        refineryRunrateMultiplier: overrides.refineryRunrateMultiplier,
      }
    );

    // ── 4. Sensitivity band (rerouteRecoveryPct ± 0.20) ───
    const basePct = overrides.rerouteRecoveryPct ?? 0.6;
    const sensitivityBand = computeSensitivityBand(
      rerouteResult.supplyDeficitPct,
      scenarioId,
      basePct,
      overrides
    );

    // ── 5. Top-3 alternatives with rationale ──────────────
    const top3Alternatives = buildTopAlternatives(
      rerouteResult.routes,
      blockedNodes,
      twin
    );

    // ── 6. Node States for Map ─────────────────────────────
    const allNodes = twin.getAllNodes().map((node) => ({
      ...node,
      isBlocked: blockedNodes.includes(node.id),
    }));

    const allEdges = twin.getAllEdges().map((edge) => {
      const fromBlocked = blockedNodes.includes(edge.from);
      const toBlocked = blockedNodes.includes(edge.to);
      const isBlocked = fromBlocked || toBlocked;

      const isPrimary =
        edge.from === "strait_of_hormuz" || edge.to === "strait_of_hormuz";

      let status: "PRIMARY" | "REROUTED" | "BLOCKED" = "PRIMARY";
      if (isBlocked) status = "BLOCKED";
      else if (!edge.is_primary) status = "REROUTED";

      return { ...edge, isBlocked, isPrimary, status };
    });

    // ── 7. Timing ──────────────────────────────────────────
    const responseProducedAt = Date.now();
    const signalToRecommendationMs = body.signalTimestamp
      ? responseProducedAt - body.signalTimestamp
      : null;

    // ── Response Assembly ──────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        mode,
        timestamp: new Date().toISOString(),
        signalToRecommendationMs,
        scenario: scenarioMeta,
        rerouting: {
          blockedBPD: rerouteResult.blockedBPD,
          activeBPD: rerouteResult.activeBPD,
          unservedBPD: rerouteResult.unservedBPD,
          supplyDeficitPct: rerouteResult.supplyDeficitPct,
          avgRerouteCostIncrease: rerouteResult.avgRerouteCostIncrease,
          avgRerouteDelayDays: rerouteResult.avgRerouteDelayDays,
          routeCount: rerouteResult.routes.length,
          reroutedCount: rerouteResult.reroutedRoutes.length,
          blockedCount: rerouteResult.blockedRoutes.length,
          top3Alternatives,
        },
        spr: {
          initialBarrels: sprResult.initialSPRBarrels,
          initialDays: sprResult.initialSPRDays,
          exhaustionDayUnmitigated: sprResult.exhaustionDayUnmitigated,
          exhaustionDayRerouted: sprResult.exhaustionDayRerouted,
          daysSaved: sprResult.daysSaved,
          trajectoryUnmitigated: sprResult.trajectoryUnmitigated,
          trajectoryRerouted: sprResult.trajectoryRerouted,
        },
        macro: {
          supplyDeficitBPD: macroResult.supplyDeficitBPD,
          supplyDeficitPct: macroResult.supplyDeficitPct,
          fuelPriceSpikePercentage: macroResult.fuelPriceSpikePercentage,
          refineryRunRateDropPct: macroResult.refineryRunRateDropPct,
          dailyGDPLossUSD: macroResult.dailyGDPLossUSD,
          fifteenDayGDPLossUSD: macroResult.fifteenDayGDPLossUSD,
          fuelPriceSpikeLabel: macroResult.fuelPriceSpikeLabel,
          gdpLossLabel: macroResult.gdpLossLabel,
          refineryHitLabel: macroResult.refineryHitLabel,
          supplyDeficitLabel: macroResult.supplyDeficitLabel,
          macroAlertLevel: macroResult.macroAlertLevel,
          crudePriceBreakevenUSD: macroResult.crudePriceBreakevenUSD,
          additionalImportCostPerDay: macroResult.additionalImportCostPerDay,
          dailyImpactSeries: macroResult.dailyImpactSeries,
        },
        sensitivityBand,
        assumptions: {
          rerouteRecoveryPct: overrides.rerouteRecoveryPct ?? 0.6,
          domesticProductionPct: overrides.domesticProductionPct ?? 0.12,
          gdpFrictionUsdPerBarrel: overrides.gdpFrictionUsdPerBarrel ?? 42,
          fuelPriceSpikeMultiplier: overrides.fuelPriceSpikeMultiplier ?? 1.45,
          refineryRunrateMultiplier: overrides.refineryRunrateMultiplier ?? 0.85,
          sprBaselineDays: 9.5,
          sprBaselineBarrels: 47500000,
        },
        network: {
          nodes: allNodes,
          edges: allEdges,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[KAVACH] Simulation error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET — health check
export async function GET() {
  return NextResponse.json({
    status: "operational",
    engine: "KAVACH Digital Twin v1.0",
    scenarios: Object.keys(SCENARIOS),
    modes: ["preset", "dynamic"],
  });
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Run a ±20% sensitivity check on rerouteRecoveryPct.
 * Returns the spread in daysSaved and dailyGDPLossUSD.
 */
function computeSensitivityBand(
  deficitPct: number,
  scenarioId: string,
  baseRecoveryPct: number,
  overrides: AssumptionOverrides
) {
  const variants = [
    Math.max(0, baseRecoveryPct - 0.2),
    Math.min(1, baseRecoveryPct + 0.2),
  ];

  const results = variants.map((recoveryPct) => {
    const reroutedSupply = SPRSimulator.reroutedSupplyBPD(
      deficitPct,
      recoveryPct,
      overrides.domesticProductionPct
    );
    const unmitigatedSupply = SPRSimulator.worstCaseSupplyBPD(
      overrides.domesticProductionPct
    );
    const sim = new SPRSimulator();
    const r = sim.simulate(
      unmitigatedSupply,
      reroutedSupply,
      scenarioId,
      new Date(),
      { domesticProductionPct: overrides.domesticProductionPct }
    );
    const macro = new MacroImpactCalculator();
    const m = macro.compute(deficitPct, 0, 0, scenarioId, new Date(), {
      gdpFrictionUsdPerBarrel: overrides.gdpFrictionUsdPerBarrel,
      fuelPriceSpikeMultiplier: overrides.fuelPriceSpikeMultiplier,
      refineryRunrateMultiplier: overrides.refineryRunrateMultiplier,
    });
    return { daysSaved: r.daysSaved, dailyGDPLossUSD: m.dailyGDPLossUSD };
  });

  return {
    recoveryRangeLow: variants[0],
    recoveryRangeHigh: variants[1],
    daysSavedLow: results[0].daysSaved,
    daysSavedHigh: results[1].daysSaved,
    gdpLossLow: results[0].dailyGDPLossUSD,
    gdpLossHigh: results[1].dailyGDPLossUSD,
  };
}

/**
 * Build top-3 rerouted alternatives with plain-language rationale strings.
 * Sorted by totalCostPerBarrel ascending (cheapest first).
 */
function buildTopAlternatives(
  routes: RouteOption[],
  blockedNodes: string[],
  twin: DigitalTwin
): Array<RouteOption & { rationale: string }> {
  // Filter to rerouted (not blocked, not primary Hormuz path)
  const viable = routes
    .filter((r) => !r.isBlocked && r.capacityBPD > 0)
    .sort((a, b) => a.totalCostPerBarrel - b.totalCostPerBarrel)
    .slice(0, 3);

  return viable.map((r) => {
    const gradeNote = r.gradeMismatch
      ? `⚠ Grade mismatch (${r.crudeType} crude, +$${r.gradeSurchargePBL}/bbl surcharge, +${r.gradeDelayDays}d)`
      : `✓ Grade compatible (${r.crudeType} crude)`;

    const routeVia = r.pathLabels.slice(1, -1).join(" → ") || "direct";
    const rationale = `${r.supplier.label} → ${r.port.label} via ${routeVia}. ${gradeNote}. Total: $${r.totalCostPerBarrel.toFixed(2)}/bbl, ${r.totalTransitDays}d transit. Capacity: ${(r.capacityBPD / 1_000_000).toFixed(2)}M BPD.`;

    return { ...r, rationale };
  });
}
