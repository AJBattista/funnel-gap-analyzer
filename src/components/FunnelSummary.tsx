// ---------------------------------------------------------------------------
// FunnelSummary — Horizontal funnel bar showing stage volumes and conversion rates
// ---------------------------------------------------------------------------

import type { AnalysisResult, FunnelInputs, FunnelStage } from '@/lib/types';
import { getTemplate } from '@/lib/benchmarks';
import { formatNumber, formatPercent, formatCurrency } from '@/utils/format';

/** Status color map matching Executive Neutral design system */
const STATUS_COLORS: Record<string, string> = {
  'on-track': '#3D7A5C',
  warning: '#B8862D',
  critical: '#9E2F2F',
};

function statusColor(stage: FunnelStage): string {
  return STATUS_COLORS[stage.status] ?? '#7A7A7A';
}

interface FunnelSummaryProps {
  analysis: AnalysisResult;
  inputs: FunnelInputs;
}

export default function FunnelSummary({ analysis, inputs }: FunnelSummaryProps) {
  const { volumes, currentRevenue } = analysis;
  const template = getTemplate(inputs.templateId);

  // Build a lookup from stage key → analyzed FunnelStage (which may be sorted by revenueAtRisk)
  const stageByKey = new Map<string, FunnelStage>();
  for (const stage of analysis.stages) {
    stageByKey.set(stage.key, stage);
  }

  // Use template.stages for funnel order (not analysis.stages which is sorted by revenue)
  const orderedStages = template.stages;

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1F1F1F] mb-4">
        Funnel Overview
      </h2>

      {/* Horizontal flow */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {volumes.map((vol, i) => {
          // Outbound stage: orderedStages[i] converts FROM this volume level to the next
          const outboundStage = i < orderedStages.length ? stageByKey.get(orderedStages[i].key) ?? null : null;

          return (
            <div key={vol.label} className="flex items-center">
              {/* Stage block */}
              <div
                className="rounded-lg border border-[#D8D2CA] bg-white px-4 py-3 min-w-[120px] text-center"
              >
                <div className="text-xs text-[#7A7A7A] mb-1">{vol.label}</div>
                <div className="text-xl font-semibold font-[family-name:var(--font-geist-mono)] text-[#1F1F1F]">
                  {formatNumber(vol.value)}
                </div>
                {outboundStage && (
                  <div className="text-xs mt-1">
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
                <div className="flex items-center px-1 text-[#B0A99F]">
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
          <div className="flex items-center px-1 text-[#B0A99F]">
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
          <div className="rounded-lg border border-[#D8D2CA] bg-[#F7F5F2] px-4 py-3 min-w-[120px] text-center">
            <div className="text-xs text-[#7A7A7A] mb-1">Revenue</div>
            <div className="text-xl font-semibold font-[family-name:var(--font-geist-mono)] text-[#1F1F1F]">
              {formatCurrency(currentRevenue)}
            </div>
            <div className="text-xs text-[#7A7A7A] mt-1">per month</div>
          </div>
        </div>
      </div>
    </div>
  );
}
