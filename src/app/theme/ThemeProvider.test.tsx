import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { Link, Route } from 'react-router';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/renderPage';
import { AppShell } from '@/app/shell/AppShell';
import { ThemeProvider, useTheme } from './ThemeProvider';

beforeEach(() => {
  localStorage.removeItem('yarotech-ui-theme');
  document.documentElement.classList.remove('dark', 'light');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem('yarotech-ui-theme');
  document.documentElement.classList.remove('dark', 'light');
});

describe('Dashboard-only theme', () => {
  it.each(['workspace', 'platform'] as const)('keeps public navigation light and restores %s preference', async (accent) => {
    localStorage.setItem('yarotech-ui-theme', 'dark');
    const user = userEvent.setup();
    renderPage(
      <AppShell groups={[]} homePath="/dashboard" profilePath={null} accent={accent}
        topBarStart={<Link to="/public">Open public page</Link>} />,
      { path: '/dashboard', route: '/public', extraRoutes:
        <Route path="/public" element={<Link to="/dashboard">Open dashboard</Link>} /> },
    );
    // A direct public visit must ignore a previously saved dark preference.
    expect(document.documentElement).not.toHaveClass('dark');
    await user.click(screen.getByRole('link', { name: 'Open dashboard' }));
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('link', { name: 'Open public page' }));
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('yarotech-ui-theme')).toBe('dark');
    await user.click(screen.getByRole('link', { name: 'Open dashboard' }));
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).toHaveClass('light');
    expect(localStorage.getItem('yarotech-ui-theme')).toBe('light');
  });

  it('clears dark mode on dashboard unmount in Strict Mode', () => {
    localStorage.setItem('yarotech-ui-theme', 'dark');
    const view = render(<StrictMode><ThemeProvider><div>Dashboard</div></ThemeProvider></StrictMode>);
    expect(document.documentElement).toHaveClass('dark');
    view.unmount();
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('still switches theme when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    function Toggle() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('dark')}>Dark</button>;
    }
    render(<ThemeProvider defaultTheme="light"><Toggle /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
  });
});
