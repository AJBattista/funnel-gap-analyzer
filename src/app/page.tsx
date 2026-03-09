'use client';

// ---------------------------------------------------------------------------
// Main Page — Wires FunnelForm → analyzeFunnel engine → Dashboard
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from 'react';
import type { FunnelInputs, AnalysisResult } from '@/lib/types';
import { getDefaultInputs } from '@/lib/benchmarks';
import { analyzeFunnel } from '@/lib/engine';

import FunnelForm from '@/components/FunnelForm';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  // FunnelInputs state — initialized with B2B SaaS Lead-Gen defaults
  const [inputs, setInputs] = useState<FunnelInputs>(() =>
    getDefaultInputs('b2b-saas-leadgen'),
  );

  // AnalysisResult state — computed from inputs
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Run analysis on mount with defaults
  useEffect(() => {
    setAnalysis(analyzeFunnel(inputs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle form input changes — re-run analysis in real time
  const handleChange = useCallback((newInputs: FunnelInputs) => {
    setInputs(newInputs);
    setAnalysis(analyzeFunnel(newInputs));
  }, []);

  // Handle explicit form submit (same as change, but allows future
  // differentiation like scroll-to-results)
  const handleSubmit = useCallback((newInputs: FunnelInputs) => {
    setInputs(newInputs);
    setAnalysis(analyzeFunnel(newInputs));
  }, []);

  return (
    <main className="min-h-screen bg-[#0f1117] py-8 px-4 sm:px-6 lg:py-12">
      <div className="max-w-[1200px] mx-auto">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#e8eaf0] mb-1.5 font-[family-name:var(--font-geist-sans)] tracking-tight">
          Funnel Gap Analyzer
        </h1>
        <p className="text-sm text-[#8a8fa8] mb-10">
          Identify where your funnel is leaking revenue and what to fix first.
        </p>

        <FunnelForm
          inputs={inputs}
          onSubmit={handleSubmit}
          onChange={handleChange}
        />

        {analysis && (
          <Dashboard analysis={analysis} inputs={inputs} />
        )}
      </div>
    </main>
  );
}
