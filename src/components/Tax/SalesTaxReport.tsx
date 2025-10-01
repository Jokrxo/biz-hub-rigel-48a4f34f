import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";

export const SalesTaxReport = () => {
  const taxData = [
    { period: "January 2024", sales: 2847390.5, taxCollected: 371360.77, taxRate: "15%" },
    { period: "December 2023", sales: 2654280.0, taxCollected: 345556.4, taxRate: "15%" },
    { period: "November 2023", sales: 2789450.5, taxCollected: 363628.57, taxRate: "15%" },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Sales Tax Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Total Sales (excl. VAT)</TableHead>
              <TableHead className="text-right">VAT Collected</TableHead>
              <TableHead className="text-right">Tax Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxData.map((row) => (
              <TableRow key={row.period}>
                <TableCell className="font-medium">{row.period}</TableCell>
                <TableCell className="text-right">R {row.sales.toLocaleString()}</TableCell>
                <TableCell className="text-right font-semibold text-primary">R {row.taxCollected.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.taxRate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
