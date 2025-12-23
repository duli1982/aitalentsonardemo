import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

export function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

