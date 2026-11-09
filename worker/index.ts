import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { errorBody } from '../lib/errors';
import { deleteGame, listGames, saveGame } from './archive-api';
import { assetLinks } from './asset-links';
import { googleCallback, logout, me, removeAccount, startGoogle } from './auth';
import { clientError } from './client-error';
import { database } from './db';
import { GET, POST, SOCKET } from './game-api';
import { visit } from './visit';

// Static pages are served by the assets binding; only /api/* and the Android app's
// assetlinks.json reach this Worker.
const app = new Hono();

app.use('/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
});
app.get('/api/game', (c) => GET(c.req.raw));
app.get('/api/game/ws', (c) => SOCKET(c.req.raw));
app.post('/api/game', (c) => POST(c.req.raw));
app.get('/api/me', (c) => me(c.req.raw));
app.delete('/api/me', (c) => removeAccount(c.req.raw));
app.get('/api/auth/google', (c) => startGoogle(c.req.raw));
app.get('/api/auth/google/callback', (c) => googleCallback(c.req.raw));
app.post('/api/auth/logout', (c) => logout(c.req.raw));
app.get('/api/games', (c) => listGames(c.req.raw, database()));
app.post('/api/games', (c) => saveGame(c.req.raw, database()));
app.delete('/api/games', (c) => deleteGame(c.req.raw, database()));
app.post('/api/client-error', (c) => clientError(c.req.raw));
app.post('/api/visit', (c) => visit(c.req.raw));
app.all('/api/*', (c) => c.json(errorBody('no-such-endpoint'), 404));
app.get('/.well-known/assetlinks.json', (c) =>
  assetLinks(c.req.raw, env.ASSETS),
);
app.onError((error, c) => {
  console.error(
    'Unhandled error',
    error instanceof Error ? error.message : 'unknown',
  );
  return c.json(errorBody('unavailable'), 503);
});

export default app;
export { GameRoom, PlayerSeats } from './room-object';
