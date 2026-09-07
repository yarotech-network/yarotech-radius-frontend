import { describe, expect, it } from 'vitest';
import { AGENT_NAV, PLATFORM_NAV, WORKSPACE_NAV } from './navConfig';
import { prefetchRoute, QUERY_ROUTE_PATHS, ROUTE_CHUNK_PATHS } from './prefetch';
import { queryPrefetchers } from './routeQueries';
import { http, HttpResponse } from 'msw';
import { waitFor } from '@testing-library/react';
import { server } from '@/test/server';
import { API } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';

describe('navigation prefetch registry (phase 9)', () => {
  it('does not preload session data before the dashboard checks session permission', async () => {
    let statsCalls = 0;
    let liveCalls = 0;
    server.use(
      http.get(`${API}/dashboard/stats/`, () => {
        statsCalls++;
        return HttpResponse.json({});
      }),
      http.get(`${API}/dashboard/live-users/`, () => {
        liveCalls++;
        return HttpResponse.json({});
      }),
    );
    const client = createTestQueryClient();
    queryPrefetchers['/dashboard']?.(client);
    await waitFor(() => {
      expect(statsCalls).toBe(1);
      expect(client.isFetching()).toBe(0);
    });
    expect(liveCalls).toBe(0);
    client.clear();
  });
  it('covers every primary nav destination with a route chunk loader', () => {
    const navPaths = [
      ...[...WORKSPACE_NAV, ...PLATFORM_NAV].flatMap((group) => group.items.map((i) => i.to)),
      ...AGENT_NAV.map((i) => i.to),
    ];
    for (const path of navPaths) expect(ROUTE_CHUNK_PATHS).toContain(path);
  });

  it('has a query prefetcher for every queried route and vice versa', () => {
    for (const path of QUERY_ROUTE_PATHS) expect(queryPrefetchers).toHaveProperty(path);
    for (const key of Object.keys(queryPrefetchers)) expect(QUERY_ROUTE_PATHS).toContain(key);
  });

  it('only queries top routes that also have a chunk loader', () => {
    for (const path of QUERY_ROUTE_PATHS) expect(ROUTE_CHUNK_PATHS).toContain(path);
  });

  it('prefetches a chunk without a client and never throws', () => {
    expect(() => prefetchRoute('/plans')).not.toThrow();
    expect(() => prefetchRoute('/not-a-route')).not.toThrow();
  });
});
