import { afterEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router';
import { renderWithProviders } from '@/test/render';
import { PublicRouteMeta } from './PublicRouteMeta';

afterEach(() => vi.restoreAllMocks());

it('updates one description on client navigation and restores the document default on unmount', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const meta = document.createElement('meta');
  meta.name = 'description';
  meta.content = 'Default description';
  document.head.append(meta);
  const { unmount } = renderWithProviders(
    <>
      <PublicRouteMeta />
      <main id="public-content" tabIndex={-1}>
        <Link to="/contact">Contact</Link>
      </main>
    </>,
  );
  expect(meta.content).toContain('Run your Wi-Fi business');
  await userEvent.click(screen.getByRole('link', { name: 'Contact' }));
  expect(meta.content).toContain('Contact Yarotech');
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  unmount();
  expect(meta.content).toBe('Default description');
  meta.remove();
});

it('tolerates a malformed fragment without breaking the page', () => {
  const { unmount } = renderWithProviders(
    <>
      <PublicRouteMeta />
      <h1>Home</h1>
    </>,
    { route: '/#%' },
  );
  expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  unmount();
});
