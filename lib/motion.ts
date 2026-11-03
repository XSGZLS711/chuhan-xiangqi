/** Shared by board animation and sound scheduling; all times are milliseconds.
 * A lifted piece glides over in about 110 ms (measured at 60 fps). It starts to
 * tip its leading edge down halfway through the glide, so the set-down is long
 * enough to see, and lies flat at the landing, when the knock sounds. Captures
 * hang a little longer first.
 */
export const PIECE_MOTION = {
  slideMs: 110,
  moveHoverMs: 60,
  captureHoverMs: 130,
  dropMs: 140,
  /** After landing it rocks and settles; sound and overlays ignore this part. */
  settleMs: 320,
  selectionMs: 90,
};

export function pieceMotion(capture = false) {
  const hoverMs = capture
    ? PIECE_MOTION.captureHoverMs
    : PIECE_MOTION.moveHoverMs;
  const landMs = hoverMs + PIECE_MOTION.dropMs;
  return {
    ...PIECE_MOTION,
    hoverMs,
    landMs,
    durationMs: landMs + PIECE_MOTION.settleMs,
  };
}
