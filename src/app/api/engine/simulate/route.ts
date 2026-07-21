// ============================================================
// KAVACH — Full Scenario Simulation API Route
// POST /api/engine/simulate
// Runs end-to-end: rerouting → SPR drawdown → macro impact
// and returns the complete JSON payload for the frontend.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { DigitalTwin } from "@/lib/engine/digitalTwin";
import { Rerouter } from "@/lib/engine/rerouter";
import { SPRSimulator } from "@/lib/engine/sprSimulator";
import { MacroImpactCalculator } from "@/lib/engine/macroImpact";
import { SCENARIOS, ScenarioId } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenarioId } = body as { scenarioId: ScenarioId };

    if (!scenarioId || !(scenarioId in SCENARIOS)) {
      return NextResponse.json(
        {
          error: `Invalid scenarioId. Valid options: ${Object.keys(SCENARIOS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const scenario = SCENARIOS[scenarioId];

    // ── 1. Digital Twin + Rerouter ─────────────────────────
    const twin = new DigitalTwin();
    const rerouter = new Rerouter(twin);

    const blockedNodes: string[] = [...scenario.blocked_nodes];
    const rerouteResult = rerouter.computeRerouting(
      scenarioId,
      blockedNodes
    );

    // ── 2. SPR Drawdown Simulation ─────────────────────────
    const sprSim = new SPRSimulator();

    const unmitigatedSupply = SPRSimulator.worstCaseSupplyBPD();
    const reroutedSupply = SPRSimulator.reroutedSupplyBPD(
      rerouteResult.supplyDeficitPct
    );

    const sprResult = sprSim.simulate(
      unmitigatedSupply,
      reroutedSupply,
      scenarioId
    );

    // ── 3. Macro-Economic Impact ───────────────────────────
    const macroCalc = new MacroImpactCalculator();

    const macroResult = macroCalc.compute(
      rerouteResult.supplyDeficitPct,
      rerouteResult.avgRerouteCostIncrease,
      rerouteResult.avgRerouteDelayDays,
      scenarioId
    );

    // ── 4. Node States for Map ─────────────────────────────
    // Annotate each network node with its current operational status
    const allNodes = twin.getAllNodes().map((node) => ({
      ...node,
      isBlocked: blockedNodes.includes(node.id),
    }));

    const allEdges = twin.getAllEdges().map((edge) => {
      const fromBlocked = blockedNodes.includes(edge.from);
      const toBlocked = blockedNodes.includes(edge.to);
      const isBlocked = fromBlocked || toBlocked;

      // Primary edges are those using Hormuz
      const isPrimary = edge.from === "strait_of_hormuz" ||
        edge.to === "strait_of_hormuz";

      let status: "PRIMARY" | "REROUTED" | "BLOCKED" = "PRIMARY";
      if (isBlocked) status = "BLOCKED";
      else if (!edge.is_primary) status = "REROUTED";

      return { ...edge, isBlocked, isPrimary, status };
    });

    // ── Response Assembly ──────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        scenario: {
          id: scenarioId,
          label: scenario.label,
          description: scenario.description,
          threat_level: scenario.threat_level,
          risk_score: scenario.risk_score,
          blocked_nodes: scenario.blocked_nodes,
        },
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
  });
}
