"use client";

import { Fuel, TrendingUp, Factory, DollarSign } from "lucide-react";

interface EconomicMetricsProps {
  fuelPriceSpikeLabel: string;
  fuelPriceSpikePercentage: number;
  refineryHitLabel: string;
  refineryRunRateDropPct: number;
  gdpLossLabel: string;
  dailyGDPLossUSD: number;
  supplyDeficitLabel: string;
  supplyDeficitBPD: number;
  crudePriceBreakevenUSD: number;
  additionalImportCostPerDay: number;
  macroAlertLevel: "LOW" | "MODERATE" | "SEVERE" | "CATASTROPHIC";
}

const ALERT_CONFIG = {
  LOW: { color: "#22c55e", bg: "#dcfce7", label: "STABLE" },
  MODERATE: { color: "#f59e0b", bg: "#fef3c7", label: "STRESSED" },
  SEVERE: { color: "#f97316", bg: "#ffedd5", label: "SEVERE" },
  CATASTROPHIC: { color: "#e11d48", bg: "#ffe4e6", label: "CATASTROPHIC" },
};

function MetricCard({
  icon,
  label,
  value,
  sub,
  detail,
  accentClass,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  detail?: string;
  accentClass: string;
  valueColor: string;
}) {
  return (
    <div className={`metric-card ${accentClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: valueColor + "15" }}
            >
              <div style={{ color: valueColor }}>{icon}</div>
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {label}
            </span>
          </div>
          <div
            className="text-3xl font-extrabold font-mono-data leading-none"
            style={{ color: valueColor }}
          >
            {value}
          </div>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
          {detail && (
            <div className="text-xs text-slate-400 mt-1 font-mono-data">
              {detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EconomicMetrics({
  fuelPriceSpikeLabel,
  fuelPriceSpikePercentage,
  refineryHitLabel,
  refineryRunRateDropPct,
  gdpLossLabel,
  dailyGDPLossUSD,
  supplyDeficitLabel,
  supplyDeficitBPD,
  crudePriceBreakevenUSD,
  additionalImportCostPerDay,
  macroAlertLevel,
}: EconomicMetricsProps) {
  const alertConf = ALERT_CONFIG[macroAlertLevel];

  return (
    <div className="kavach-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Macro-Economic Shock
          </h2>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{
            backgroundColor: alertConf.bg,
            color: alertConf.color,
          }}
        >
          {alertConf.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Fuel className="w-4 h-4" />}
          label="Fuel Price Spike"
          value={fuelPriceSpikeLabel}
          sub="Domestic pump price delta"
          detail={`${fuelPriceSpikePercentage.toFixed(1)}% × deficit factor`}
          accentClass="crimson"
          valueColor="#e11d48"
        />
        <MetricCard
          icon={<Factory className="w-4 h-4" />}
          label="Refinery Throughput"
          value={refineryHitLabel}
          sub="Run rate reduction"
          detail={`${refineryRunRateDropPct.toFixed(1)}% drop from baseline`}
          accentClass="amber"
          valueColor="#d97706"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Daily GDP Friction"
          value={gdpLossLabel}
          sub="Economic loss per day"
          detail={`$42/bbl × ${(supplyDeficitBPD / 1000).toFixed(0)}K bpd deficit`}
          accentClass="navy"
          valueColor="#1e3a8a"
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Supply Deficit"
          value={supplyDeficitLabel}
          sub="Of total daily demand"
          detail={`${(supplyDeficitBPD / 1000).toFixed(0)}K BPD unmet`}
          accentClass="emerald"
          valueColor="#059669"
        />
      </div>

      {/* Additional metrics strip */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
          <div className="text-xs text-slate-500 mb-0.5">Crude Breakeven</div>
          <div className="text-sm font-bold font-mono-data text-slate-800">
            ${crudePriceBreakevenUSD.toFixed(1)}/bbl
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
          <div className="text-xs text-slate-500 mb-0.5">
            Extra Import Cost/Day
          </div>
          <div className="text-sm font-bold font-mono-data text-slate-800">
            $
            {additionalImportCostPerDay >= 1_000_000
              ? `${(additionalImportCostPerDay / 1_000_000).toFixed(1)}M`
              : `${(additionalImportCostPerDay / 1_000).toFixed(0)}K`}
          </div>
        </div>
      </div>

      {/* Formula note */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
        <p className="text-xs text-slate-400 leading-relaxed font-mono-data">
          Fuel Spike = Deficit% × 1.45 &nbsp;|&nbsp; Refinery Hit = Deficit% ×
          0.85
          <br />
          GDP Loss = Deficit_BPD × $42 friction factor
        </p>
      </div>
    </div>
  );
}
