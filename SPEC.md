# SPEC.md — Funnel Gap Analyzer

## 1. Product Purpose

Funnel Gap Analyzer is a single-page diagnostic tool that answers one question: **where is the funnel leaking money and what should we fix first?**

A user inputs their funnel metrics (visitor count, conversion rates at each stage, and average deal value). The tool compares each stage against industry benchmarks, identifies the largest revenue leaks, ranks them by recoverable revenue, and recommends the single best fix to pursue first.

No login. No database. No API calls. Everything runs client-side in the browser.

---

## 2. Funnel Model

The funnel has five stages, each with an input metric and a conversion rate to the next stage:

| Stage | Input Metric | Conversion To Next Stage |
|-------|-------------|--------------------------|
| **Visitors** | Monthly unique visitors | Visitor → Lead conversion rate |
| **Leads** | Leads generated | Lead → Qualified conversion rate |
| **Qualified** | Marketing/Sales qualified leads | Qualified → Proposal conversion rate |
| **Proposals** | Proposals sent / demos given | Proposal → Close conversion rate |
| **Customers** | Closed deals | *(terminal stage)* |

Additionally, the user provides:

- **Average Deal Value** ($): revenue per closed deal

### Derived Metrics

- **Leads** = Visitors × Visitor→Lead rate
- **Qualified** = Leads × Lead→Qualified rate
- **Proposals** = Qualified × Qualified→Proposal rate
- **Customers** = Proposals × Proposal→Close rate
- **Total Revenue** = Customers × Average Deal Value

---

## 3. Benchmark Data

Industry benchmarks represent median B2B SaaS performance. Each stage has a benchmark conversion rate:

| Conversion | Benchmark Rate |
|-----------|---------------|
| Visitor → Lead | 3.0% |
| Lead → Qualified | 35.0% |
| Qualified → Proposal | 50.0% |
| Proposal → Close | 25.0% |

These benchmarks are stored as a typed constant, not fetched from an API.

---

## 4. Gap Analysis Engine

For each funnel stage, the engine computes:

### 4.1. Gap Identification

- **Gap** = Benchmark rate − User rate (clamped to 0 if user is above benchmark)
- A stage is "leaking" if the user's conversion rate is below the benchmark

### 4.2. Revenue Impact Calculation

For each leaking stage, compute the **Revenue at Risk** — the additional revenue the user would earn if that single stage improved to benchmark, holding all other stages constant.

```
Revenue at Benchmark Rate = recalculate full funnel with this one stage at benchmark
Revenue at Risk = Revenue at Benchmark Rate − Current Total Revenue
```

This is the **incremental revenue** from fixing one stage in isolation.

### 4.3. Priority Ranking

Rank all leaking stages by Revenue at Risk, descending. The stage with the highest Revenue at Risk is:

- **Largest Revenue Leak** — the stage losing the most money
- **Best Next Fix** — the recommended first action

### 4.4. Projected Revenue Recovery

Sum of all Revenue at Risk across all leaking stages. This represents the theoretical maximum recovery if every stage reached benchmark. Note: this is a ceiling estimate because individual stage improvements compound, so the sum overstates the total. Display with appropriate caveat language.

---

## 5. Scenario Engine

The scenario engine answers: "What if I improve stage X to Y%?"

### 5.1. Behavior

- User adjusts a single stage's conversion rate (via slider or direct input)
- The engine recalculates the full funnel with the adjusted rate
- Dashboard updates in real time to show the new revenue, new gap, and delta vs. current

### 5.2. Constraints

- Scenario adjustments are bounded: minimum = current rate, maximum = 100%
- Benchmark line remains visible for reference
- Only one stage can be adjusted at a time (to keep the mental model simple)

---

## 6. Input Form

### 6.1. Fields

| Field | Type | Validation | Default |
|-------|------|-----------|---------|
| Monthly Visitors | Integer | ≥ 0, max 100,000,000 | 10,000 |
| Visitor → Lead Rate | Percentage | 0–100% | 2.5% |
| Lead → Qualified Rate | Percentage | 0–100% | 30.0% |
| Qualified → Proposal Rate | Percentage | 0–100% | 45.0% |
| Proposal → Close Rate | Percentage | 0–100% | 20.0% |
| Average Deal Value | Currency ($) | ≥ 0, max 10,000,000 | $5,000 |

### 6.2. Behavior

- Form starts pre-filled with defaults so the user sees a working example immediately
- All fields validate on blur and on submit
- Invalid values show inline error messages (no modals, no toasts)
- "Analyze Funnel" button triggers the analysis
- Form is a client component (`"use client"`)

### 6.3. Input Formatting

- Visitor count and deal value display with comma separators (e.g., 10,000)
- Percentage fields display with one decimal place
- Currency field displays with `$` prefix

---

## 7. Output Dashboard

The dashboard renders the analysis results. All components below appear on a single page below the input form.

### 7.1. Funnel Summary Bar

A horizontal bar showing each stage's volume (Visitors → Leads → Qualified → Proposals → Customers) with the final revenue figure. Each stage shows:

- Stage name
- Absolute count
- Conversion rate to next stage
- Status color based on gap severity

### 7.2. Gap Analysis Cards

