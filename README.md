# KAVACH — Energy Security Command Center

KAVACH is a web-based decision-support platform for analyzing geopolitical and logistics disruptions in the global oil supply chain. It is designed for rapid scenario simulation, risk assessment, and executive reporting around chokepoint disruptions such as the Strait of Hormuz, Bab-el-Mandeb, and the Suez Canal.

The application combines a live interactive map, fleet movement visualization, AI-powered threat analysis, and economic impact modeling into one dashboard.

## Why this project exists

India and many other economies depend heavily on imported crude oil. When a major shipping corridor is blocked or threatened, the impact is not limited to logistics. It can affect:

- fuel prices
- refinery throughput
- supply availability
- strategic reserves
- macroeconomic stability

KAVACH helps users understand these consequences quickly and turn raw news signals into operational insight.

## What the product does

KAVACH allows a user to:

- view a simulated or live crisis scenario on a map
- analyze how blocked chokepoints affect routes and shipping flow
- compare rerouted alternatives and associated costs/delays
- estimate the impact on Strategic Petroleum Reserves (SPR)
- understand the macroeconomic impact such as fuel price spikes and GDP pressure
- run AI-based analysis on news text or breaking signals
- generate a concise executive brief for leadership review

## Core user experience

The dashboard is built around a single idea: from signal to action.

A typical workflow is:

1. Select a scenario or receive a live alert
2. Observe affected routes and blocked nodes on the map
3. Review risk numbers, economic pressure, and rerouting impact
4. Use AI analysis to interpret incoming information
5. Generate an executive brief for decision-makers

## Main features

### 1. Scenario simulation
The app includes predefined crisis scenarios such as:

- Baseline (no disruption)
- Hormuz Shutdown
- Red Sea Escalation
- Suez Disruption
- Dual Chokepoint Crisis

Each scenario simulates the effects of a disruption on:

- route availability
- rerouting cost
- transit delay
- supply deficit
- SPR drawdown
- macroeconomic pressure

### 2. AI-based intelligence analysis
Users can paste news text or a scenario summary and send it to an AI model for structured risk assessment. The system extracts:

- threat level
- risk score
- impacted chokepoint
- estimated disruption duration
- event summary
- recommended action

### 3. Live signal ingestion
The app can poll live news sources and surface high-risk articles. This gives the interface a “live intelligence” feel and supports rapid response monitoring.

### 4. Map-driven visualization
The dashboard includes an interactive map powered by Leaflet and React Leaflet. It visualizes:

- shipping routes
- blocked nodes
- rerouted paths
- vessel movement
- geopolitical chokepoints

### 5. Executive brief generation
The software can generate a ministerial-style summary of a scenario, including:

- supply chain status
- economic outlook
- reserve position
- recommended actions

## Technology stack

KAVACH is built with:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Leaflet + React Leaflet
- Recharts
- Google Gemini AI for risk analysis
- Node.js server APIs for simulation and ingestion

## Project structure

```text
src/
  app/
    page.tsx                  # main dashboard entry
    api/
      engine/simulate/        # simulation API
      fleet/telemetry/        # telemetry API
      ingestion/news/         # AI analysis API
      ingestion/news/live/    # live news polling API
  components/
    dashboard/               # dashboard widgets and panels
  hooks/
    useNewsFeed.ts           # live news polling hook
  lib/
    agents/
      riskParser.ts          # Gemini-based risk parsing
    config.ts               # scenario definitions and constants
    engine/
      digitalTwin.ts        # network model for route analysis
      macroImpact.ts        # economic impact calculations
      rerouter.ts           # alternative routing logic
      signalMapper.ts       # mapping threat signals to blocked nodes
      sprSimulator.ts       # SPR drawdown simulation
    ingestion/
      newsFeed.ts           # GDELT / NewsAPI ingestion logic
  data/
    news_cache.json         # cached live news data
```

## Prerequisites

Make sure you have the following installed:

- Node.js 20+ recommended
- npm

## Environment setup

Create a `.env.local` file in the project root and add the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key_here
# Optional
NEWSAPI_KEY=your_newsapi_key_here
```

### Notes

- The app uses Gemini for risk analysis and executive brief generation.
- If `GEMINI_API_KEY` is not configured, the AI analysis features may fail or return errors.
- Live news features can still work partially through GDELT even without API keys.

## Installation

Install dependencies:

```bash
npm install
```

## Running the app locally

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Available scripts

```bash
npm run dev      # start the development server
npm run build    # build the production app
npm run start    # start the built app
npm run lint     # run eslint checks
```

## How the app works

### Simulation flow

When a scenario is selected, the server route at `/api/engine/simulate` runs a multi-step computation:

1. model the network state
2. identify blocked nodes and impacted routes
3. compute alternative reroutes
4. estimate supply deficit and cost impact
5. simulate SPR drawdown
6. calculate macroeconomic impact

### Intelligence flow

When the user submits text or a live news alert:

1. the text is sent to the ingestion endpoint
2. the risk parser extracts structured intelligence from it
3. the UI updates with threat level, risk score, and impact summary
4. the simulation can be triggered automatically if risk is high

### Executive brief flow

When the user requests an executive brief:

1. the current scenario and assessment are combined
2. the app builds a narrative summary
3. the system presents a decision-oriented brief for leadership

## Demo guide

If you want to present this project in a video or live demo, a good flow is:

1. Open the dashboard and explain the problem: energy supply is vulnerable to chokepoint disruptions.
2. Show the baseline view to establish normal operations.
3. Switch to a crisis scenario such as Hormuz Shutdown.
4. Highlight the map and the affected route.
5. Explain how the risk panel captures the disruption severity.
6. Show the rerouting options and alternative path cost/delay.
7. Demonstrate the SPR panel and explain reserve strain.
8. Paste a news article into the intelligence panel and show AI analysis.
9. Generate the executive brief and explain how leadership can use it.

This narrative makes the product feel practical and decision-driven rather than purely technical.

## Configuration notes

The simulation constants and scenario definitions live in:

- [src/lib/config.ts](src/lib/config.ts)

The main UI is driven by:

- [src/app/page.tsx](src/app/page.tsx)

The AI parsing logic is implemented in:

- [src/lib/agents/riskParser.ts](src/lib/agents/riskParser.ts)

## Potential extensions

Future improvements could include:

- real-time vessel tracking integration
- richer GIS layers and satellite overlays
- multi-country policy comparison
- push notifications for high-risk alerts
- dashboard export to PDF or PowerPoint
- authentication and role-based access for analysts and executives

## Troubleshooting

### The app does not start
Check that dependencies are installed correctly:

```bash
npm install
```

### AI analysis fails
Verify that your Gemini API key is valid and set in `.env.local`.

### Live feed is empty
The live feed may be unavailable due to network restrictions or external service limits. The app can still run using the preloaded scenarios and local simulation data.

## Summary

KAVACH is a practical demonstration of how modern web applications can support high-stakes decision-making using:

- geospatial visualization
- scenario simulation
- AI-assisted intelligence parsing
- executive reporting

It is especially useful for presentations, strategic planning, and crisis-response demonstrations.
