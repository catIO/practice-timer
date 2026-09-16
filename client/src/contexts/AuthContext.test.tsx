import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './AuthContext';

const mocks = vi.hoisted(() => ({
  authCallback: undefined as ((event: string, session: Session | null) => void) | undefined,
  unsubscribe: vi.fn(),
  stopSync: vi.fn(),
  cancelSync: vi.fn(),
  pull: vi.fn(),
  getCurrentSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: true }));
vi.mock('../lib/userDataSync', () => ({
  initUserDataSync: () => mocks.stopSync,
  cancelUserDataSync: mocks.cancelSync,
  pullUserDataFromCloud: mocks.pull,
}));
vi.mock('../lib/authService', () => ({
  getCurrentSession: mocks.getCurrentSession,
  getCurrentUser: vi.fn(),
  signIn: mocks.signIn,
  signOut: mocks.signOut,
  signUp: vi.fn(),
  onAuthStateChange: (callback: typeof mocks.authCallback) => {
    mocks.authCallback = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  },
}));

let auth: ReturnType<typeof useAuth>;
function Consumer() {
  auth = useAuth();
  return <div>{auth.isSyncingData ? 'Syncing' : 'Ready'}</div>;
}

const session = (id: string): Session => ({
  access_token: 'test', refresh_token: 'test', expires_in: 3600, token_type: 'bearer',
  user: { id, aud: 'authenticated', created_at: '', app_metadata: {}, user_metadata: {} },
});

describe('Auth sync lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.getCurrentSession.mockReset().mockResolvedValue(null);
    mocks.pull.mockReset().mockResolvedValue(true);
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    mocks.signIn.mockReset();
    localStorage.clear();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  async function mount() {
    const view = render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => {});
    return view;
  }

  it('defers initial-session hydration outside the auth notification callback', async () => {
    await mount();
    act(() => { mocks.authCallback?.('INITIAL_SESSION', session('A')); });
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(screen.getByText('Syncing')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.pull).toHaveBeenCalledOnce();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('hydrates password sign-in only through its auth notification', async () => {
    await mount();
    const signedIn = session('A');
    mocks.signIn.mockImplementation(async () => {
      mocks.authCallback?.('SIGNED_IN', signedIn);
      return { user: signedIn.user, session: signedIn, error: null };
    });
    await act(async () => { await auth.signIn('user@example.com', 'password'); });
    expect(mocks.pull).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.pull).toHaveBeenCalledOnce();
  });

  it('does not cancel deferred sign-in hydration on a token refresh', async () => {
    await mount();
    act(() => {
      mocks.authCallback?.('SIGNED_IN', session('A'));
      mocks.authCallback?.('TOKEN_REFRESHED', session('A'));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.pull).toHaveBeenCalledOnce();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('cancels deferred hydration and sync before requesting sign-out', async () => {
    await mount();
    act(() => { mocks.authCallback?.('SIGNED_IN', session('A')); });
    await act(async () => { await auth.signOut(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.cancelSync).toHaveBeenCalledOnce();
    expect(mocks.cancelSync.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('does not let an old account hydration clear the new account loading state', async () => {
    await mount();
    let finishOld!: (value: boolean) => void;
    let finishNew!: (value: boolean) => void;
    mocks.pull
      .mockReturnValueOnce(new Promise<boolean>((resolve) => { finishOld = resolve; }))
      .mockReturnValueOnce(new Promise<boolean>((resolve) => { finishNew = resolve; }));
    act(() => { mocks.authCallback?.('SIGNED_IN', session('A')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { mocks.authCallback?.('SIGNED_IN', session('B')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { finishOld(true); });
    expect(screen.getByText('Syncing')).toBeInTheDocument();
    await act(async () => { finishNew(true); });
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('cleans up auth and sync listeners and cancels deferred work on unmount', async () => {
    const view = await mount();
    act(() => { mocks.authCallback?.('SIGNED_IN', session('A')); });
    view.unmount();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.stopSync).toHaveBeenCalledOnce();
  });
});