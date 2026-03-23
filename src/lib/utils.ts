import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  const eok = value / 100000000;
  return `${Math.round(eok)}억`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}
