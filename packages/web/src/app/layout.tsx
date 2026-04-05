import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { QuickChatDialog } from '@/components/quick-chat-dialog';
import { Providers } from '@/components/providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DataChat — 智能数据对话平台',
  description: '用自然语言对话探索数据，AI 驱动查询、图表与洞察',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`h-full ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased font-sans">
        <Providers>
          {children}
          <QuickChatDialog />
        </Providers>
      </body>
    </html>
  );
}
