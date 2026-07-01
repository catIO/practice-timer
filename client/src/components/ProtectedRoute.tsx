import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { Lock } from 'lucide-react';
import { Button } from './ui/button';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isLoggedIn, isLoading } = useAuth();
    const [showAuth, setShowAuth] = useState(false);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
                <div className="text-center max-w-sm px-4">
                    <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
                    <p className="text-muted-foreground mb-6">
                        Create a free account to access the Repertoire Manager and track your pieces.
                    </p>
                    <div className="flex flex-col gap-2">
                        <Button onClick={() => setShowAuth(true)}>Sign In</Button>
                        <Button variant="outline" onClick={() => setShowAuth(true)}>Create Account</Button>
                    </div>
                    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
