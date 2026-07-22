// ============================================================
// KAVACH — SPR Drawdown Simulator
// Computes 15-day Strategic Petroleum Reserve depletion curves
// under unmitigated vs. rerouted supply scenarios.
//
// Formula:
//   Reserve(t) = InitialSPR - ∫₀ᵗ (DailyDemand - ActiveImportSupply) dt
//
// Baseline SPR = 9.5 days × 5,000,000 BPD = 47,500,000 barrels
// ============================================================

import {
  INDIA_DAILY_DEMAND_BPD,
  SPR_BASELINE_BARRELS,
  SPR_BASELINE_DAYS,
  SIM_DAYS,
} from "@/lib/config";

// ── Types ────────────────────────────────────────────────────

export interface SPRDayPoint {
  day: number;
  date: string;
  reserveBarrels: number;       // total barrels remaining
  reserveDays: number;          // days of cover left at current demand
  drawdownBarrels: number;      // barrels drawn this day
  activeSupplyBPD: number;      // import supply flowing in
  netDeficitBPD: number;        // demand - active supply (positive = drawdown)
  cumulativeDrawdown: number;   // total drawn since day 0
  pctRemaining: number;         // % of initial SPR left
  alertStatus: "NORMAL" | "WARNING" | "CRITICAL" | "DEPLETED";
}

export interface SPRSimResult {
  scenarioId: string;
  initialSPRBarrels: number;
  initialSPRDays: number;
  dailyDemandBPD: number;
  trajectoryUnmitigated: SPRDayPoint[];  // no rerouting
  trajectoryRerouted: SPRDayPoint[];     // with active rerouting
  exhaustionDayUnmitigated: number | null;
  exhaustionDayRerouted: number | null;
  daysSaved: number;  // rerouting buys this many extra days
  peakDrawdownRateUnmitigated: number;  // BPD
  peakDrawdownRateRerouted: number;     // BPD
}

// ── SPR Simulator ────────────────────────────────────────────

export class SPRSimulator {

  /**
   * Simulate the SPR drawdown curve over SIM_DAYS.
   *
   * @param activeBPD_unmitigated - supply BPD if no rerouting happens
   * @param activeBPD_rerouted - supply BPD after rerouting is active
   * @param scenarioId - scenario identifier
   * @param startDate - simulation start date (defaults to today)
   * @param overrides - optional assumption overrides
   */
  simulate(
    activeBPD_unmitigated: number,
    activeBPD_rerouted: number,
    scenarioId: string,
    startDate: Date = new Date(),
    overrides?: { domesticProductionPct?: number }
  ): SPRSimResult {

    const trajectoryUnmitigated = this._computeTrajectory(
      activeBPD_unmitigated,
      startDate,
      overrides?.domesticProductionPct
    );

    const trajectoryRerouted = this._computeTrajectory(
      activeBPD_rerouted,
      startDate,
      overrides?.domesticProductionPct
    );

    const exhaustionDayUnmitigated = this._findExhaustionDay(trajectoryUnmitigated);
    const exhaustionDayRerouted = this._findExhaustionDay(trajectoryRerouted);

    const daysSaved =
      exhaustionDayUnmitigated !== null && exhaustionDayRerouted !== null
        ? exhaustionDayRerouted - exhaustionDayUnmitigated
        : exhaustionDayRerouted !== null
          ? 0
          : exhaustionDayUnmitigated !== null
            ? SIM_DAYS - exhaustionDayUnmitigated
            : 0;

    const peakDrawdownUnmitigated = Math.max(
      ...trajectoryUnmitigated.map((d) => d.drawdownBarrels)
    );
    const peakDrawdownRerouted = Math.max(
      ...trajectoryRerouted.map((d) => d.drawdownBarrels)
    );

    return {
      scenarioId,
      initialSPRBarrels: SPR_BASELINE_BARRELS,
      initialSPRDays: SPR_BASELINE_DAYS,
      dailyDemandBPD: INDIA_DAILY_DEMAND_BPD,
      trajectoryUnmitigated,
      trajectoryRerouted,
      exhaustionDayUnmitigated,
      exhaustionDayRerouted,
      daysSaved: Math.max(0, daysSaved),
      peakDrawdownRateUnmitigated: peakDrawdownUnmitigated,
      peakDrawdownRateRerouted: peakDrawdownRerouted,
    };
  }

