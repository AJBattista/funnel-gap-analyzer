// ---------------------------------------------------------------------------
// Funnel Gap Analyzer — Scenario Engine, Priority Ranking & Confidence
// ---------------------------------------------------------------------------
//
// Scenario lift formula:
//   ScenarioLiftRevenue = CurrentStageVolume × (LiftInRate / 100)
//                         × DownstreamYield × ValuePerConversion
//
// Bounded scenario types only:
//   +1pp, +3pp, +5pp, raise to benchmark, raise to top quartile
//   No free-form sliders, no "double your rate" scenarios.
//
// Priority ranking sorts stages by:
//   1. Recoverable revenue (descending)
//   2. Benchmark gap size (descending)
//   3. Diagnosis confidence (high > medium > low)
//
// Confidence flags lower confidence when:
//   - Traffic is very low (< 500 monthly visitors)
//   - Values hit guardrail bounds repeatedly (≥ 2 fields clamped)
//   - Proxy benchmarks are used (template may not match exact niche)
//   - Multiple downstream stages are underperforming (≥ 2 below benchmark)
// ---------------------------------------------------------------------------

import type {
  FunnelInputs,
  FunnelStage,
  AnalysisResult,
  ScenarioType,
  ScenarioOption,
  ScenarioResult,
  PriorityRanking,
  DiagnosisConfidence,
  ConfidenceFlag,
  ConfidenceLevel,
  ConfidenceLabel,
} from './types';
import { getTemplate } from './benchmarks';
import {
  calculateVolumes,
  calculateRevenue,
  clampInputRates,
} from './engine';
import { clamp, formatCurrency, formatPercent } from '../utils/format';

// ---- Constants ------------------------------------------------------------

/**
 * Top-quartile rate = benchmark × this multiplier.
 * Median-to-P75 spread is typically ~30% across most funnel metrics
 * (source: OpenView, HubSpot aggregate data).
 */
const TOP_QUARTILE_MULTIPLIER = 1.30;

/** Very low traffic threshold — below this, downstream math is unreliable. */
const VERY_LOW_TRAFFIC = 500;

/** Number of guardrail-bound hits that triggers a confidence downgrade. */
const BOUNDS_HIT_THRESHOLD = 2;

// ---- Scenario lift calculator ---------------------------------------------

/**
 * Compute the lift in percentage points for a given scenario type.
 *
 * The lift is clamped so that targetRate stays within [currentRate, stageCeiling].
 * If the scenario yields no improvement (e.g., already at benchmark), liftPp = 0.
 */
function computeLiftPp(
  scenarioType: ScenarioType,
  currentRate: number,
  benchmarkRate: number,
  stageCeiling: number,
): number {
  const topQuartileRate = Math.min(
    benchmarkRate * TOP_QUARTILE_MULTIPLIER,
    stageCeiling,
  );

  let rawTarget: number;

  switch (scenarioType) {
    case 'raise-1pp':
      rawTarget = currentRate + 1;
      break;
    case 'raise-3pp':
      rawTarget = currentRate + 3;
      break;
    case 'raise-5pp':
      rawTarget = currentRate + 5;
      break;
    case 'raise-to-benchmark':
      rawTarget = benchmarkRate;
      break;
    case 'raise-to-top-quartile':
      rawTarget = topQuartileRate;
      break;
  }

  // Clamp target to [currentRate, min(100, stageCeiling)]
  const maxRate = Math.min(100, stageCeiling);
  const clampedTarget = clamp(rawTarget, currentRate, maxRate);

  return Math.max(0, clampedTarget - currentRate);
}

/**
 * Compute a single ScenarioOption for one stage and one scenario type.
 *
 * ScenarioLiftRevenue = CurrentStageVolume × (LiftInRate / 100)
 *                       × DownstreamYield × ValuePerConversion
 */
