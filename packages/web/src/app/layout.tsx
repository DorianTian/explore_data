import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
