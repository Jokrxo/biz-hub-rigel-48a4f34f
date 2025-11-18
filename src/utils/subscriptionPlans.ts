export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  limits: {
    transactions: number;
    users: number;
    storage: number; // GB
    invoices: number;
    customers: number;
  };
  stripePriceId?: string;
  paypalPlanId?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for small businesses and startups',
    price: 29,
    currency: 'USD',
    interval: 'month',
    features: [
      'Up to 500 transactions per month',
      'Up to 3 users',
      '5GB storage',
      'Basic reporting',
      'Email support',
      'VAT tracking',
      'Invoice generation'
    ],
    limits: {
      transactions: 500,
      users: 3,
      storage: 5,
      invoices: 100,
      customers: 100
    },
    stripePriceId: 'price_basic_monthly',
    paypalPlanId: 'P-BASIC-MONTHLY'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Ideal for growing businesses',
    price: 79,
    currency: 'USD',
    interval: 'month',
    popular: true,
    features: [
      'Up to 2,000 transactions per month',
      'Up to 10 users',
      '50GB storage',
      'Advanced reporting',
      'Priority support',
      'All Basic features',
      'Multi-currency support',
      'Advanced analytics',
      'API access',
      'Custom integrations'
    ],
    limits: {
      transactions: 2000,
      users: 10,
      storage: 50,
      invoices: 500,
      customers: 500
    },
    stripePriceId: 'price_pro_monthly',
    paypalPlanId: 'P-PRO-MONTHLY'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with advanced needs',
    price: 199,
    currency: 'USD',
    interval: 'month',
    features: [
      'Unlimited transactions',
      'Unlimited users',
      '500GB storage',
      'Custom reporting',
      '24/7 phone support',
      'All Pro features',
      'Dedicated account manager',
      'Custom integrations',
      'Advanced security',
      'SLA guarantee',
      'Training sessions',
      'Custom development'
    ],
    limits: {
      transactions: -1, // unlimited
      users: -1, // unlimited
      storage: 500,
      invoices: -1, // unlimited
      customers: -1 // unlimited
    },
    stripePriceId: 'price_enterprise_monthly',
    paypalPlanId: 'P-ENTERPRISE-MONTHLY'
  }
];

export const ANNUAL_DISCOUNT = 0.15; // 15% discount for annual billing

export interface BillingCycle {
  id: 'monthly' | 'annual';
  name: string;
  discount?: number;
}

export const BILLING_CYCLES: BillingCycle[] = [
  {
    id: 'monthly',
    name: 'Monthly'
  },
  {
    id: 'annual',
    name: 'Annual',
    discount: ANNUAL_DISCOUNT
  }
];

export function calculatePlanPrice(plan: SubscriptionPlan, cycle: BillingCycle): number {
  if (cycle.discount) {
    return Math.round(plan.price * 12 * (1 - cycle.discount));
  }
  return plan.price;
}

export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}