  /**
   * Compute day-by-day SPR trajectory using discrete integration.
   * Reserve(t) = Reserve(t-1) - max(0, DailyDemand - ActiveSupply)
   *
   * When reserve hits 0, we report DEPLETED status.
   * We also model a 20% domestic production offset to active supply.
   */
  private _computeTrajectory(
    activeImportBPD: number,
    startDate: Date,
    domesticProductionPct: number = 0.12
  ): SPRDayPoint[] {
    const domesticProduction = INDIA_DAILY_DEMAND_BPD * domesticProductionPct; // ~12% domestic by default
    const totalActiveSupply = activeImportBPD + domesticProduction;

    let currentReserve = SPR_BASELINE_BARRELS;
    let cumulativeDrawdown = 0;
    const trajectory: SPRDayPoint[] = [];

    for (let day = 0; day <= SIM_DAYS; day++) {
      const netDeficitBPD = Math.max(
        0,
        INDIA_DAILY_DEMAND_BPD - totalActiveSupply
      );

      // Draw from SPR to cover deficit (can't draw more than what's left)
      const drawdownToday = Math.min(netDeficitBPD, currentReserve);
      cumulativeDrawdown += drawdownToday;
      currentReserve = Math.max(0, currentReserve - drawdownToday);

      const reserveDays =
        netDeficitBPD > 0
          ? currentReserve / netDeficitBPD
          : currentReserve / INDIA_DAILY_DEMAND_BPD;

      const pctRemaining = currentReserve / SPR_BASELINE_BARRELS;

      let alertStatus: SPRDayPoint["alertStatus"] = "NORMAL";
      if (currentReserve === 0) alertStatus = "DEPLETED";
      else if (pctRemaining < 0.15) alertStatus = "CRITICAL";
      else if (pctRemaining < 0.4) alertStatus = "WARNING";

      const date = new Date(startDate);
      date.setDate(date.getDate() + day);

      trajectory.push({
        day,
        date: date.toISOString().split("T")[0],
        reserveBarrels: Math.round(currentReserve),
        reserveDays: Math.round(reserveDays * 10) / 10,
        drawdownBarrels: Math.round(drawdownToday),
        activeSupplyBPD: Math.round(totalActiveSupply),
        netDeficitBPD: Math.round(netDeficitBPD),
        cumulativeDrawdown: Math.round(cumulativeDrawdown),
        pctRemaining: Math.round(pctRemaining * 1000) / 10, // to 1 decimal %
        alertStatus,
      });
    }

    return trajectory;
  }

  /**
   * Find the first day the SPR hits 0 (exhaustion day)
   */
  private _findExhaustionDay(trajectory: SPRDayPoint[]): number | null {
    const depleted = trajectory.find((d) => d.alertStatus === "DEPLETED");
    return depleted ? depleted.day : null;
  }

  /**
   * Compute unmitigated supply (zero active imports — worst case)
   * @param domesticProductionPct - fraction of demand met by domestic production (default 0.12)
   */
  static worstCaseSupplyBPD(domesticProductionPct: number = 0.12): number {
    // Only domestic production remains
    return INDIA_DAILY_DEMAND_BPD * domesticProductionPct;
  }

  /**
   * Compute rerouted supply estimate given a supply deficit fraction.
   * @param deficitPct - fraction of demand unmet
   * @param rerouteRecoveryPct - fraction of disrupted supply recovered via rerouting (default 0.60)
   * @param domesticProductionPct - fraction met domestically (default 0.12)
   */
  static reroutedSupplyBPD(
    deficitPct: number,
    rerouteRecoveryPct: number = 0.6,
    domesticProductionPct: number = 0.12
  ): number {
    const baseImportBPD = INDIA_DAILY_DEMAND_BPD * (1 - domesticProductionPct);
    const disruptedBPD = baseImportBPD * deficitPct;
    const recoveredBPD = disruptedBPD * rerouteRecoveryPct;
    return baseImportBPD - disruptedBPD + recoveredBPD;
  }
}
