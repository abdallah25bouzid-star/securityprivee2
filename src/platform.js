import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = 'kv';

const supabase = URL && KEY ? createClient(URL, KEY) : null;
const LS = window.localStorage;

if (!supabase) {
  console.warn('[Buckler] Supabase non configuré → stockage local (non partagé).');
}

window.storage = {
  async get(k) {
    if (!supabase) {
      const v = LS.getItem(k);
      return v == null ? null : { key: k, value: v };
    }
    const { data, error } = await supabase.from(TABLE).select('value').eq('key', k).maybeSingle();
    if (error || !data) return null;
    return { key: k, value: data.value };
  },
  async set(k, value) {
    if (!supabase) { LS.setItem(k, value); return { key: k, value }; }
    await supabase.from(TABLE).upsert({ key: k, value }, { onConflict: 'key' });
    return { key: k, value };
  },
  async delete(k) {
    if (!supabase) { LS.removeItem(k); return { key: k, deleted: true }; }
    await supabase.from(TABLE).delete().eq('key', k);
    return { key: k, deleted: true };
  },
  async list(prefix = '') {
    if (!supabase) {
      const keys = [];
      for (let i = 0; i < LS.length; i++) { const kk = LS.key(i); if (kk && kk.startsWith(prefix)) keys.push(kk); }
      return { keys, prefix };
    }
    const { data } = await supabase.from(TABLE).select('key').like('key', prefix + '%');
    return { keys: (data || []).map((r) => r.key), prefix };
  },
};

if (supabase) {
  let timer;
  supabase
    .channel('kv-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.dispatchEvent(new Event('focus')), 300);
    })
    .subscribe();
}

const _fetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    const u = typeof input === 'string' ? input : input && input.url;
    if (u && u.indexOf('api.anthropic.com/v1/messages') !== -1) return _fetch('/api/claude', init);
  } catch (e) {}
  return _fetch(input, init);
};
