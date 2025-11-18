// Mock payment service for prototype
// In production, this would integrate with Stripe and PayPal APIs

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  email?: string;
  isDefault: boolean;
}

export interface Subscription {
  id: string;
  plan: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'requires_payment_method' | 'processing';
  clientSecret?: string;
}

export interface BillingHistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoiceUrl?: string;
}

class PaymentService {
  // Mock payment processing
  async processPayment(amount: number, currency: string, paymentMethod: string): Promise<PaymentIntent> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock successful payment
    return {
      id: 'pi_' + Math.random().toString(36).substr(2, 9),
      amount,
      currency,
      status: 'succeeded',
      clientSecret: 'cs_test_' + Math.random().toString(36).substr(2, 16)
    };
  }

  // Create subscription
  async createSubscription(planId: string, paymentMethodId: string): Promise<Subscription> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      id: 'sub_' + Math.random().toString(36).substr(2, 9),
      plan: planId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    };
  }

  // Get current subscription
  async getCurrentSubscription(): Promise<Subscription | null> {
    // Mock existing subscription
    return {
      id: 'sub_123456789',
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    };
  }

  // Get payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return [
      {
        id: 'pm_123',
        type: 'card',
        last4: '4242',
        brand: 'Visa',
        isDefault: true
      },
      {
        id: 'pm_456',
        type: 'paypal',
        email: 'user@example.com',
        isDefault: false
      }
    ];
  }

  // Get billing history
  async getBillingHistory(): Promise<BillingHistoryItem[]> {
    return [
      {
        id: 'inv_001',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Pro Plan - Monthly',
        amount: 79,
        status: 'paid',
        invoiceUrl: '/invoices/INV-001.pdf'
      },
      {
        id: 'inv_002',
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Pro Plan - Monthly',
        amount: 79,
        status: 'paid',
        invoiceUrl: '/invoices/INV-002.pdf'
      }
    ];
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Subscription cancelled:', subscriptionId);
  }

  // Update subscription
  async updateSubscription(subscriptionId: string, newPlanId: string): Promise<Subscription> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      id: subscriptionId,
      plan: newPlanId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    };
  }

  // Create PayPal subscription
  async createPayPalSubscription(planId: string): Promise<{ approvalUrl: string }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock PayPal approval URL
    return {
      approvalUrl: `https://www.paypal.com/webapps/billing/plans/subscribe?token=BA-` + Math.random().toString(36).substr(2, 16)
    };
  }

  // Simulate webhook events
  simulateWebhookEvent(eventType: string, data: any) {
    console.log('Simulating webhook event:', eventType, data);
    
    // In production, this would send actual webhook events
    // For now, we'll just log them
    return {
      id: 'evt_' + Math.random().toString(36).substr(2, 14),
      type: eventType,
      data: { object: data },
      created: Math.floor(Date.now() / 1000)
    };
  }
}

export const paymentService = new PaymentService();

// Stripe.js mock for development
export const loadStripe = () => {
  return Promise.resolve({
    elements: () => ({
      create: (type: string, options?: any) => ({
        mount: (element: HTMLElement) => {
          // Mock card element
          element.innerHTML = `
            <div style="border: 1px solid #ccc; padding: 10px; border-radius: 4px;">
              <input type="text" placeholder="Card number" style="width: 100%; border: none; outline: none;">
            </div>
          `;
        },
        on: (event: string, handler: Function) => {
          // Mock event handlers
        },
        destroy: () => {}
      })
    }),
    createPaymentMethod: () => Promise.resolve({ paymentMethod: { id: 'pm_mock' } }),
    confirmCardPayment: () => Promise.resolve({ paymentIntent: { status: 'succeeded' } }),
    confirmCardSetup: () => Promise.resolve({ setupIntent: { status: 'succeeded' } })
  });
};

// PayPal SDK mock for development
export const loadPayPalSDK = () => {
  return Promise.resolve({
    Buttons: () => ({
      render: (element: HTMLElement) => {
        element.innerHTML = `
          <div style="border: 1px solid #0070ba; background: #0070ba; color: white; padding: 10px; border-radius: 4px; text-align: center;">
            Pay with PayPal
          </div>
        `;
      }
    }),
    Marks: () => ({
      render: (element: HTMLElement) => {
        element.innerHTML = '<div>PayPal</div>';
      }
    })
  });
};