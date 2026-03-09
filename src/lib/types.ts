// ---------------------------------------------------------------------------
// Funnel Gap Analyzer — Type Definitions
// ---------------------------------------------------------------------------

// ---- Template identifiers -------------------------------------------------

export type TemplateId =
  | 'dtc-ecommerce'
  | 'b2b-saas-leadgen'
  | 'b2b-saas-trial'
  | 'local-services'
  | 'consumer-app'
  | 'creator-info';

// ---- Stage definitions ----------------------------------------------------

/** A single conversion step in a funnel template. */
export interface StageDefinition {
  /** Machine key, e.g. "visitorToLead" */
  key: string;
  /** Human-readable label, e.g. "Visitor → Lead" */
  label: string;
  /** Label for the upstream volume, e.g. "Visitors" */
  fromLabel: string;
  /** Label for the downstream volume, e.g. "Leads" */
  toLabel: string;
}

// ---- Guardrails -----------------------------------------------------------

/** Plausible rate range for a single conversion stage in a specific industry. */
export interface StageGuardrails {
  /** Minimum plausible rate (%). Below this, flag as suspicious. */
  rateFloor: number;
  /** Maximum plausible rate (%). Above this, flag as suspicious. */
  rateCeiling: number;
}

/** Plausible revenue-per-conversion range for an industry. */
export interface RevenueGuardrails {
  floor: number;
  ceiling: number;
}

/** Global traffic volume bounds. */
export interface TrafficBounds {
  readonly min: number;
  readonly max: number;
}

/** Global recovery guardrails applied after gap analysis. */
export interface RecoveryGuardrails {
  /**
   * Maximum projected recovery as a fraction of current revenue.
   * 0.40 = recovery cannot exceed 40% of current funnel revenue.
   */
  readonly recoveryCap: number;
  /**
   * Maximum fraction of any single gap that can be claimed as recoverable.
   * 0.50 = at most 50% of the gap between user rate and benchmark is
   * assumed recoverable in the projection.
   */
  readonly benchmarkGapRecoveryLimit: number;
}

// ---- Funnel template ------------------------------------------------------

/** Complete definition of a funnel archetype including benchmarks and guardrails. */
export interface FunnelTemplate {
  id: TemplateId;
  name: string;
  description: string;
  /** Ordered conversion stages (first = top of funnel). */
  stages: StageDefinition[];
  /** Benchmark conversion rate (%) keyed by stage key. */
  benchmarkRates: Record<string, number>;
  /** Plausible rate bounds keyed by stage key. */
  stageGuardrails: Record<string, StageGuardrails>;
  /** Plausible revenue-per-conversion range. */
  revenuePerConversion: RevenueGuardrails;
  /** Pre-filled defaults for the input form. */
  defaults: {
    visitors: number;
    rates: Record<string, number>;
    revenuePerConversion: number;
  };
}

// ---- User inputs ----------------------------------------------------------

/** User-provided funnel metrics. */
export interface FunnelInputs {
  templateId: TemplateId;
  /** Monthly unique visitors / top-of-funnel volume. */
  visitors: number;
  /** Conversion rates (%) keyed by stage key. */
  rates: Record<string, number>;
  /** Revenue per conversion ($). */
  revenuePerConversion: number;
}

// ---- Confidence flags -----------------------------------------------------

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceFlag {
  level: ConfidenceLevel;
  /** Which input field triggered the flag (stage key, "visitors", or "revenuePerConversion"). */
  field: string;
  /** Human-readable explanation. */
  reason: string;
}

// ---- Analysis results -----------------------------------------------------

export type StageStatus = 'on-track' | 'warning' | 'critical';

/** Computed analysis for a single conversion stage. */
export interface FunnelStage {
  key: string;
  label: string;
  userRate: number;
  benchmarkRate: number;
  /** Benchmark − user rate, clamped ≥ 0. */
  gap: number;
  /** Incremental revenue if this stage alone improved to benchmark (after guardrails). */
  revenueAtRisk: number;
  status: StageStatus;
}

/** A single label + value pair for a volume level in the funnel. */
export interface VolumeEntry {
  label: string;
  value: number;
}

/** Complete analysis output. */
export interface AnalysisResult {
  templateId: TemplateId;
  stages: FunnelStage[];
  currentRevenue: number;
  /** Total projected recovery across all leaking stages (after guardrails). */
  projectedRecovery: number;
  /** Ordered volumes from top of funnel to terminal stage. */
  volumes: VolumeEntry[];
  /** Stage with the highest revenue at risk, or null if no leaks. */
  largestLeak: FunnelStage | null;
  /** Recommended first fix — same as largestLeak (highest-impact stage). */
  bestNextFix: FunnelStage | null;
  /** Data quality / plausibility flags. */
  confidenceFlags: ConfidenceFlag[];
}

// ---- Scenario results -----------------------------------------------------

/** Output of a what-if scenario adjustment. */
export interface ScenarioResult {
  stageKey: string;
  adjustedRate: number;
  newRevenue: number;
  revenueDelta: number;
  newVolumes: VolumeEntry[];
}
