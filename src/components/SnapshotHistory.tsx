import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Camera, ArrowLeft, Trash2, Download, Calendar, Database, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SnapshotMeta, SnapshotRow, EditableData } from '../types';
import { fetchSnapshots, fetchSnapshotData, deleteSnapshot } from '../services/supabaseDataService';
import { getRevenue, calculateStats } from '../services/dataService';
import { formatCurrency } from '../lib/utils';

interface SnapshotHistoryProps {
  isAdmin?: boolean;
}

export const SnapshotHistory: React.FC<SnapshotHistoryProps> = ({ isAdmin }) => {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotMeta | null>(null);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const data = await fetchSnapshots();
    setSnapshots(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const handleSelect = async (snap: SnapshotMeta) => {
    setDetailLoading(true);
    setSelectedSnapshot(snap);
    const rows = await fetchSnapshotData(snap.id);
    setSnapshotRows(rows);
    setDetailLoading(false);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 스냅샷을 삭제하시겠습니까?')) return;
    const ok = await deleteSnapshot(id);
    if (ok) {
      setSnapshots(prev => prev.filter(s => s.id !== id));
      if (selectedSnapshot?.id === id) {
        setSelectedSnapshot(null);
        setSnapshotRows([]);
      }
    }
  };

  const handleBack = () => {
    setSelectedSnapshot(null);
    setSnapshotRows([]);
  };

  const handleExcelDownload = useCallback(() => {
    if (!selectedSnapshot || snapshotRows.length === 0) return;
    const rows = snapshotRows.map(({ item, edit }) => {
      const qty = edit?.revenuePossibleQuantity || item.remainingQuantity;
      return {
        '중요도': edit?.importance ?? '',
        'CIS담당': item.cisManager,
        '구매담당': edit?.purchaseManager ?? '',
        '중분류': item.category,
        '고객약호': item.customerCode,
        '자재': item.materialCode,
        '내역': item.itemName,
        '미납잔량': item.remainingQuantity,
        '생산완료요청일': edit?.productionCompleteDate ?? '',
        '부자재(일정)': edit?.materialSettingDate ?? '',
        '제조': edit?.manufacturingDate ?? '',
        '충포장': edit?.packagingDate ?? '',
        '생산처': edit?.productionSite ?? '',
        '매출 가능여부': edit?.revenuePossible ?? '',
        '매출 가능 수량': qty,
        '지연사유': edit?.delayReason ?? '',
        '단가': item.unitPrice,
        '매출': qty * item.unitPrice,
        '비고': edit?.note ?? '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '스냅샷');
    XLSX.writeFile(wb, `스냅샷_${selectedSnapshot.month}_${selectedSnapshot.label}.xlsx`);
  }, [selectedSnapshot, snapshotRows]);

  // Group snapshots by month
  const groupedSnapshots = useMemo(() => {
    const map = new Map<string, SnapshotMeta[]>();
    snapshots.forEach(s => {
      const list = map.get(s.month) || [];
      list.push(s);
      map.set(s.month, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [snapshots]);

  // Detail view: show snapshot data in a read-only table
  if (selectedSnapshot) {
    // 스냅샷 데이터로 종합현황 계산
    const snapshotItems = snapshotRows.map(r => r.item);
    const snapshotEditMap: Record<string, EditableData> = {};
    snapshotRows.forEach(r => { snapshotEditMap[r.item.id] = r.edit; });
    const snapshotStats = snapshotRows.length > 0 ? calculateStats(snapshotItems, snapshotEditMap) : null;
    const goalRate = snapshotStats && snapshotStats.overall.totalRevenue > 0
      ? (snapshotStats.overall.possibleRevenue / snapshotStats.overall.totalRevenue) * 100 : 0;

    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-slate-800">{selectedSnapshot.label}</h3>
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">읽기전용</span>
                </div>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  {selectedSnapshot.month} | {new Date(selectedSnapshot.created_at).toLocaleString('ko-KR')} | {selectedSnapshot.item_count}건 | {formatCurrency(selectedSnapshot.total_revenue)}
                </p>
              </div>
            </div>
            <button
              onClick={handleExcelDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" /> 다운로드
            </button>
          </div>
        </div>

        {/* 종합현황 요약 카드 */}
        {snapshotStats && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 px-6 py-5">
            <h3 className="text-[14px] font-bold text-slate-700 mb-4">종합현황</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center py-3 px-3 rounded-xl bg-slate-50">
                <div className="text-[11px] font-medium text-slate-400 mb-1">총 건수</div>
                <div className="text-[20px] font-extrabold text-slate-800">{snapshotStats.overall.totalCount}건</div>
              </div>
              <div className="text-center py-3 px-3 rounded-xl bg-slate-50">
                <div className="text-[11px] font-medium text-slate-400 mb-1">총 매출액</div>
                <div className="text-[20px] font-extrabold text-slate-800">{formatCurrency(snapshotStats.overall.totalRevenue)}</div>
              </div>
              <div className="text-center py-3 px-3 rounded-xl bg-emerald-50">
                <div className="text-[11px] font-medium text-emerald-500 mb-1">가능 ({snapshotStats.overall.possibleCount}건)</div>
                <div className="text-[20px] font-extrabold text-emerald-600">{formatCurrency(snapshotStats.overall.possibleRevenue)}</div>
              </div>
              <div className="text-center py-3 px-3 rounded-xl bg-amber-50">
                <div className="text-[11px] font-medium text-amber-500 mb-1">확인중 ({snapshotStats.overall.checkingCount}건)</div>
                <div className="text-[20px] font-extrabold text-amber-600">{formatCurrency(snapshotStats.overall.checkingRevenue)}</div>
              </div>
              <div className="text-center py-3 px-3 rounded-xl bg-indigo-50">
                <div className="text-[11px] font-medium text-indigo-400 mb-1">달성률</div>
                <div className={`text-[20px] font-extrabold ${goalRate >= 100 ? 'text-indigo-500' : 'text-red-400'}`}>{goalRate.toFixed(1)}%</div>
              </div>
            </div>
            {/* 달성률 바 */}
            <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(goalRate, 100)}%`, backgroundColor: '#6366f1' }} />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-[14px]">불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">중요도</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">CIS담당</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">구매담당</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">중분류</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">고객약호</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">자재</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">내역</th>
                    <th className="px-3 py-2.5 text-right font-bold text-slate-500 whitespace-nowrap">미납잔량</th>
                    <th className="px-3 py-2.5 text-center font-bold text-slate-500 whitespace-nowrap">매출가능</th>
                    <th className="px-3 py-2.5 text-right font-bold text-slate-500 whitespace-nowrap">가능수량</th>
                    <th className="px-3 py-2.5 text-right font-bold text-slate-500 whitespace-nowrap">매출</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">지연사유</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotRows.map(({ item, edit }, idx) => {
                    const qty = edit?.revenuePossibleQuantity || item.remainingQuantity;
                    const revenue = qty * item.unitPrice;
                    const importance = edit?.importance || '';
                    const impColor = importance === '상' ? 'text-red-500' : importance === '중' ? 'text-amber-500' : importance === '하' ? 'text-green-500' : 'text-slate-400';
                    const possibleColor = edit?.revenuePossible === '가능' ? 'text-emerald-600 bg-emerald-50' : edit?.revenuePossible === '불가능' ? 'text-red-500 bg-red-50' : 'text-amber-500 bg-amber-50';
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className={`px-3 py-2 font-bold ${impColor}`}>{importance || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{item.cisManager}</td>
                        <td className="px-3 py-2 text-slate-600">{edit?.purchaseManager || ''}</td>
                        <td className="px-3 py-2 text-slate-600">{item.category}</td>
                        <td className="px-3 py-2 text-slate-600">{item.customerCode}</td>
                        <td className="px-3 py-2 text-slate-600">{item.materialCode}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{item.itemName}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.remainingQuantity.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${possibleColor}`}>{edit?.revenuePossible || '확인중'}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{qty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrency(revenue)}</td>
                        <td className="px-3 py-2 text-slate-600">{edit?.delayReason || ''}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate">{edit?.note || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view: show all snapshots grouped by month
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <Camera className="w-5 h-5 text-slate-600" />
          <h2 className="text-[18px] font-bold text-slate-800">월별 스냅샷 이력</h2>
        </div>
        <p className="text-[13px] text-slate-400 ml-8">마감 시점의 데이터를 스냅샷으로 저장하고 조회할 수 있습니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-[14px]">불러오는 중...</div>
      ) : snapshots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col items-center justify-center py-20">
          <Database className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-[15px] font-semibold text-slate-400">저장된 스냅샷이 없습니다</p>
          <p className="text-[13px] text-slate-300 mt-1">상세데이터 탭에서 스냅샷을 저장해 주세요.</p>
        </div>
      ) : (
        groupedSnapshots.map(([month, snaps]) => (
          <div key={month} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/60 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-[14px] font-bold text-slate-600">{month.replace('-', '년 ')}월</span>
              <span className="text-[12px] text-slate-400 ml-1">{snaps.length}개 스냅샷</span>
            </div>
            <div className="divide-y divide-slate-100">
              {snaps.map(snap => (
                <div
                  key={snap.id}
                  onClick={() => handleSelect(snap)}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-slate-700">{snap.label}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[12px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(snap.created_at).toLocaleString('ko-KR')}
                        </span>
                        <span className="text-[12px] text-slate-400">{snap.created_by}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[14px] font-bold text-slate-700">{snap.item_count}건</div>
                      <div className="text-[12px] text-slate-400">{formatCurrency(snap.total_revenue)}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDelete(snap.id, e)}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
