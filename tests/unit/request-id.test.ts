import { describe, expect, it } from 'vitest';
import { getRequestId, newRequestId, withRequestId } from '@/lib/request-id';

describe('newRequestId', () => {
  it('generates unique opaque ids', () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).toBeTypeOf('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('generates UUID format', () => {
    expect(newRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('getRequestId', () => {
  it('reads requestId from locals', () => {
    expect(getRequestId({ requestId: 'abc' })).toBe('abc');
  });

  it('returns null for missing, empty or invalid locals', () => {
    expect(getRequestId(undefined)).toBeNull();
    expect(getRequestId(null)).toBeNull();
    expect(getRequestId({})).toBeNull();
    expect(getRequestId({ requestId: '' })).toBeNull();
    expect(getRequestId({ requestId: null })).toBeNull();
  });
});

describe('withRequestId', () => {
  it('prefixes messages with the request id', () => {
    expect(withRequestId('abc', 'hello')).toBe('[req:abc] hello');
  });

  it('returns the message unchanged without id', () => {
    expect(withRequestId(null, 'hello')).toBe('hello');
    expect(withRequestId(undefined, 'hello')).toBe('hello');
  });
});
