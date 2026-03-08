import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Clock, LogOut } from 'lucide-react';

export function InactivePage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-10 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="text-amber-600 w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            승인 대기 중
          </h1>
          <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
            <span className="font-bold text-slate-700">{profile?.email}</span> 계정으로 로그인되었습니다.
            <br />
            관리자의 승인 후 서비스를 이용할 수 있습니다.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8">
            <p className="text-sm text-amber-700 font-semibold">
              관리자에게 승인을 요청해 주세요.
            </p>
          </div>

          <button
            onClick={signOut}
            className="flex items-center justify-center gap-2 mx-auto px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
