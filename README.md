# DriftShield — Agent Runtime Security (frontend prototype)

> **Frontend-only simulation.** Every agent, tool call, alert and risk score in this app is mock data generated in your browser.
> No real AI agents are monitored, no real confidential data is accessed, and nothing is enforced outside the demo.
> Risk scores are **illustrative** and have **not** been empirically validated. No detection accuracy, latency or production-security claims are made.

DriftShield is a runtime security gateway that sits between autonomous AI agents and the tools they call. This repository is an
interactive prototype built for hackathon demonstration (team **DarkNeuron**, DJS ISACA). It follows the *Identity Drift Detection in
Autonomous AI Agents — Solution Report*.

## Problem

Identity and access management answers *"is this token valid, and is this agent allowed to call this tool?"*
It cannot tell whether an **allowed** action is **expected**. A prompt-injected agent, a stolen token, a slowly drifting agent or a
confused-deputy delegation chain all keep valid credentials while their behaviour changes.

## Solution

Every tool call passes through one gateway that decides inline and explains the decision. Four layers feed one explainable 0–100 score:

1. **Role contract** (deterministic) — allowed tools, sensitivity ceiling, approved egress, rate limits, forbidden sequences.
2. **Taint tracking** (deterministic) — content from PDFs, e-mails and web pages is tagged *untrusted*; sensitive actions that follow it score higher.
3. **Behavioural drift** (statistical) — per-agent baselines with a frozen *golden* profile, sequence/rate/novelty signals and CUSUM.
4. **Delegation provenance** (graph) — every event carries its parent event, root principal and agent chain.

## Core USP — Role · Reason · Routine

| | Question | Signals |
|---|---|---|
| **ROLE** | Is the action permitted for the declared role? | allowed tools, sensitivity ceiling, approved destinations, forbidden sequences |
| **REASON** | Is it justified by the task and by what the agent just read? | input provenance, taint, parent event, root principal, delegation chain |
| **ROUTINE** | Is it consistent with this agent's normal behaviour? | golden / rolling baseline, tool frequency, novelty, sequence and rate anomalies |

Every investigation view shows the three-column PASS / WARN / FAIL summary and a final decision.

## Features

- **Overview** – KPIs, fleet risk gauge, activity chart (15 m / 1 h / 24 h), threat distribution, live event feed, high-risk agents.
- **Live Monitor** – animated 7-stage gateway pipeline fed by a controlled nine-call playlist (start / pause / reset, speed, auto-play toggle).
- **Attack Simulator** – five deterministic, replayable scenarios with step timeline, live risk gauge, terminal log, evidence and causal chain:
  A Poisoned Supplier Document · B Restricted Data Exfiltration · C Suspicious Agent Identity (stolen token) · D Gradual Behavioural Deviation · E Cross-Agent Identity Drift (multi-agent delegation abuse).
- **Agent Fleet** – 12 agents, cards + sortable table, filters, agent profile drawer, simulated Activate / Pause / Quarantine / Isolate / Restore with confirmation.
- **Security Alerts** – search, filters, sort, pagination, drawer with *detected / recommended / enforced* shown separately, acknowledge / close / reopen.
- **Event Timeline** – timeline and table views, filters, structured event JSON with copy-to-clipboard.
- **Delegation Graph** – SVG graph with pan, zoom, fit, session filter, attack-path highlight, node and edge inspector. Run scenario E from the page to watch the chain build.
- **Role Contracts** – edit with validation, save draft → simulate approval → activate, version history and diff, reset.
- **Resource Catalogue** – 15 resources, filters and an access-policy tester that names the violated policy.
- **Audit Trail** – simulated hash chain, tamper demo, working **JSON** and **CSV** export.
- **Settings** – theme, motion, playback, notifications, configurable risk thresholds, reset (persisted in `localStorage`).

## Technology

React 18 · Vite 5 · TypeScript · Tailwind CSS 3 · React Router 6 · Zustand · Recharts · Framer Motion · Lucide icons. No backend, database,
external API or environment variable is required.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run check:engine   # print the deterministic scores of every scenario
```

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Framework preset **Vite** (auto-detected). Build command `npm run build`, output directory `dist`.
3. `vercel.json` rewrites every path to `index.html`, so refreshing a nested route such as `/simulator` does not 404.

No environment variables are needed.

## Project structure

```
src/
  components/
    layout/      sidebar, top bar, shell, toasts, error boundary
    ui/          cards, badges, controls, drawers / modals, misc
    common/      risk gauge, Role·Reason·Routine panel, event / alert / agent drawers, causal chain
    simulator/   gateway pipeline, terminal, drift chart
    charts/      shared chart styling
  pages/         one file per route
  data/          agents, contracts, resources, policies, scenarios, seed history
  lib/           riskScoring, policyEngine, simulationEngine, simRunner, graph, hash, exportUtils, storage
  store/         zustand stores (persisted app state, ephemeral simulation state, UI state)
  hooks/ types/ styles/
```

## Mock data and the simulated risk engine

All data comes from typed TypeScript objects in `src/data`. The seed history is generated by a seeded pseudo-random generator, so every reset is identical.
Scenario events are produced by the **same engine** used everywhere else: each scripted event carries explicit mock features
(taint tags, novelty, rate z-score, fingerprint …) and the detectors turn those into signals.

Scoring (`src/lib/riskScoring.ts`):

```
R = 100 · (1 − Π_f (1 − w_f · s_f))
```

* `s_f` is the **strongest** triggered signal inside evidence family `f` (max, not sum) so one incident is not counted several times.
* Family weights (starting values from the report): contract 0.9 · egress 0.8 · taint 0.7 · delegation 0.6 · behaviour 0.5 · identity 0.5.
* A deterministic **hard violation** (tool not allowed, sensitivity above ceiling, unapproved egress, forbidden sequence) floors the score at 90 and always blocks, independent of the thresholds.
* Bands (configurable in Settings): 0–34 allow · 35–54 watch · 55–74 step-up approval · 75–89 block operation · 90–100 pause agent / quarantine sensitive scopes.
* Results are deterministic and bounded to 0–100. Scenario A lands on 94/100 from its configured mock signals — a demonstration value, not a measured model output.

## Known limitations

- No real agents, tokens, documents or data; "blocking" only affects the in-browser simulation.
- The audit hash chain uses a fast non-cryptographic hash and lives in `localStorage`; it is **not** tamper-proof.
- Detectors, weights and thresholds are demonstration values and are not calibrated on labelled incidents.
- MITRE ATLAS / OWASP references are limited to the identifiers named in the solution report; other mappings are marked illustrative.
- State persists only in the visitor's browser (`localStorage`); the *Reset demo* button restores the seed.
