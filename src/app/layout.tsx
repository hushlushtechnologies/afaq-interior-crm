import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import { MotionProvider } from '@/components/providers/motion-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Afaq Al Manzel Interiors CRM',
  description: 'The interior design and operations workspace for Afaq Al Manzel Interiors.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
