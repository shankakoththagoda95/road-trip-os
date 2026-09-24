// Accepts "6,5" as well as "6.5". Returns null for empty / invalid input.
export function parseNumber(text: string) {
  const value = Number.parseFloat(text.replace(',', '.'));

  return Number.isFinite(value) ? value : null;
}

// e.g. "€1,234" / "SEK 1,234": whole units, locale formatting.
export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}
