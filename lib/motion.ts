/** Shared by board animation and sound scheduling; all times are milliseconds. */
export const PIECE_MOTION = {
  slideMs: 140,
  moveHoverMs: 240,
  captureHoverMs: 300,
  dropMs: 60,
  selectionMs: 100,
};

export function pieceMotion(capture = false) {
  const hoverMs = capture
    ? PIECE_MOTION.captureHoverMs
    : PIECE_MOTION.moveHoverMs;
  const landMs = hoverMs + PIECE_MOTION.dropMs;
  return { ...PIECE_MOTION, hoverMs, landMs, durationMs: landMs };
}
