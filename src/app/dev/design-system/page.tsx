import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignSystemPreview } from '@/components/dev/design-system-preview';

export const metadata: Metadata = {
  title: 'Design system | Afaq Al Manzel',
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DesignSystemPreview />;
}
