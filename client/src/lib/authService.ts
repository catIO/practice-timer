import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
    user: User | null;
    session: Session | null;
    error: AuthError | null;
}

const SUPABASE_UNAVAILABLE_ERROR = {
    message: 'Supabase is not configured',
    name: 'AuthError',
    status: 0,
} as AuthError;

export async function signUp(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { user: null, session: null, error: SUPABASE_UNAVAILABLE_ERROR };
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/`,
        },
    });
    return { user: data.user, session: data.session, error };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { user: null, session: null, error: SUPABASE_UNAVAILABLE_ERROR };
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { user: data.user, session: data.session, error };
}

export async function signInWithMagicLink(email: string): Promise<{ error: AuthError | null }> {
    if (!supabase) return { error: SUPABASE_UNAVAILABLE_ERROR };
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: `${window.location.origin}/`,
        },
    });
    return { error };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return { error };
}

export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
    if (!supabase) return { error: SUPABASE_UNAVAILABLE_ERROR };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    if (!supabase) return { error: SUPABASE_UNAVAILABLE_ERROR };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
}

export async function getCurrentSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export function onAuthStateChange(
    callback: (event: string, session: Session | null) => void
) {
    if (!supabase) {
        // Return a no-op subscription when Supabase is not configured
        return { data: { subscription: { unsubscribe: () => { } } } };
    }
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
