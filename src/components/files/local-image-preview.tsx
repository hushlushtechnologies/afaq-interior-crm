'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LocalImagePreviewProps = {
  url: string;
  fileName: string;
  compact?: boolean;
};

export function LocalImagePreview({ url, fileName, compact = false }: LocalImagePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const containerClassName = cn(
    'relative overflow-hidden rounded-control border border-border bg-muted',
    compact ? 'h-16 w-20 shrink-0' : 'aspect-[3/2] w-full',
  );

  if (failed) {
    return (
      <div className={cn(containerClassName, 'flex items-center justify-center p-2 text-center')}>
        <p className="text-xs leading-5 text-muted-foreground">Preview unavailable</p>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {loading ? <Skeleton className="absolute inset-0 h-full w-full rounded-none" /> : null}

      <Image
        src={url}
        alt={compact ? '' : `Local preview of ${fileName}`}
        fill
        unoptimized
        sizes={compact ? '80px' : '(max-width: 640px) 90vw, 540px'}
        onLoad={() => setLoading(false)}
        onError={() => setFailed(true)}
        className={cn(
          compact ? 'object-cover' : 'object-contain',
          'transition-opacity motion-reduce:transition-none',
          loading ? 'opacity-0' : 'opacity-100',
        )}
      />
    </div>
  );
}