export function computeScenarioOption(
  scenarioType: ScenarioType,
  stage: FunnelStage,
  stageCeiling: number,
  valuePerConversion: number,
): ScenarioOption {
  const liftPp = computeLiftPp(
    scenarioType,
    stage.userRate,
    stage.benchmarkRate,
    stageCeiling,
  );

  const targetRate = stage.userRate + liftPp;

  // ScenarioLiftRevenue formula
  const liftRevenue =
    stage.currentStageVolume *
    (liftPp / 100) *
    stage.downstreamYield *
    valuePerConversion;

  const labels: Record<ScenarioType, string> = {
    'raise-1pp': '+1 pp',
    'raise-3pp': '+3 pp',
    'raise-5pp': '+5 pp',
    'raise-to-benchmark': 'Raise to Benchmark',
    'raise-to-top-quartile': 'Raise to Top Quartile',
  };

  return {
    type: scenarioType,
    label: labels[scenarioType],
    targetRate,
    liftPp,
    liftRevenue,
  };
}

/** All bounded scenario types in order. */
const ALL_SCENARIO_TYPES: readonly ScenarioType[] = [
  'raise-1pp',
  'raise-3pp',
  'raise-5pp',
  'raise-to-benchmark',
  'raise-to-top-quartile',
] as const;

/**
 * Compute all bounded scenario options for a single stage.
 * Returns only scenarios that produce a positive lift.
 */
export function computeAllScenarios(
  stage: FunnelStage,
  stageCeiling: number,
  valuePerConversion: number,
): ScenarioOption[] {
  return ALL_SCENARIO_TYPES
    .map((type) =>
      computeScenarioOption(type, stage, stageCeiling, valuePerConversion),
    )
    .filter((opt) => opt.liftPp > 0);
}

// ---- Full scenario result (for slider UI) ---------------------------------

/**
 * Calculate a full funnel re-run with one stage adjusted.
 * Used by the scenario slider in the dashboard.
 */
export function calculateScenario(
  inputs: FunnelInputs,
  stageKey: string,
  adjustedRate: number,
): ScenarioResult {
  const template = getTemplate(inputs.templateId);
  const clamped = clampInputRates(inputs);

  // Current revenue
  const currentVolumes = calculateVolumes(
    clamped.visitors,
    template.stages,
    clamped.rates,
  );
  const currentTerminal =
    currentVolumes.length > 0
      ? currentVolumes[currentVolumes.length - 1].value
      : 0;
  const currentRevenue = calculateRevenue(
    currentTerminal,
    clamped.revenuePerConversion,
  );

  // Adjusted funnel
  const currentRate = clamped.rates[stageKey] ?? 0;
  const guard = template.stageGuardrails[stageKey];
  const maxRate = guard ? Math.min(100, guard.rateCeiling) : 100;
  const clampedRate = clamp(adjustedRate, currentRate, maxRate);

  const adjustedRates = { ...clamped.rates, [stageKey]: clampedRate };
  const newVolumes = calculateVolumes(
    clamped.visitors,
    template.stages,
    adjustedRates,
  );
  const newTerminal =
    newVolumes.length > 0 ? newVolumes[newVolumes.length - 1].value : 0;
  const newRevenue = calculateRevenue(
    newTerminal,
    clamped.revenuePerConversion,
  );

  return {
    stageKey,
    adjustedRate: clampedRate,
    newRevenue,
    revenueDelta: newRevenue - currentRevenue,
    newVolumes,
  };
}

// ---- Confidence flag system -----------------------------------------------

/**
 * Extended confidence evaluation.
 *
 * Checks the four degradation conditions:
 *   1. Very low traffic (< 500 visitors)
 *   2. Multiple values hitting guardrail bounds (≥ 2)
 *   3. Proxy benchmark warning (always present — our benchmarks are
 *      industry medians, not exact-niche data)
 *   4. Multiple downstream stages underperforming (≥ 2 stages below benchmark)
 */
