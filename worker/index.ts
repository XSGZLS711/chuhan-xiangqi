import { Hono } from 'hono';
import { deleteGame, listGames, saveGame } from './archive-api';
import { googleCallback, logout, me, removeAccount, startGoogle } from './auth';
import { database } from './db';
import { GET, POST } from './game-api';

// Static pages are served by the assets binding; only /api/* reaches this Worker.
const app = new Hono();

app.use('/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
});
app.get('/api/game', (c) => GET(c.req.raw));
app.post('/api/game', (c) => POST(c.req.raw));
app.get('/api/me', (c) => me(c.req.raw));
app.delete('/api/me', (c) => removeAccount(c.req.raw));
app.get('/api/auth/google', (c) => startGoogle(c.req.raw));
app.get('/api/auth/google/callback', (c) => googleCallback(c.req.raw));
app.post('/api/auth/logout', (c) => logout(c.req.raw));
app.get('/api/games', (c) => listGames(c.req.raw, database()));
app.post('/api/games', (c) => saveGame(c.req.raw, database()));
app.delete('/api/games', (c) => deleteGame(c.req.raw, database()));
app.all('/api/*', (c) => c.json({ error: '接口不存在。' }, 404));
app.onError((error, c) => {
  console.error(
    'Unhandled error',
    error instanceof Error ? error.message : 'unknown',
  );
  return c.json({ error: '棋室暂时连接不上，请稍后重试。' }, 503);
});

export default app;
