/**
 * Icon wrapper around @phosphor-icons/react.
 *
 * Usage:
 *   import { House } from '@phosphor-icons/react/dist/ssr/House';
 *   <Icon as={House} size="md" />
 *
 * Or with a Phosphor component name string:
 *   <Icon name="House" size="md" />
 *
 * Always import individual icons from /dist/ssr/ for tree-shaking.
 * NEVER do `import * from '@phosphor-icons/react'` — pulls everything.
 */

import {
  House,
  User,
  Gear,
  SignOut,
  Rocket,
  Trophy,
  Flame,
  Sparkle,
  BookOpen,
  X,
  Check,
  Warning,
  Info,
  Lock,
  CaretDown,
  CaretRight,
  CaretLeft,
  CaretUp,
  Plus,
  Minus,
  MagnifyingGlass,
  List,
  ChartLine,
  ChartBar,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  GraduationCap,
  type IconProps as PhosphorIconProps,
} from '@phosphor-icons/react/dist/ssr';
import clsx from 'clsx';
import styles from './Icon.module.css';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  as?: React.ComponentType<PhosphorIconProps>;
  name?: PhosphorIconName;
  size?: IconSize;
  weight?: 'light' | 'regular' | 'bold';
  className?: string;
  'aria-label'?: string;
}

const SIZE_MAP: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export type PhosphorIconName =
  | 'House'
  | 'User'
  | 'Gear'
  | 'SignOut'
  | 'Rocket'
  | 'Trophy'
  | 'Flame'
  | 'Sparkle'
  | 'BookOpen'
  | 'X'
  | 'Check'
  | 'Warning'
  | 'Info'
  | 'Lock'
  | 'CaretDown'
  | 'CaretRight'
  | 'CaretLeft'
  | 'CaretUp'
  | 'Plus'
  | 'Minus'
  | 'MagnifyingGlass'
  | 'List'
  | 'ChartLine'
  | 'ChartBar'
  | 'CreditCard'
  | 'Receipt'
  | 'Calendar'
  | 'Clock'
  | 'GraduationCap';

const ICON_MAP: Record<PhosphorIconName, React.ComponentType<PhosphorIconProps>> = {
  House,
  User,
  Gear,
  SignOut,
  Rocket,
  Trophy,
  Flame,
  Sparkle,
  BookOpen,
  X,
  Check,
  Warning,
  Info,
  Lock,
  CaretDown,
  CaretRight,
  CaretLeft,
  CaretUp,
  Plus,
  Minus,
  MagnifyingGlass,
  List,
  ChartLine,
  ChartBar,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  GraduationCap,
};

export function Icon({
  as,
  name,
  size = 'md',
  weight = 'light',
  className,
  'aria-label': ariaLabel,
}: IconProps) {
  const Component = as ?? (name ? ICON_MAP[name] : undefined);
  if (!Component) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Icon: unknown icon "${name}". Add it to ICON_MAP or pass as={SomePhosphorIcon}.`);
    }
    return null;
  }

  const ariaProps = ariaLabel
    ? { 'aria-label': ariaLabel, role: 'img' }
    : { 'aria-hidden': true };

  return (
    <Component
      size={SIZE_MAP[size]}
      weight={weight}
      className={clsx(styles.icon, className)}
      {...ariaProps}
    />
  );
}