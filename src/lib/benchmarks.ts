// ---------------------------------------------------------------------------
// Funnel Gap Analyzer — Benchmark Data & Guardrails
// ---------------------------------------------------------------------------
//
// Benchmark rates are median/typical values sourced from industry reports:
//   - B2B SaaS: HubSpot State of Marketing, Implisit/Salesforce benchmarks
//   - DTC Ecommerce: Littledata / Shopify aggregate data
//   - PLG/Trial: OpenView Partners, Lenny Rachitsky benchmarks
//   - Local Services: WordStream / CallRail local lead-gen data
//   - Consumer App: Adjust/AppsFlyer mobile benchmarks, Recurly churn data
//   - Creator/Info Product: ConvertKit, Kajabi aggregate benchmarks
//
// All rates are expressed as percentages (0–100), not decimals.
// ---------------------------------------------------------------------------

import type {
  TemplateId,
  FunnelTemplate,
  FunnelInputs,
  TrafficBounds,
  RecoveryGuardrails,
} from './types';

// ---- Global guardrails ----------------------------------------------------

export const TRAFFIC_BOUNDS: TrafficBounds = {
  min: 100,
  max: 1_000_000,
} as const;

export const RECOVERY_GUARDRAILS: RecoveryGuardrails = {
  /** Projected recovery cannot exceed 40% of current funnel revenue. */
  recoveryCap: 0.40,
  /** Each stage's recoverable amount uses at most 50% of the gap. */
  benchmarkGapRecoveryLimit: 0.50,
} as const;

// ---- DTC Ecommerce --------------------------------------------------------

const dtcEcommerce: FunnelTemplate = {
  id: 'dtc-ecommerce',
  name: 'DTC Ecommerce',
  description:
    'Direct-to-consumer online store: visitors browse products, add to cart, check out, and purchase.',
  stages: [
    {
      key: 'visitToProductView',
      label: 'Visit → Product View',
      fromLabel: 'Visitors',
      toLabel: 'Product Views',
    },
    {
      key: 'productViewToCart',
      label: 'Product View → Add to Cart',
      fromLabel: 'Product Views',
      toLabel: 'Add to Carts',
    },
    {
      key: 'cartToCheckout',
      label: 'Add to Cart → Checkout',
      fromLabel: 'Add to Carts',
      toLabel: 'Checkouts',
    },
    {
      key: 'checkoutToPurchase',
      label: 'Checkout → Purchase',
      fromLabel: 'Checkouts',
      toLabel: 'Purchases',
    },
  ],
  benchmarkRates: {
    visitToProductView: 45.0,
    productViewToCart: 10.0,
    cartToCheckout: 45.0,
    checkoutToPurchase: 65.0,
  },
  stageGuardrails: {
    visitToProductView: { rateFloor: 10.0, rateCeiling: 90.0 },
    productViewToCart: { rateFloor: 1.0, rateCeiling: 35.0 },
    cartToCheckout: { rateFloor: 15.0, rateCeiling: 80.0 },
    checkoutToPurchase: { rateFloor: 25.0, rateCeiling: 95.0 },
  },
  revenuePerConversion: { floor: 5, ceiling: 500 },
  defaults: {
    visitors: 50_000,
    rates: {
      visitToProductView: 40.0,
      productViewToCart: 8.0,
      cartToCheckout: 35.0,
      checkoutToPurchase: 55.0,
    },
    revenuePerConversion: 75,
  },
};

// ---- B2B SaaS Lead-Gen ----------------------------------------------------

