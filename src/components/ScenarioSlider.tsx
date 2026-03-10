'use client';

// ---------------------------------------------------------------------------
// ScenarioSlider — Pick a stage + improvement type, see Projected Revenue Recovery
// ---------------------------------------------------------------------------

import { useState, useMemo, useEffect } from 'react';
import type { AnalysisResult, FunnelInputs, ScenarioResult } from '@/lib/types';
import { calculateScenario } from '@/lib/scenarios';
import { getTemplate } from '@/lib/benchmarks';
import { formatCurrency, formatPercent } from '@/utils/format';

interface ScenarioSliderProps {
  analysis: AnalysisResult;
  inputs: FunnelInputs;
}

export default function ScenarioSlider({ analysis, inputs }: ScenarioSliderProps) {
  const template = getTemplate(inputs.templateId);

  // Only show leaking stages
  const leakingStages = analysis.stages.filter((s) => s.gap > 0);

  // Selected stage key
  const [selectedKey, setSelectedKey] = useState<string>(
    leakingStages.length > 0 ? leakingStages[0].key : '',
  );

  // Reset selection when template or analysis changes
  useEffect(() => {
    const firstLeaking = leakingStages.length > 0 ? leakingStages[0] : null;
    if (firstLeaking) {
      setSelectedKey(firstLeaking.key);
      const g = template.stageGuardrails[firstLeaking.key];
      const mx = g ? Math.min(100, g.rateCeiling) : 100;
      setAdjustedRate(Math.min(firstLeaking.benchmarkRate, mx));
    } else {
      setSelectedKey('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.templateId, analysis]);

  // Adjusted rate for the selected stage
  const selectedStage = analysis.stages.find((s) => s.key === selectedKey);
  const guard = template.stageGuardrails[selectedKey];
  const minRate = selectedStage?.userRate ?? 0;
  const maxRate = guard ? Math.min(100, guard.rateCeiling) : 100;
  const benchmarkRate = selectedStage?.benchmarkRate ?? 0;

  const [adjustedRate, setAdjustedRate] = useState<number>(
    Math.min(benchmarkRate, maxRate),
  );

  // Recompute scenario
  const scenario: ScenarioResult | null = useMemo(() => {
    if (!selectedKey || adjustedRate <= minRate) return null;
    return calculateScenario(inputs, selectedKey, adjustedRate);
  }, [inputs, selectedKey, adjustedRate, minRate]);

  // When stage selection changes, reset slider
  function handleStageChange(key: string) {
    setSelectedKey(key);
    const stage = analysis.stages.find((s) => s.key === key);
    const bm = stage?.benchmarkRate ?? 0;
    const g = template.stageGuardrails[key];
    const mx = g ? Math.min(100, g.rateCeiling) : 100;
    setAdjustedRate(Math.min(bm, mx));
  }

  if (leakingStages.length === 0) return null;

  // Benchmark marker position as percentage of slider range
  const sliderRange = maxRate - minRate;
  const benchmarkPosition =
    sliderRange > 0
      ? ((Math.min(benchmarkRate, maxRate) - minRate) / sliderRange) * 100
      : 0;

  return (
    <div className="rounded-lg border border-[#D8D2CA] bg-white p-5">
      <h3 className="text-sm font-semibold text-[#1F1F1F] mb-4">
        Scenario Explorer
      </h3>
      <p className="text-xs text-[#7A7A7A] mb-4">
        Pick a stage and adjust the conversion rate to see Projected Revenue Recovery.
      </p>

      {/* Stage selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {leakingStages.map((stage) => {
          const isSelected = stage.key === selectedKey;
          return (
            <button
              key={stage.key}
              onClick={() => handleStageChange(stage.key)}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors hover:bg-[#F7F5F2] hover:text-[#1F1F1F]"
              style={{
                backgroundColor: isSelected ? '#F7F5F2' : 'transparent',
                color: isSelected ? '#1F1F1F' : '#7A7A7A',
                border: `1px solid ${isSelected ? '#C4BDB4' : '#D8D2CA'}`,
              }}
            >
              {stage.label}
            </button>
          );
        })}
      </div>

      {selectedStage && (
        <div className="space-y-4">
          {/* Current and target rates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-0.5">
                Current Rate
              </div>
              <div className="text-base font-semibold font-[family-name:var(--font-geist-mono)] text-[#B8862D]">
                {formatPercent(minRate)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-0.5">
                Target Rate
              </div>
              <div className="text-base font-semibold font-[family-name:var(--font-geist-mono)] text-[#3D7A5C]">
                {formatPercent(adjustedRate)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-0.5">
                Benchmark
              </div>
              <div className="text-base font-semibold font-[family-name:var(--font-geist-mono)] text-[#5B7A94]">
                {formatPercent(benchmarkRate)}
              </div>
            </div>
          </div>

          {/* Slider with benchmark marker */}
          <div className="relative pt-4 pb-2">
            {/* Benchmark marker */}
            {benchmarkPosition > 0 && benchmarkPosition <= 100 && (
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${benchmarkPosition}%` }}
              >
                <div className="text-[9px] text-[#5B7A94] font-[family-name:var(--font-geist-mono)] whitespace-nowrap">
                  Benchmark
                </div>
                <div className="w-px h-2 bg-[#5B7A94]" />
              </div>
            )}

            <input
              type="range"
              min={minRate}
              max={maxRate}
              step={0.1}
              value={adjustedRate}
              onChange={(e) => setAdjustedRate(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3D7A5C ${
                  sliderRange > 0
                    ? ((adjustedRate - minRate) / sliderRange) * 100
                    : 0
                }%, #D8D2CA 0%)`,
              }}
            />
          </div>

          {/* Revenue delta result */}
          {scenario && scenario.revenueDelta > 0 && (
            <div className="rounded-lg bg-[#F7F5F2] p-4 mt-2">
              <div className="text-[10px] uppercase tracking-wide text-[#7A7A7A] mb-1">
                Projected Revenue Recovery
              </div>
              <div className="text-2xl font-semibold font-[family-name:var(--font-geist-mono)] text-[#3D7A5C]">
                +{formatCurrency(scenario.revenueDelta)}
                <span className="text-sm text-[#7A7A7A] font-normal">/mo</span>
              </div>
              <div className="text-xs text-[#7A7A7A] mt-1">
                New monthly revenue: {formatCurrency(scenario.newRevenue)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
