import { useState } from 'react';
import PricingPage from '@/components/Payment/PricingPage';
import PaymentForm from '@/components/Payment/PaymentForm';
import BillingDashboard from '@/components/Payment/BillingDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Settings,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import type { SubscriptionPlan } from '@/utils/subscriptionPlans';

// Mock user subscription data
const mockUserSubscription = {
  plan: 'pro',
  status: 'active',
  trialEndsAt: null,
  currentPeriodEnd: '2024-02-15'
};

type PaymentStep = 'plans' | 'payment' | 'success' | 'billing';

const PaymentPortal = () => {
  const [currentStep, setCurrentStep] = useState<PaymentStep>('plans');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setCurrentStep('payment');
  };

  const handlePaymentSuccess = () => {
    setCurrentStep('success');
  };

  const handleManageBilling = () => {
    setCurrentStep('billing');
  };

  const handleBackToPlans = () => {
    setCurrentStep('plans');
    setSelectedPlan(null);
  };

  // If user already has a subscription, show billing dashboard
  if (mockUserSubscription.plan && currentStep === 'plans') {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Current Subscription Status */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Your Subscription</CardTitle>
                  <p className="text-muted-foreground">Manage your billing and subscription</p>
                </div>
                <Badge className="bg-green-500 hover:bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary capitalize">
                    {mockUserSubscription.plan}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Plan</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {new Date(mockUserSubscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Next Billing Date</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">
                    <DollarSign className="h-6 w-6 inline" />
                    79
                  </div>
                  <div className="text-sm text-muted-foreground">Monthly</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  className="flex-1" 
                  onClick={handleManageBilling}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Billing
                </Button>
                <Button variant="outline" className="flex-1">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Alternative: Show plan comparison for upgrades */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Need More Features?</h2>
            <p className="text-muted-foreground">
              Upgrade to a higher plan to unlock additional features and capabilities
            </p>
          </div>

          <PricingPage 
            currentPlan={mockUserSubscription.plan}
            onPlanSelect={handlePlanSelect}
          />
        </div>
      </div>
    );
  }

  // Show billing dashboard
  if (currentStep === 'billing') {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => setCurrentStep('plans')}
            className="mb-6"
          >
            ← Back to Overview
          </Button>
          <BillingDashboard />
        </div>
      </div>
    );
  }

  // Show success page
  if (currentStep === 'success') {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="border-green-500">
            <CardHeader>
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-green-100 rounded-full">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-3xl text-green-600">
                Payment Successful!
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Your subscription has been activated. Welcome to {selectedPlan?.name}!
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You will receive a confirmation email shortly with your invoice and setup instructions.
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Subscription Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Plan:</span>
                    <span className="font-medium">{selectedPlan?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Billing Cycle:</span>
                    <span className="font-medium capitalize">{selectedBillingCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount:</span>
                    <span className="font-medium">
                      ${selectedBillingCycle === 'annual' ? (selectedPlan?.price || 0) * 12 * 0.85 : selectedPlan?.price || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button className="flex-1" onClick={handleManageBilling}>
                  Go to Dashboard
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setCurrentStep('plans')}>
                  View All Plans
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show payment form
  if (currentStep === 'payment' && selectedPlan) {
    return (
      <div className="container mx-auto py-8 px-4">
        <PaymentForm
          plan={selectedPlan}
          billingCycle={selectedBillingCycle}
          onSuccess={handlePaymentSuccess}
          onBack={handleBackToPlans}
        />
      </div>
    );
  }

  // Show pricing plans (default)
  return (
    <div className="container mx-auto py-8 px-4">
      <PricingPage 
        currentPlan={mockUserSubscription.plan}
        onPlanSelect={handlePlanSelect}
      />
    </div>
  );
}

export default PaymentPortal;