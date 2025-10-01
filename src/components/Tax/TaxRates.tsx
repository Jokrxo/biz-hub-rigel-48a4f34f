import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Percent } from "lucide-react";

export const TaxRates = () => {
  const rates = [
    { name: "Standard VAT Rate", rate: "15%", description: "Applied to most goods and services" },
    { name: "Zero-Rated VAT", rate: "0%", description: "Applied to exports and basic food items" },
    { name: "Income Tax (Corporate)", rate: "27%", description: "Standard corporate tax rate" },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" />
          Tax Rates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rates.map((rate) => (
            <div key={rate.name} className="flex items-center justify-between p-4 border rounded">
              <div>
                <p className="font-medium">{rate.name}</p>
                <p className="text-sm text-muted-foreground">{rate.description}</p>
              </div>
              <span className="text-2xl font-bold text-primary">{rate.rate}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
