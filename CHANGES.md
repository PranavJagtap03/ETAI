# KAVACH — Engineering Change Log

> All changes scoped to the five evaluation criteria.

---

## Task 2 — Signal-to-Recommendation Loop

**New file:** `src/lib/engine/signalMapper.ts`  
Maps `RiskAssessment.impacted_chokepoint` enum values to actual `blocked_nodes[]` IDs in `network.json`. Handles `"Multiple"` by scanning `event_summary` for keyword hints before falling back to `["strait_of_hormuz", "bab_el_mandeb"]`.

**Modified:** `src/app/api/engine/simulate/route.ts`  
Added `mode: "preset" | "dynamic"` toggle. Dynamic mode accepts raw `blocked_nodes[]`, `threat_level`, and `risk_score` directly from a `RiskAssessment`, bypassing the hardcoded scenario presets. Returns `signalToRecommendationMs` when a `signalTimestamp` is provided.

**Modified:** `src/app/page.tsx`  
`handleAnalyze()` now auto-triggers `runDynamicSimulation()` via `signalMapper.ts` whenever `risk_score >= RISK_THRESHOLDS.MEDIUM`. The preset flow is unchanged and remains the default.

**Modified:** `src/components/dashboard/LiveTicker.tsx`  
Added `signalToRecommendationMs` prop. Renders amber `⚡ N.Ns` badge when set.

---

## Task 3 — Supplier Graph Expansion + Executable Alternatives

**Modified:** `src/data/network.json`  
Added 4 new supplier nodes and all relevant edges:
- `basra_terminal` — Iraq, 3.5M BPD, Sour
- `bonny_terminal` — Nigeria, 2.0M BPD, Sweet
- `cabinda_terminal` — Angola, 1.2M BPD, Sweet
- `houston_port` — USA, 1.5M BPD, Sweet

Each new supplier has edges to Cape of Good Hope and then to Indian ports, with realistic `distance_nm`, `cost_per_barrel`, and `transit_days`.

**Modified:** `src/lib/agents/riskParser.ts`  
Added `getAvailableSupplierNames()` that reads live node list from `network.json`. `buildPrompt()` injects this list, grounding Gemini recommendations in actual graph nodes.

**Modified:** `src/app/api/engine/simulate/route.ts`  
`buildTopAlternatives()` generates plain-language rationale strings for top-3 viable routes:  
`"Nigeria (Bonny) → Cape → Jamnagar. ✓ Grade compatible (Sweet crude). Total: $11.82/bbl, 26d transit. Capacity: 1.20M BPD."`

**New file:** `src/components/dashboard/AlternativesPanel.tsx`  
Displays top-3 alternatives with rank badge, cost/bbl, transit days, capacity, grade compat indicator, and rationale text.

**Modified:** `src/components/dashboard/RiskPanel.tsx`  
Added `alternatives` prop and renders `AlternativesPanel` below the macro shock section.

---

## Task 1 — Live News Ingestion Pipeline

**New file:** `src/lib/ingestion/newsFeed.ts`  
- `fetchGdeltArticles()` — GDELT DOC 2.0 API, no auth required, returns up to 25 articles per query
- `fetchNewsApiArticles()` — NewsAPI.org, requires `NEWSAPI_KEY` env var (skips gracefully if missing)
- `deduplicateArticles()` — URL + title similarity dedup
- `relevanceScore()` — 4-keyword hit relevance pre-filter (saves Gemini quota)
- `getLatestArticles()` — file-cache at `src/data/news_cache.json` with 30-minute TTL

**New file:** `src/app/api/ingestion/news/live/route.ts`  
`GET /api/ingestion/news/live?hours=6`  
Fetches articles, pre-filters, runs Gemini on candidates, returns `detectionLatencyMs` (article publishedAt → ingested timestamp).

**New file:** `src/hooks/useNewsFeed.ts`  
React hook polling `/api/ingestion/news/live` every 5 minutes. Deduplicates across polls. Fires `onHighRiskAlert` callback for new high-risk articles. Exposes `latestDetectionMs` for display.

**Modified:** `src/components/dashboard/IntelligencePanel.tsx`  
New "Live Feed" section above the paste box shows last 3 real-time alerts with threat badge and detection latency. Clicking an alert loads it into the analyze flow.

---

## Task 4 — Explicit Assumptions + Sensitivity Band

**Modified:** `src/lib/engine/sprSimulator.ts`  
`simulate()` and `_computeTrajectory()` now accept optional `domesticProductionPct` override.  
`worstCaseSupplyBPD()` and `reroutedSupplyBPD()` accept `rerouteRecoveryPct` and `domesticProductionPct` overrides.

**Modified:** `src/lib/engine/macroImpact.ts`  
`compute()` accepts optional `gdpFrictionUsdPerBarrel`, `fuelPriceSpikeMultiplier`, `refineryRunrateMultiplier` overrides. Local variables use overrides; module-level constants remain as documented defaults.

**Modified:** `src/app/api/engine/simulate/route.ts`  
Threads `assumptionOverrides` from request body through both engine calls. Runs `computeSensitivityBand()` at `rerouteRecoveryPct ± 0.20`. Returns `assumptions` object (all active values) and `sensitivityBand` in every response.

**Modified:** `src/components/dashboard/ExecutiveBriefModal.tsx`  
Added "Model Assumptions & Sensitivity" accordion below brief content listing all 6 constants plus Gemini's disruption estimate. Shows `±20% recovery sensitivity band` when available.

---

## Task 5 — Geospatial Depth

**Modified:** `src/app/api/fleet/telemetry/route.ts`  
`GET` handler now reads `?blockedNodes=comma,separated,list` query param from client.  
Merges dynamic blocked nodes with scenario preset blocked nodes for correct map rendering in dynamic simulation mode.

**Modified:** `src/data/network.json`  
New supplier nodes appear in the node list and are picked up by the telemetry route's `nodeFeatures` mapper, so they render as supplier markers on the map.
