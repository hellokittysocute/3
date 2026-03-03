import { DashboardItem } from '../types';
import { parseDashboardData } from '../services/dataService';
import rawCsv from './raw.csv?raw';

const parsedItems = parseDashboardData(rawCsv);

export const CATEGORIES = [...new Set(parsedItems.map(i => i.category).filter(Boolean))].sort();

export function get805Items(): DashboardItem[] {
  return parsedItems;
}
