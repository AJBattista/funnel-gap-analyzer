'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TemplateId, FunnelInputs, FunnelTemplate } from '@/lib/types';
import {
  TEMPLATE_ORDER,
  getTemplate,
  getDefaultInputs,
  TRAFFIC_BOUNDS,
} from '@/lib/benchmarks';
import { clamp } from '@/utils/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InputMode = 'rates' | 'volumes';
type TimePeriod = 'monthly' | 'weekly' | 'quarterly';
type TrafficSource = '' | 'organic' | 'paid' | 'mixed';

interface FunnelFormProps {
  onSubmit: (inputs: FunnelInputs) => void;
  initialInputs?: FunnelInputs;
}

interface FieldError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Template selector card data
// ---------------------------------------------------------------------------

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

// B2B SaaS IDs for sub-mode selector
const B2B_SAAS_IDS: TemplateId[] = ['b2b-saas-leadgen', 'b2b-saas-trial'];
const NON_B2B_IDS: TemplateId[] = TEMPLATE_ORDER.filter(
  (id) => !B2B_SAAS_IDS.includes(id),
);

// Funnel type groups for the selector
type FunnelCategory = 'b2b-saas' | TemplateId;

function templateIdToCategory(id: TemplateId): FunnelCategory {
  if (B2B_SAAS_IDS.includes(id)) return 'b2b-saas';
  return id;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumericInput(value: string): number {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
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
 * volumes[0] = visitors, volumes[i+1] = output of stage i.
 */
function deriveRatesFromVolumes(
  template: FunnelTemplate,
  volumeValues: Record<string, number>,
): Record<string, number> {
  const rates: Record<string, number> = {};
  const { stages } = template;

  // Build ordered volume keys: fromLabel of stage 0, then toLabel of each stage
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FunnelForm({ onSubmit, initialInputs }: FunnelFormProps) {
  // ---- Core state ----
  const defaultTemplate: TemplateId = initialInputs?.templateId ?? 'b2b-saas-leadgen';
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>(defaultTemplate);
  const [selectedCategory, setSelectedCategory] = useState<FunnelCategory>(
    templateIdToCategory(defaultTemplate),
  );

  const template = getTemplate(selectedTemplate);
  const defaults = getDefaultInputs(selectedTemplate);

  // Form values
  const [visitors, setVisitors] = useState<string>(
    formatDisplayNumber(initialInputs?.visitors ?? defaults.visitors),
  );
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const initial = initialInputs?.rates ?? defaults.rates;
    const result: Record<string, string> = {};
    for (const stage of template.stages) {
      result[stage.key] = formatDisplayRate(initial[stage.key] ?? 0);
    }
    return result;
  });
  const [revenuePerConversion, setRevenuePerConversion] = useState<string>(
    formatDisplayCurrency(
      initialInputs?.revenuePerConversion ?? defaults.revenuePerConversion,
    ),
  );

  // Volume mode values
  const [volumeValues, setVolumeValues] = useState<Record<string, string>>(() => {
    const vols = deriveVolumesFromRates(
      template,
      initialInputs?.visitors ?? defaults.visitors,
      initialInputs?.rates ?? defaults.rates,
    );
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(vols)) {
      result[k] = formatDisplayNumber(v);
    }
    return result;
  });

  // ---- Optional fields ----
  const [inputMode, setInputMode] = useState<InputMode>('rates');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly');
  const [trafficSource, setTrafficSource] = useState<TrafficSource>('');
  // benchmarkMode is always 'industry-median' — shown as static display
  const benchmarkModeLabel = 'Industry Median';

  // ---- Validation ----
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // ---- Template change → re-populate defaults ----
  const handleTemplateChange = useCallback(
    (newId: TemplateId) => {
      setSelectedTemplate(newId);
      const newTemplate = getTemplate(newId);
      const newDefaults = getDefaultInputs(newId);

      setVisitors(formatDisplayNumber(newDefaults.visitors));

      const newRates: Record<string, string> = {};
      for (const stage of newTemplate.stages) {
        newRates[stage.key] = formatDisplayRate(
          newDefaults.rates[stage.key] ?? 0,
        );
      }
      setRates(newRates);

      setRevenuePerConversion(
        formatDisplayCurrency(newDefaults.revenuePerConversion),
      );

      // Reset volume values
      const vols = deriveVolumesFromRates(
        newTemplate,
        newDefaults.visitors,
        newDefaults.rates,
      );
      const volStrings: Record<string, string> = {};
      for (const [k, v] of Object.entries(vols)) {
        volStrings[k] = formatDisplayNumber(v);
      }
      setVolumeValues(volStrings);

      setErrors([]);
      setTouched(new Set());
    },
    [],
  );

  // When category changes, select the appropriate template
  const handleCategoryChange = useCallback(
    (cat: FunnelCategory) => {
      setSelectedCategory(cat);
      if (cat === 'b2b-saas') {
        // Default to lead-gen if coming from outside B2B
        if (!B2B_SAAS_IDS.includes(selectedTemplate)) {
          handleTemplateChange('b2b-saas-leadgen');
        }
      } else {
        handleTemplateChange(cat as TemplateId);
      }
    },
    [selectedTemplate, handleTemplateChange],
  );

  const handleB2bSubModeChange = useCallback(
    (id: TemplateId) => {
      handleTemplateChange(id);
    },
    [handleTemplateChange],
  );

  // ---- Sync input mode ----
  // When switching from volumes to rates, derive rates from current volumes
  useEffect(() => {
    if (inputMode === 'rates') {
      // Derive rates from volume values if volumes were edited
      // Actually, keep rates as-is since user may not have been in volume mode
    }
  }, [inputMode]);

  // ---- Validation ----
  const validate = useCallback((): FieldError[] => {
    const errs: FieldError[] = [];
    const visitorsNum = parseNumericInput(visitors);

    if (visitorsNum < TRAFFIC_BOUNDS.min) {
      errs.push({
        field: 'visitors',
        message: `Minimum ${TRAFFIC_BOUNDS.min.toLocaleString()} visitors`,
      });
    }
    if (visitorsNum > TRAFFIC_BOUNDS.max) {
      errs.push({
        field: 'visitors',
        message: `Maximum ${TRAFFIC_BOUNDS.max.toLocaleString()} visitors`,
      });
    }

    if (inputMode === 'rates') {
      for (const stage of template.stages) {
        const rateVal = parseFloat(rates[stage.key] ?? '0');
        const guard = template.stageGuardrails[stage.key];
        if (guard) {
          if (rateVal < 0 || rateVal > 100) {
            errs.push({
              field: stage.key,
              message: 'Rate must be 0–100%',
            });
          }
        }
      }
    }

    const revVal = parseNumericInput(revenuePerConversion);
    if (revVal < 0) {
      errs.push({ field: 'revenuePerConversion', message: 'Must be $0 or more' });
    }
    if (revVal > 10_000_000) {
      errs.push({
        field: 'revenuePerConversion',
        message: 'Maximum $10,000,000',
      });
    }

    return errs;
  }, [visitors, rates, revenuePerConversion, template, inputMode]);

  const getError = (field: string): string | undefined => {
    if (!touched.has(field)) return undefined;
    return errors.find((e) => e.field === field)?.message;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => new Set(prev).add(field));
    setErrors(validate());
  };

  // ---- Build FunnelInputs & submit ----
  const handleSubmit = () => {
    // Mark all fields as touched
    const allFields = new Set<string>([
      'visitors',
      'revenuePerConversion',
      ...template.stages.map((s) => s.key),
    ]);
    setTouched(allFields);

    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    const visitorsNum = parseNumericInput(visitors);
    const revNum = parseNumericInput(revenuePerConversion);

    let finalRates: Record<string, number>;

    if (inputMode === 'volumes') {
      // Derive rates from volumes
      const numericVolumes: Record<string, number> = {};
      for (const [k, v] of Object.entries(volumeValues)) {
        numericVolumes[k] = parseNumericInput(v);
      }
      finalRates = deriveRatesFromVolumes(template, numericVolumes);
    } else {
      finalRates = {};
      for (const stage of template.stages) {
        finalRates[stage.key] = parseFloat(rates[stage.key] ?? '0');
      }
    }

    // Clamp to guardrail bounds
    for (const stage of template.stages) {
      const guard = template.stageGuardrails[stage.key];
      if (guard) {
        finalRates[stage.key] = clamp(
          finalRates[stage.key],
          guard.rateFloor,
          guard.rateCeiling,
        );
      } else {
        finalRates[stage.key] = clamp(finalRates[stage.key], 0, 100);
      }
    }

    const inputs: FunnelInputs = {
      templateId: selectedTemplate,
      visitors: clamp(visitorsNum, TRAFFIC_BOUNDS.min, TRAFFIC_BOUNDS.max),
      rates: finalRates,
      revenuePerConversion: Math.max(0, revNum),
    };

    onSubmit(inputs);
  };

  // ---- Rate field handlers ----
  const handleRateChange = (key: string, value: string) => {
    setRates((prev) => ({ ...prev, [key]: value }));
  };

  const handleRateBlur = (key: string) => {
    handleBlur(key);
    // Format on blur
    const val = parseFloat(rates[key] ?? '0');
    if (!isNaN(val)) {
      const clamped = clamp(val, 0, 100);
      setRates((prev) => ({ ...prev, [key]: formatDisplayRate(clamped) }));
    }
  };

  // ---- Volume field handlers ----
  const handleVolumeChange = (label: string, value: string) => {
    setVolumeValues((prev) => ({ ...prev, [label]: value }));
  };

  const handleVolumeBlur = (label: string) => {
    const val = parseNumericInput(volumeValues[label] ?? '0');
    setVolumeValues((prev) => ({
      ...prev,
      [label]: formatDisplayNumber(Math.max(0, Math.round(val))),
    }));
  };

  // ---- Visitors field handlers ----
  const handleVisitorsBlur = () => {
    handleBlur('visitors');
    const val = parseNumericInput(visitors);
    setVisitors(formatDisplayNumber(Math.max(0, Math.round(val))));
  };

  // ---- Revenue field handlers ----
  const handleRevenueBlur = () => {
    handleBlur('revenuePerConversion');
    const val = parseNumericInput(revenuePerConversion);
    setRevenuePerConversion(formatDisplayCurrency(Math.max(0, val)));
  };

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
    <div className="rounded-lg border border-white/[0.06] bg-ds-panel p-6">
      {/* ---- Section: Funnel Type ---- */}
      <div className="mb-6">
        <label className="mb-3 block text-sm font-semibold text-ds-text">
          Funnel Type
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                selectedCategory === cat.id
                  ? 'border-ds-blue bg-ds-blue/10 text-ds-text'
                  : 'border-white/[0.06] bg-ds-bg-alt text-ds-text-secondary hover:border-white/[0.12] hover:text-ds-text'
              }`}
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
          <label className="mb-2 block text-xs font-medium text-ds-text-secondary">
            Sales Motion
          </label>
          <div className="inline-flex rounded-lg border border-white/[0.06] bg-ds-bg-alt p-0.5">
            {B2B_SAAS_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleB2bSubModeChange(id)}
                className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                  selectedTemplate === id
                    ? 'bg-ds-panel-elevated text-ds-text'
                    : 'text-ds-text-secondary hover:text-ds-text'
                }`}
              >
                {TEMPLATE_DISPLAY[id].shortName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Template description ---- */}
      <p className="mb-6 text-sm text-ds-text-secondary">
        {template.description}
      </p>

      {/* ---- Row: Input Mode + Time Period ---- */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        {/* Input mode toggle */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ds-text-secondary">
            Enter as
          </label>
          <div className="inline-flex rounded-lg border border-white/[0.06] bg-ds-bg-alt p-0.5">
            <button
              type="button"
              onClick={() => setInputMode('rates')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                inputMode === 'rates'
                  ? 'bg-ds-panel-elevated text-ds-text'
                  : 'text-ds-text-secondary hover:text-ds-text'
              }`}
            >
              Conversion Rates
            </button>
            <button
              type="button"
              onClick={() => setInputMode('volumes')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                inputMode === 'volumes'
                  ? 'bg-ds-panel-elevated text-ds-text'
                  : 'text-ds-text-secondary hover:text-ds-text'
              }`}
            >
              Stage Volumes
            </button>
          </div>
        </div>

        {/* Time period */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ds-text-secondary">
            Time Period (optional)
          </label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
            className="rounded-lg border border-white/[0.1] bg-ds-bg-alt px-3 py-2 text-sm text-ds-text outline-none focus:border-ds-blue"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>

        {/* Traffic source */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ds-text-secondary">
            Traffic Source (optional)
          </label>
          <select
            value={trafficSource}
            onChange={(e) => setTrafficSource(e.target.value as TrafficSource)}
            className="rounded-lg border border-white/[0.1] bg-ds-bg-alt px-3 py-2 text-sm text-ds-text outline-none focus:border-ds-blue"
          >
            <option value="">Not specified</option>
            <option value="organic">Organic</option>
            <option value="paid">Paid</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        {/* Benchmark mode */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ds-text-secondary">
            Benchmark Mode
          </label>
          <div className="rounded-lg border border-white/[0.06] bg-ds-bg-alt px-3 py-2 text-sm text-ds-text-secondary">
            {benchmarkModeLabel}
          </div>
        </div>
      </div>

      {/* ---- Visitors + Revenue per Conversion ---- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Visitors */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ds-text">
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
            value={visitors}
            onChange={(e) => setVisitors(e.target.value)}
            onBlur={handleVisitorsBlur}
            onFocus={(e) => {
              // Show raw number on focus for easy editing
              const val = parseNumericInput(e.target.value);
              if (val > 0) setVisitors(String(Math.round(val)));
            }}
            className={`w-full rounded-lg border bg-ds-bg-alt px-3 py-2.5 font-mono text-sm text-ds-text outline-none transition-colors focus:border-ds-blue ${
              getError('visitors')
                ? 'border-ds-red'
                : 'border-white/[0.1]'
            }`}
            placeholder="10,000"
          />
          {getError('visitors') && (
            <p className="mt-1 text-xs text-ds-red">{getError('visitors')}</p>
          )}
          <p className="mt-1 text-xs text-ds-text-secondary">
            {TRAFFIC_BOUNDS.min.toLocaleString()} – {TRAFFIC_BOUNDS.max.toLocaleString()}
          </p>
        </div>

        {/* Revenue per conversion */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ds-text">
            Revenue per Conversion
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ds-text-secondary">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={revenuePerConversion}
              onChange={(e) => setRevenuePerConversion(e.target.value)}
              onBlur={handleRevenueBlur}
              onFocus={(e) => {
                const val = parseNumericInput(e.target.value);
                if (val > 0) setRevenuePerConversion(String(Math.round(val)));
              }}
              className={`w-full rounded-lg border bg-ds-bg-alt py-2.5 pl-7 pr-3 font-mono text-sm text-ds-text outline-none transition-colors focus:border-ds-blue ${
                getError('revenuePerConversion')
                  ? 'border-ds-red'
                  : 'border-white/[0.1]'
              }`}
              placeholder="5,000"
            />
          </div>
          {getError('revenuePerConversion') && (
            <p className="mt-1 text-xs text-ds-red">
              {getError('revenuePerConversion')}
            </p>
          )}
          <p className="mt-1 text-xs text-ds-text-secondary">
            Typical for {template.name}: ${template.revenuePerConversion.floor.toLocaleString()} – ${template.revenuePerConversion.ceiling.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ---- Stage Inputs ---- */}
      <div className="mb-6">
        <label className="mb-3 block text-sm font-semibold text-ds-text">
          {inputMode === 'rates' ? 'Conversion Rates' : 'Stage Volumes'}
        </label>

        {inputMode === 'rates' ? (
          /* ---- Rate inputs ---- */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {template.stages.map((stage) => {
              const guard = template.stageGuardrails[stage.key];
              const benchmark = template.benchmarkRates[stage.key];
              return (
                <div key={stage.key}>
                  <label className="mb-1.5 block text-xs font-medium text-ds-text-secondary">
                    {stage.label}
                    <span className="ml-2 text-ds-blue">
                      Benchmark: {benchmark?.toFixed(1)}%
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rates[stage.key] ?? ''}
                      onChange={(e) =>
                        handleRateChange(stage.key, e.target.value)
                      }
                      onBlur={() => handleRateBlur(stage.key)}
                      onFocus={() => {
                        // Show raw value on focus
                        const val = parseFloat(rates[stage.key] ?? '0');
                        if (!isNaN(val)) {
                          setRates((prev) => ({
                            ...prev,
                            [stage.key]: String(val),
                          }));
                        }
                      }}
                      className={`w-full rounded-lg border bg-ds-bg-alt py-2 pl-3 pr-8 font-mono text-sm text-ds-text outline-none transition-colors focus:border-ds-blue ${
                        getError(stage.key)
                          ? 'border-ds-red'
                          : 'border-white/[0.1]'
                      }`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ds-text-secondary">
                      %
                    </span>
                  </div>
                  {getError(stage.key) && (
                    <p className="mt-1 text-xs text-ds-red">
                      {getError(stage.key)}
                    </p>
                  )}
                  {guard && (
                    <p className="mt-1 text-xs text-ds-text-secondary">
                      Plausible: {guard.rateFloor.toFixed(1)}% – {guard.rateCeiling.toFixed(1)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ---- Volume inputs ---- */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {volumeLabels.map((label, i) => (
              <div key={label}>
                <label className="mb-1.5 block text-xs font-medium text-ds-text-secondary">
                  {label}
                  {i === 0 && (
                    <span className="ml-2 text-ds-blue">Top of funnel</span>
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
                  className="w-full rounded-lg border border-white/[0.1] bg-ds-bg-alt px-3 py-2 font-mono text-sm text-ds-text outline-none transition-colors focus:border-ds-blue"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Submit ---- */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full rounded-lg bg-gradient-to-r from-ds-blue to-blue-500 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
      >
        Analyze Funnel
      </button>
    </div>
  );
}
