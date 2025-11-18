import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Building2, Crown, ArrowRight, DollarSign, Users, BarChart3, Shield } from 'lucide-react';
import { SUBSCRIPTION_PLANS, BILLING_CYCLES, calculatePlanPrice, formatPrice } from '@/utils/subscriptionPlans';
import type { SubscriptionPlan, BillingCycle } from '@/utils/subscriptionPlans';

interface PricingCardProps {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  onSelect: (plan: SubscriptionPlan) => void;
  currentPlan?: string;
}

function PricingCard({ plan, cycle, onSelect, currentPlan }: PricingCardProps) {
  const isCurrent = currentPlan === plan.id;
  const price = calculatePlanPrice(plan, cycle);
  const monthlyPrice = cycle.id === 'annual' ? Math.round(price / 12) : plan.price;

  return (
    <Card className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''} ${isCurrent ? 'ring-2 ring-green-500' : ''}`}>
      {plan.popular && (
        <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
          <Crown className="h-3 w-3 mr-1" />
          Most Popular
        </Badge>
      )}
      
      {isCurrent && (
        <Badge className="absolute -top-2 right-2 bg-green-500 text-white">
          Current Plan
        </Badge>
      )}

      <CardHeader className="text-center pb-8 pt-6">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            {plan.id === 'basic' && <Users className="h-6 w-6 text-primary" />}
            {plan.id === 'pro' && <BarChart3 className="h-6 w-6 text-primary" />}
            {plan.id === 'enterprise' && <Shield className="h-6 w-6 text-primary" />}
          </div>
        </div>
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription className="text-base">{plan.description}</CardDescription>
        
        <div className="mt-6">
          <div className="flex items-baseline justify-center">
            <span className="text-4xl font-bold">{formatPrice(price)}</span>
            <span className="text-muted-foreground ml-1">/{cycle.name}</span>
          </div>
          {cycle.id === 'annual' && (
            <Badge variant="secondary" className="mt-2">
              Save 15% annually
            </Badge>
          )}
          {cycle.id === 'annual' && (
            <p className="text-sm text-muted-foreground mt-1">
              ${monthlyPrice}/month billed annually
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3 mb-8">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Transactions</span>
            <span className="font-medium">
              {plan.limits.transactions === -1 ? 'Unlimited' : plan.limits.transactions.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Users</span>
            <span className="font-medium">
              {plan.limits.users === -1 ? 'Unlimited' : plan.limits.users}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Storage</span>
            <span className="font-medium">{plan.limits.storage}GB</span>
          </div>
        </div>

        <Button 
          className="w-full" 
          variant={plan.popular ? 'default' : 'outline'}
          onClick={() => onSelect(plan)}
          disabled={isCurrent}
        >
          {isCurrent ? 'Current Plan' : 'Choose Plan'}
          {!isCurrent && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </CardContent>
    </Card>
  );
}

interface PricingPageProps {
  currentPlan?: string;
  onPlanSelect: (plan: SubscriptionPlan) => void;
}

const PricingPage = ({ currentPlan, onPlanSelect }: PricingPageProps) => {
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(BILLING_CYCLES[0]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Select the perfect plan for your accounting needs. Upgrade or downgrade anytime.
        </p>
        
        <div className="flex justify-center mb-8">
          <div className="bg-muted p-1 rounded-lg inline-flex">
            {BILLING_CYCLES.map((cycle) => (
              <Button
                key={cycle.id}
                variant={selectedCycle.id === cycle.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCycle(cycle)}
                className="px-4"
              >
                {cycle.name}
                {cycle.discount && (
                  <Badge variant="secondary" className="ml-2">
                    Save {Math.round(cycle.discount * 100)}%
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            cycle={selectedCycle}
            onSelect={onPlanSelect}
            currentPlan={currentPlan}
          />
        ))}
      </div>

      <div className="text-center mt-12">
        <p className="text-muted-foreground">
          All plans include a 14-day free trial. No credit card required to start.
        </p>
        <div className="flex justify-center items-center gap-2 mt-4 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>Secure payments powered by Stripe & PayPal</span>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;