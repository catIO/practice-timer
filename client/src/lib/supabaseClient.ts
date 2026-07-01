import { createClient } from '@supabase/supabase-js';

// Vite exposes VITE_* vars to the client. Netlify's Supabase integration sets
// SUPABASE_DATABASE_URL and SUPABASE_ANON_KEY (no VITE_ prefix), so we also
// check those at build time via define in vite.config.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ Supabase environment variables not set. ' +
        'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});
