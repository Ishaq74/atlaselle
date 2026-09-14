import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENTS, isAnalyticsEvent, sanitizeAnalyticsProps } from '@/lib/analytics';

describe('analytics allowlist (TODO §20.3)', () => {
  it('accepts the 10 authorized events only', () => {
    expect(ANALYTICS_EVENTS).toHaveLength(10);
    expect(isAnalyticsEvent('purchase')).toBe(true);
    expect(isAnalyticsEvent('trip_view')).toBe(true);
    expect(isAnalyticsEvent('motivation')).toBe(false);
    expect(isAnalyticsEvent('')).toBe(false);
    expect(isAnalyticsEvent(undefined)).toBe(false);
  });

  it('strips everything but safe props', () => {
    expect(sanitizeAnalyticsProps({ tripId: 'abc', locale: 'fr', motivation: 'x', diet: 'y' })).toEqual({
      tripId: 'abc',
      locale: 'fr',
    });
    expect(sanitizeAnalyticsProps(undefined)).toEqual({});
  });
});
