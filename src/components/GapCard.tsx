// ---------------------------------------------------------------------------
// GapCard — Individual gap analysis card for one funnel stage
// ---------------------------------------------------------------------------

import type { FunnelStage } from '@/lib/types';
import { formatPercent, formatCurrency } from '@/utils/format';

/** Status color map matching Executive Neutral design system */
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'on-track': { bg: 'rgba(61, 122, 92, 0.08)', text: '#3D7A5C', label: 'Above Benchmark' },
  warning:    { bg: 'rgba(184, 134, 45, 0.08)',  text: '#B8862D', label: 'Below Benchmark' },
  critical:   { bg: 'rgba(158, 47, 47, 0.08)',   text: '#9E2F2F', label: 'Critical Gap' },
};

/** Benchmark delta display labels per spec */
function gapLabel(stage: FunnelStage): string {
  const delta = stage.benchmarkDelta;
  if (delta >= 1.0) return 'Above Benchmark';
  if (delta >= 0.85) return 'Near Benchmark';
  if (delta >= 0.70) return 'Below Benchmark';
  return 'Critical Gap';
}

function gapLabelColor(stage: FunnelStage): string {
  const delta = stage.benchmarkDelta;
  if (delta >= 1.0) return '#3D7A5C';
  if (delta >= 0.85) return '#5B7A94';
  if (delta >= 0.70) return '#B8862D';
  return '#9E2F2F';
}

interface GapCardProps {
  stage: FunnelStage;
  isLargestLeak: boolean;
}

export default function GapCard({ stage, isLargestLeak }: GapCardProps) {
  const statusStyle = STATUS_COLORS[stage.status] ?? STATUS_COLORS['warning'];
  const label = gapLabel(stage);
  const labelColor = gapLabelColor(stage);

  return (
    <div
      className="rounded-lg border bg-white p-4 relative hover:bg-[#F7F5F2] transition-colors"
      style={{
        borderColor: isLargestLeak ? '#9E2F2F' : '#D8D2CA',
        paddingTop: isLargestLeak ? '1.25rem' : undefined,
      }}
    >
      {/* Largest leak badge */}
      {isLargestLeak && (
        <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-[#9E2F2F] text-white text-[10px] font-semibold uppercase tracking-wider rounded">
          Largest Revenue Leak
        </div>
      )}

      {/* Stage label */}
      <div className="text-sm font-semibold text-[#1F1F1F] mb-3">{stage.label}</div>

      {/* Rate comparison */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-0.5">
            Your Rate
          </div>
          <div
            className="text-lg font-semibold font-[family-name:var(--font-geist-mono)]"
            style={{ color: statusStyle.text }}
          >
            {formatPercent(stage.userRate)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-0.5">
            Benchmark
          </div>
          <div className="text-lg font-semibold font-[family-name:var(--font-geist-mono)] text-[#5B7A94]">
            {formatPercent(stage.benchmarkRate)}
          </div>
        </div>
      </div>

      {/* Gap label with color */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-xs font-semibold px-2 py-0.5 rounded"
          style={{ backgroundColor: `${labelColor}15`, color: labelColor }}
        >
          {label}
        </div>
        {stage.gap > 0 && (
          <div className="text-xs text-[#7A7A7A] font-[family-name:var(--font-geist-mono)]">
            {formatPercent(stage.gap)} gap
          </div>
        )}
      </div>

      {/* Revenue at Risk */}
      {stage.revenueAtRisk > 0 && (
        <div className="mt-3 pt-3 border-t border-[#D8D2CA]">
          <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-0.5">
            Revenue at Risk
          </div>
          <div
            className="text-base font-semibold font-[family-name:var(--font-geist-mono)]"
            style={{ color: statusStyle.text }}
          >
            {formatCurrency(stage.revenueAtRisk)}/mo
          </div>
        </div>
      )}
    </div>
  );
}
