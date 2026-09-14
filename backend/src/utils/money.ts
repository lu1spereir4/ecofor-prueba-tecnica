// Toda operación monetaria se efectúa en centavos enteros, sin Number/float.
export function cents(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Monto decimal inválido: ${value}`);
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function money(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

// Acepta notación científica de números JSON finitos sin redondear operaciones.
export function decimalRatio(value: number | string): { numerator: bigint; denominator: bigint } {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match) throw new Error('Valor decimal inválido');
  const fraction = match[2] ?? '';
  const exponent = Number(match[3] ?? 0) - fraction.length;
  const coefficient = BigInt(match[1]! + fraction);
  return exponent >= 0
    ? { numerator: coefficient * 10n ** BigInt(exponent), denominator: 1n }
    : { numerator: coefficient, denominator: 10n ** BigInt(-exponent) };
}

export function decimalMoneyInput(value: number | string): bigint {
  const { numerator, denominator } = decimalRatio(value);
  if ((numerator * 100n) % denominator !== 0n)
    throw new Error('El monto admite hasta dos decimales');
  return (numerator * 100n) / denominator;
}
