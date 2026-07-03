import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
    signUp as authSignUp,
    signIn as authSignIn,
    signOut as authSignOut,
    getCurrentSession,
    getCurrentUser,
    onAuthStateChange,
} from '../lib/authService';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    isPasswordRecovery: boolean;
    clearPasswordRecovery: () => void;
    signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

    const clearPasswordRecovery = () => setIsPasswordRecovery(false);

    const migrateLocalReports = async (userId: string) => {
        try {
            const localReports = JSON.parse(localStorage.getItem('local_shared_reports') || '[]');
            if (localReports.length === 0) return;

            if (!supabase) return;

            const { error } = await supabase
                .from('shared_reports')
                .update({ user_id: userId })
                .in('id', localReports);

            if (!error) {
                console.log(`Successfully migrated ${localReports.length} anonymous reports to user ${userId}`);
                localStorage.removeItem('local_shared_reports');
            } else {
                console.warn('Failed to migrate anonymous reports to user account:', error);
            }
        } catch (err) {
            console.warn('Error during anonymous reports migration:', err);
        }
    };

    useEffect(() => {
        let mounted = true;

        // If Supabase is not configured, skip auth initialization entirely
        if (!isSupabaseConfigured) {
            setIsLoading(false);
            return;
        }

        const initializeAuth = async () => {
            try {
                const currentSession = await getCurrentSession();
                if (mounted) {
                    setSession(currentSession);
                    setUser(currentSession?.user ?? null);
                    if (currentSession?.user) {
                        migrateLocalReports(currentSession.user.id);
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    migrateLocalReports(session.user.id);
                }
                if (_event === 'PASSWORD_RECOVERY') {
                    setIsPasswordRecovery(true);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signUp = async (email: string, password: string) => {
        try {
            const result = await authSignUp(email, password);
            if (result.error) {
                return { error: new Error(result.error.message), needsEmailConfirmation: false };
            }
            const needsEmailConfirmation = !!result.user && !result.session;
            return { error: null, needsEmailConfirmation };
        } catch (error) {
            return { error: error instanceof Error ? error : new Error('Sign up failed'), needsEmailConfirmation: false };
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            const result = await authSignIn(email, password);
            if (result.error) {
                return { error: new Error(result.error.message) };
            }
            return { error: null };
        } catch (error) {
            return { error: error instanceof Error ? error : new Error('Sign in failed') };
        }
    };

    const signOut = async () => {
        try {
            await authSignOut();
        } catch (error) {
            console.warn('Sign-out server error (clearing local session):', error);
        }
        // Force-clear localStorage auth token as fallback
        try {
            const url = import.meta.env.VITE_SUPABASE_URL || '';
            if (url) {
                const projectRef = new URL(url).hostname.split('.')[0];
                localStorage.removeItem(`sb-${projectRef}-auth-token`);
            }
        } catch {
            Object.keys(localStorage)
                .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                .forEach(k => localStorage.removeItem(k));
        }
        setUser(null);
        setSession(null);
    };

    const refreshUser = async () => {
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.error('Error refreshing user:', error);
        }
    };

    const value: AuthContextType = {
        user,
        session,
        isLoggedIn: !!user,
        isLoading,
        isPasswordRecovery,
        clearPasswordRecovery,
        signUp,
        signIn,
        signOut,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
