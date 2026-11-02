/** Shared by board animation and sound scheduling; all times are milliseconds. */
const slideMs = 240;
const durationMs = slideMs + 170;
export const PIECE_MOTION = {
  slideMs,
  durationMs,
  landMs: Math.round(durationMs * 0.84),
};

export function pieceMotion(_capture = false) {
  return PIECE_MOTION;
}
