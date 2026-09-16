import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { AccountSettingsTab } from './AccountSettingsTab';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/authService', () => ({
    updatePassword: vi.fn(),
    updateDisplayName: vi.fn(),
}));

describe('Account settings', () => {
    it('retains account controls without exposing maintenance workarounds', () => {
        const onSignOut = vi.fn().mockResolvedValue(undefined);
        render(<AccountSettingsTab
            user={{
                id: 'test-user',
                email: 'musician@example.com',
                user_metadata: { full_name: 'Musician' },
                app_metadata: {},
                aud: 'authenticated',
                created_at: '2026-09-16T00:00:00Z',
            } satisfies User}
            onSignOut={onSignOut}
            onRefreshUser={vi.fn()}
        />);

        expect(screen.getByText('Account Profile')).toBeInTheDocument();
        expect(screen.getByText('musician@example.com')).toBeInTheDocument();
        expect(screen.getByLabelText('Display Name')).toHaveValue('Musician');
        expect(screen.getByLabelText('New Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update Name' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();
        expect(screen.queryByText('Data & Device Utilities')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /sync now|restore plan|updates.*reload/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
        expect(onSignOut).toHaveBeenCalledOnce();
    });
});