export function isSameMtime(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.5;
}
