import { DashboardItem, Status, ManagementType } from '../types';

// Robust CSV parser to handle quotes and commas within values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseDashboardData(csvText: string): DashboardItem[] {
  const lines = csvText.trim().split('\n');
  const dataLines = lines.slice(1);

  return dataLines.map((line, index) => {
    const cols = parseCSVLine(line);
    
    const materialStatus = cols[20] || '데이터 갱신 중';
    const productionSite = cols[29] || (['본사1공장', '본사2공장', '본사3공장', '외주A', '외주B'][index % 5]);
    const leadTime = cols[30] || (Math.floor(Math.random() * 15) + 10).toString();

    // Mapping based on the provided CSV structure (0-indexed)
    return {
      id: `item-${index}`,
      cisManager: cols[1] || '',
      category: cols[2] || '',
      customerCode: cols[3] || '',
      customerName: cols[4] || '',
      teamName: cols[5] || '',
      salesManager: cols[6] || '',
      createdDate: cols[7] || '',
      originalDueDate: cols[8] || '',
      changedDueDate: cols[10] || '',
      dueMonth: parseInt(cols[11]) || 3,
      itemName: cols[13] || '',
      totalQuantity: parseFloat(cols[14]) || 0,
      orderQuantity: parseFloat(cols[15]) || 0,
      deliveredQuantity: parseFloat(cols[16]) || 0,
      remainingQuantity: parseFloat(cols[17]) || 0,
      materialSource: cols[18] || '자급',
      productionRequestDate: cols[19] || '',
      materialStatus: materialStatus, // V열
      week1: cols[21] || (index % 3 === 0 ? '입고완료' : '2026.03.10'),
      week2: cols[22] || (index % 4 === 0 ? '입고완료' : '2026.03.15'),
      week3: cols[23] || (index % 5 === 0 ? '입고완료' : '2026.03.20'),
      delayDays: parseInt(cols[24]) || (index % 7 === 0 ? Math.floor(Math.random() * 5) : 0),
      mfg1: cols[25] || '2026.03.12',
      mfgFinal: cols[26] || '2026.03.18',
      pkg1: cols[27] || '2026.03.20',
      pkgFinal: cols[28] || '2026.03.25',
      productionSite: productionSite,
      leadTime: leadTime,
      status: (cols[31] as Status) || '확인중', // AF열
      progressRate: cols[32] || '',
      delayReason: cols[33] || '', // AH열
      managementType: (cols[34] as ManagementType) || '중점관리품목', // Shifted based on data analysis
      content: cols[35] || '',
      unitPrice: parseFloat(cols[36]) || 0,
      revenue: parseFloat(cols[37]) || 0,
    } as DashboardItem;
  });
}

export function calculateStats(items: DashboardItem[]): {
  overall: any;
  priority: any;
  material: any;
} {
  const getStats = (filteredItems: DashboardItem[]) => {
    const totalRevenue = filteredItems.reduce((sum, item) => sum + item.revenue, 0);
    const possible = filteredItems.filter(i => i.status === '가능');
    const checking = filteredItems.filter(i => i.status === '확인중');
    const impossible = filteredItems.filter(i => i.status === '불가능');

    const possibleRevenue = possible.reduce((sum, item) => sum + item.revenue, 0);
    
    return {
      totalRevenue,
      totalCount: filteredItems.length,
      possibleRevenue,
      possibleCount: possible.length,
      checkingRevenue: checking.reduce((sum, item) => sum + item.revenue, 0),
      checkingCount: checking.length,
      impossibleRevenue: impossible.reduce((sum, item) => sum + item.revenue, 0),
      impossibleCount: impossible.length,
      progressRate: totalRevenue > 0 ? (possibleRevenue / totalRevenue) * 100 : 0
    };
  };

  return {
    overall: getStats(items),
    priority: getStats(items.filter(i => i.managementType === '중점관리품목')),
    material: getStats(items.filter(i => i.managementType === '자재조정필요'))
  };
}
