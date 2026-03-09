'use client';

// ---------------------------------------------------------------------------
// FunnelForm — Input form with template selector, volume/rate mode toggle,
//              validation, guardrail visual feedback, and live analysis trigger
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from 'react';
import type { TemplateId, FunnelInputs, FunnelTemplate } from '@/lib/types';
import {
  TEMPLATE_ORDER,
  getTemplate,
  getDefaultInputs,
  TRAFFIC_BOUNDS,
} from '@/lib/benchmarks';
import { formatPercent, clamp } from '@/utils/format';

// ---- Types ----------------------------------------------------------------

type InputMode = 'rates' | 'volumes';
type TimePeriod = 'monthly' | 'weekly' | 'quarterly';
type TrafficSource = '' | 'organic' | 'paid' | 'mixed';

interface FunnelFormProps {
  inputs: FunnelInputs;
  onSubmit: (inputs: FunnelInputs) => void;
  onChange: (inputs: FunnelInputs) => void;
}

interface FieldError {
  field: string;
  message: string;
}

interface GuardrailHit {
  field: string;
  message: string;
  level: 'floor' | 'ceiling';
}

// ---- Template display data ------------------------------------------------

const TEMPLATE_DISPLAY: Record<
  TemplateId,
  { icon: string; shortName: string; category?: string }
> = {
  'dtc-ecommerce': { icon: '🛒', shortName: 'DTC Ecommerce' },
  'b2b-saas-leadgen': {
    icon: '🏢',
    shortName: 'Lead-Gen',
    category: 'B2B SaaS',
  },
  'b2b-saas-trial': {
    icon: '🚀',
    shortName: 'Trial / PLG',
    category: 'B2B SaaS',
  },
  'local-services': { icon: '📍', shortName: 'Local Services' },
  'consumer-app': { icon: '📱', shortName: 'Consumer App' },
  'creator-info': { icon: '🎓', shortName: 'Creator / Info' },
};

const B2B_SAAS_IDS: TemplateId[] = ['b2b-saas-leadgen', 'b2b-saas-trial'];
const NON_B2B_IDS: TemplateId[] = TEMPLATE_ORDER.filter(
  (id) => !B2B_SAAS_IDS.includes(id),
);

type FunnelCategory = 'b2b-saas' | TemplateId;

function templateIdToCategory(id: TemplateId): FunnelCategory {
  if (B2B_SAAS_IDS.includes(id)) return 'b2b-saas';
  return id;
}

// ---- Helpers --------------------------------------------------------------

