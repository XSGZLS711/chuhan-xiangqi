import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '楚汉棋社 · 好友象棋对战',
  description:
    '邀请好友在线下中国象棋。无限悔棋、独立推演、棋谱复盘，打开链接即可入座。',
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f0e9' },
    { media: '(prefers-color-scheme: dark)', color: '#191c1b' },
  ],
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
