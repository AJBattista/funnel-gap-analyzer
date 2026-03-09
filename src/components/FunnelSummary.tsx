// ---------------------------------------------------------------------------
// FunnelSummary — Horizontal funnel bar showing stage volumes and conversion rates
// ---------------------------------------------------------------------------

import type { AnalysisResult, FunnelStage } from '@/lib/types';
import { formatNumber, formatPercent, formatCurrency } from '@/utils/format';

/** Status color map matching CLAUDE.md design system */
const STATUS_COLORS: Record<string, string> = {
  'on-track': '#3daa8c',
  warning: '#d4a24e',
  critical: '#d94a4a',
};

function statusColor(stage: FunnelStage): string {
  return STATUS_COLORS[stage.status] ?? '#8a8fa8';
}

interface FunnelSummaryProps {
  analysis: AnalysisResult;
}

export default function FunnelSummary({ analysis }: FunnelSummaryProps) {
  const { volumes, stages, currentRevenue } = analysis;

  // Build a lookup: volume label → stage that feeds into it (for coloring)
  const stageByToLabel = new Map<string, FunnelStage>();
  for (const stage of stages) {
    // The stage label is like "Visitor → Lead", the volume downstream is "Leads"
    // We match by stage key — volumes[i+1] corresponds to stage[i]
    stageByToLabel.set(stage.key, stage);
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-[#e8eaf0] mb-4">
        Funnel Overview
      </h2>

      {/* Horizontal flow */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {volumes.map((vol, i) => {
          // Determine the stage that feeds INTO this volume level
          // volumes[0] is top-of-funnel (no stage), volumes[i>0] is output of stages[i-1]
          const feedingStage = i > 0 ? stages.find((_, idx) => idx === i - 1) : null;
          const color = feedingStage ? statusColor(feedingStage) : '#4a90d9';

          // Conversion rate = stage[i] userRate (the rate FROM this volume to the next)
          const outboundStage = i < stages.length ? stages.find((_, idx) => idx === i) : null;

          return (
            <div key={vol.label} className="flex items-center">
              {/* Stage block */}
              <div
                className="rounded-lg border border-white/[0.06] bg-[#1c1f2e] px-4 py-3 min-w-[120px] text-center"
              >
                <div className="text-xs text-[#8a8fa8] mb-1">{vol.label}</div>
                <div
                  className="text-xl font-semibold font-[family-name:var(--font-geist-mono)]"
                  style={{ color }}
                >
                  {formatNumber(vol.value)}
                </div>
                {outboundStage && (
                  <div className="text-xs text-[#8a8fa8] mt-1">
                    <span
                      className="font-[family-name:var(--font-geist-mono)]"
                      style={{ color: statusColor(outboundStage) }}
                    >
                      {formatPercent(outboundStage.userRate)}
                    </span>
                  </div>
                )}
              </div>

              {/* Arrow connector */}
              {i < volumes.length - 1 && (
                <div className="flex items-center px-1 text-[#8a8fa8]">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4 10h12m0 0l-4-4m4 4l-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {/* Revenue block */}
        <div className="flex items-center">
          <div className="flex items-center px-1 text-[#8a8fa8]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 10h12m0 0l-4-4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-[#232738] px-4 py-3 min-w-[120px] text-center">
            <div className="text-xs text-[#8a8fa8] mb-1">Revenue</div>
            <div className="text-xl font-semibold font-[family-name:var(--font-geist-mono)] text-[#e8eaf0]">
              {formatCurrency(currentRevenue)}
            </div>
            <div className="text-xs text-[#8a8fa8] mt-1">per month</div>
          </div>
        </div>
      </div>
    </div>
  );
}
