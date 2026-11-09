declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    // The static files (public/ in the build), for the one the Worker answers itself:
    // assetlinks.json (worker/asset-links.ts).
    ASSETS: Fetcher;
    // One Durable Object per friend room, and one listing the rooms each player sits in.
    ROOMS: DurableObjectNamespace<import('./room-object').GameRoom>;
    SEATS: DurableObjectNamespace<import('./room-object').PlayerSeats>;
    // Google sign-in; set with `wrangler secret put` (locally in .dev.vars).
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}
