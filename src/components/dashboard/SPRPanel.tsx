"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { TrendingDown, Database } from "lucide-react";

interface SPRDayPoint {
  day: number;
  reserveBarrels: number;
  pctRemaining: number;
  alertStatus: string;
}

interface SPRPanelProps {
  trajectoryUnmitigated: SPRDayPoint[];
  trajectoryRerouted: SPRDayPoint[];
  exhaustionDayUnmitigated: number | null;
  exhaustionDayRerouted: number | null;
  daysSaved: number;
  initialSPRBarrels: number;
}

// SPR site breakdown (static)
const SPR_SITES = [
  { name: "Padur, Karnataka", capacity: 26.5, fill: 92 },
  { name: "Mangalore, Karnataka", capacity: 11.25, fill: 88 },
  { name: "Vizag, Andhra Pradesh", capacity: 9.75, fill: 95 },
];

function formatM(v: number) {
  return `${(v / 1_000_000).toFixed(0)}M`;
}

function MiniTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md p-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">Day {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name === "unmitigated" ? "No action" : "Rerouted"}:</span>
          <span className="font-bold font-mono-data">{formatM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function SPRPanel({
  trajectoryUnmitigated,
  trajectoryRerouted,
  exhaustionDayUnmitigated,
  exhaustionDayRerouted,
  daysSaved,
  initialSPRBarrels,
}: SPRPanelProps) {
  const chartData = trajectoryUnmitigated.map((u, i) => ({
    day: u.day,
    unmitigated: u.reserveBarrels,
    rerouted: trajectoryRerouted[i]?.reserveBarrels ?? 0,
  }));

  const warningLine = initialSPRBarrels * 0.15;
  const totalSPR = SPR_SITES.reduce((s, x) => s + x.capacity, 0);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* SPR site breakdown */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">SPR Sites</span>
          <span className="ml-auto text-xs font-bold font-mono-data text-blue-700">{totalSPR.toFixed(1)}M bbl total</span>
        </div>
        {SPR_SITES.map((site) => (
          <div key={site.name} className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600">{site.name}</span>
              <span className="text-xs font-mono-data font-bold text-slate-700">
                {((site.capacity * site.fill) / 100).toFixed(1)}M / {site.capacity}M bbl
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${site.fill}%`,
                  background: site.fill > 85 ? "#22c55e" : site.fill > 60 ? "#f59e0b" : "#e11d48",
                }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-0.5 text-right">{site.fill}% full</div>
          </div>
        ))}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          {
            label: "No-Action Exhaust",
            value: exhaustionDayUnmitigated != null ? `Day ${exhaustionDayUnmitigated}` : ">15d",
            color: exhaustionDayUnmitigated != null ? "#e11d48" : "#22c55e",
          },
          {
            label: "With Rerouting",
            value: exhaustionDayRerouted != null ? `Day ${exhaustionDayRerouted}` : ">15d ✓",
            color: exhaustionDayRerouted != null ? "#f59e0b" : "#22c55e",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
            <div className="text-sm font-extrabold font-mono-data" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {daysSaved > 0 && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span className="text-xs text-emerald-700 font-semibold">
            Rerouting adds +{daysSaved} days of SPR cover
          </span>
        </div>
      )}

      {/* Mini chart */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1.5">15-Day Drawdown</p>
        <div style={{ height: 110 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="spr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={formatM} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<MiniTooltip />} />
              <ReferenceLine y={warningLine} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth={1} />
              <Area type="monotone" dataKey="unmitigated" name="unmitigated" stroke="#e11d48" strokeWidth={1.5} fill="url(#spu)" dot={false} />
              <Area type="monotone" dataKey="rerouted" name="rerouted" stroke="#10b981" strokeWidth={1.5} fill="url(#spr)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
