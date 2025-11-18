// Payment Configuration
// This file contains all the configuration for payment providers

export interface PaymentConfig {
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    enabled: boolean;
  };
  paypal: {
    clientId: string;
    clientSecret: string;
    webhookId: string;
    enabled: boolean;
    environment: 'sandbox' | 'live';
  };
  subscription: {
    trialDays: number;
    gracePeriodDays: number;
    billingCycles: ('monthly' | 'annual')[];
  };
  security: {
    requireStrongAuth: boolean;
    maxFailedAttempts: number;
    lockoutDuration: number; // minutes
  };
}

// Development/Sandbox configuration
export const paymentConfig: PaymentConfig = {
  stripe: {
    publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_1234567890',
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_1234567890',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_1234567890',
    enabled: true
  },
  paypal: {
    clientId: process.env.VITE_PAYPAL_CLIENT_ID || 'test_client_id',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'test_client_secret',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || 'test_webhook_id',
    enabled: true,
    environment: 'sandbox'
  },
  subscription: {
    trialDays: 14,
    gracePeriodDays: 7,
    billingCycles: ['monthly', 'annual']
  },
  security: {
    requireStrongAuth: true,
    maxFailedAttempts: 3,
    lockoutDuration: 30
  }
};

// Environment-specific configurations
export const getPaymentConfig = (environment: 'development' | 'production' = 'development'): PaymentConfig => {
  if (environment === 'production') {
    return {
      ...paymentConfig,
      stripe: {
        ...paymentConfig.stripe,
        publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        enabled: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY)
      },
      paypal: {
        ...paymentConfig.paypal,
        clientId: process.env.VITE_PAYPAL_CLIENT_ID || '',
        clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
        enabled: Boolean(process.env.VITE_PAYPAL_CLIENT_ID),
        environment: 'live'
      }
    };
  }
  return paymentConfig;
};

// Feature flags
export const paymentFeatures = {
  stripeEnabled: paymentConfig.stripe.enabled,
  paypalEnabled: paymentConfig.paypal.enabled,
  subscriptionsEnabled: true,
  trialsEnabled: true,
  webhooksEnabled: true,
  invoicingEnabled: true,
  refundsEnabled: true
};

// Error messages
export const paymentErrorMessages = {
  cardDeclined: 'Your card was declined. Please try a different payment method.',
  insufficientFunds: 'Insufficient funds. Please try a different payment method.',
  expiredCard: 'Your card has expired. Please update your payment method.',
  invalidCard: 'Invalid card details. Please check and try again.',
  networkError: 'Network error. Please try again.',
  serverError: 'Server error. Please contact support.',
  subscriptionNotFound: 'Subscription not found.',
  paymentMethodRequired: 'Payment method is required.',
  invalidAmount: 'Invalid amount specified.'
};

// Webhook event types
export const stripeWebhookEvents = {
  PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  PAYMENT_FAILED: 'invoice.payment_failed',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  TRIAL_WILL_END: 'customer.subscription.trial_will_end'
} as const;

export const paypalWebhookEvents = {
  SUBSCRIPTION_ACTIVATED: 'BILLING.SUBSCRIPTION.ACTIVATED',
  SUBSCRIPTION_CANCELLED: 'BILLING.SUBSCRIPTION.CANCELLED',
  SUBSCRIPTION_SUSPENDED: 'BILLING.SUBSCRIPTION.SUSPENDED',
  PAYMENT_COMPLETED: 'PAYMENT.SALE.COMPLETED',
  PAYMENT_DENIED: 'PAYMENT.SALE.DENIED'
} as const;

// Helper functions
export const isValidEnvironment = () => {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

export const getWebhookUrl = (provider: 'stripe' | 'paypal') => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  return `${baseUrl}/api/webhooks/${provider}`;
};

export const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100); // Stripe amounts are in cents
};