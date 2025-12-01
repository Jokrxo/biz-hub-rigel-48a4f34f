import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const TaxComputation = () => {
  const [profitBeforeTax, setProfitBeforeTax] = useState<string>("");
  const [nonDeductibleExpenses, setNonDeductibleExpenses] = useState<string>("");
  const [nonTaxableIncome, setNonTaxableIncome] = useState<string>("");
  const [tempIncrease, setTempIncrease] = useState<string>("");
  const [tempDecrease, setTempDecrease] = useState<string>("");
  const [corporateRate, setCorporateRate] = useState<string>("27");

  const parse = (v: string) => {
    const n = Number(v || 0);
    return isNaN(n) ? 0 : n;
  };

  const totals = useMemo(() => {
    const pbt = parse(profitBeforeTax);
    const nde = parse(nonDeductibleExpenses);
    const nti = parse(nonTaxableIncome);
    const tInc = parse(tempIncrease);
    const tDec = parse(tempDecrease);
    const rate = parse(corporateRate);
    const netPermanent = nde - nti;
    const netTemporary = tInc - tDec;
    const adjustedTaxableIncome = pbt + netPermanent + netTemporary;
    const taxableIncome = Math.max(0, adjustedTaxableIncome);
    const currentTax = Math.round(((taxableIncome * rate) / 100) * 100) / 100;
    const deferredTax = Math.round(((netTemporary * rate) / 100) * 100) / 100;
    const totalTaxCharge = Math.round(((currentTax + deferredTax) + Number.EPSILON) * 100) / 100;
    return { pbt, nde, nti, tInc, tDec, rate, netPermanent, netTemporary, adjustedTaxableIncome, taxableIncome, currentTax, deferredTax, totalTaxCharge };
  }, [profitBeforeTax, nonDeductibleExpenses, nonTaxableIncome, tempIncrease, tempDecrease, corporateRate]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Tax Computation (SARS Structured)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Profit Before Tax</Label>
              <Input type="number" step="0.01" value={profitBeforeTax} onChange={(e) => setProfitBeforeTax(e.target.value)} />
            </div>
            <Separator className="my-2" />
            <div className="space-y-2">
              <Label>Permanent Differences — Non-deductible expenses (add)</Label>
              <Input type="number" step="0.01" value={nonDeductibleExpenses} onChange={(e) => setNonDeductibleExpenses(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Permanent Differences — Non-taxable income (deduct)</Label>
              <Input type="number" step="0.01" value={nonTaxableIncome} onChange={(e) => setNonTaxableIncome(e.target.value)} />
            </div>
            <Separator className="my-2" />
            <div className="space-y-2">
              <Label>Temporary Differences — Increases (add)</Label>
              <Input type="number" step="0.01" value={tempIncrease} onChange={(e) => setTempIncrease(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Temporary Differences — Decreases (deduct)</Label>
              <Input type="number" step="0.01" value={tempDecrease} onChange={(e) => setTempDecrease(e.target.value)} />
            </div>
            
          </div>

          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Profit Before Tax</TableCell>
                  <TableCell className="font-medium">{totals.pbt.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="pt-4 text-sm text-muted-foreground">Permanent Differences</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Add: Non-deductible expenses</TableCell>
                  <TableCell>{totals.nde.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Less: Non-taxable income</TableCell>
                  <TableCell>{totals.nti.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Net permanent differences</TableCell>
                  <TableCell>{totals.netPermanent.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="pt-4 text-sm text-muted-foreground">Temporary Differences</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Add: Timing differences increasing taxable income</TableCell>
                  <TableCell>{totals.tInc.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Less: Timing differences decreasing taxable income</TableCell>
                  <TableCell>{totals.tDec.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Net temporary differences</TableCell>
                  <TableCell>{totals.netTemporary.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Subtotal → Adjusted Taxable Income</TableCell>
                  <TableCell className="font-medium">{totals.adjustedTaxableIncome.toFixed(2)}</TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell className="font-medium">Taxable Income</TableCell>
                  <TableCell className="font-medium">{totals.taxableIncome.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Current Tax @ {totals.rate.toFixed(2)}%</TableCell>
                  <TableCell>{totals.currentTax.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Deferred Tax @ {totals.rate.toFixed(2)}% of temporary differences</TableCell>
                  <TableCell>{totals.deferredTax.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Total Tax Charge</TableCell>
                  <TableCell className="font-semibold">{totals.totalTaxCharge.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Corporate tax rate (%)</Label>
                <Input type="number" step="0.1" value={corporateRate} onChange={(e) => setCorporateRate(e.target.value)} />
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Tax Charge</div>
                <div className="text-2xl font-bold">{totals.totalTaxCharge.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
