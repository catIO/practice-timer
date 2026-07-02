import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { updatePassword } from '@/lib/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
    const navigate = useNavigate();
    const { clearPasswordRecovery } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await updatePassword(password);
            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
                clearPasswordRecovery();
                setTimeout(() => navigate('/'), 2000);
            }
        } catch {
            setError('Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
            <div className="w-full max-w-sm px-4">
                <h1 className="text-2xl font-bold mb-6 text-center">Set New Password</h1>

                {success ? (
                    <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                        <p className="text-green-200">Password updated successfully!</p>
                        <p className="text-sm text-muted-foreground mt-1">Redirecting...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                <p className="text-sm text-red-200">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter new password"
                                required
                                minLength={6}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                required
                                minLength={6}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Updating...' : 'Update Password'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
