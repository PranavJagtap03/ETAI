"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Database, AlertTriangle, TrendingDown } from "lucide-react";

interface SPRDayPoint {
  day: number;
  date: string;
  reserveBarrels: number;
  reserveDays: number;
  pctRemaining: number;
  drawdownBarrels: number;
  alertStatus: string;
}

interface SPRChartProps {
  trajectoryUnmitigated: SPRDayPoint[];
  trajectoryRerouted: SPRDayPoint[];
  exhaustionDayUnmitigated: number | null;
  exhaustionDayRerouted: number | null;
  daysSaved: number;
  initialSPRBarrels: number;
}

const formatBarrels = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
};

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-600 mb-2">Day {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-xs text-slate-600">{p.name}</span>
          </div>
          <span className="text-xs font-bold font-mono-data text-slate-800">
            {formatBarrels(p.value)} bbl
          </span>
        </div>
      ))}
    </div>
  );
}

export function SPRChart({
  trajectoryUnmitigated,
  trajectoryRerouted,
  exhaustionDayUnmitigated,
  exhaustionDayRerouted,
  daysSaved,
  initialSPRBarrels,
}: SPRChartProps) {
  // Merge both trajectories for the chart
  const chartData = trajectoryUnmitigated.map((u, i) => ({
    day: u.day,
    date: u.date,
    unmitigated: u.reserveBarrels,
    rerouted: trajectoryRerouted[i]?.reserveBarrels ?? 0,
    pctUnmitigated: u.pctRemaining,
    pctRerouted: trajectoryRerouted[i]?.pctRemaining ?? 0,
  }));

  // Warning threshold (15% of initial)
  const warningThreshold = initialSPRBarrels * 0.15;
  const criticalThreshold = initialSPRBarrels * 0.05;

  return (
    <div className="kavach-card p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            SPR Drawdown Trajectory
          </h2>
          <span className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
            15-day simulation
          </span>
        </div>
        <div className="flex items-center gap-3">
          {daysSaved > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">
                Rerouting saves +{daysSaved}d
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Key stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-center">
          <div className="text-xs text-slate-500 mb-0.5">Initial SPR</div>
          <div className="text-sm font-bold font-mono-data text-slate-800">
            47.5M bbl
          </div>
          <div className="text-xs text-slate-400">9.5 days</div>
        </div>
        <div
          className={`rounded-lg border p-2.5 text-center ${
            exhaustionDayUnmitigated !== null
              ? "bg-rose-50 border-rose-200"
              : "bg-slate-50 border-slate-100"
          }`}
        >
          <div className="text-xs text-slate-500 mb-0.5">
            Unmitigated Exhaust
          </div>
          <div
            className={`text-sm font-bold font-mono-data ${
              exhaustionDayUnmitigated !== null
                ? "text-rose-700"
                : "text-emerald-700"
            }`}
          >
            {exhaustionDayUnmitigated !== null
              ? `Day ${exhaustionDayUnmitigated}`
              : "> 15d"}
          </div>
        </div>
        <div
          className={`rounded-lg border p-2.5 text-center ${
            exhaustionDayRerouted !== null
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="text-xs text-slate-500 mb-0.5">
            Rerouted Exhaust
          </div>
          <div
            className={`text-sm font-bold font-mono-data ${
              exhaustionDayRerouted !== null
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {exhaustionDayRerouted !== null
              ? `Day ${exhaustionDayRerouted}`
              : "> 15d ✓"}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <defs>
              <linearGradient id="gradUnmitigated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#e11d48" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradRerouted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{
                value: "Day",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 10, fill: "#94a3b8" },
              }}
            />
            <YAxis
              tickFormatter={formatBarrels}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) =>
                value === "unmitigated" ? "Without Rerouting" : "With Rerouting"
              }
            />
            {/* Warning reference line */}
            <ReferenceLine
              y={warningThreshold}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label={{
                value: "Warning",
                position: "right",
                style: { fontSize: 9, fill: "#f59e0b" },
              }}
            />
            <ReferenceLine
              y={criticalThreshold}
              stroke="#e11d48"
              strokeDasharray="4 2"
              label={{
                value: "Critical",
                position: "right",
                style: { fontSize: 9, fill: "#e11d48" },
              }}
            />
            <Area
              type="monotone"
              dataKey="unmitigated"
              name="unmitigated"
              stroke="#e11d48"
              strokeWidth={2}
              fill="url(#gradUnmitigated)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="rerouted"
              name="rerouted"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradRerouted)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend note */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
        <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          SPR drawdown uses discrete integration:{" "}
          <span className="font-mono-data">
            Reserve(t) = Reserve(t-1) − max(0, Demand − ActiveSupply)
          </span>
          . Includes 12% domestic production offset.
        </p>
      </div>
    </div>
  );
}
