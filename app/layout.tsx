import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'GestureDJ',
  description: 'Gesture-controlled browser DJ console'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f14] text-gray-100 antialiased">
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
