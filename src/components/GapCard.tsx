// ---------------------------------------------------------------------------
// GapCard — Individual gap analysis card for one funnel stage
// ---------------------------------------------------------------------------

import type { FunnelStage } from '@/lib/types';
import { formatPercent, formatCurrency } from '@/utils/format';

/** Status color map matching CLAUDE.md */
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'on-track': { bg: 'rgba(61, 170, 140, 0.1)', text: '#3daa8c', label: 'Above Benchmark' },
  warning:    { bg: 'rgba(212, 162, 78, 0.1)',  text: '#d4a24e', label: 'Below Benchmark' },
  critical:   { bg: 'rgba(217, 74, 74, 0.1)',   text: '#d94a4a', label: 'Critical Gap' },
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
  if (delta >= 1.0) return '#3daa8c';
  if (delta >= 0.85) return '#4a90d9';
  if (delta >= 0.70) return '#d4a24e';
  return '#d94a4a';
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
      className="rounded-lg border bg-[#1c1f2e] p-4 relative"
      style={{
        borderColor: isLargestLeak ? '#d94a4a' : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Largest leak badge */}
      {isLargestLeak && (
        <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-[#d94a4a] text-white text-[10px] font-semibold uppercase tracking-wide rounded">
          Largest Revenue Leak
        </div>
      )}

      {/* Stage label */}
      <div className="text-sm font-semibold text-[#e8eaf0] mb-3">{stage.label}</div>

      {/* Rate comparison */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#8a8fa8] mb-0.5">
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
          <div className="text-[10px] uppercase tracking-wide text-[#8a8fa8] mb-0.5">
            Benchmark
          </div>
          <div className="text-lg font-semibold font-[family-name:var(--font-geist-mono)] text-[#4a90d9]">
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
          <div className="text-xs text-[#8a8fa8] font-[family-name:var(--font-geist-mono)]">
            {formatPercent(stage.gap)} gap
          </div>
        )}
      </div>

      {/* Revenue at Risk */}
      {stage.revenueAtRisk > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wide text-[#8a8fa8] mb-0.5">
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
