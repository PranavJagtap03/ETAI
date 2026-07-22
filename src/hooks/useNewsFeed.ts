"use client";

// ============================================================
// KAVACH — useNewsFeed hook
// Polls /api/ingestion/news/live every 5 minutes and surfaces
// high-risk articles as live alerts in the dashboard.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import type { RiskAssessment } from "@/lib/agents/riskParser";
import { RISK_THRESHOLDS } from "@/lib/config";

// ── Types ────────────────────────────────────────────────────

export interface LiveAlert {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  provider: string;
  relevanceScore: number;
  assessment: RiskAssessment;
  ingestedAt: string;
  detectionLatencyMs: number;
}

interface UseNewsFeedOptions {
  pollIntervalMs?: number;  // default 5 minutes
  hoursBack?: number;       // default 6h window
  minRiskScore?: number;    // default RISK_THRESHOLDS.MEDIUM
  onHighRiskAlert?: (alert: LiveAlert) => void;
}

interface UseNewsFeedReturn {
  liveAlerts: LiveAlert[];
  latestDetectionMs: number | null;
  isPolling: boolean;
  lastPollAt: string | null;
  error: string | null;
  pollNow: () => void;
}

// ── Hook ──────────────────────────────────────────────────────

export function useNewsFeed({
  pollIntervalMs = 5 * 60 * 1000, // 5 minutes
  hoursBack = 6,
  minRiskScore = RISK_THRESHOLDS.MEDIUM,
  onHighRiskAlert,
}: UseNewsFeedOptions = {}): UseNewsFeedReturn {
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [latestDetectionMs, setLatestDetectionMs] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track seen article URLs to avoid re-firing onHighRiskAlert
  const seenUrls = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    setIsPolling(true);
    setError(null);
    try {
      const res = await fetch(`/api/ingestion/news/live?hours=${hoursBack}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error ?? "Unknown feed error");

      const items: Array<{
        article: {
          title: string;
          url: string;
          source: string;
          publishedAt: string;
          provider: string;
          relevanceScore: number;
        };
        assessment: RiskAssessment;
        ingestedAt: string;
        detectionLatencyMs: number;
      }> = json.items ?? [];

      // Filter to high-risk alerts
      const highRisk = items.filter(
        (item) => item.assessment.risk_score >= minRiskScore
      );

      const newAlerts: LiveAlert[] = highRisk.map((item) => ({
        id: `${item.article.url}_${item.ingestedAt}`,
        ...item.article,
        assessment: item.assessment,
        ingestedAt: item.ingestedAt,
        detectionLatencyMs: item.detectionLatencyMs,
      }));

      // Only add truly new alerts (not seen before)
      const freshAlerts = newAlerts.filter(
        (a) => !seenUrls.current.has(a.url)
      );

      if (freshAlerts.length > 0) {
        freshAlerts.forEach((a) => seenUrls.current.add(a.url));
        setLiveAlerts((prev) =>
          [...freshAlerts, ...prev].slice(0, 20) // cap at 20 alerts
        );

        // Fire callbacks for brand-new high-risk alerts
        if (onHighRiskAlert) {
          freshAlerts.forEach((a) => onHighRiskAlert(a));
        }
      }

      // Track best (lowest) detection latency from this batch
      const latencies = items.map((i) => i.detectionLatencyMs).filter((l) => l > 0);
      if (latencies.length > 0) {
        setLatestDetectionMs(Math.min(...latencies));
      }

      setLastPollAt(new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Feed error";
      console.error("[KAVACH] useNewsFeed poll error:", msg);
      setError(msg);
    } finally {
      setIsPolling(false);
    }
  }, [hoursBack, minRiskScore, onHighRiskAlert]);

  // Initial poll on mount
  useEffect(() => {
    poll();
  }, [poll]);

  // Recurring polling
  useEffect(() => {
    intervalRef.current = setInterval(poll, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, pollIntervalMs]);

  return {
    liveAlerts,
    latestDetectionMs,
    isPolling,
    lastPollAt,
    error,
    pollNow: poll,
  };
}
