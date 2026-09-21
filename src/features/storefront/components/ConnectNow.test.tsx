import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectNow } from './ConnectNow';

afterEach(cleanup);
describe('Connect now', () => {
  it('opens the configured portal with no referrer or credentials', () => {
    render(<ConnectNow url="http://10.40.0.1/login" />);
    const link = screen.getByRole('link', { name: 'Connect now' });
    expect(link).toHaveAttribute('href', 'http://10.40.0.1/login');
    expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByText(/Join this business/)).toBeInTheDocument();
  });
  it.each(['', 'javascript:alert(1)', 'https://user:secret@example.com/', 'http://10.40.0.1/login?password=abc'])('omits invalid or missing URL %s', (url) => {
    render(<ConnectNow url={url} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
