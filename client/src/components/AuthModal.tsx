import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resetPassword } from '../lib/authService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertCircle, Mail, Loader2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'signin',
}) => {
    const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const { signUp, signIn } = useAuth();

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError(null);
        setEmailConfirmationSent(false);
        setResetEmailSent(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (mode === 'forgot') {
                const { error } = await resetPassword(email);
                if (error) {
                    setError(error.message);
                } else {
                    setResetEmailSent(true);
                }
            } else if (mode === 'signup') {
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setIsLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters');
                    setIsLoading(false);
                    return;
                }
                const { error, needsEmailConfirmation } = await signUp(email, password);
                if (error) {
                    setError(error.message);
                } else if (needsEmailConfirmation) {
                    setEmailConfirmationSent(true);
                } else {
                    resetForm();
                    onClose();
                }
            } else {
                const { error } = await signIn(email, password);
                if (error) {
                    if (error.message.toLowerCase().includes('email not confirmed')) {
                        setEmailConfirmationSent(true);
                    } else {
                        setError(error.message);
                    }
                } else {
                    resetForm();
                    onClose();
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (newMode: 'signin' | 'signup' | 'forgot') => {
        setMode(newMode);
        setError(null);
        setPassword('');
        setConfirmPassword('');
        setEmailConfirmationSent(false);
        setResetEmailSent(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'forgot' ? 'Reset Password' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </DialogTitle>
                </DialogHeader>

                {emailConfirmationSent ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <Mail className="h-4 w-4 text-green-400" />
                                <p className="text-sm font-medium text-green-200">Check your email</p>
                            </div>
                            <p className="text-sm text-green-300">
                                We've sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
                            </p>
                        </div>
                        <Button variant="outline" className="w-full" onClick={() => { resetForm(); onClose(); }}>
                            Close
                        </Button>
                    </div>
                ) : resetEmailSent ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <Mail className="h-4 w-4 text-blue-400" />
                                <p className="text-sm font-medium text-blue-200">Reset link sent</p>
                            </div>
                            <p className="text-sm text-blue-300">
                                Check <strong>{email}</strong> for a password reset link.
                            </p>
                        </div>
                        <Button variant="outline" className="w-full" onClick={() => { resetForm(); onClose(); }}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        {mode !== 'forgot' && (
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                />
                            </div>
                        )}

                        {mode === 'signup' && (
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {mode === 'forgot' ? 'Send Reset Link' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                        </Button>

                        <div className="flex flex-col items-center gap-2 text-sm">
                            {mode === 'signin' && (
                                <>
                                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => switchMode('forgot')}>
                                        Forgot password?
                                    </button>
                                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => switchMode('signup')}>
                                        Don't have an account? <span className="underline">Sign up</span>
                                    </button>
                                </>
                            )}
                            {mode === 'signup' && (
                                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => switchMode('signin')}>
                                    Already have an account? <span className="underline">Sign in</span>
                                </button>
                            )}
                            {mode === 'forgot' && (
                                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => switchMode('signin')}>
                                    Back to sign in
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};
