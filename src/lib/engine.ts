// ---------------------------------------------------------------------------
// Funnel Gap Analyzer — Core Math Engine
// ---------------------------------------------------------------------------
//
// All formulas from the spec:
//
//   StageRate         = NextStageVolume / CurrentStageVolume
//   BenchmarkDelta    = ActualRate / BenchmarkRate
//                       thresholds: ≥1.00 on-track, ≥0.85 mild, ≥0.70 warning, <0.70 critical
//   LostNextStage     = max(0, RecoverableGap/100) × CurrentStageVolume
//                       where RecoverableGap = Gap × benchmarkGapRecoveryLimit (50%)
//   DownstreamYield   = ∏(actual rate / 100) for all stages after the current one
//   RecoverableFinal  = LostNextStage × DownstreamYield
//   RevenueAtRisk     = RecoverableFinalConversions × ValuePerConversion
//
// Guardrails applied:
//   1. Stage rates clamped to template-defined floor/ceiling bounds
//   2. Recoverable gap limited to 50% of benchmark gap
//   3. Total projected recovery capped at 40% of current funnel revenue
// ---------------------------------------------------------------------------

import type {
  FunnelInputs,
  FunnelStage,
  AnalysisResult,
  VolumeEntry,
  StageStatus,
  StageDefinition,
} from './types';
import { getTemplate, evaluateConfidence, RECOVERY_GUARDRAILS } from './benchmarks';
import { clamp } from '../utils/format';

// ---- Input clamping -------------------------------------------------------

/**
 * Clamp all input rates to their template-defined guardrail bounds.
 * Visitors clamped to ≥ 0, revenuePerConversion clamped to ≥ 0.
 * Returns a new FunnelInputs (does not mutate the original).
 */
export function clampInputRates(inputs: FunnelInputs): FunnelInputs {
  const template = getTemplate(inputs.templateId);
  const clampedRates: Record<string, number> = {};

  for (const stage of template.stages) {
    const guard = template.stageGuardrails[stage.key];
    const rate = inputs.rates[stage.key] ?? 0;
    clampedRates[stage.key] = guard
      ? clamp(rate, guard.rateFloor, guard.rateCeiling)
      : clamp(rate, 0, 100);
  }

  return {
    ...inputs,
    visitors: Math.max(0, inputs.visitors),
    rates: clampedRates,
    revenuePerConversion: Math.max(0, inputs.revenuePerConversion),
  };
}

// ---- Volume computation ---------------------------------------------------

/**
 * Compute volumes at each funnel level.
 *
 * Returns N+1 VolumeEntry items for N stages:
 *   [0] = visitors (fromLabel of first stage)
 *   [i] = output of stage i-1 (toLabel of stage i-1)
 *
 * StageRate for stage i = volumes[i+1].value / volumes[i].value
 */
export function calculateVolumes(
  visitors: number,
  stages: StageDefinition[],
  rates: Record<string, number>,
): VolumeEntry[] {
  const volumes: VolumeEntry[] = [];
  if (stages.length === 0) return volumes;

  // Top of funnel
  volumes.push({ label: stages[0].fromLabel, value: visitors });

  let current = visitors;
  for (const stage of stages) {
    const rate = rates[stage.key] ?? 0;
    current = current * (rate / 100);
    volumes.push({ label: stage.toLabel, value: current });
  }

  return volumes;
}

/**
 * Derive the stage rate from volumes: NextStageVolume / CurrentStageVolume.
 * Returns 0 if currentVolume is 0 (division-by-zero guard).
 * Result is a percentage (0–100).
 */
export function stageRateFromVolumes(
  currentVolume: number,
  nextVolume: number,
): number {
  if (currentVolume === 0) return 0;
  return (nextVolume / currentVolume) * 100;
}

// ---- Downstream yield -----------------------------------------------------

/**
 * Compute the downstream yield for a stage at the given index.
 * This is the product of actual rates (as decimals) for all stages AFTER stageIndex.
 *
 * If there are no downstream stages, yield = 1.0 (the terminal stage itself).
 */
export function calculateDownstreamYield(
  stages: StageDefinition[],
  rates: Record<string, number>,
  stageIndex: number,
): number {
  let result = 1.0;
  for (let j = stageIndex + 1; j < stages.length; j++) {
    const rate = rates[stages[j].key] ?? 0;
    result *= rate / 100;
  }
  return result;
}

// ---- BenchmarkDelta & status ----------------------------------------------

/**
 * BenchmarkDelta = ActualRate / BenchmarkRate.
 *
 * Edge cases:
 *   - benchmarkRate = 0 and actualRate > 0 → Infinity (above any benchmark)
 *   - benchmarkRate = 0 and actualRate = 0 → 1.0 (both zero, no gap)
 */
export function calculateBenchmarkDelta(
  actualRate: number,
  benchmarkRate: number,
): number {
  if (benchmarkRate === 0) {
    return actualRate > 0 ? Infinity : 1.0;
  }
  return actualRate / benchmarkRate;
}

/**
 * Determine stage status from benchmark delta.
 *
 * Thresholds:
 *   ≥ 1.00 → on-track  (at or above benchmark)
 *   ≥ 0.70 → warning   (below benchmark, recoverable gap)
 *   < 0.70 → critical  (severe underperformance)
 */
export function getStageStatus(benchmarkDelta: number): StageStatus {
  if (benchmarkDelta >= 1.0) return 'on-track';
  if (benchmarkDelta >= 0.70) return 'warning';
  return 'critical';
}

// ---- Revenue computation --------------------------------------------------

/**
 * Revenue = terminal conversions × value per conversion.
 */
