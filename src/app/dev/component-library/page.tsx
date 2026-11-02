import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormLibraryPreview } from '@/components/dev/form-library-preview';
import { PageContainer } from '@/components/ui/page-container';
import { ToastProvider } from '@/components/ui/toast-provider';

export const metadata: Metadata = {
  title: 'Component library | Afaq Al Manzel',
  description: 'Development-only reusable component examples.',
};

export default function ComponentLibraryPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <ToastProvider>
      <PageContainer>
        <FormLibraryPreview />
      </PageContainer>
    </ToastProvider>
  );
}