const b2bSaasLeadgen: FunnelTemplate = {
  id: 'b2b-saas-leadgen',
  name: 'B2B SaaS (Lead-Gen)',
  description:
    'Enterprise/mid-market SaaS with a sales-led motion: visitors become leads, qualify, get demos, and close.',
  stages: [
    {
      key: 'visitorToLead',
      label: 'Visitor → Lead',
      fromLabel: 'Visitors',
      toLabel: 'Leads',
    },
    {
      key: 'leadToQualified',
      label: 'Lead → Qualified',
      fromLabel: 'Leads',
      toLabel: 'Qualified',
    },
    {
      key: 'qualifiedToProposal',
      label: 'Qualified → Proposal',
      fromLabel: 'Qualified',
      toLabel: 'Proposals',
    },
    {
      key: 'proposalToClose',
      label: 'Proposal → Close',
      fromLabel: 'Proposals',
      toLabel: 'Customers',
    },
  ],
  benchmarkRates: {
    visitorToLead: 3.0,
    leadToQualified: 35.0,
    qualifiedToProposal: 50.0,
    proposalToClose: 25.0,
  },
  stageGuardrails: {
    visitorToLead: { rateFloor: 0.5, rateCeiling: 15.0 },
    leadToQualified: { rateFloor: 5.0, rateCeiling: 70.0 },
    qualifiedToProposal: { rateFloor: 10.0, rateCeiling: 85.0 },
    proposalToClose: { rateFloor: 5.0, rateCeiling: 55.0 },
  },
  revenuePerConversion: { floor: 1_000, ceiling: 500_000 },
  defaults: {
    visitors: 10_000,
    rates: {
      visitorToLead: 2.5,
      leadToQualified: 30.0,
      qualifiedToProposal: 45.0,
      proposalToClose: 20.0,
    },
    revenuePerConversion: 12_000,
  },
};

// ---- B2B SaaS Trial / PLG ------------------------------------------------

const b2bSaasTrial: FunnelTemplate = {
  id: 'b2b-saas-trial',
  name: 'B2B SaaS (Trial / PLG)',
  description:
    'Product-led SaaS with a free trial or freemium model: visitors sign up, activate, convert to paid, and retain.',
  stages: [
    {
      key: 'visitorToSignup',
      label: 'Visitor → Free Trial',
      fromLabel: 'Visitors',
      toLabel: 'Signups',
    },
    {
      key: 'signupToActivated',
      label: 'Signup → Activated',
      fromLabel: 'Signups',
      toLabel: 'Activated Users',
    },
    {
      key: 'activatedToPaid',
      label: 'Activated → Paid',
      fromLabel: 'Activated Users',
      toLabel: 'Paid Users',
    },
    {
      key: 'paidToRetained',
      label: 'Paid → Retained (Mo 2)',
      fromLabel: 'Paid Users',
      toLabel: 'Retained Users',
    },
  ],
  benchmarkRates: {
    visitorToSignup: 5.0,
    signupToActivated: 35.0,
    activatedToPaid: 15.0,
    paidToRetained: 80.0,
  },
  stageGuardrails: {
    visitorToSignup: { rateFloor: 1.0, rateCeiling: 20.0 },
    signupToActivated: { rateFloor: 5.0, rateCeiling: 70.0 },
    activatedToPaid: { rateFloor: 2.0, rateCeiling: 50.0 },
    paidToRetained: { rateFloor: 30.0, rateCeiling: 98.0 },
  },
  revenuePerConversion: { floor: 100, ceiling: 25_000 },
  defaults: {
    visitors: 20_000,
    rates: {
      visitorToSignup: 4.0,
      signupToActivated: 28.0,
      activatedToPaid: 10.0,
      paidToRetained: 70.0,
    },
    revenuePerConversion: 600,
  },
};

// ---- Local Services -------------------------------------------------------

const localServices: FunnelTemplate = {
  id: 'local-services',
  name: 'Local Services',
  description:
    'Local service business (plumbing, legal, dental, etc.): visitors inquire, book a consultation, accept a quote, and complete the job.',
  stages: [
    {
      key: 'visitToInquiry',
      label: 'Visit → Inquiry',
      fromLabel: 'Visitors',
      toLabel: 'Inquiries',
    },
    {
      key: 'inquiryToConsultation',
      label: 'Inquiry → Consultation',
      fromLabel: 'Inquiries',
      toLabel: 'Consultations',
    },
    {
      key: 'consultationToQuote',
      label: 'Consultation → Quote Accepted',
      fromLabel: 'Consultations',
      toLabel: 'Accepted Quotes',
    },
    {
      key: 'quoteToJob',
      label: 'Quote → Job Completed',
      fromLabel: 'Accepted Quotes',
      toLabel: 'Completed Jobs',
    },
  ],
  benchmarkRates: {
    visitToInquiry: 5.0,
    inquiryToConsultation: 50.0,
    consultationToQuote: 60.0,
    quoteToJob: 85.0,
  },
  stageGuardrails: {
    visitToInquiry: { rateFloor: 1.0, rateCeiling: 20.0 },
    inquiryToConsultation: { rateFloor: 15.0, rateCeiling: 85.0 },
    consultationToQuote: { rateFloor: 20.0, rateCeiling: 90.0 },
    quoteToJob: { rateFloor: 40.0, rateCeiling: 99.0 },
  },
  revenuePerConversion: { floor: 50, ceiling: 50_000 },
  defaults: {
    visitors: 3_000,
    rates: {
      visitToInquiry: 4.0,
      inquiryToConsultation: 40.0,
      consultationToQuote: 50.0,
      quoteToJob: 80.0,
    },
    revenuePerConversion: 500,
  },
};

