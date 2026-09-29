const identityKeys = new Set([
  'id', 'ids', 'uuid', 'uuids', 'pk', 'tenant', 'user', 'actor', 'agent',
  'voucher', 'plan', 'router', 'payment', 'order', 'customer', 'membership',
  'resource', 'resource_key',
]);

/** Presentation only: preserve the original audit record and its internal links. */
export function visibleAuditDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(details).flatMap(([key, value]) => {
    const normalized = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    if (identityKeys.has(normalized) || /_(ids?|uuids?|pk)$/.test(normalized)) return [];
    const clean = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(clean);
      if (item !== null && typeof item === 'object') {
        return visibleAuditDetails(item as Record<string, unknown>);
      }
      return item;
    };
    return [[key, clean(value)]];
  }));
}
