import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  const eok = value / 100000000;
  if (eok >= 10) return `${Math.round(eok)}억`;
  if (eok >= 1) return `${eok.toFixed(1)}억`;
  return `${eok.toFixed(2)}억`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}
