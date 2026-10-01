import RoutersPage from './RoutersPage';

/**
 * Backwards-compatible entry for `/routers/new`.
 *
 * The standalone full-page form was refactored into `AddRouterDialog` rendered
 * over the fleet (`RoutersPage`). This wrapper keeps the historical import path
 * working without maintaining a second divergent form implementation.
 */
export default function SelfServiceRouterPage() {
  return <RoutersPage />;
}
