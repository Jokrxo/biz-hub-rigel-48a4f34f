import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const PurchaseTransactions = () => {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Array<{ id: string; date: string; description: string; reference: string; amount: number; status: string }>>([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(7);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRows([]); return; }
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const companyId = (profile as any)?.company_id;
        if (!companyId) { setRows([]); return; }

        const { data: txs } = await supabase
          .from("transactions")
          .select(`id, description, transaction_date, reference_number, total_amount, status,
            entries:transaction_entries(id, debit, credit, chart_of_accounts(account_type, account_name))
          `)
          .eq("company_id", companyId)
          .order("transaction_date", { ascending: false });

        const mapped = (txs || []).filter((t: any) => {
          const hasExpense = (t.entries || []).some((e: any) => String(e.chart_of_accounts?.account_type || "").toLowerCase().includes("expense"));
          return hasExpense;
        }).map((t: any) => ({
          id: t.id,
          date: new Date(t.transaction_date).toLocaleDateString('en-ZA'),
          description: t.description || "",
          reference: t.reference_number || "",
          amount: Math.abs(Number(t.total_amount || 0)),
          status: String(t.status || "").toLowerCase()
        }));
        setRows(mapped);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = rows.filter(r => (
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.reference.toLowerCase().includes(search.toLowerCase())
  ));
  const totalCount = filtered.length;
  const start = page * pageSize;
  const pagedRows = filtered.slice(start, start + pageSize);
  useEffect(() => { setPage(0); }, [search]);

  return (
    <Card className="card-professional">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Purchase Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description or reference" className="pl-10" />
          </div>
          <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5}>No purchase transactions found</TableCell></TableRow>
              ) : pagedRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="font-medium">{r.description}</TableCell>
                  <TableCell>{r.reference || "–"}</TableCell>
                  <TableCell className="text-right">R {r.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      r.status === 'approved' ? 'bg-primary/10 text-primary' :
                      r.status === 'pending' ? 'bg-accent/10 text-accent' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {r.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-muted-foreground">
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Showing {pagedRows.length} of {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
              <Button variant="outline" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
