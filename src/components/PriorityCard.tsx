// ---------------------------------------------------------------------------
// PriorityCard — Summary card: Largest Revenue Leak, Best Next Fix,
//                Projected Revenue Recovery, Priority Ranking table,
//                and Confidence indicator
// ---------------------------------------------------------------------------

import type {
  AnalysisResult,
  FunnelInputs,
  PriorityRanking,
  DiagnosisConfidence,
} from '@/lib/types';
import { formatCurrency, formatPercent } from '@/utils/format';
import {
  generateRecommendation,
  generateLeakSummary,
  buildPriorityRankings,
  evaluateExtendedConfidence,
} from '@/lib/scenarios';

/** Confidence level color */
const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#3daa8c',
  medium: '#d4a24e',
  low: '#d94a4a',
};

interface PriorityCardProps {
  analysis: AnalysisResult;
  inputs: FunnelInputs;
}

export default function PriorityCard({ analysis, inputs }: PriorityCardProps) {
  const { largestLeak, bestNextFix, projectedRecovery } = analysis;
  const diagnosisConfidence = evaluateExtendedConfidence(inputs, analysis);
  const rankings = buildPriorityRankings(analysis, inputs, diagnosisConfidence);

  // Find the best scenario for the best next fix
  const bestFixRanking = rankings.find((r) => r.isBestNextFix);

  // No leaks state
  if (!largestLeak) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-[#1c1f2e] p-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#3daa8c]" />
          <h2 className="text-lg font-semibold text-[#e8eaf0]">
            No Leaks Detected
          </h2>
        </div>
        <p className="text-sm text-[#8a8fa8] mt-2">
          All funnel stages are at or above benchmark. Your funnel is performing
          well relative to industry medians.
        </p>
      </div>
    );
  }

  const recommendation =
    bestNextFix && bestFixRanking
      ? generateRecommendation(bestNextFix, inputs, bestFixRanking.bestScenario)
      : null;

  return (
    <div className="space-y-6">
      {/* Hero summary — most prominent element */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Largest Revenue Leak */}
        <div className="rounded-lg border border-[#d94a4a]/30 bg-gradient-to-br from-[#1c1f2e] to-[#1e1520] p-6 sm:p-7">
          <div className="text-[10px] uppercase tracking-widest text-[#d94a4a] font-semibold mb-3">
            Largest Revenue Leak
          </div>
          <div className="text-lg font-semibold text-[#e8eaf0] mb-2">
            {largestLeak.label}
          </div>
          <div className="text-3xl sm:text-4xl font-semibold font-[family-name:var(--font-geist-mono)] text-[#d94a4a] mb-1">
            {formatCurrency(largestLeak.revenueAtRisk)}
            <span className="text-sm text-[#8a8fa8] font-normal ml-1">/mo at risk</span>
          </div>
          <div className="text-xs text-[#8a8fa8] mt-3 leading-relaxed">
            {generateLeakSummary(largestLeak)}
          </div>
        </div>

        {/* Best Next Fix */}
        <div className="rounded-lg border border-[#3daa8c]/30 bg-gradient-to-br from-[#1c1f2e] to-[#152018] p-6 sm:p-7">
          <div className="text-[10px] uppercase tracking-widest text-[#3daa8c] font-semibold mb-3">
            Best Next Fix
          </div>
          {bestNextFix && (
            <>
              <div className="text-lg font-semibold text-[#e8eaf0] mb-2">
                {bestNextFix.label}
              </div>
              <div className="text-sm text-[#8a8fa8] leading-relaxed">
                {recommendation}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Projected Revenue Recovery — secondary prominence */}
      <div className="rounded-lg border border-[#3daa8c]/20 bg-[#1c1f2e] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#8a8fa8] font-semibold mb-1">
            Projected Revenue Recovery
          </div>
          <div className="text-xs text-[#8a8fa8]">
            Theoretical maximum if all stages reach benchmark.
          </div>
        </div>
        <div className="text-3xl font-semibold font-[family-name:var(--font-geist-mono)] text-[#3daa8c] whitespace-nowrap">
          +{formatCurrency(projectedRecovery)}
          <span className="text-sm text-[#8a8fa8] font-normal ml-1">/mo</span>
        </div>
      </div>

      {/* Priority Ranking Table */}
      {rankings.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-[#1c1f2e] p-5">
          <h3 className="text-sm font-semibold text-[#e8eaf0] mb-4">
            Priority Ranking
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[#8a8fa8] border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-4">Rank</th>
                  <th className="text-left py-2 pr-4">Stage</th>
                  <th className="text-right py-2 pr-4">Benchmark Gap</th>
                  <th className="text-right py-2 pr-4">Recoverable Revenue</th>
                  <th className="text-center py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <PriorityRow key={r.stageKey} ranking={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confidence Indicator */}
      <ConfidencePanel confidence={diagnosisConfidence} />
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

function PriorityRow({ ranking }: { ranking: PriorityRanking }) {
  const confColor = CONFIDENCE_COLORS[ranking.confidenceLevel] ?? '#8a8fa8';

  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <td className="py-3 pr-4">
        <span className="text-xs font-semibold text-[#8a8fa8] font-[family-name:var(--font-geist-mono)]">
          #{ranking.rank}
        </span>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-[#e8eaf0]">{ranking.label}</span>
          {ranking.isLargestLeak && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#d94a4a]/10 text-[#d94a4a] font-semibold">
              Leak
            </span>
          )}
          {ranking.isBestNextFix && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#3daa8c]/10 text-[#3daa8c] font-semibold">
              Fix
            </span>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 text-right font-[family-name:var(--font-geist-mono)] text-[#d4a24e]">
        {formatPercent(ranking.benchmarkGapPp)}
      </td>
      <td className="py-3 pr-4 text-right font-[family-name:var(--font-geist-mono)] text-[#e8eaf0]">
        {formatCurrency(ranking.recoverableRevenue)}/mo
      </td>
      <td className="py-3 text-center">
        <span
          className="text-xs font-semibold capitalize"
          style={{ color: confColor }}
        >
          {ranking.confidenceLevel}
        </span>
      </td>
    </tr>
  );
}

function ConfidencePanel({ confidence }: { confidence: DiagnosisConfidence }) {
  const color = CONFIDENCE_COLORS[confidence.overall] ?? '#8a8fa8';

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#1c1f2e] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-semibold" style={{ color }}>
          {confidence.overallLabel}
        </h3>
      </div>
      {confidence.flags.length > 0 && (
        <ul className="space-y-2">
          {confidence.flags.map((flag, i) => (
            <li key={i} className="text-xs text-[#8a8fa8] flex items-start gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{
                  backgroundColor:
                    CONFIDENCE_COLORS[flag.level] ?? '#8a8fa8',
                }}
              />
              {flag.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
