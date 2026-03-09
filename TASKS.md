# TASKS.md — Build Plan

Seven ordered tasks to build the Funnel Gap Analyzer. Each task builds on the previous one. Do not skip ahead.

---

## Task 1: Type Definitions and Benchmark Data Layer

**Goal:** Establish all TypeScript types, interfaces, and the benchmark data constants. This is the contract that every other layer depends on.

**Files to create:**
- `src/lib/types.ts`
- `src/lib/benchmarks.ts`
- `src/utils/format.ts`

**Deliverables:**

1. Define `FunnelInputs` — the user-provided form data:
   - `visitors`: number (monthly unique visitors)
   - `visitorToLeadRate`: number (0–100)
   - `leadToQualifiedRate`: number (0–100)
   - `qualifiedToProposalRate`: number (0–100)
   - `proposalToCloseRate`: number (0–100)
   - `averageDealValue`: number (dollars)

2. Define `StageName` union type: `'visitorToLead' | 'leadToQualified' | 'qualifiedToProposal' | 'proposalToClose'`

3. Define `FunnelStage` — computed data for one stage:
   - `name`: StageName
   - `label`: string (human-readable, e.g., "Visitor → Lead")
   - `userRate`: number
   - `benchmarkRate`: number
   - `gap`: number (benchmark − user, clamped ≥ 0)
   - `revenueAtRisk`: number
   - `status`: `'on-track' | 'warning' | 'critical'`

4. Define `AnalysisResult`:
   - `stages`: FunnelStage[]
   - `currentRevenue`: number
   - `projectedRecovery`: number
   - `stageVolumes`: { visitors, leads, qualified, proposals, customers }
   - `largestLeak`: FunnelStage | null
   - `bestNextFix`: FunnelStage | null

5. Define `ScenarioResult`:
   - `stageName`: StageName
   - `adjustedRate`: number
   - `newRevenue`: number
   - `revenueDelta`: number
   - `newStageVolumes`: { visitors, leads, qualified, proposals, customers }

6. Define `BenchmarkData` as a `Record<StageName, number>` constant with values:
   - visitorToLead: 3.0
   - leadToQualified: 35.0
   - qualifiedToProposal: 50.0
   - proposalToClose: 25.0

7. Define default `FunnelInputs` constant with the spec defaults.

8. Create formatting utilities in `src/utils/format.ts`:
   - `formatCurrency(value: number): string` — $1,234 or $1.2M for large values
   - `formatNumber(value: number): string` — comma-separated integers
   - `formatPercent(value: number): string` — one decimal, with % suffix
   - `clamp(value: number, min: number, max: number): number`

**Guardrails:**
- All rates stored as 0–100 (not 0–1)
- All types exported, no `any`
- Benchmark data is `as const` where possible

**Validation:** `npm run build` passes with no errors.

---

## Task 2: Core Funnel Math Engine

**Goal:** Pure functions that take `FunnelInputs` and return a complete `AnalysisResult`. Zero UI code.

**Files to create:**
- `src/lib/engine.ts`

**Deliverables:**

1. `calculateStageVolumes(inputs: FunnelInputs)` — compute the absolute count at each stage:
   - leads = visitors × visitorToLeadRate / 100
   - qualified = leads × leadToQualifiedRate / 100
   - proposals = qualified × qualifiedToProposalRate / 100
   - customers = proposals × proposalToCloseRate / 100

2. `calculateRevenue(customers: number, dealValue: number): number`

3. `calculateRevenueAtRisk(inputs: FunnelInputs, stageName: StageName): number`
   - Clone inputs, set the given stage to its benchmark rate
   - Recalculate full funnel
   - Return delta vs. current revenue
   - Return 0 if user rate ≥ benchmark

4. `analyzeFunnel(inputs: FunnelInputs): AnalysisResult`
   - Compute volumes, revenue, gaps, revenue at risk for each stage
   - Assign status: `'critical'` for largest leak, `'warning'` for other leaks, `'on-track'` for at/above benchmark
   - Sort stages by revenue at risk descending
   - Set `largestLeak` and `bestNextFix` to the top-ranked leaking stage (or null if none)
   - Sum all revenue at risk into `projectedRecovery`

**Edge cases to handle:**
- visitors = 0 → all downstream = 0, revenue = 0, no leaks
- All rates ≥ benchmark → no leaks, `largestLeak` = null
- Rates at exactly benchmark → not a leak (gap = 0)

**Validation:** `npm run build` passes with no errors.

---

## Task 3: Scenario Engine and Priority Ranking

**Goal:** Functions to compute what-if scenarios. Still zero UI code.

**Files to create:**
- `src/lib/scenarios.ts`

**Deliverables:**

1. `calculateScenario(inputs: FunnelInputs, stageName: StageName, adjustedRate: number): ScenarioResult`
   - Clamp adjustedRate between current rate and 100
   - Clone inputs with the adjusted rate for the given stage
   - Recalculate full funnel with adjusted inputs
   - Return new revenue, delta vs. current, and new stage volumes

