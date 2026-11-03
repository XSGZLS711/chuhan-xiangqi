declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    // Google sign-in; set with `wrangler secret put` (locally in .dev.vars).
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}
