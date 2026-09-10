export type GameViewport = {
  width: number;
  height: number;
  top: number;
  locked: boolean;
};

/** Keep the board's layout while an editor and its keyboard cover the page. */
export function nextGameViewport(
  previous: GameViewport | undefined,
  visible: { width: number; height: number; top: number },
  editing: boolean,
): GameViewport {
  const sameWidth = previous && Math.abs(previous.width - visible.width) < 1;
  // Retain the layout during the keyboard's closing animation after blur.
  const stillClosing =
    previous?.locked && visible.height < previous.height - 80;
  const locked = !!sameWidth && (editing || !!stillClosing);
  return {
    width: visible.width,
    height: locked ? previous.height : visible.height,
    top: locked ? previous.top : visible.top,
    locked,
  };
}
