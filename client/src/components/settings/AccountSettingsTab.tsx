import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updatePassword, updateDisplayName } from '@/lib/authService';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';

interface AccountSettingsTabProps {
  user: User | null;
  onSignOut: () => Promise<void>;
  onRefreshUser: () => Promise<void>;
}

export function AccountSettingsTab({
  user,
  onSignOut,
  onRefreshUser,
}: AccountSettingsTabProps) {
  const { toast } = useToast();

  // Display Name state
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  );
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // Sync display name when user prop updates
  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || user.user_metadata?.name || '');
    }
  }, [user]);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const formatErrorMessage = (msg?: string | null): string => {
    if (!msg) return 'An unexpected error occurred';
    if (msg.toLowerCase().includes('failed to fetch')) {
      return 'Unable to reach the server. Please check your internet connection or ad blocker.';
    }
    return msg;
  };

  const handleDisplayNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisplayNameError(null);
    setDisplayNameSuccess(false);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setDisplayNameError('Name cannot be empty');
      return;
    }

    const currentName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    if (trimmed === currentName) {
      toast({
        title: 'No changes',
        description: 'Display name is already set to that value.',
      });
      return;
    }

    setIsUpdatingDisplayName(true);

    try {
      const { error } = await updateDisplayName(trimmed);
      if (error) {
        setDisplayNameError(formatErrorMessage(error.message));
      } else {
        setDisplayNameSuccess(true);
        await onRefreshUser();
        toast({
          title: 'Profile Updated',
          description: 'Your display name has been saved.',
        });
      }
    } catch {
      setDisplayNameError('Unable to reach the server. Please check your connection.');
    } finally {
      setIsUpdatingDisplayName(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordError(formatErrorMessage(error.message));
      } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmNewPassword('');
        toast({
          title: 'Password Updated',
          description: 'Your password was changed successfully.',
        });
      }
    } catch {
      setPasswordError('Unable to reach the server. Please check your connection.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Account Profile Card */}
      <SettingCard
        title="Account Profile"
        description="Manage your account email and personal profile details"
        icon="account_circle"
      >
        <SettingRow
          label="Email Address"
          description="Your verified login identifier"
        >
          <span className="text-xs font-mono bg-slate-900/60 border border-white/10 px-3 py-1.5 rounded-lg text-foreground">
            {user?.email || 'Not logged in'}
          </span>
        </SettingRow>

        <div className="pt-4 border-t border-white/5">
          <form onSubmit={handleDisplayNameUpdate} className="space-y-3 max-w-md">
            {displayNameError && (
              <div className="p-3 bg-red-950/20 border border-red-850 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-200">{displayNameError}</p>
              </div>
            )}
            {displayNameSuccess && (
              <div className="p-3 bg-green-950/20 border border-green-850 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-sm text-green-200">Display name updated successfully</p>
              </div>
            )}
            <div>
              <Label htmlFor="display-name" className="text-sm">Display Name</Label>
              <Input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (displayNameError) setDisplayNameError(null);
                  if (displayNameSuccess) setDisplayNameSuccess(false);
                }}
                placeholder="Your name"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isUpdatingDisplayName}
              className="mt-1"
            >
              {isUpdatingDisplayName ? 'Saving...' : 'Update Name'}
            </Button>
          </form>
        </div>
      </SettingCard>

      {/* Security Card */}
      <SettingCard
        title="Security & Password"
        description="Update your credentials to keep your practice data safe"
        icon="lock"
      >
        <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="p-3 bg-red-950/20 border border-red-850 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-200">{passwordError}</p>
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-green-950/20 border border-green-850 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-200">Password updated successfully</p>
            </div>
          )}
          <div>
            <Label htmlFor="new-password" className="text-sm">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordError) setPasswordError(null);
                if (passwordSuccess) setPasswordSuccess(false);
              }}
              placeholder="New password (min 6 characters)"
              className="mt-1"
              required
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="confirm-new-password" className="text-sm">Confirm New Password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(e.target.value);
                if (passwordError) setPasswordError(null);
                if (passwordSuccess) setPasswordSuccess(false);
              }}
              placeholder="Confirm new password"
              className="mt-1"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" size="sm" disabled={isUpdatingPassword}>
            {isUpdatingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </SettingCard>

      {/* Session Card */}
      <div className="pt-2 flex items-center justify-between">
        <Button
          variant="destructive"
          size="sm"
          onClick={onSignOut}
          className="flex items-center gap-2"
        >
          <span className="material-icons text-sm">logout</span>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
