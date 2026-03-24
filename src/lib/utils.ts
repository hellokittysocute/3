import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  const eok = value / 100000000;
  return `${Math.round(eok)}억`;
}

export function formatCurrencyDetail(value: number) {
  const eok = value / 100000000;
  if (eok >= 10) return `${Math.round(eok)}억`;
  if (eok >= 1) return `${eok.toFixed(1)}억`;
  return `${eok.toFixed(2)}억`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}

// 2026년 한국 공휴일 (월-일 형식)
const KR_HOLIDAYS_2026 = [
  '01-01', '01-28', '01-29', '01-30', // 신정, 설날
  '03-01', // 삼일절
  '05-05', '05-24', // 어린이날, 부처님오신날
  '06-06', // 현충일
  '08-15', // 광복절
  '09-24', '09-25', '09-26', // 추석
  '10-03', '10-09', // 개천절, 한글날
  '12-25', // 크리스마스
];

/** 주어진 날짜가 워킹데이(월~금, 공휴일 제외)인지 판별 */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // 주말
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return !KR_HOLIDAYS_2026.includes(mmdd);
}

/** baseDate로부터 워킹데이 N일 후 날짜 반환 */
export function addWorkingDays(baseDate: Date, days: number): Date {
  const result = new Date(baseDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result)) added++;
  }
  return result;
}
