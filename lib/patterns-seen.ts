import type { PatternId } from './patterns';

/** Which named openings this device has already been shown at length. The first sighting of
 * each is a lesson (its name held, with a line on what it is); after that it is only named in
 * passing. Kept in localStorage like the language; a browser that cannot store it treats every
 * opening as seen, so it is never shown at length over and over.
 */
const KEY = 'chuhan-patterns-seen';

function read(): PatternId[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? (value as PatternId[]) : [];
  } catch {
    return null;
  }
}
export function firstSighting(id: PatternId): boolean {
  const seen = read();
  return seen !== null && !seen.includes(id);
}
export function markSeen(id: PatternId) {
  const seen = read();
  if (!seen || seen.includes(id)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen, id]));
  } catch {}
}
