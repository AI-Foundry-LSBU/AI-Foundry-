// PostgreSQL numeric values stay decimal strings. All arithmetic uses BigInt
// ten-thousandths so totals do not accumulate binary floating-point rounding.
export function scaled(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(text)) throw new TypeError('Invalid saved decimal value.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const amount = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  return negative ? -amount : amount;
}

export function decimal(value) {
  if (value === null || value === undefined) return null;
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 10000n}.${String(absolute % 10000n).padStart(4, '0')}`;
}
