import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrialBalance } from '@/types/trial-balance';

const schema = z.object({
  account_code: z.string().min(1, 'Account code is required'),
  account_name: z.string().min(1, 'Account name is required'),
  debit: z.number().min(0, 'Debit must be positive').default(0),
  credit: z.number().min(0, 'Credit must be positive').default(0),
}).refine((data) => data.debit > 0 || data.credit > 0, {
  message: 'Either debit or credit must be greater than 0',
  path: ['debit'],
});

type FormData = z.infer<typeof schema>;

interface TrialBalanceFormProps {
  entry?: TrialBalance;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export const TrialBalanceForm: React.FC<TrialBalanceFormProps> = ({
  entry,
  onSubmit,
  onCancel,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_code: entry?.account_code || '',
      account_name: entry?.account_name || '',
      debit: entry?.debit || 0,
      credit: entry?.credit || 0,
    },
  });

  const debitValue = watch('debit');
  const creditValue = watch('credit');

  // Auto-clear opposite field when entering value
  const handleDebitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setValue('debit', value);
    if (value > 0) {
      setValue('credit', 0);
    }
  };

  const handleCreditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setValue('credit', value);
    if (value > 0) {
      setValue('debit', 0);
    }
  };

  return (
    <Card className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{entry ? 'Edit Entry' : 'Add New Entry'}</CardTitle>
          <CardDescription>
            {entry ? 'Update trial balance entry' : 'Create a new trial balance entry'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="account_code">Account Code</Label>
              <Input
                id="account_code"
                {...register('account_code')}
                placeholder="e.g., 1000"
              />
              {errors.account_code && (
                <p className="text-sm text-destructive mt-1">
                  {errors.account_code.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                {...register('account_name')}
                placeholder="e.g., Cash at Bank"
              />
              {errors.account_name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.account_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="debit">Debit Amount</Label>
                <Input
                  id="debit"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('debit', { valueAsNumber: true })}
                  onChange={handleDebitChange}
                  value={debitValue}
                />
              </div>

              <div>
                <Label htmlFor="credit">Credit Amount</Label>
                <Input
                  id="credit"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('credit', { valueAsNumber: true })}
                  onChange={handleCreditChange}
                  value={creditValue}
                />
              </div>
            </div>

            {errors.debit && (
              <p className="text-sm text-destructive">
                {errors.debit.message}
              </p>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {entry ? 'Update' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </div>
    </Card>
  );
};