// ---- Consumer App ---------------------------------------------------------

const consumerApp: FunnelTemplate = {
  id: 'consumer-app',
  name: 'Consumer App',
  description:
    'Consumer mobile or web app: visitors sign up, complete onboarding, subscribe, and retain into month 2.',
  stages: [
    {
      key: 'visitToSignup',
      label: 'Visit → Signup',
      fromLabel: 'Visitors',
      toLabel: 'Signups',
    },
    {
      key: 'signupToOnboarded',
      label: 'Signup → Onboarded',
      fromLabel: 'Signups',
      toLabel: 'Onboarded Users',
    },
    {
      key: 'onboardedToSubscribed',
      label: 'Onboarded → Subscribed',
      fromLabel: 'Onboarded Users',
      toLabel: 'Subscribers',
    },
    {
      key: 'subscribedToRetained',
      label: 'Subscribed → Retained (Mo 2)',
      fromLabel: 'Subscribers',
      toLabel: 'Retained Users',
    },
  ],
  benchmarkRates: {
    visitToSignup: 12.0,
    signupToOnboarded: 40.0,
    onboardedToSubscribed: 8.0,
    subscribedToRetained: 70.0,
  },
  stageGuardrails: {
    visitToSignup: { rateFloor: 2.0, rateCeiling: 40.0 },
    signupToOnboarded: { rateFloor: 10.0, rateCeiling: 75.0 },
    onboardedToSubscribed: { rateFloor: 1.0, rateCeiling: 30.0 },
    subscribedToRetained: { rateFloor: 20.0, rateCeiling: 95.0 },
  },
  revenuePerConversion: { floor: 5, ceiling: 1_200 },
  defaults: {
    visitors: 100_000,
    rates: {
      visitToSignup: 10.0,
      signupToOnboarded: 32.0,
      onboardedToSubscribed: 5.0,
      subscribedToRetained: 60.0,
    },
    revenuePerConversion: 120,
  },
};

// ---- Creator / Info Product -----------------------------------------------

const creatorInfo: FunnelTemplate = {
  id: 'creator-info',
  name: 'Creator / Info Product',
  description:
    'Course, membership, or digital product funnel: visitors subscribe to email, engage, view the sales page, and purchase.',
  stages: [
    {
      key: 'visitToSubscriber',
      label: 'Visit → Email Subscriber',
      fromLabel: 'Visitors',
      toLabel: 'Subscribers',
    },
    {
      key: 'subscriberToEngaged',
      label: 'Subscriber → Engaged',
      fromLabel: 'Subscribers',
      toLabel: 'Engaged Subscribers',
    },
    {
      key: 'engagedToSalesPage',
      label: 'Engaged → Sales Page',
      fromLabel: 'Engaged Subscribers',
      toLabel: 'Sales Page Views',
    },
    {
      key: 'salesPageToPurchase',
      label: 'Sales Page → Purchase',
      fromLabel: 'Sales Page Views',
      toLabel: 'Purchases',
    },
  ],
  benchmarkRates: {
    visitToSubscriber: 4.0,
    subscriberToEngaged: 35.0,
    engagedToSalesPage: 20.0,
    salesPageToPurchase: 5.0,
  },
  stageGuardrails: {
    visitToSubscriber: { rateFloor: 0.5, rateCeiling: 15.0 },
    subscriberToEngaged: { rateFloor: 10.0, rateCeiling: 65.0 },
    engagedToSalesPage: { rateFloor: 5.0, rateCeiling: 50.0 },
    salesPageToPurchase: { rateFloor: 0.5, rateCeiling: 25.0 },
  },
  revenuePerConversion: { floor: 7, ceiling: 5_000 },
  defaults: {
    visitors: 15_000,
    rates: {
      visitToSubscriber: 3.0,
      subscriberToEngaged: 28.0,
      engagedToSalesPage: 15.0,
      salesPageToPurchase: 3.0,
    },
    revenuePerConversion: 97,
  },
};

// ---- Template registry ----------------------------------------------------

/** All funnel templates keyed by TemplateId. */
export const FUNNEL_TEMPLATES: Record<TemplateId, FunnelTemplate> = {
  'dtc-ecommerce': dtcEcommerce,
  'b2b-saas-leadgen': b2bSaasLeadgen,
  'b2b-saas-trial': b2bSaasTrial,
  'local-services': localServices,
  'consumer-app': consumerApp,
  'creator-info': creatorInfo,
} as const;

/** Ordered list of template IDs for UI rendering. */
export const TEMPLATE_ORDER: readonly TemplateId[] = [
  'b2b-saas-leadgen',
  'b2b-saas-trial',
  'dtc-ecommerce',
  'local-services',
  'consumer-app',
  'creator-info',
] as const;

// ---- Helpers --------------------------------------------------------------

/**
 * Return the FunnelTemplate for a given ID.
 * Throws if the ID is not found (should never happen with typed IDs).
 */
export function getTemplate(id: TemplateId): FunnelTemplate {
  const t = FUNNEL_TEMPLATES[id];
  if (!t) {
    throw new Error(`Unknown template: ${id}`);
  }
  return t;
}

/** Build a default FunnelInputs from a template's defaults. */
export function getDefaultInputs(id: TemplateId): FunnelInputs {
  const t = getTemplate(id);
  return {
    templateId: id,
    visitors: t.defaults.visitors,
    rates: { ...t.defaults.rates },
    revenuePerConversion: t.defaults.revenuePerConversion,
  };
}

// ---- Confidence flag logic ------------------------------------------------

import type { ConfidenceFlag } from './types';

/**
 * Evaluate a set of FunnelInputs against the template guardrails and return
 * any confidence flags. An empty array means "high confidence."
 */
export function evaluateConfidence(inputs: FunnelInputs): ConfidenceFlag[] {
  const template = getTemplate(inputs.templateId);
  const flags: ConfidenceFlag[] = [];

  // --- Traffic volume ---
  if (inputs.visitors < TRAFFIC_BOUNDS.min) {
    flags.push({
      level: 'low',
      field: 'visitors',
      reason: `Monthly traffic (${inputs.visitors.toLocaleString()}) is below the minimum plausible volume of ${TRAFFIC_BOUNDS.min.toLocaleString()}. Results may not be statistically meaningful.`,
    });
  } else if (inputs.visitors > TRAFFIC_BOUNDS.max) {
    flags.push({
      level: 'medium',
      field: 'visitors',
      reason: `Monthly traffic (${inputs.visitors.toLocaleString()}) exceeds ${TRAFFIC_BOUNDS.max.toLocaleString()}. Verify this is a single funnel, not aggregate traffic.`,
    });
  }

  // --- Revenue per conversion ---
  const revGuard = template.revenuePerConversion;
  if (inputs.revenuePerConversion < revGuard.floor) {
    flags.push({
      level: 'low',
      field: 'revenuePerConversion',
      reason: `Revenue per conversion ($${inputs.revenuePerConversion.toLocaleString()}) is below the typical floor of $${revGuard.floor.toLocaleString()} for ${template.name}.`,
    });
  } else if (inputs.revenuePerConversion > revGuard.ceiling) {
    flags.push({
      level: 'medium',
      field: 'revenuePerConversion',
      reason: `Revenue per conversion ($${inputs.revenuePerConversion.toLocaleString()}) exceeds the typical ceiling of $${revGuard.ceiling.toLocaleString()} for ${template.name}. Verify this is per-deal, not aggregate.`,
    });
  }

  // --- Stage rates ---
  for (const stage of template.stages) {
    const rate = inputs.rates[stage.key];
    if (rate === undefined) continue;

    const guard = template.stageGuardrails[stage.key];
    if (!guard) continue;

    if (rate < guard.rateFloor) {
      flags.push({
        level: 'low',
        field: stage.key,
        reason: `${stage.label} rate (${rate.toFixed(1)}%) is below the plausible floor of ${guard.rateFloor.toFixed(1)}% for ${template.name}. This may indicate a tracking issue or data entry error.`,
      });
    } else if (rate > guard.rateCeiling) {
      flags.push({
        level: 'medium',
        field: stage.key,
        reason: `${stage.label} rate (${rate.toFixed(1)}%) exceeds the plausible ceiling of ${guard.rateCeiling.toFixed(1)}% for ${template.name}. Verify the metric definition matches this stage.`,
      });
    }
  }

  return flags;
}