2. `generateRecommendation(stage: FunnelStage, inputs: FunnelInputs): string`
   - Produce a plain-language sentence like: "Improving your Visitor → Lead conversion from 2.5% to the 3.0% benchmark could recover an estimated $12,500/month in revenue."
   - Use the formatting utilities from Task 1

**Validation:** `npm run build` passes with no errors.

---

## Task 4: Input Form UI

**Goal:** Build the `FunnelForm` client component with all fields, validation, defaults, and formatting.

**Files to create:**
- `src/components/FunnelForm.tsx`

**Deliverables:**

1. Client component (`"use client"`)
2. Six input fields as defined in SPEC §6.1, pre-filled with defaults
3. Inline validation on blur:
   - Percentage fields: 0–100
   - Visitors: 0–100,000,000
   - Deal value: 0–10,000,000
   - Show red error text below invalid fields
4. Input formatting:
   - Comma separators for visitors and deal value
   - `$` prefix for deal value
   - `%` suffix for percentage fields
5. "Analyze Funnel" button that calls an `onSubmit(inputs: FunnelInputs)` callback prop
6. Dark theme styling per CLAUDE.md design system
7. Responsive: two-column grid on desktop, single column on mobile

**Validation:** `npm run build` passes. Form renders and is interactive in `npm run dev`.

---

## Task 5: Output Dashboard UI

**Goal:** Build all dashboard components that display the analysis results.

**Files to create:**
- `src/components/Dashboard.tsx`
- `src/components/FunnelSummary.tsx`
- `src/components/GapCard.tsx`
- `src/components/PriorityCard.tsx`
- `src/components/ScenarioSlider.tsx`

**Deliverables:**

1. **Dashboard.tsx** — container that takes `AnalysisResult` and `FunnelInputs` as props, renders all sub-components. Shows a "No leaks detected" state when appropriate.

2. **FunnelSummary.tsx** — horizontal bar/flow showing stage volumes (Visitors → Leads → Qualified → Proposals → Customers → Revenue). Each stage shows count, conversion rate, and status color.

3. **GapCard.tsx** — one card per stage showing: stage label, your rate vs benchmark rate, gap in percentage points (or "On Track"), revenue at risk, status color indicator (green/amber/red).

4. **PriorityCard.tsx** — prominent card showing Largest Revenue Leak, Best Next Fix recommendation text, and Projected Revenue Recovery total. Uses `generateRecommendation()` from Task 3.

5. **ScenarioSlider.tsx** — client component (`"use client"`). For each leaking stage, renders a range slider. Shows current rate, benchmark marker, selected target rate, and real-time revenue delta. Uses `calculateScenario()` from Task 3.

**All components:**
- Dark theme per CLAUDE.md
- Responsive (stack on mobile)
- Use status colors correctly
- Use Geist Mono for numeric data

**Validation:** `npm run build` passes with no errors.

---

## Task 6: Wire Everything Together

**Goal:** Connect the form, engine, and dashboard on the main page. The app should be fully functional.

**Files to modify:**
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`

**Deliverables:**

1. **page.tsx** — convert to a client component that:
   - Holds `FunnelInputs` state (initialized with defaults)
   - Holds `AnalysisResult | null` state
   - On mount or form submit: runs `analyzeFunnel()` and stores result
   - Renders `FunnelForm` at top with `onSubmit` handler
   - Renders `Dashboard` below with analysis result (or nothing if null)
   - Max-width 1200px, centered

2. **layout.tsx** — set page metadata (title: "Funnel Gap Analyzer", description), apply Geist fonts, set background color

3. **globals.css** — add custom CSS properties for the color palette, ensure dark background on html/body, add any Tailwind @layer overrides needed

**Validation:** `npm run build` passes. Full flow works in `npm run dev`: fill form → click Analyze → see dashboard → adjust scenario sliders.

---

## Task 7: Visual Polish

**Goal:** Refine the UI to match the premium dark aesthetic. Fix any visual inconsistencies.

**Files to modify:** Any component files as needed.

**Deliverables:**

1. Verify all colors match CLAUDE.md exactly
2. Ensure consistent spacing, padding, and border radius across all cards and sections
3. Verify responsive layout at mobile (< 768px), tablet (768–1024px), and desktop (> 1024px)
4. Add subtle transitions: hover states on buttons and cards, smooth slider interaction
5. Verify Geist Mono is used for all numeric values (counts, rates, currency)
6. Ensure "Analyze Funnel" button has the subtle gradient CTA style
7. Test edge cases visually:
   - All zeros input
   - All rates above benchmark ("No leaks detected")
   - Single stage leaking
   - All stages leaking
8. Remove the default Next.js boilerplate styling and content
9. Clean up any unused imports or dead code

**Validation:** `npm run build` passes. `npm run lint` passes. Visual inspection confirms the dark premium aesthetic with no leftover boilerplate.
