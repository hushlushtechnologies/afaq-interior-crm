import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';
import { Icon } from './icon';

type IconButtonProps = Omit<ButtonProps, 'children' | 'aria-label'> & {
  label: string;
  icon: LucideIcon;
};

export function IconButton({ label, icon, loading, className, ...props }: IconButtonProps) {
  return (
    <Button
      {...props}
      loading={loading}
      aria-label={label}
      title={label}
      className={cn('size-12 min-h-12 p-0', className)}
    >
      {!loading && <Icon icon={icon} />}
    </Button>
  );
}