export function calculateRevenue(
  terminalConversions: number,
  valuePerConversion: number,
): number {
  return terminalConversions * valuePerConversion;
}

// ---- Main analysis --------------------------------------------------------

/**
 * Run the full funnel gap analysis.
 *
 * 1. Clamps inputs to guardrail bounds
 * 2. Computes volumes through the funnel
 * 3. For each stage, computes BenchmarkDelta, gap, LostNextStage,
 *    DownstreamYield, RecoverableFinalConversions, and RevenueAtRisk
 * 4. Applies the 50% benchmark gap recovery limit per stage
 * 5. Caps total projected recovery at 40% of current revenue
 * 6. Ranks stages by RevenueAtRisk descending
 */
export function analyzeFunnel(rawInputs: FunnelInputs): AnalysisResult {
  const template = getTemplate(rawInputs.templateId);
  const inputs = clampInputRates(rawInputs);
  const { stages: stageDefs } = template;

  // ---- Compute volumes ----
  const volumes = calculateVolumes(
    inputs.visitors,
    stageDefs,
    inputs.rates,
  );

  // Terminal conversions and current revenue
  const terminalVolume =
    volumes.length > 0 ? volumes[volumes.length - 1].value : 0;
  const currentRevenue = calculateRevenue(
    terminalVolume,
    inputs.revenuePerConversion,
  );

  // ---- Edge case: zero visitors ----
  if (inputs.visitors === 0) {
    const emptyStages: FunnelStage[] = stageDefs.map((sd) => ({
      key: sd.key,
      label: sd.label,
      userRate: inputs.rates[sd.key] ?? 0,
      benchmarkRate: template.benchmarkRates[sd.key] ?? 0,
      benchmarkDelta: 1.0,
      gap: 0,
      currentStageVolume: 0,
      lostNextStage: 0,
      downstreamYield: 0,
      recoverableFinalConversions: 0,
      revenueAtRisk: 0,
      status: 'on-track' as StageStatus,
    }));

    return {
      templateId: inputs.templateId,
      stages: emptyStages,
      currentRevenue: 0,
      projectedRecovery: 0,
      volumes,
      largestLeak: null,
      bestNextFix: null,
      confidenceFlags: evaluateConfidence(rawInputs),
    };
  }

  // ---- Analyze each stage ----
  const analyzedStages: FunnelStage[] = stageDefs.map((sd, i) => {
    const userRate = inputs.rates[sd.key] ?? 0;
    const benchmarkRate = template.benchmarkRates[sd.key] ?? 0;

    // BenchmarkDelta = ActualRate / BenchmarkRate
    const benchmarkDelta = calculateBenchmarkDelta(userRate, benchmarkRate);

    // Gap = max(0, benchmarkRate − userRate) in percentage points
    const gap = Math.max(0, benchmarkRate - userRate);

    // Recoverable gap: only 50% of the benchmark gap is assumed closeable
    const recoverableGap = gap * RECOVERY_GUARDRAILS.benchmarkGapRecoveryLimit;

    // Volume entering this stage
    const currentStageVolume = volumes[i].value;

    // LostNextStage = (recoverableGap / 100) × currentStageVolume
    const lostNextStage = (recoverableGap / 100) * currentStageVolume;

    // DownstreamYield = product of actual rates for all later stages
    const downstreamYield = calculateDownstreamYield(
      stageDefs,
      inputs.rates,
      i,
    );

    // RecoverableFinalConversions = LostNextStage × DownstreamYield
    const recoverableFinalConversions = lostNextStage * downstreamYield;

    // RevenueAtRisk = RecoverableFinalConversions × ValuePerConversion
    const revenueAtRisk =
      recoverableFinalConversions * inputs.revenuePerConversion;

    // Status from BenchmarkDelta thresholds
    const status = getStageStatus(benchmarkDelta);

    return {
      key: sd.key,
      label: sd.label,
      userRate,
      benchmarkRate,
      benchmarkDelta,
      gap,
      currentStageVolume,
      lostNextStage,
      downstreamYield,
      recoverableFinalConversions,
      revenueAtRisk,
      status,
    };
  });

  // ---- Recovery cap: 40% of current revenue ----
  const rawRecovery = analyzedStages.reduce(
    (sum, s) => sum + s.revenueAtRisk,
    0,
  );

  const recoveryCap = currentRevenue * RECOVERY_GUARDRAILS.recoveryCap;
  const projectedRecovery =
    currentRevenue > 0 ? Math.min(rawRecovery, recoveryCap) : 0;

  // If the cap binds, scale each stage's revenueAtRisk proportionally
  // so the parts sum to the capped total.
  if (rawRecovery > recoveryCap && rawRecovery > 0 && currentRevenue > 0) {
    const scaleFactor = recoveryCap / rawRecovery;
    for (const stage of analyzedStages) {
      stage.revenueAtRisk = stage.revenueAtRisk * scaleFactor;
    }
  }

  // ---- Priority ranking: sort by revenueAtRisk descending ----
  const sortedStages = [...analyzedStages].sort(
    (a, b) => b.revenueAtRisk - a.revenueAtRisk,
  );

  // Largest leak = first stage with a positive gap and positive revenueAtRisk
  const leakingStages = sortedStages.filter(
    (s) => s.gap > 0 && s.revenueAtRisk > 0,
  );
  const largestLeak = leakingStages.length > 0 ? leakingStages[0] : null;
  const bestNextFix = largestLeak;

  // ---- Confidence flags ----
  const confidenceFlags = evaluateConfidence(rawInputs);

  return {
    templateId: inputs.templateId,
    stages: sortedStages,
    currentRevenue,
    projectedRecovery,
    volumes,
    largestLeak,
    bestNextFix,
    confidenceFlags,
  };
}
