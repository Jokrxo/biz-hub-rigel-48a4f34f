import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Lock, AlertCircle, Check, Building2, Globe, DollarSign } from 'lucide-react';
import type { SubscriptionPlan } from '@/utils/subscriptionPlans';

interface PaymentFormProps {
  plan: SubscriptionPlan;
  billingCycle: 'monthly' | 'annual';
  onSuccess: () => void;
  onBack: () => void;
}

export function PaymentForm({ plan, billingCycle, onSuccess, onBack }: PaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (paymentMethod === 'card') {
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
        newErrors.cardNumber = 'Please enter a valid card number';
      }
      if (!expiryDate || expiryDate.length !== 5) {
        newErrors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
      }
      if (!cvv || cvv.length < 3) {
        newErrors.cvv = 'Please enter a valid CVV';
      }
      if (!cardholderName) {
        newErrors.cardholderName = 'Please enter the cardholder name';
      }
    }

    if (!email || !email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate payment processing
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 2000);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    setExpiryDate(formatted);
  };

  const getCardType = () => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (cleanNumber.startsWith('4')) return 'Visa';
    if (cleanNumber.startsWith('5')) return 'Mastercard';
    if (cleanNumber.startsWith('3')) return 'American Express';
    return 'Card';
  };

  const getCardIcon = () => {
    const cardType = getCardType();
    switch (cardType) {
      case 'Visa': return '💳';
      case 'Mastercard': return '💳';
      case 'American Express': return '💳';
      default: return '💳';
    }
  };

  const totalPrice = billingCycle === 'annual' ? (plan?.price || 0) * 12 * 0.85 : (plan?.price || 0);

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No plan selected</h2>
          <Button onClick={onBack}>Back to Plans</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          ← Back to Plans
        </Button>
        
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{plan?.name || 'Selected'} Plan</h3>
              <p className="text-sm text-muted-foreground">
                {billingCycle === 'annual' ? 'Billed annually (15% savings)' : 'Billed monthly'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">${totalPrice}</div>
              <div className="text-sm text-muted-foreground">/{billingCycle}</div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
          <CardDescription>
            Secure payment powered by Stripe. Your payment information is encrypted and never stored on our servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Method Selection */}
            <div className="space-y-4">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="h-16"
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  Credit Card
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'paypal' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('paypal')}
                  className="h-16"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  PayPal
                </Button>
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Credit Card Form */}
            {paymentMethod === 'card' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardholderName">Cardholder Name</Label>
                  <Input
                    id="cardholderName"
                    placeholder="John Doe"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className={errors.cardholderName ? 'border-red-500' : ''}
                  />
                  {errors.cardholderName && (
                    <p className="text-sm text-red-500">{errors.cardholderName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      maxLength={19}
                      className={errors.cardNumber ? 'border-red-500' : ''}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {cardNumber && (
                        <span className="text-sm text-muted-foreground">
                          {getCardIcon()} {getCardType()}
                        </span>
                      )}
                    </div>
                  </div>
                  {errors.cardNumber && (
                    <p className="text-sm text-red-500">{errors.cardNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      placeholder="MM/YY"
                      value={expiryDate}
                      onChange={handleExpiryDateChange}
                      maxLength={5}
                      className={errors.expiryDate ? 'border-red-500' : ''}
                    />
                    {errors.expiryDate && (
                      <p className="text-sm text-red-500">{errors.expiryDate}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      maxLength={4}
                      className={errors.cvv ? 'border-red-500' : ''}
                    />
                    {errors.cvv && (
                      <p className="text-sm text-red-500">{errors.cvv}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PayPal Instructions */}
            {paymentMethod === 'paypal' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You will be redirected to PayPal to complete your payment securely. After payment, you'll be returned to complete your subscription setup.
                </AlertDescription>
              </Alert>
            )}

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Your payment information is encrypted and secure. We never store your card details.</span>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  {paymentMethod === 'card' ? <CreditCard className="h-4 w-4 mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
                  Start {plan?.name || 'Selected'} Plan - ${totalPrice}
                </>
              )}
            </Button>

            {/* Terms */}
            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy. 
              You can cancel anytime from your account settings.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentForm;