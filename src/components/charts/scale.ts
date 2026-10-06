/** Round an axis maximum up to a clean value and return evenly spaced ticks from zero. */
export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((n) => n * magnitude >= rough) ?? 10) * magnitude;
  const ticks = [];
  for (let value = 0; value < max + step / 2; value += step) ticks.push(value);
  if ((ticks.at(-1) ?? 0) < max) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}
