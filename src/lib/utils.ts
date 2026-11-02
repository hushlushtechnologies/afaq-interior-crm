import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';
