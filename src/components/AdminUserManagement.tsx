import React, { useEffect, useState } from 'react';
import { UserProfile } from '../contexts/AuthContext';
import { Shield, User, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export function AdminUserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data as UserProfile[]);
      }
    } catch (err: any) {
      console.error('사용자 목록 조회 오류:', err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus as 'active' | 'inactive' } : u));
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as 'admin' | 'user' } : u));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">회원 관리</h2>
          <p className="text-sm text-slate-400 mt-1">등록된 사용자의 상태와 권한을 관리합니다.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          새로고침
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">사용자</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">이메일</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">역할</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">상태</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">가입일</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">작업</th>
            </tr>
          </thead>
          <tbody>
            {[...users].sort((a, b) => {
              // 비활성(미승인) 사용자를 상단에 표시
              if (a.status !== b.status) return a.status === 'inactive' ? -1 : 1;
              return 0;
            }).map(user => (
              <tr key={user.id} className={cn("border-b border-slate-50 transition-colors", user.status === 'inactive' ? "bg-amber-50/60 hover:bg-amber-100/60" : "hover:bg-slate-50/50")}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <span className="text-sm font-bold text-slate-700">{user.name || '(이름 없음)'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                <td className="px-6 py-4 text-center">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                    user.role === 'admin' ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "bg-slate-50 text-slate-500 border border-slate-200"
                  )}>
                    {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {user.role === 'admin' ? '관리자' : '일반'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                    user.status === 'active' ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-red-50 text-red-500 border border-red-200"
                  )}>
                    {user.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {user.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-sm text-slate-400">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => toggleStatus(user.id, user.status)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                        user.status === 'active'
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      )}
                    >
                      {user.status === 'active' ? '비활성화' : '활성화'}
                    </button>
                    <button
                      onClick={() => toggleRole(user.id, user.role)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      {user.role === 'admin' ? '일반으로' : '관리자로'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400 text-sm">등록된 사용자가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
