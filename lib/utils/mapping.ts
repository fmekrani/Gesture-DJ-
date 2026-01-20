export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number) {
  if (a === b) return 0;
  return (v - a) / (b - a);
}
