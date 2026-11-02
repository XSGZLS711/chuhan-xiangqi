import { Hono } from 'hono';
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
app.all('/api/*', (c) => c.json({ error: '接口不存在。' }, 404));
app.onError((error, c) => {
  console.error(
    'Unhandled error',
    error instanceof Error ? error.message : 'unknown',
  );
  return c.json({ error: '棋室暂时连接不上，请稍后重试。' }, 503);
});

export default app;
