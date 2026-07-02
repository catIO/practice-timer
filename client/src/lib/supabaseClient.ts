import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite exposes VITE_* vars to the client. Netlify's Supabase integration sets
// SUPABASE_DATABASE_URL and SUPABASE_ANON_KEY (no VITE_ prefix), so we also
// check those at build time via define in vite.config.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
    console.warn(
        '⚠️ Supabase environment variables not set. ' +
        'Auth and database features will be disabled. ' +
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable.'
    );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    })
    : null;
