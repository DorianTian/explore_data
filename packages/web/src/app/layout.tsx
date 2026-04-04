import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { QuickChatDialog } from '@/components/quick-chat-dialog';
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
  title: 'NL2SQL - 智能数据查询平台',
  description: '用自然语言查询数据，AI 自动生成 SQL',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`h-full ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased font-sans">
        {children}
        <QuickChatDialog />
      </body>
    </html>
  );
}
