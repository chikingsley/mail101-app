import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.BUN_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.BUN_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured - realtime updates disabled');
}

// Create Supabase client for realtime subscriptions
// Note: We only use this for realtime notifications, not for data access
// All data access goes through our authenticated backend API
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