One card per funnel stage, showing:

- **Stage name** (e.g., "Visitor → Lead")
- **Your rate** vs **Benchmark rate**
- **Gap** (percentage points below benchmark, or "On Track" if at/above)
- **Revenue at Risk** (dollar amount, formatted)
- **Status indicator** using status colors:
  - Green (`#3daa8c`): at or above benchmark
  - Amber (`#d4a24e`): gap exists but not the largest leak
  - Red (`#d94a4a`): largest revenue leak

### 7.3. Priority Recommendation

A prominent card highlighting:

- **Largest Revenue Leak**: which stage and how much revenue at risk
- **Best Next Fix**: plain-language recommendation (e.g., "Improving your Visitor → Lead conversion from 2.5% to the 3.0% benchmark could recover an estimated $X/month")
- **Projected Revenue Recovery**: total recoverable revenue across all stages

### 7.4. Scenario Slider

For each leaking stage, a slider that lets the user explore "what if I improve this rate to X%?"

- Shows current rate, benchmark rate (as a marker), and the user-selected target
- Displays the resulting revenue delta in real time
- Resets when the user modifies the input form

---

## 8. Data Validation & Guardrails

### 8.1. Type Safety

All data structures are defined with TypeScript interfaces/types:

- `FunnelInputs` — user-provided metrics
- `FunnelStage` — computed stage data (volume, rate, gap, revenue impact)
- `BenchmarkData` — benchmark rates per stage
- `AnalysisResult` — complete analysis output
- `ScenarioResult` — what-if scenario output

### 8.2. Runtime Validation

- All percentage inputs clamped to 0–100
- All numeric inputs clamped to their defined ranges
- Division by zero guarded (if visitors = 0, all downstream = 0)
- Revenue calculations use safe arithmetic (no floating point display errors — round to nearest cent for display, nearest dollar for large values)

### 8.3. Edge Cases

- All zeros: display empty funnel with $0 revenue, no gaps flagged
- All rates at or above benchmark: display "No leaks detected" state
- Single stage below benchmark: that stage is both largest leak and best fix
- Very large numbers: format with K/M suffixes above 10,000 (e.g., $1.2M)

---

## 9. Visual Design

### 9.1. Layout

- Single-page application
- Input form at top
- Dashboard results below (hidden until first analysis, or shown with defaults)
- Maximum content width: 1200px, centered
- Responsive: stacks to single column below 768px

### 9.2. Color System

As defined in CLAUDE.md:

- **Background:** `#0f1117` (page), `#141720` (alternate sections)
- **Panels:** `#1c1f2e` (cards), `#232738` (elevated elements)
- **Primary text:** `#e8eaf0`
- **Secondary text:** `#8a8fa8`
- **Benchmark reference:** `#4a90d9` (cool blue)
- **On/above benchmark:** `#3daa8c` (teal/green)
- **Warning gap:** `#d4a24e` (amber)
- **Critical leak:** `#d94a4a` (red)

### 9.3. Typography

- Use the Geist font family (already included in Next.js scaffold)
- Headings: Geist Sans, semibold
- Body: Geist Sans, regular
- Monospace data: Geist Mono for numbers and rates

### 9.4. Component Style

- Cards: rounded-lg, 1px border with `rgba(255,255,255,0.06)`, background `#1c1f2e`
- Buttons: solid fill, no outlines, subtle hover state
- Inputs: dark background (`#141720`), 1px border `rgba(255,255,255,0.1)`, focus ring with primary blue
- No shadows — use border and background differentiation for elevation
- No gradients except subtle ones on the primary CTA button

---

## 10. Technical Architecture

### 10.1. File Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with fonts and metadata
│   ├── page.tsx            # Main page composing form + dashboard
│   └── globals.css         # Tailwind base styles + custom properties
├── components/
│   ├── FunnelForm.tsx      # Input form (client component)
│   ├── Dashboard.tsx       # Dashboard container
│   ├── FunnelSummary.tsx   # Horizontal funnel bar
│   ├── GapCard.tsx         # Individual gap analysis card
│   ├── PriorityCard.tsx    # Best-next-fix recommendation
│   └── ScenarioSlider.tsx  # What-if slider (client component)
├── lib/
│   ├── types.ts            # All TypeScript types/interfaces
│   ├── benchmarks.ts       # Benchmark data constants
│   ├── engine.ts           # Core funnel math engine
│   └── scenarios.ts        # Scenario engine
└── utils/
    └── format.ts           # Number/currency/percentage formatters
```

### 10.2. State Management

- React `useState` in the main page component
- No external state libraries (no Redux, Zustand, etc.)
- Form state managed locally in FunnelForm
- Analysis results lifted to page level and passed down as props
- Scenario state managed locally in ScenarioSlider

### 10.3. Performance

- All computation is synchronous and trivial (< 1ms)
- No loading states needed for calculations
- No API calls
- Static export compatible

---

## 11. Non-Goals

These are explicitly out of scope:

- User accounts / authentication
- Data persistence / database
- API integrations (CRM, analytics platforms)
- Historical tracking / time series
- Multiple funnel comparison
- PDF export
- Email reports
- Custom benchmark editing
- A/B test integration
- Multi-currency support
