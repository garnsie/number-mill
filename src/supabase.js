import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const sb = (url && key) ? createClient(url, key) : null;

export async function submitScore(date, playerId, score, character) {
  if (!sb) return;
  try {
    await sb.from('daily_scores')
      .upsert({ date, player_id: playerId, score, character }, { onConflict: 'date,player_id' });
  } catch (e) {
    console.error('Score submit failed:', e);
  }
}

export async function getLeaderboard(date) {
  if (!sb) return [];
  try {
    const { data } = await sb.from('daily_scores')
      .select('player_id, score, character')
      .eq('date', date)
      .order('score', { ascending: false })
      .limit(100);
    return data || [];
  } catch (e) {
    console.error('Leaderboard fetch failed:', e);
    return [];
  }
}
