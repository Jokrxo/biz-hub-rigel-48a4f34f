import { supabase } from "@/lib/supabase";

export type PeriodData = { period_start: string; period_end: string; gross: number; taxableAllowances?: number; fringeBenefits?: number };

export const getCompanyTaxSettings = async (company_id: string) => {
  const { data } = await supabase.from("payroll_settings" as any).select("tax_config").eq("company_id", company_id).maybeSingle();
  const cfg = (data?.tax_config as any) || null;
  return cfg || { brackets: [{ up_to: 237100, rate: 0.18, base: 0 }, { up_to: 370500, rate: 0.26, base: 42678 }, { up_to: 512800, rate: 0.31, base: 77362 }, { up_to: 673000, rate: 0.36, base: 121475 }, { up_to: 857900, rate: 0.39, base: 179147 }, { up_to: 1145900, rate: 0.41, base: 251258 }, { up_to: null, rate: 0.45, base: 388638 }], rebates: { primary: 17235 }, uif_cap: 17712, sdl_rate: 0.01 };
};

export const annualize = (gross: number, periodDays: number) => {
  const daysInYear = 365;
  return +(gross * (daysInYear / Math.max(1, periodDays))).toFixed(2);
};

export const deannualize = (annualTax: number, periodDays: number) => {
  const daysInYear = 365;
  return +(annualTax * (Math.max(1, periodDays) / daysInYear)).toFixed(2);
};

export const calculatePAYE = async (company_id: string, employee: { tax_number?: string | null }, period: PeriodData) => {
  const cfg = await getCompanyTaxSettings(company_id);
  const periodDays = Math.max(1, (new Date(period.period_end).getTime() - new Date(period.period_start).getTime()) / (1000 * 60 * 60 * 24) + 1);
  const taxable = Number(period.gross || 0) + Number(period.taxableAllowances || 0) + Number(period.fringeBenefits || 0);
  const annualTaxable = annualize(taxable, periodDays);
  let annualTax = 0;
  let lastCap = 0;
  for (const b of cfg.brackets) {
    const cap = b.up_to ?? Infinity;
    if (annualTaxable > cap) { lastCap = cap; continue; }
    const excess = Math.max(0, annualTaxable - lastCap);
    annualTax = +(b.base + excess * b.rate).toFixed(2);
    break;
  }
  const rebate = Number(cfg.rebates?.primary || 0);
  const annualAfterRebate = Math.max(0, annualTax - rebate);
  const paye = deannualize(annualAfterRebate, periodDays);
  const uifBase = Math.min(Number(period.gross || 0), Number(cfg.uif_cap || 17712));
  const uif_emp = +(uifBase * 0.01).toFixed(2);
  const uif_er = +(uifBase * 0.01).toFixed(2);
  const sdl_er = +((Number(period.gross || 0)) * Number(cfg.sdl_rate || 0.01)).toFixed(2);
  return { paye, uif_emp, uif_er, sdl_er };
};