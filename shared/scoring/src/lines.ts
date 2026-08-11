/// The eight scoring lines of a 3x3 grid as cell bitmasks. Rows come first,
/// followed by columns and the two diagonals. Keep this order stable because
/// the UI uses the indexes to animate each completed line.
export const LINE_MASKS = [0x007, 0x038, 0x1c0, 0x049, 0x092, 0x124, 0x111, 0x054] as const;
export const HORIZONTAL_LINE_MASKS = LINE_MASKS.slice(0, 3);
export const DIAGONAL_LINE_MASKS = LINE_MASKS.slice(6, 8);

export function completedLineIndexes(mask: number): number[] {
  return LINE_MASKS.flatMap((lineMask, index) => ((mask & lineMask) === lineMask ? [index] : []));
}

export function completedLinesForMask(mask: number): number {
  return completedLineIndexes(mask).length;
}

/// The progressive jackpot requires five or more correct cells that complete
/// at least one horizontal row and at least one diagonal in the same grid.
export function qualifiesForJackpot(mask: number): boolean {
  const horizontal = HORIZONTAL_LINE_MASKS.some((lineMask) => (mask & lineMask) === lineMask);
  const diagonal = DIAGONAL_LINE_MASKS.some((lineMask) => (mask & lineMask) === lineMask);
  return horizontal && diagonal;
}
