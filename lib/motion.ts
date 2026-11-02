/** Shared by board animation and sound scheduling; all times are milliseconds.
 * Measured on a 60 fps recording of live play: a lifted piece glides over in
 * about 110 ms, hangs briefly, and is set down within three frames.
 */
export const PIECE_MOTION = {
  slideMs: 110,
  moveHoverMs: 160,
  captureHoverMs: 230,
  dropMs: 40,
  selectionMs: 90,
};

export function pieceMotion(capture = false) {
  const hoverMs = capture
    ? PIECE_MOTION.captureHoverMs
    : PIECE_MOTION.moveHoverMs;
  const landMs = hoverMs + PIECE_MOTION.dropMs;
  return { ...PIECE_MOTION, hoverMs, landMs, durationMs: landMs };
}
