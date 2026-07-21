"use client";

import { ThreatLevel } from "@/lib/config";
import { Shield, Activity, Zap, Clock } from "lucide-react";

interface HeaderProps {
  threatLevel: ThreatLevel;
  scenarioLabel: string;
  riskScore: number;
  isSimulating: boolean;
}

const THREAT_CONFIG = {
  LOW: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    glow: "",
    label: "LOW THREAT",
  },
  MEDIUM: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    glow: "animate-pulse-amber",
    label: "MEDIUM THREAT",
  },
  HIGH: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-800",
    dot: "bg-orange-500",
    glow: "animate-pulse-amber",
    label: "HIGH THREAT",
  },
  CRITICAL: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    glow: "animate-pulse-red",
    label: "CRITICAL THREAT",
  },
};

export function Header({
  threatLevel,
  scenarioLabel,
  riskScore,
  isSimulating,
}: HeaderProps) {
  const config = THREAT_CONFIG[threatLevel];
  const now = new Date();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      {/* Top brand bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Logo Mark */}
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center bg-navy-gradient shadow-sm ${config.glow}`}
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
              }}
            >
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div
              className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${config.dot} animate-blink`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-800 tracking-tight text-slate-900 font-extrabold">
                KAVACH
              </span>
              <span className="text-xs text-slate-400 font-medium border border-slate-200 rounded px-1.5 py-0.5">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 -mt-0.5">
              Energy Supply Chain Resilience Command Center
            </p>
          </div>
        </div>

        {/* Center — threat strip */}
        <div
          className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${config.bg} ${config.border} ${config.glow}`}
        >
          <div className={`w-2 h-2 rounded-full ${config.dot} animate-blink`} />
          <span className={`text-xs font-700 font-bold tracking-widest ${config.text}`}>
            {config.label}
          </span>
          <div className="h-4 w-px bg-current opacity-20" />
          <span className={`text-xs font-mono-data font-bold ${config.text}`}>
            RISK: {(riskScore * 100).toFixed(0)}%
          </span>
        </div>

        {/* Right — meta */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="w-3.5 h-3.5" />
            <span>
              {isSimulating ? (
                <span className="text-blue-600 font-medium animate-pulse">
                  Simulating…
                </span>
              ) : (
                "Live"
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono-data" suppressHydrationWarning>
              {now.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              IST
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-slate-600 font-medium">
              ET AI Hackathon 2026
            </span>
          </div>
        </div>
      </div>

      {/* Scenario sub-bar */}
      <div className="flex items-center gap-2 px-6 py-2">
        <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">
          Active Scenario:
        </span>
        <span className="text-xs font-semibold text-slate-700">
          {scenarioLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">
            India SPR Buffer: 9.5 days &nbsp;|&nbsp; Import Dependency: 88%
            &nbsp;|&nbsp; Hormuz Transit: ~42.5%
          </span>
        </div>
      </div>
    </header>
  );
}
