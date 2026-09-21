import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TenantLogo } from './TenantLogo';

afterEach(cleanup);
describe('Tenant logo', () => {
  it('has an accessible fallback without a logo', () => {
    render(<TenantLogo name="Saeed" />);
    expect(screen.getByLabelText('Saeed storefront')).toBeInTheDocument();
  });
  it('falls back on a failed image and tries a replacement URL', () => {
    const { rerender } = render(<TenantLogo name="Saeed" url="/logo/one/" />);
    fireEvent.error(screen.getByAltText('Saeed logo'));
    expect(screen.getByLabelText('Saeed storefront')).toBeInTheDocument();
    rerender(<TenantLogo name="Saeed" url="/logo/two/" />);
    expect(screen.getByAltText('Saeed logo')).toHaveAttribute('src', '/logo/two/');
  });
});
