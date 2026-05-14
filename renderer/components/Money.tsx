export function money(value: number, currencySymbol = "৳") {
  const formatted = new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2
  }).format(value);

  return currencySymbol === "৳" ? formatted : `${currencySymbol}${value.toFixed(2)}`;
}
