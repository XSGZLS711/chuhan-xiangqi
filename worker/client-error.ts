import { errorBody, type ErrorCode } from '../lib/errors';
import { sameOrigin } from './identity';

// What a page reports when something breaks in a player's browser. It goes to Workers Logs
// through console.error and nowhere else: no D1, no cookie read, no account looked up. A
// report holds the message, its stack, the page path, the user agent and the language.

/** A report is a few kilobytes at most; anything longer is refused unread. */
export const REPORT_MAX_BYTES = 8 * 1024;
/** Reports one Worker instance logs per minute. A page in an error loop stops at its own
 * cap first (lib/telemetry.ts); this one bounds what a script can make us log. */
export const REPORTS_PER_MINUTE = 30;
const KINDS = ['error', 'rejection', 'engine'] as const;
export type ReportKind = (typeof KINDS)[number];

/** True while this minute's budget lasts. One counter per Worker instance, in memory. */
export function perMinute(limit: number) {
  let start = -Infinity;
  let count = 0;
  return (now = Date.now()) => {
    if (now - start >= 60000) {
      start = now;
      count = 0;
    }
    return ++count <= limit;
  };
}

/** The body as text, or null once it passes `max` bytes: a body that says it is too long,
 * or turns out to be, is not read further. */
export async function readLimited(
  req: Request,
  max: number,
): Promise<string | null> {
  if (Number(req.headers.get('content-length')) > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** A string field cut to `max` characters, or undefined when it is not a string. */
export const clip = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

const noStore = { 'Cache-Control': 'no-store, private' };
export const refuse = (code: ErrorCode, status: number) =>
  Response.json(errorBody(code), { status, headers: noStore });
export const accepted = () =>
  new Response(null, { status: 204, headers: noStore });

const budget = perMinute(REPORTS_PER_MINUTE);

export async function clientError(
  req: Request,
  allow: (now?: number) => boolean = budget,
) {
  const refused = sameOrigin(req);
  if (refused) return refused;
  const raw = await readLimited(req, REPORT_MAX_BYTES);
  if (raw === null) return refuse('request-too-large', 413);
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>;
  } catch {}
  const message = clip(body?.message, 500);
  if (!body || !message) return refuse('bad-request', 400);
  // The words fit any sender that is going too fast, not only chat.
  if (!allow()) return refuse('chat-too-fast', 429);
  const kind = KINDS.find((k) => k === body.kind) ?? 'error';
  console.error({
    message: 'client-error',
    kind,
    error: message,
    code: clip(body.code, 60),
    stack: clip(body.stack, 4000),
    page: clip(body.page, 200),
    ua: clip(req.headers.get('user-agent'), 300),
    lang: clip(body.lang, 35),
    ui: clip(body.ui, 35),
  });
  return accepted();
}
