export function ema(prev: number, next: number, alpha = 0.15) {
  return prev * (1 - alpha) + next * alpha;
}
