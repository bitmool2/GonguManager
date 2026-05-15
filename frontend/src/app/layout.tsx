import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '공구매니저 - GonguManager',
  description: '인스타그램 공동구매 셀러를 위한 주문 관리 플랫폼',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
