import { describe, it, expect } from 'vitest';
import { hasStatus } from '../../subscription/utils/subscriptionStatus';

describe('hasStatus', () => {
  it('matches the backend upper-case enum value', () => {
    expect(hasStatus('PENDING', 'PENDING')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(hasStatus('pending', 'PENDING')).toBe(true);
    expect(hasStatus('Active', 'ACTIVE')).toBe(true);
  });

  it('does not match a different status', () => {
    expect(hasStatus('ACTIVE', 'PENDING')).toBe(false);
  });

  it('treats a missing status as no match', () => {
    expect(hasStatus(undefined, 'PENDING')).toBe(false);
    expect(hasStatus(null, 'PENDING')).toBe(false);
    expect(hasStatus('', 'PENDING')).toBe(false);
  });
});
