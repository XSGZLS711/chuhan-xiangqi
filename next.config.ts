import type { NextConfig } from 'next';

// The AI room runs a WebAssembly engine that needs SharedArrayBuffer, so it must
// be cross-origin isolated. Static hosts get this from the scoped service worker
// instead; this server can simply send the headers.
const isolation = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/ai', headers: isolation },
      { source: '/ai/:path*', headers: isolation },
    ];
  },
};

export default nextConfig;
