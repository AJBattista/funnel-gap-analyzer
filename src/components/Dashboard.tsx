'use client';

// ---------------------------------------------------------------------------
// Dashboard — Container for all output sections
// Receives real AnalysisResult and FunnelInputs from the page
// ---------------------------------------------------------------------------

import type { AnalysisResult, FunnelInputs } from '@/lib/types';
import { formatCurrency } from '@/utils/format';

import FunnelSummary from './FunnelSummary';
import GapCard from './GapCard';
import PriorityCard from './PriorityCard';
import ScenarioSlider from './ScenarioSlider';

interface DashboardProps {
  analysis: AnalysisResult;
  inputs: FunnelInputs;
}

export default function Dashboard({ analysis, inputs }: DashboardProps) {
  const hasLeaks = analysis.largestLeak !== null;

  return (
    <div className="w-full space-y-10">
      {/* Section: Priority Recommendation + Rankings + Confidence — MOST PROMINENT */}
      <PriorityCard analysis={analysis} inputs={inputs} />

      {/* Section: Funnel Overview */}
      <FunnelSummary analysis={analysis} inputs={inputs} />

      {/* Section: Benchmark Delta by Stage */}
      <div>
        <h2 className="text-lg font-semibold text-[#e8eaf0] mb-4">
          Benchmark Delta by Stage
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analysis.stages.map((stage) => (
            <GapCard
              key={stage.key}
              stage={stage}
              isLargestLeak={
                analysis.largestLeak?.key === stage.key
              }
            />
          ))}
        </div>
      </div>

      {/* Section: Revenue at Risk by Stage — ranked visual */}
      {hasLeaks && <RevenueAtRiskRanking analysis={analysis} />}

      {/* Section: Scenario Explorer */}
      {hasLeaks && (
        <ScenarioSlider analysis={analysis} inputs={inputs} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue at Risk by Stage — horizontal bar chart ranked by revenue at risk
// ---------------------------------------------------------------------------

function RevenueAtRiskRanking({ analysis }: { analysis: AnalysisResult }) {
  const leaking = analysis.stages.filter((s) => s.revenueAtRisk > 0);
  if (leaking.length === 0) return null;

  const maxRevenue = leaking[0].revenueAtRisk; // already sorted desc

  const statusColor = (status: string) => {
    if (status === 'critical') return '#d94a4a';
    if (status === 'warning') return '#d4a24e';
    return '#3daa8c';
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#e8eaf0] mb-4">
        Revenue at Risk by Stage
      </h2>
      <div className="rounded-lg border border-white/[0.06] bg-[#1c1f2e] p-5 space-y-4">
        {leaking.map((stage) => {
          const widthPct =
            maxRevenue > 0
              ? (stage.revenueAtRisk / maxRevenue) * 100
              : 0;
          const color = statusColor(stage.status);

          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#e8eaf0]">{stage.label}</span>
                <span
                  className="text-sm font-semibold font-[family-name:var(--font-geist-mono)]"
                  style={{ color }}
                >
                  {formatCurrency(stage.revenueAtRisk)}/mo
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#232738]">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

