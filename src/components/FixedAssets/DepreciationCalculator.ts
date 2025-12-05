/**
 * Calculates depreciation for fixed assets using straight-line method
 */

export interface DepreciationResult {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  monthsDepreciated: number;
}

export const calculateDepreciation = (
  cost: number,
  purchaseDate: string,
  usefulLifeYears: number,
  currentDate: Date = new Date()
): DepreciationResult => {
  const purchase = new Date(purchaseDate);
  if (currentDate.getTime() < purchase.getTime()) {
    const annualDepreciationPre = cost / usefulLifeYears;
    return {
      annualDepreciation: annualDepreciationPre,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      monthsDepreciated: 0,
    };
  }
  const monthsDiff = Math.floor(
    (currentDate.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  );
  
  const monthsDepreciated = Math.max(0, monthsDiff);
  const annualDepreciation = cost / usefulLifeYears;
  const monthlyDepreciation = annualDepreciation / 12;
  
  const accumulatedDepreciation = Math.min(
    monthlyDepreciation * monthsDepreciated,
    cost
  );
  
  const netBookValue = cost - accumulatedDepreciation;
  
  return {
    annualDepreciation,
    accumulatedDepreciation,
    netBookValue,
    monthsDepreciated,
  };
};

export const updateAssetDepreciation = async (
  supabase: any,
  assetId: string,
  accumulatedDepreciation: number
) => {
  const { error } = await supabase
    .from("fixed_assets")
    .update({ accumulated_depreciation: accumulatedDepreciation })
    .eq("id", assetId);
  
  if (error) throw error;
};
