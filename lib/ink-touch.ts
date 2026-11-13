/** A drop of ink where a button is pressed: a small ring that spreads and fades at the
 * point of contact, on every button and link except the board's points (the board answers
 * with its own lift and markers). One listener for the page; nothing for reduced motion.
 */
const TARGETS = 'button, a[href], summary, [role="tab"]';

export function installInkTouch(root: Document = document) {
  if (typeof window === 'undefined') return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const press = (event: PointerEvent) => {
    if (reduced.matches || event.button > 0) return;
    const target = (event.target as Element | null)?.closest(TARGETS);
    if (
      !target ||
      target.closest('.chess-board') ||
      target.matches(':disabled')
    )
      return;
    const drop = root.createElement('span');
    drop.className = 'ink-touch';
    drop.style.left = `${event.clientX}px`;
    drop.style.top = `${event.clientY}px`;
    // Inside a modal the drop must join it in the top layer to be seen.
    const host: HTMLElement =
      target.closest<HTMLElement>('dialog[open]') ?? root.body;
    host.appendChild(drop);
    drop.addEventListener('animationend', () => drop.remove(), { once: true });
    setTimeout(() => drop.remove(), 1000);
  };
  root.addEventListener('pointerdown', press, { passive: true });
  return () => root.removeEventListener('pointerdown', press);
}
