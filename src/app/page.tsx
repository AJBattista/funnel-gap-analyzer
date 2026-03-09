import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f1117] py-8 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <h1 className="text-2xl font-semibold text-[#e8eaf0] mb-2 font-[family-name:var(--font-geist-sans)]">
          Funnel Gap Analyzer
        </h1>
        <p className="text-sm text-[#8a8fa8] mb-8">
          Identify where your funnel is leaking revenue and what to fix first.
        </p>
        <Dashboard />
      </div>
    </main>
  );
}
