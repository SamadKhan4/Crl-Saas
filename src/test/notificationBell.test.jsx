import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationBell from '../components/layout/NotificationBell';
vi.mock('../api/client', () => ({ get: vi.fn(async () => ({ data: [{ _id: 'n1', subject: 'Shipment delivered', message: 'LR001 delivered', createdAt: '2026-10-12T10:00:00.000Z' }] })), errorMessage: (error) => error.message }));
it('shows a new notification dot, displays notifications and remembers viewing them', async () => {
  localStorage.clear();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><NotificationBell user={{ id: 'admin', role: 'ADMIN' }} /></MemoryRouter></QueryClientProvider>);
  const bell = await screen.findByRole('button', { name: 'Notifications, new notifications' });
  await userEvent.click(bell);
  expect(await screen.findByText('LR001 delivered')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/admin/notifications');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-expanded', 'true'));
  expect(localStorage.getItem('crl-notifications-seen:admin')).toBe('2026-10-12T10:00:00.000Z');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByText('LR001 delivered')).not.toBeInTheDocument();
});
