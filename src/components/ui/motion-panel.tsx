'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

export function MotionPanel({ className, children, ...props }: HTMLMotionProps<'div'>) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <motion.div
      {...props}
      initial={false}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className={cn('min-w-0', className)}
    >
      {children}
    </motion.div>
  );
}
