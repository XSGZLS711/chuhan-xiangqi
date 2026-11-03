import { accepted, clip, perMinute, readLimited, refuse } from './client-error';
import { sameOrigin } from './identity';

// One page load, counted without a cookie: which page, the site the visitor came from, the
// languages, a touch screen or not, and the country Cloudflare saw. Logged to Workers Logs
// (console.log) and nowhere else, so nobody can be told apart from anybody else.

const VISIT_MAX_BYTES = 512;
/** Page loads one Worker instance logs per minute, far above what the site sees. */
export const VISITS_PER_MINUTE = 300;
const PAGES = ['home', 'room', 'ai', 'review'] as const;
// Crawlers that run scripts and headless browsers are not visitors.
const ROBOT = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

const budget = perMinute(VISITS_PER_MINUTE);

export async function visit(
  req: Request,
  allow: (now?: number) => boolean = budget,
) {
  const refused = sameOrigin(req);
  if (refused) return refused;
  const raw = await readLimited(req, VISIT_MAX_BYTES);
  if (raw === null) return refuse('request-too-large', 413);
  let body: Record<string, unknown> = {};
  try {
    body = Object(JSON.parse(raw)) as Record<string, unknown>;
  } catch {}
  const page = PAGES.find((p) => p === body.page);
  if (!page) return refuse('bad-request', 400);
  if (ROBOT.test(req.headers.get('user-agent') ?? '')) return accepted();
  if (!allow()) return refuse('chat-too-fast', 429);
  console.log({
    message: 'visit',
    page,
    // A hostname such as "discord.com", "" when typed or bookmarked, "self" inside the site.
    from: clip(body.from, 100) ?? '',
    lang: clip(body.lang, 35),
    ui: clip(body.ui, 35),
    touch: body.touch === true,
    country: req.cf?.country ?? '',
  });
  return accepted();
}
