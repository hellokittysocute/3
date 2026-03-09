import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// navigator.locks API 데드락 방지를 위한 in-process 락 구현
const locks: Record<string, Promise<unknown>> = {};

async function processLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  const prev = locks[name] ?? Promise.resolve();
  const current = prev.catch(() => {}).then(() => fn());
  locks[name] = current;
  return await current;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: processLock,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});
