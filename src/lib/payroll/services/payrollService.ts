import { supabase } from "@/lib/supabase";
import { calculatePAYE } from "../services/taxService";

export type ProcessInput = { company_id: string; employee_id: string; period_start: string; period_end: string; pay_run_id?: string | null };

export const processPayroll = async (input: ProcessInput) => {
  const { data: line } = await supabase.from("pay_run_lines" as any).select("id, details").eq("pay_run_id", input.pay_run_id).eq("employee_id", input.employee_id).maybeSingle();
  const det = (line?.details as any) || {};
  const earnings = Array.isArray(det.earnings) ? det.earnings : [];
  const deductions = Array.isArray(det.deductions) ? det.deductions : [];
  const employer = Array.isArray(det.employer) ? det.employer : [];
  const gross = +(earnings.reduce((s: number, e: any) => s + Number(e.amount || 0), 0).toFixed(2));
  const taxableAllowances = +(earnings.filter((e: any) => ["travel_allowance","subsistence_allowance","cellphone_allowance"].includes(String(e.type))).reduce((s: number, e: any) => s + Number(e.amount || 0) * (String(e.type) === "travel_allowance" ? 0.8 : 1), 0).toFixed(2));
  const fringeBenefits = +(earnings.filter((e: any) => ["company_car","low_interest_loan","medical_fringe"].includes(String(e.type))).reduce((s: number, e: any) => s + Number(e.amount || 0), 0).toFixed(2));
  const { data: emp } = await supabase.from("employees" as any).select("id, tax_number").eq("id", input.employee_id).maybeSingle();
  const tax = await calculatePAYE(input.company_id, { tax_number: emp?.tax_number }, { period_start: input.period_start, period_end: input.period_end, gross, taxableAllowances, fringeBenefits });
  const totalDeductions = +(deductions.reduce((s: number, d: any) => s + Number(d.amount || 0), 0).toFixed(2));
  const net = +(gross - tax.paye - tax.uif_emp - totalDeductions).toFixed(2);
  const employer_contrib = +(employer.reduce((s: number, e: any) => s + Number(e.amount || 0), 0).toFixed(2));
  const payload = { gross, net, paye: tax.paye, uif_emp: tax.uif_emp, uif_er: tax.uif_er, sdl_er: tax.sdl_er, employer_contrib, details: det } as any;
  if (line?.id) {
    const upd = await supabase.from("pay_run_lines" as any).update(payload as any).eq("id", line.id);
    if (upd.error) throw upd.error;
  } else if (input.pay_run_id) {
    const ins = await supabase.from("pay_run_lines" as any).insert({ pay_run_id: input.pay_run_id, employee_id: input.employee_id, ...payload } as any);
    if (ins.error) throw ins.error;
  }
  return payload;
};