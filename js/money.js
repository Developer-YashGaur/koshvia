// Integer minor-unit money. No floats. Half-even rounding (spec R1-R3).
const DEC = { INR: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, KWD: 3 };
export const decimals = (c) => { if (!(c in DEC)) throw new Error('unknown currency ' + c); return DEC[c]; };
export function parse(str, cur) {
  const d = decimals(cur); const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!m) throw new Error('bad amount'); const frac = (m[3] ?? '');
  if (frac.length > d) throw new Error('too many decimals');
  const v = BigInt(m[2] + frac.padEnd(d, '0')); return m[1] ? -v : v;
}
export function format(minor, cur) {
  const d = decimals(cur), neg = minor < 0n, s = (neg ? -minor : minor).toString().padStart(d + 1, '0');
  return (neg ? '-' : '') + (d ? s.slice(0, -d) + '.' + s.slice(-d) : s);
}
// rate as decimal string with up to 8 dp; converts minor units of `from` to minor units of `to`, half-even.
export function convert(minor, from, to, rate) {
  const [i, f = ''] = rate.split('.'); const rScale = 8n;
  const r = BigInt(i + f.padEnd(8, '0').slice(0, 8));
  const num = minor * r * 10n ** BigInt(decimals(to)); const den = 10n ** rScale * 10n ** BigInt(decimals(from));
  return divHalfEven(num, den);
}
export function divHalfEven(n, d) {
  const neg = (n < 0n) !== (d < 0n); n = n < 0n ? -n : n; d = d < 0n ? -d : d;
  let q = n / d; const r2 = (n % d) * 2n;
  if (r2 > d || (r2 === d && q % 2n === 1n)) q += 1n; return neg ? -q : q;
}
// deterministic allocation: remainder to earliest parts
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0n); const out = weights.map((w) => (total * w) / sum);
  let rem = total - out.reduce((a, b) => a + b, 0n); for (let i = 0; rem > 0n; i = (i + 1) % out.length, rem--) out[i] += 1n; return out;
}