export function evaluateExtendedConfidence(
  inputs: FunnelInputs,
  analysis: AnalysisResult,
): DiagnosisConfidence {
  const template = getTemplate(inputs.templateId);
  const flags: ConfidenceFlag[] = [...analysis.confidenceFlags];

  // --- 1. Very low traffic ---
  if (inputs.visitors > 0 && inputs.visitors < VERY_LOW_TRAFFIC) {
    flags.push({
      level: 'low',
      field: 'visitors',
      reason: `Only ${inputs.visitors.toLocaleString()} monthly visitors — conversion rates at this volume are highly variable. Collect more data before acting on these recommendations.`,
    });
  }

  // --- 2. Values hitting bounds repeatedly ---
  let boundsHitCount = 0;
  for (const stage of template.stages) {
    const rate = inputs.rates[stage.key];
    if (rate === undefined) continue;
    const guard = template.stageGuardrails[stage.key];
    if (!guard) continue;
    if (rate <= guard.rateFloor || rate >= guard.rateCeiling) {
      boundsHitCount++;
    }
  }
  // Also check revenue bounds
  const revGuard = template.revenuePerConversion;
  if (
    inputs.revenuePerConversion <= revGuard.floor ||
    inputs.revenuePerConversion >= revGuard.ceiling
  ) {
    boundsHitCount++;
  }

  if (boundsHitCount >= BOUNDS_HIT_THRESHOLD) {
    flags.push({
      level: 'medium',
      field: 'multiple',
      reason: `${boundsHitCount} input values are at or near guardrail limits. This may indicate the selected funnel template is not a good fit for your business, or that input data needs review.`,
    });
  }

  // --- 3. Proxy benchmark warning ---
  // Always flag: our benchmarks are industry medians, not exact-niche data
  flags.push({
    level: 'medium',
    field: 'benchmarks',
    reason: `Benchmarks are industry-wide medians for "${template.name}" funnels. Your specific niche, market segment, or geography may differ. Treat projections as directional estimates.`,
  });

  // --- 4. Multiple downstream stages underperforming ---
  const underperformingCount = analysis.stages.filter(
    (s) => s.gap > 0,
  ).length;
  if (underperformingCount >= 2) {
    flags.push({
      level: 'medium',
      field: 'downstream',
      reason: `${underperformingCount} of ${template.stages.length} stages are below benchmark. When multiple stages leak simultaneously, fixing one stage alone recovers less than projected because downstream stages also lose volume.`,
    });
  }

  // --- Aggregate to overall confidence ---
  const overall = aggregateConfidence(flags);
  const overallLabel = CONFIDENCE_LABELS[overall];

  return { overall, overallLabel, flags };
}

/** Map ConfidenceLevel to display label. */
const CONFIDENCE_LABELS: Record<ConfidenceLevel, ConfidenceLabel> = {
  high: 'High Confidence',
  medium: 'Moderate Confidence',
  low: 'Low Confidence',
};

/**
 * Aggregate multiple flags into a single overall confidence level.
 *
 * - Any 'low' flag → overall 'low'
 * - ≥ 2 'medium' flags → overall 'low'
 * - 1 'medium' flag → overall 'medium'
 * - No flags or only proxy benchmark flag → overall 'high'
 */
function aggregateConfidence(flags: ConfidenceFlag[]): ConfidenceLevel {
  const hasLow = flags.some((f) => f.level === 'low');
  if (hasLow) return 'low';

  // Don't count the ever-present proxy benchmark flag toward the medium count
  const nonProxyMediumFlags = flags.filter(
    (f) => f.level === 'medium' && f.field !== 'benchmarks',
  );
  if (nonProxyMediumFlags.length >= 2) return 'low';
  if (nonProxyMediumFlags.length === 1) return 'medium';

  return 'high';
}

/**
 * Determine confidence level for a single stage's diagnosis.
 * Uses the stage-specific flags from the full flag list.
 */
function stageConfidence(
  stageKey: string,
  allFlags: ConfidenceFlag[],
): ConfidenceLevel {
  const stageFlags = allFlags.filter(
    (f) =>
      f.field === stageKey ||
      f.field === 'visitors' ||
      f.field === 'benchmarks' ||
      f.field === 'downstream',
  );

  return aggregateConfidence(stageFlags);
}

// ---- Priority ranking system ----------------------------------------------

/**
 * Rank stages by recoverable revenue, benchmark gap, and confidence.
 *
 * Sort order:
 *   1. recoverableRevenue descending (primary)
 *   2. benchmarkGapPp descending (tiebreaker — bigger gaps have more room)
 *   3. confidence ascending by severity — high(0) > medium(1) > low(2)
 *
 * Largest Revenue Leak = rank 1 stage (highest recoverable revenue).
 *
 * Best Next Fix = highest-ranked stage with at least 'medium' confidence.
 * Falls back to largest leak if all stages are low confidence.
 */