function parseNumericInput(raw: string): number {
  const cleaned = raw.replace(/[$,%\s,]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatDisplayNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatDisplayRate(value: number): string {
  return value.toFixed(1);
}

function formatDisplayCurrency(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Given volume inputs for each funnel level, derive conversion rates.
 */
function deriveRatesFromVolumes(
  template: FunnelTemplate,
  volumeValues: Record<string, number>,
): Record<string, number> {
  const rates: Record<string, number> = {};
  const { stages } = template;

  const volumeKeys = [
    stages[0]?.fromLabel ?? 'Visitors',
    ...stages.map((s) => s.toLabel),
  ];

  for (let i = 0; i < stages.length; i++) {
    const fromKey = volumeKeys[i];
    const toKey = volumeKeys[i + 1];
    const fromVol = volumeValues[fromKey] ?? 0;
    const toVol = volumeValues[toKey] ?? 0;
    rates[stages[i].key] = fromVol > 0 ? (toVol / fromVol) * 100 : 0;
  }

  return rates;
}

/**
 * Given rates, compute volumes for display in volume mode.
 */
function deriveVolumesFromRates(
  template: FunnelTemplate,
  visitors: number,
  rates: Record<string, number>,
): Record<string, number> {
  const volumes: Record<string, number> = {};
  const { stages } = template;

  if (stages.length === 0) return volumes;
  volumes[stages[0].fromLabel] = visitors;

  let current = visitors;
  for (const stage of stages) {
    const rate = rates[stage.key] ?? 0;
    current = current * (rate / 100);
    volumes[stage.toLabel] = current;
  }

  return volumes;
}

// ---- Component ------------------------------------------------------------

export default function FunnelForm({ inputs, onSubmit, onChange }: FunnelFormProps) {
  const template = getTemplate(inputs.templateId);

  // ---- Category / template state ----
  const [selectedCategory, setSelectedCategory] = useState<FunnelCategory>(
    templateIdToCategory(inputs.templateId),
  );

  // ---- Input mode state ----
  const [inputMode, setInputMode] = useState<InputMode>('rates');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly');
  const [trafficSource, setTrafficSource] = useState<TrafficSource>('');
  const benchmarkModeLabel = 'Industry Median';

  // ---- Display strings ----
  const [visitorsDisplay, setVisitorsDisplay] = useState(
    formatDisplayNumber(inputs.visitors),
  );
  const [revenueDisplay, setRevenueDisplay] = useState(
    formatDisplayCurrency(inputs.revenuePerConversion),
  );
  const [rateDisplays, setRateDisplays] = useState<Record<string, string>>(
    () => {
      const displays: Record<string, string> = {};
      for (const stage of template.stages) {
        displays[stage.key] = formatDisplayRate(inputs.rates[stage.key] ?? 0);
      }
      return displays;
    },
  );
  const [volumeValues, setVolumeValues] = useState<Record<string, string>>(
    () => {
      const vols = deriveVolumesFromRates(
        template,
        inputs.visitors,
        inputs.rates,
      );
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(vols)) {
        result[k] = formatDisplayNumber(v);
      }
      return result;
    },
  );

  // ---- Validation & guardrails ----
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [guardrailHits, setGuardrailHits] = useState<GuardrailHit[]>([]);

  // ---- Sync displays when template changes ----
  useEffect(() => {
    setVisitorsDisplay(formatDisplayNumber(inputs.visitors));
    setRevenueDisplay(formatDisplayCurrency(inputs.revenuePerConversion));
    const displays: Record<string, string> = {};
    for (const stage of template.stages) {
      displays[stage.key] = formatDisplayRate(inputs.rates[stage.key] ?? 0);
    }
    setRateDisplays(displays);

    const vols = deriveVolumesFromRates(template, inputs.visitors, inputs.rates);
    const volStrings: Record<string, string> = {};
    for (const [k, v] of Object.entries(vols)) {
      volStrings[k] = formatDisplayNumber(v);
    }
    setVolumeValues(volStrings);

    setErrors([]);
    setGuardrailHits([]);
    setSelectedCategory(templateIdToCategory(inputs.templateId));
  }, [inputs.templateId, template, inputs.visitors, inputs.revenuePerConversion, inputs.rates]);

  // ---- Template change ----
  function handleTemplateChange(id: TemplateId) {
    const defaults = getDefaultInputs(id);
    onChange(defaults);
  }

  const handleCategoryChange = useCallback(
    (cat: FunnelCategory) => {
      setSelectedCategory(cat);
      if (cat === 'b2b-saas') {
        if (!B2B_SAAS_IDS.includes(inputs.templateId)) {
          const defaults = getDefaultInputs('b2b-saas-leadgen');
          onChange(defaults);
        }
      } else {
        const defaults = getDefaultInputs(cat as TemplateId);
        onChange(defaults);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs.templateId, onChange],
  );

  // ---- Field change handlers ----

  function updateInputs(partial: Partial<FunnelInputs>) {
    const updated = { ...inputs, ...partial };
    onChange(updated);
  }

  function handleVisitorsChange(raw: string) {
    setVisitorsDisplay(raw);
  }

  function handleVisitorsBlur() {
    const val = parseNumericInput(visitorsDisplay);
    const clamped = clamp(Math.round(val), 0, 100_000_000);
    setVisitorsDisplay(formatDisplayNumber(clamped));

    const newErrors = errors.filter((e) => e.field !== 'visitors');
    if (val < 0 || val > 100_000_000) {
      newErrors.push({
        field: 'visitors',
        message: 'Must be between 0 and 100,000,000',
      });
    }
    setErrors(newErrors);
    updateInputs({ visitors: clamped });
  }

  function handleRevenueChange(raw: string) {
    setRevenueDisplay(raw);
  }

  function handleRevenueBlur() {
    const val = parseNumericInput(revenueDisplay);
    const clamped = clamp(Math.round(val), 0, 10_000_000);
    setRevenueDisplay(formatDisplayCurrency(clamped));

    const newErrors = errors.filter((e) => e.field !== 'revenuePerConversion');
    if (val < 0 || val > 10_000_000) {
      newErrors.push({
        field: 'revenuePerConversion',
        message: 'Must be between $0 and $10,000,000',
      });
    }
    setErrors(newErrors);
    checkRevenueGuardrails(clamped, template);
    updateInputs({ revenuePerConversion: clamped });
  }

  function handleRateChange(key: string, raw: string) {
    setRateDisplays((prev) => ({ ...prev, [key]: raw }));
  }

  function handleRateBlur(key: string) {
    const val = parseNumericInput(rateDisplays[key] ?? '0');
    const clamped = clamp(parseFloat(val.toFixed(1)), 0, 100);
    setRateDisplays((prev) => ({ ...prev, [key]: formatDisplayRate(clamped) }));

    const newErrors = errors.filter((e) => e.field !== key);
    if (val < 0 || val > 100) {
      newErrors.push({ field: key, message: 'Must be between 0% and 100%' });
    }
    setErrors(newErrors);
    checkRateGuardrails(key, clamped, template);

    const newRates = { ...inputs.rates, [key]: clamped };
    updateInputs({ rates: newRates });
  }

  // ---- Volume mode handlers ----

  function handleVolumeChange(label: string, value: string) {
    setVolumeValues((prev) => ({ ...prev, [label]: value }));
  }

  function handleVolumeBlur(label: string) {
    const val = parseNumericInput(volumeValues[label] ?? '0');
    const rounded = Math.max(0, Math.round(val));
    setVolumeValues((prev) => ({
      ...prev,
      [label]: formatDisplayNumber(rounded),
    }));

    // Derive rates from all current volume values and update
    const numericVolumes: Record<string, number> = {};
    for (const [k, v] of Object.entries(volumeValues)) {
      numericVolumes[k] = k === label ? rounded : parseNumericInput(v);
    }
    const derivedRates = deriveRatesFromVolumes(template, numericVolumes);

    // Top-of-funnel volume is visitors
    const firstLabel = template.stages[0]?.fromLabel ?? 'Visitors';
    const newVisitors = label === firstLabel ? rounded : parseNumericInput(volumeValues[firstLabel] ?? '0');

    updateInputs({ visitors: newVisitors, rates: derivedRates });
  }

  // ---- Guardrail checks ----

  function checkRateGuardrails(key: string, value: number, tmpl: FunnelTemplate) {
    const guard = tmpl.stageGuardrails[key];
    const newHits = guardrailHits.filter((h) => h.field !== key);
    if (guard) {
      if (value < guard.rateFloor) {
        newHits.push({
          field: key,
          message: `Below plausible floor (${guard.rateFloor.toFixed(1)}%)`,
          level: 'floor',
        });
      } else if (value > guard.rateCeiling) {
        newHits.push({
          field: key,
          message: `Above plausible ceiling (${guard.rateCeiling.toFixed(1)}%)`,
          level: 'ceiling',
        });
      }
    }
    setGuardrailHits(newHits);
  }

  function checkRevenueGuardrails(value: number, tmpl: FunnelTemplate) {
    const guard = tmpl.revenuePerConversion;
    const newHits = guardrailHits.filter((h) => h.field !== 'revenuePerConversion');
    if (value > 0 && value < guard.floor) {
      newHits.push({
        field: 'revenuePerConversion',
        message: `Below typical floor ($${guard.floor.toLocaleString()})`,
        level: 'floor',
      });
    } else if (value > guard.ceiling) {
      newHits.push({
        field: 'revenuePerConversion',
        message: `Above typical ceiling ($${guard.ceiling.toLocaleString()})`,
        level: 'ceiling',
      });
    }
    setGuardrailHits(newHits);
  }

  // ---- Submit ----
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length > 0) return;
    onSubmit(inputs);
  }

  // ---- Render helpers ----
  function getFieldError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function getGuardrailHit(field: string): GuardrailHit | undefined {
    return guardrailHits.find((h) => h.field === field);
  }

  const inputBaseClass =
    'w-full bg-[#141720] border rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] font-[family-name:var(--font-geist-mono)] outline-none transition-colors focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30';
  const inputBorderNormal = 'border-white/[0.1]';
  const inputBorderError = 'border-[#d94a4a]';
  const inputBorderWarn = 'border-[#d4a24e]';

  function fieldBorder(field: string): string {
    if (getFieldError(field)) return inputBorderError;
    if (getGuardrailHit(field)) return inputBorderWarn;
    return inputBorderNormal;
  }

  // ---- Volume labels for dynamic fields ----
  const volumeLabels: string[] =
    template.stages.length > 0
      ? [
          template.stages[0].fromLabel,
          ...template.stages.map((s) => s.toLabel),
        ]
      : [];

  // ---- Categories for the top-level selector ----
  const categories: { id: FunnelCategory; label: string; icon: string }[] = [
    { id: 'b2b-saas', label: 'B2B SaaS', icon: '🏢' },
    ...NON_B2B_IDS.map((id) => ({
      id: id as FunnelCategory,
      label: TEMPLATE_DISPLAY[id].shortName,
      icon: TEMPLATE_DISPLAY[id].icon,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/[0.06] bg-[#1c1f2e] p-5 sm:p-6 mb-10">
      {/* ---- Section: Funnel Type ---- */}
      <div className="mb-6">
        <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
          Funnel Type
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className="rounded-lg px-3 py-2.5 text-xs font-medium text-left transition-colors hover:bg-[#232738] hover:text-[#e8eaf0]"
              style={{
                backgroundColor: selectedCategory === cat.id ? '#232738' : 'transparent',
                color: selectedCategory === cat.id ? '#e8eaf0' : '#8a8fa8',
                border: `1px solid ${selectedCategory === cat.id ? 'rgba(74, 144, 217, 0.4)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- B2B SaaS Sub-Mode ---- */}
      {selectedCategory === 'b2b-saas' && (
        <div className="mb-6">
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
            Sales Motion
          </label>
          <div className="inline-flex rounded-lg border border-white/[0.06] bg-[#141720] p-0.5">
            {B2B_SAAS_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTemplateChange(id)}
                className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                  inputs.templateId === id
                    ? 'bg-[#232738] text-[#e8eaf0]'
                    : 'text-[#8a8fa8] hover:text-[#e8eaf0]'
                }`}
              >
                {TEMPLATE_DISPLAY[id].shortName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Template description ---- */}
      <p className="text-xs text-[#8a8fa8] mb-6">{template.description}</p>

      {/* ---- Row: Input Mode + Time Period + Traffic Source + Benchmark ---- */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        {/* Input mode toggle */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
            Enter as
          </label>
          <div className="inline-flex rounded-lg border border-white/[0.06] bg-[#141720] p-0.5">
            <button
              type="button"
              onClick={() => setInputMode('rates')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                inputMode === 'rates'
                  ? 'bg-[#232738] text-[#e8eaf0]'
                  : 'text-[#8a8fa8] hover:text-[#e8eaf0]'
              }`}
            >
              Conversion Rates
            </button>
            <button
              type="button"
              onClick={() => setInputMode('volumes')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                inputMode === 'volumes'
                  ? 'bg-[#232738] text-[#e8eaf0]'
                  : 'text-[#8a8fa8] hover:text-[#e8eaf0]'
              }`}
            >
              Stage Volumes
            </button>
          </div>
        </div>

        {/* Time period */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
            Time Period
          </label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
            className="rounded-lg border border-white/[0.1] bg-[#141720] px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-[#4a90d9]"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>

        {/* Traffic source */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
            Traffic Source
          </label>
          <select
            value={trafficSource}
            onChange={(e) => setTrafficSource(e.target.value as TrafficSource)}
            className="rounded-lg border border-white/[0.1] bg-[#141720] px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-[#4a90d9]"
          >
            <option value="">Not specified</option>
            <option value="organic">Organic</option>
            <option value="paid">Paid</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        {/* Benchmark mode */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
            Benchmark Mode
          </label>
          <div className="rounded-lg border border-white/[0.06] bg-[#141720] px-3 py-2 text-sm text-[#8a8fa8]">
            {benchmarkModeLabel}
          </div>
        </div>
      </div>

      {/* ---- Visitors + Revenue per Conversion ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
        {/* Monthly Visitors */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-1">
            {timePeriod === 'weekly'
              ? 'Weekly'
              : timePeriod === 'quarterly'
                ? 'Quarterly'
                : 'Monthly'}{' '}
            Visitors
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={visitorsDisplay}
            onChange={(e) => handleVisitorsChange(e.target.value)}
            onBlur={handleVisitorsBlur}
            onFocus={() => {
              const val = parseNumericInput(visitorsDisplay);
              if (val > 0) setVisitorsDisplay(String(Math.round(val)));
            }}
            className={`${inputBaseClass} ${fieldBorder('visitors')}`}
            placeholder="10,000"
          />
          <FieldFeedback
            error={getFieldError('visitors')}
            guardrail={getGuardrailHit('visitors')}
          />
          <p className="text-[10px] text-[#8a8fa8]/60 mt-0.5 font-[family-name:var(--font-geist-mono)]">
            Typical: {TRAFFIC_BOUNDS.min.toLocaleString()} – {TRAFFIC_BOUNDS.max.toLocaleString()}
          </p>
        </div>

        {/* Revenue per Conversion */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-1">
            Revenue per Conversion
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8fa8] text-sm">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={revenueDisplay}
              onChange={(e) => handleRevenueChange(e.target.value)}
              onBlur={handleRevenueBlur}
              onFocus={() => {
                const val = parseNumericInput(revenueDisplay);
                if (val > 0) setRevenueDisplay(String(Math.round(val)));
              }}
              className={`${inputBaseClass} ${fieldBorder('revenuePerConversion')} pl-7`}
              placeholder="5,000"
            />
          </div>
          <FieldFeedback
            error={getFieldError('revenuePerConversion')}
            guardrail={getGuardrailHit('revenuePerConversion')}
          />
          <p className="text-[10px] text-[#8a8fa8]/60 mt-0.5 font-[family-name:var(--font-geist-mono)]">
            Typical for {template.name}: ${template.revenuePerConversion.floor.toLocaleString()} – ${template.revenuePerConversion.ceiling.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ---- Stage Inputs ---- */}
      <div className="mb-6">
        <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-2">
          {inputMode === 'rates' ? 'Conversion Rates' : 'Stage Volumes'}
        </label>

        {inputMode === 'rates' ? (
          /* ---- Rate inputs ---- */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {template.stages.map((stage) => {
              const guard = template.stageGuardrails[stage.key];
              return (
                <div key={stage.key}>
                  <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-1">
                    {stage.label}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rateDisplays[stage.key] ?? '0.0'}
                      onChange={(e) => handleRateChange(stage.key, e.target.value)}
                      onBlur={() => handleRateBlur(stage.key)}
                      onFocus={() => {
                        const val = parseFloat(rateDisplays[stage.key] ?? '0');
                        if (!isNaN(val)) {
                          setRateDisplays((prev) => ({
                            ...prev,
                            [stage.key]: String(val),
                          }));
                        }
                      }}
                      className={`${inputBaseClass} ${fieldBorder(stage.key)} pr-7`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8fa8] text-sm">
                      %
                    </span>
                  </div>
                  {guard && (
                    <div className="text-[10px] text-[#8a8fa8]/60 mt-0.5 font-[family-name:var(--font-geist-mono)]">
                      Benchmark: {formatPercent(template.benchmarkRates[stage.key] ?? 0)}
                      {' · '}
                      Range: {guard.rateFloor.toFixed(1)}–{guard.rateCeiling.toFixed(1)}%
                    </div>
                  )}
                  <FieldFeedback
                    error={getFieldError(stage.key)}
                    guardrail={getGuardrailHit(stage.key)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* ---- Volume inputs ---- */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {volumeLabels.map((label, i) => (
              <div key={label}>
                <label className="block text-xs uppercase tracking-wide text-[#8a8fa8] font-semibold mb-1">
                  {label}
                  {i === 0 && (
                    <span className="ml-2 text-[#4a90d9]">Top of funnel</span>
                  )}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={volumeValues[label] ?? ''}
                  onChange={(e) => handleVolumeChange(label, e.target.value)}
                  onBlur={() => handleVolumeBlur(label)}
                  onFocus={() => {
                    const val = parseNumericInput(volumeValues[label] ?? '0');
                    if (val > 0) {
                      setVolumeValues((prev) => ({
                        ...prev,
                        [label]: String(Math.round(val)),
                      }));
                    }
                  }}
                  className={`${inputBaseClass} ${inputBorderNormal}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit button */}
      <div className="pt-5 border-t border-white/[0.06]">
        <button
          type="submit"
          disabled={errors.length > 0}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110 active:brightness-95"
          style={{
            background: 'linear-gradient(135deg, #4a90d9, #3d7bc8)',
          }}
        >
          Analyze Funnel
        </button>
      </div>
    </form>
  );
}

// ---- Sub-components -------------------------------------------------------

function FieldFeedback({
  error,
  guardrail,
}: {
  error?: string;
  guardrail?: GuardrailHit;
}) {
  if (error) {
    return <p className="text-xs text-[#d94a4a] mt-0.5">{error}</p>;
  }
  if (guardrail) {
    return <p className="text-xs text-[#d4a24e] mt-0.5">{guardrail.message}</p>;
  }
  return null;
}
