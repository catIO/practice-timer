import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
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

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const currentSession = await getCurrentSession();
                if (mounted) {
                    setSession(currentSession);
                    setUser(currentSession?.user ?? null);
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
        signUp,
        signIn,
        signOut,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