export function buildPriorityRankings(
  analysis: AnalysisResult,
  inputs: FunnelInputs,
  diagnosisConfidence: DiagnosisConfidence,
): PriorityRanking[] {
  const template = getTemplate(inputs.templateId);
  const clamped = clampInputRates(inputs);

  // Only rank stages that have a gap
  const leakingStages = analysis.stages.filter(
    (s) => s.gap > 0 && s.revenueAtRisk > 0,
  );

  if (leakingStages.length === 0) return [];

  // Confidence weight: high=0, medium=1, low=2
  const confWeight: Record<ConfidenceLevel, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  // Build entries with sort keys
  const entries = leakingStages.map((stage) => {
    const confidence = stageConfidence(
      stage.key,
      diagnosisConfidence.flags,
    );
    const stageCeiling =
      template.stageGuardrails[stage.key]?.rateCeiling ?? 100;

    // Compute best scenario (highest liftRevenue)
    const scenarios = computeAllScenarios(
      stage,
      stageCeiling,
      clamped.revenuePerConversion,
    );
    const bestScenario =
      scenarios.length > 0
        ? scenarios.reduce((best, s) =>
            s.liftRevenue > best.liftRevenue ? s : best,
          )
        : null;

    return {
      stageKey: stage.key,
      label: stage.label,
      rank: 0, // assigned after sort
      recoverableRevenue: stage.revenueAtRisk,
      benchmarkGapPp: stage.gap,
      confidenceLevel: confidence,
      isLargestLeak: false,
      isBestNextFix: false,
      bestScenario,
      _confWeight: confWeight[confidence],
    };
  });

  // Sort: revenue desc, gap desc, confidence asc (lower weight = higher confidence)
  entries.sort((a, b) => {
    if (b.recoverableRevenue !== a.recoverableRevenue) {
      return b.recoverableRevenue - a.recoverableRevenue;
    }
    if (b.benchmarkGapPp !== a.benchmarkGapPp) {
      return b.benchmarkGapPp - a.benchmarkGapPp;
    }
    return a._confWeight - b._confWeight;
  });

  // Assign ranks, identify largest leak and best next fix
  const rankings: PriorityRanking[] = entries.map((e, i) => ({
    stageKey: e.stageKey,
    label: e.label,
    rank: i + 1,
    recoverableRevenue: e.recoverableRevenue,
    benchmarkGapPp: e.benchmarkGapPp,
    confidenceLevel: e.confidenceLevel,
    isLargestLeak: i === 0,
    isBestNextFix: false,
    bestScenario: e.bestScenario,
  }));

  // Largest Revenue Leak = rank 1
  if (rankings.length > 0) {
    rankings[0].isLargestLeak = true;
  }

  // Best Next Fix = highest-ranked with at least medium confidence
  const bestFix = rankings.find(
    (r) => r.confidenceLevel === 'high' || r.confidenceLevel === 'medium',
  );
  if (bestFix) {
    bestFix.isBestNextFix = true;
  } else if (rankings.length > 0) {
    // Fallback: largest leak is best fix even with low confidence
    rankings[0].isBestNextFix = true;
  }

  return rankings;
}

// ---- Recommendation text generator ----------------------------------------

/**
 * Generate a plain-language recommendation for the Best Next Fix.
 */
export function generateRecommendation(
  stage: FunnelStage,
  inputs: FunnelInputs,
  bestScenario: ScenarioOption | null,
): string {
  const recoveryStr = formatCurrency(stage.revenueAtRisk);

  if (!bestScenario || bestScenario.liftPp === 0) {
    return (
      `${stage.label} is your largest revenue leak with ${recoveryStr}/month at risk. ` +
      `Your current rate of ${formatPercent(stage.userRate)} is below the ` +
      `${formatPercent(stage.benchmarkRate)} benchmark.`
    );
  }

  const liftStr = formatCurrency(bestScenario.liftRevenue);

  return (
    `Improving your ${stage.label} conversion from ${formatPercent(stage.userRate)} ` +
    `to ${formatPercent(bestScenario.targetRate)} (${bestScenario.label}) could ` +
    `recover an estimated ${liftStr}/month in revenue. ` +
    `The benchmark for this stage is ${formatPercent(stage.benchmarkRate)}.`
  );
}

/**
 * Generate a short summary of the Largest Revenue Leak.
 */
export function generateLeakSummary(
  stage: FunnelStage,
): string {
  return (
    `${stage.label} — ` +
    `${formatPercent(stage.gap)} below benchmark, ` +
    `${formatCurrency(stage.revenueAtRisk)}/month at risk.`
  );
}
