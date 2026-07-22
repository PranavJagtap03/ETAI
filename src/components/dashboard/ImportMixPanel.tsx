"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Globe2 } from "lucide-react";

// India's crude import mix by source country (approximate 2024 data)
const IMPORT_MIX_BASE = [
  { country: "Russia", pct: 36, crude: "Sour", color: "#1e3a8a" },
  { country: "Saudi Arabia", pct: 17, crude: "Sour", color: "#2563eb" },
  { country: "Iraq", pct: 16, crude: "Sour", color: "#3b82f6" },
  { country: "UAE", pct: 8, crude: "Sweet", color: "#60a5fa" },
  { country: "USA", pct: 7, crude: "Sweet", color: "#10b981" },
  { country: "Nigeria", pct: 4, crude: "Sweet", color: "#34d399" },
  { country: "Others", pct: 12, crude: "Mixed", color: "#94a3b8" },
];

// India major refinery stats
const REFINERIES = [
  { name: "Jamnagar (RIL)", capacity: 1240, runRate: 96, crude: "Sour" },
  { name: "Koyali (IOCL)", capacity: 274, runRate: 91, crude: "Mixed" },
  { name: "MRPL Mangalore", capacity: 300, runRate: 88, crude: "Sour" },
  { name: "Paradip (IOCL)", capacity: 300, runRate: 93, crude: "Sour" },
  { name: "Haldia (IOCL)", capacity: 150, runRate: 85, crude: "Mixed" },
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { country: string; pct: number; crude: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-xs">
      <p className="font-bold text-slate-800">{d.country}</p>
      <p className="text-slate-600">{d.pct}% of imports</p>
      <p className="text-slate-500">{d.crude} crude</p>
    </div>
  );
}

export function ImportMixPanel({ supplyDeficitPct }: { supplyDeficitPct: number }) {
  // Adjust run rates based on deficit
  const adjustedRefineries = REFINERIES.map((r) => ({
    ...r,
    effectiveRunRate: Math.round(r.runRate * (1 - supplyDeficitPct * 0.85)),
  }));

  const totalCapacity = REFINERIES.reduce((s, r) => s + r.capacity, 0);
  const avgRunRate = adjustedRefineries.reduce((s, r) => s + r.effectiveRunRate, 0) / adjustedRefineries.length;

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Import mix donut */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Globe2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">Import Mix by Source</span>
        </div>
        <div className="flex gap-3 items-center">
          <div style={{ width: 100, height: 100, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie
                  data={IMPORT_MIX_BASE}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={46}
                  dataKey="pct"
                  strokeWidth={1}
                  stroke="#fff"
                >
                  {IMPORT_MIX_BASE.map((entry) => (
                    <Cell key={entry.country} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            {IMPORT_MIX_BASE.map((item) => (
              <div key={item.country} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                <span className="text-xs text-slate-600 flex-1 truncate">{item.country}</span>
                <span className="text-xs font-bold font-mono-data text-slate-700">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refinery run rates */}
      <div className="border-t border-slate-100 pt-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">Refinery Run Rates</span>
          <span className="text-xs font-mono-data font-bold text-slate-600">
            Avg: {avgRunRate.toFixed(0)}%
          </span>
        </div>
        {adjustedRefineries.map((r) => (
          <div key={r.name} className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600 truncate flex-1">{r.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-mono-data text-slate-500">{r.capacity}K BPD</span>
                <span
                  className="text-xs font-bold font-mono-data"
                  style={{
                    color: r.effectiveRunRate > 85 ? "#22c55e" :
                      r.effectiveRunRate > 70 ? "#f59e0b" : "#e11d48",
                  }}
                >
                  {r.effectiveRunRate}%
                </span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${r.effectiveRunRate}%`,
                  background: r.effectiveRunRate > 85 ? "#22c55e" :
                    r.effectiveRunRate > 70 ? "#f59e0b" : "#e11d48",
                }}
              />
            </div>
          </div>
        ))}
        <div className="mt-1.5 rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
          <span className="text-xs text-slate-500">Total Refinery Capacity: </span>
          <span className="text-xs font-bold font-mono-data text-slate-800">{totalCapacity.toLocaleString()} K BPD</span>
        </div>
      </div>
    </div>
  );
}
