// ============================================================
// KAVACH — Macro-Economic Shock Impact Calculator
//
// Formulas:
//   Supply Deficit % = (BaselineSupply - ActiveSupply) / BaselineSupply
//   Domestic Fuel Price Spike % = Supply Deficit % × 1.45
//   Refinery Run Rate Hit % = Supply Deficit % × 0.85
//   Daily GDP Impact (USD) = Supply Deficit (Barrels) × $42 friction
// ============================================================

import {
  INDIA_DAILY_DEMAND_BPD,
  FUEL_PRICE_SPIKE_MULTIPLIER,
  REFINERY_RUNRATE_MULTIPLIER,
  GDP_FRICTION_USD_PER_BARREL,
  SIM_DAYS,
} from "@/lib/config";

// ── Types ────────────────────────────────────────────────────

export interface MacroImpactResult {
  scenarioId: string;
  supplyDeficitBPD: number;
  supplyDeficitPct: number;         // fraction (0–1)

  // Price impacts
  fuelPriceSpikePercentage: number; // % spike in domestic fuel price
  crudePriceBreakevenUSD: number;   // breakeven Brent equiv. under rerouted cost

  // Refinery impacts
  refineryRunRateDropPct: number;   // % drop in throughput
  estimatedRefineryLossBPD: number; // BPD of capacity lost

  // GDP impacts
  dailyGDPLossUSD: number;
  fifteenDayGDPLossUSD: number;     // 15-day cumulative
  annualizedGDPLossUSD: number;     // extrapolated to 1 year

  // Trade balance impact
  additionalImportCostPerDay: number;  // USD from rerouting surcharge
  additionalTransitDays: number;

  // Human-readable labels
  fuelPriceSpikeLabel: string;
  gdpLossLabel: string;
  refineryHitLabel: string;
  supplyDeficitLabel: string;

  // Alert tier
  macroAlertLevel: "LOW" | "MODERATE" | "SEVERE" | "CATASTROPHIC";
  
  // Time-series shock curve (15 days)
  dailyImpactSeries: DailyMacroPoint[];
}

export interface DailyMacroPoint {
  day: number;
  date: string;
  gdpLossUSD: number;
  fuelPriceSpikeAdditionalPct: number;
  refineryRunRatePct: number; // operational %, not drop
  cumulativeGDPLossUSD: number;
}

// ── Macro Impact Calculator ──────────────────────────────────

export class MacroImpactCalculator {

  /**
   * Compute all macro-economic shock metrics given supply deficit
   *
   * @param supplyDeficitPct - fraction of daily demand unmet (0–1)
   * @param avgRerouteCostIncreasePerBBL - additional USD/barrel from rerouting
   * @param additionalTransitDays - extra days from alternate routing
   * @param scenarioId - scenario identifier
   */
  compute(
    supplyDeficitPct: number,
    avgRerouteCostIncreasePerBBL: number,
    additionalTransitDays: number,
    scenarioId: string,
    startDate: Date = new Date()
  ): MacroImpactResult {

    // Clamp deficit to valid range
    const deficit = Math.min(1, Math.max(0, supplyDeficitPct));

    // ── Core Metrics ────────────────────────────────────────

    const supplyDeficitBPD = Math.round(deficit * INDIA_DAILY_DEMAND_BPD);

    // Domestic Fuel Price Spike % = Deficit% × 1.45
    const fuelPriceSpikePercentage =
      Math.round(deficit * FUEL_PRICE_SPIKE_MULTIPLIER * 1000) / 10;

    // Refinery Run Rate Hit % = Deficit% × 0.85
    const refineryRunRateDropPct =
      Math.round(deficit * REFINERY_RUNRATE_MULTIPLIER * 1000) / 10;

    const estimatedRefineryLossBPD = Math.round(
      deficit * REFINERY_RUNRATE_MULTIPLIER * 1_500_000 // total refinery capacity ~1.5M BPD
    );

    // Daily GDP Impact = Deficit BPD × $42
    const dailyGDPLossUSD = supplyDeficitBPD * GDP_FRICTION_USD_PER_BARREL;

    // Crude breakeven adjusted for rerouting cost
    const baseBrentEquiv = 80; // baseline Brent price USD/BBL
    const crudePriceBreakevenUSD =
      baseBrentEquiv + avgRerouteCostIncreasePerBBL;

    // Additional import cost per day from rerouting
    const reroutedImportBPD = INDIA_DAILY_DEMAND_BPD * 0.88 * (1 - deficit);
    const additionalImportCostPerDay = Math.round(
      reroutedImportBPD * avgRerouteCostIncreasePerBBL
    );

    // ── Time-Series (15 days) ────────────────────────────────
    // Shock intensifies in first 5 days (ramp-up), then plateaus

    const dailyImpactSeries: DailyMacroPoint[] = [];
    let cumulativeGDP = 0;

    for (let day = 0; day <= SIM_DAYS; day++) {
      const rampFactor = Math.min(1, day / 5); // ramp from 0→1 over 5 days
      const dayDeficit = deficit * rampFactor;

      const gdpLoss =
        Math.round(dayDeficit * INDIA_DAILY_DEMAND_BPD) *
        GDP_FRICTION_USD_PER_BARREL;

      cumulativeGDP += gdpLoss;

      const date = new Date(startDate);
      date.setDate(date.getDate() + day);

      dailyImpactSeries.push({
        day,
        date: date.toISOString().split("T")[0],
        gdpLossUSD: gdpLoss,
        fuelPriceSpikeAdditionalPct:
          Math.round(dayDeficit * FUEL_PRICE_SPIKE_MULTIPLIER * 1000) / 10,
        refineryRunRatePct: Math.round((1 - dayDeficit * REFINERY_RUNRATE_MULTIPLIER) * 100),
        cumulativeGDPLossUSD: cumulativeGDP,
      });
    }

    // ── Cumulative / Annualized ──────────────────────────────

    const fifteenDayGDPLossUSD = dailyGDPLossUSD * SIM_DAYS;
    const annualizedGDPLossUSD = dailyGDPLossUSD * 365;

    // ── Alert Level ──────────────────────────────────────────
    let macroAlertLevel: MacroImpactResult["macroAlertLevel"] = "LOW";
    if (deficit >= 0.5) macroAlertLevel = "CATASTROPHIC";
    else if (deficit >= 0.3) macroAlertLevel = "SEVERE";
    else if (deficit >= 0.15) macroAlertLevel = "MODERATE";

    // ── Labels ───────────────────────────────────────────────
    const fuelPriceSpikeLabel = `+${fuelPriceSpikePercentage.toFixed(1)}%`;
    const gdpLossLabel = this._formatUSD(dailyGDPLossUSD);
    const refineryHitLabel = `-${refineryRunRateDropPct.toFixed(1)}%`;
    const supplyDeficitLabel = `${(deficit * 100).toFixed(1)}%`;

    return {
      scenarioId,
      supplyDeficitBPD,
      supplyDeficitPct: deficit,
      fuelPriceSpikePercentage,
      crudePriceBreakevenUSD,
      refineryRunRateDropPct,
      estimatedRefineryLossBPD,
      dailyGDPLossUSD,
      fifteenDayGDPLossUSD,
      annualizedGDPLossUSD,
      additionalImportCostPerDay,
      additionalTransitDays,
      fuelPriceSpikeLabel,
      gdpLossLabel,
      refineryHitLabel,
      supplyDeficitLabel,
      macroAlertLevel,
      dailyImpactSeries,
    };
  }

  /**
   * Format USD values as readable strings (M/B suffix)
   */
  private _formatUSD(value: number): string {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  }
}
