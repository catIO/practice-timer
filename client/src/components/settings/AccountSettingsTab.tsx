import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updatePassword, updateDisplayName } from '@/lib/authService';
import { supabase } from '@/lib/supabaseClient';
import { restorePlanFromSnapshot, type ReportSnapshot } from '@/lib/reportShare';
import { practicePlanApi } from '@/lib/practicePlan';
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

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Cache & update state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isRestoringPlan, setIsRestoringPlan] = useState(false);

  const handleDisplayNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisplayNameError(null);
    setDisplayNameSuccess(false);
    setIsUpdatingDisplayName(true);

    try {
      const { error } = await updateDisplayName(displayName.trim());
      if (error) {
        setDisplayNameError(error.message);
      } else {
        setDisplayNameSuccess(true);
        await onRefreshUser();
        toast({
          title: 'Profile Updated',
          description: 'Your display name has been saved.',
        });
      }
    } catch {
      setDisplayNameError('Failed to update display name');
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
        setPasswordError(error.message);
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
      setPasswordError('Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleRestorePlan = async () => {
    if (!supabase) {
      toast({
        title: 'Not available',
        description: 'Database connection not configured.',
        variant: 'destructive',
      });
      return;
    }

    setIsRestoringPlan(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        toast({
          title: 'Not logged in',
          description: 'Please log in to restore.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('shared_reports')
        .select('data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        toast({
          title: 'No report found',
          description: 'No published report found for your account.',
          variant: 'destructive',
        });
        return;
      }

      const snapshot = data.data as ReportSnapshot;
      const restoredPlan = restorePlanFromSnapshot(snapshot);
      practicePlanApi.save(restoredPlan);
      toast({
        title: 'Plan restored',
        description: 'Your practice plan has been restored. Reload to see changes.',
      });
    } catch (e) {
      console.error('[Settings] Restore failed:', e);
      toast({
        title: 'Restore failed',
        description: 'An error occurred while restoring.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoringPlan(false);
    }
  };

  const handleCheckUpdatesAndReload = async () => {
    setIsCheckingUpdate(true);
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.update().catch(() => {});
        }
      }

      toast({
        title: 'Cache cleared',
        description: 'Reloading latest version...',
      });

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Update check failed:', err);
      window.location.reload();
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
          icon="alternate_email"
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
                onChange={(e) => setDisplayName(e.target.value)}
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
              onChange={(e) => setNewPassword(e.target.value)}
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
              onChange={(e) => setConfirmNewPassword(e.target.value)}
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

      {/* Cloud & Device Utilities */}
      <SettingCard
        title="Data & Device Utilities"
        description="Recovery and offline cache maintenance"
        icon="cloud_sync"
      >
        <SettingRow
          label="Data Recovery"
          description="Restore your current practice plan from your most recently published report"
          icon="history"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-white/10"
            onClick={handleRestorePlan}
            disabled={isRestoringPlan}
          >
            {isRestoringPlan ? 'Restoring...' : 'Restore plan from report'}
          </Button>
        </SettingRow>

        <SettingRow
          label="App Updates & Cache"
          description="Clear local PWA cache and reload to fetch the latest application build (useful on iPads and mobile homescreens)"
          icon="cached"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-white/10"
            onClick={handleCheckUpdatesAndReload}
            disabled={isCheckingUpdate}
          >
            <span className="material-icons text-sm mr-1.5">refresh</span>
            {isCheckingUpdate ? 'Updating...' : 'Check for Updates & Reload'}
          </Button>
        </SettingRow>
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
