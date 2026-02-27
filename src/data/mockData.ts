import { DashboardItem, Status, ManagementType } from '../types';
import { differenceInDays, parse } from 'date-fns';

const SAMPLE_CUSTOMERS = [
  { code: 'DPD', name: '주식회사 더파운더즈', team: '마케팅 8팀' },
  { code: 'CLO', name: '(주)클리오', team: '마케팅 3팀' },
  { code: 'GDI', name: '주식회사 구다이글로벌', team: '마케팅 3팀' },
  { code: 'IWD', name: '(주) 아이패밀리에스씨', team: '마케팅 8팀' },
  { code: 'GEN', name: '(주)고운세상코스메틱', team: '마케팅 2팀' },
  { code: 'SNT', name: '쏘내추럴(주)', team: '마케팅 1팀' },
  { code: 'OLV', name: '씨제이올리브영 주식회사', team: '마케팅 1팀' },
  { code: 'CSB', name: '주식회사 뷰티셀렉션', team: '마케팅 2팀' },
  { code: 'FCM', name: '주식회사 포컴퍼니', team: '마케팅 6팀' },
  { code: 'HDP', name: '현대약품 ㈜', team: '마케팅 7팀' },
  { code: 'BNU', name: '(주)비나우', team: '마케팅 6팀' },
  { code: 'DNC', name: '주식회사 디엔코스메틱스', team: '마케팅 3팀' },
  { code: 'SLC', name: '서린컴퍼니(주)', team: '마케팅 5팀' },
  { code: 'DKP', name: '동국제약 (주)', team: '마케팅 9팀' },
  { code: 'ABC', name: '(주)에이블씨엔씨', team: '마케팅 2팀' },
  { code: 'BOS', name: '주식회사 부스터스', team: '마케팅 1팀' },
  { code: 'CBK', name: '(주)카버코리아', team: '마케팅 1팀' },
  { code: 'NAN', name: '주식회사 블루존와이드', team: '마케팅 8팀' },
  { code: 'CRV', name: '주식회사 크레이버코퍼레이션', team: '마케팅 6팀' },
  { code: 'ATO', name: '애터미 주식회사', team: '마케팅 8팀' },
  { code: 'M4T', name: '마케팅 4팀 고객사', team: '마케팅 4팀' }, // Added 4팀
];

const CATEGORIES = ['미스트', '에센스', '크림', '선제품', '립글로스', '아이섀도', '겔마스크', '클렌징', '파운데이션', '두발용'];
const MANAGERS = ['백승윤', '최윤호', '박진형', '김현석', '정태수', '안세연', '조경수', '김현주', '민예지', '이상엽'];
const DELAY_REASONS = ['영업', '고객', '구매', '생산', '품질'];

export function get805Items(): DashboardItem[] {
  const items: DashboardItem[] = [];
  
  for (let i = 0; i < 805; i++) {
    const isPriority = i < 659;
    const customer = SAMPLE_CUSTOMERS[i % SAMPLE_CUSTOMERS.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    const manager = MANAGERS[i % MANAGERS.length];
    
    const baseRevenue = isPriority ? 53000000 : 89000000;
    const revenue = baseRevenue + (Math.random() - 0.5) * 20000000;
    
    let status: Status = '확인중';
    const rand = Math.random();
    if (rand > 0.8) status = '가능';
    else if (rand > 0.6) status = '불가능';

    // Dates for calculations
    const material1stDateStr = '2026.03.05';
    const week3DateStr = '2026.03.20';
    const pkgFinalDateStr = '2026.03.28';

    const date1 = parse(material1stDateStr, 'yyyy.MM.dd', new Date());
    const date3 = parse(week3DateStr, 'yyyy.MM.dd', new Date());
    const datePkg = parse(pkgFinalDateStr, 'yyyy.MM.dd', new Date());

    const calculatedDelay = differenceInDays(date3, date1);
    const calculatedLeadTime = differenceInDays(datePkg, date3);

    items.push({
      id: `item-${i}`,
      cisManager: manager,
      category: category,
      customerCode: customer.code,
      customerName: customer.name,
      teamName: customer.team,
      salesManager: '담당자',
      createdDate: '2026-02-01',
      originalDueDate: '2026-03-15',
      changedDueDate: isPriority ? '2026-03-25' : '2026-04-10',
      dueMonth: isPriority ? 3 : 4,
      materialCode: `MAT-${1000 + i}`,
      itemName: `${customer.code} ${category} ${i + 1}`,
      totalQuantity: 10000,
      orderQuantity: 10000,
      deliveredQuantity: Math.floor(Math.random() * 2000),
      remainingQuantity: 8000 + Math.floor(Math.random() * 2000),
      materialSource: Math.random() > 0.9 ? '사급' : '자급',
      productionRequestDate: '2026-03-05',
      materialStatus: Math.random() > 0.7 ? '세팅완료' : material1stDateStr,
      week1: '2026.03.10',
      week2: '2026.03.15',
      week3: week3DateStr,
      delayDays: calculatedDelay,
      mfg1: '2026.03.22',
      mfgFinal: '2026.03.25',
      pkg1: '2026.03.26',
      pkgFinal: pkgFinalDateStr,
      productionSite: ['본사1공장', '본사2공장', '본사3공장', '외주A', '외주B'][i % 5],
      leadTime: calculatedLeadTime.toString(),
      status: status,
      progressRate: '0%',
      delayReason: status !== '가능' ? DELAY_REASONS[Math.floor(Math.random() * DELAY_REASONS.length)] : '',
      content: '',
      managementType: isPriority ? '중점관리품목' : '자재조정필요',
      unitPrice: Math.floor(revenue / 10000),
      revenue: revenue,
    });
  }
  
  return items;
}
