import type { Request } from 'express';

import {
  EffectiveClientIpResolver,
  type EffectiveClientIpResolverPort,
} from './effective-client-ip';

function requestDouble(
  remoteAddress: string,
  headers: Record<string, string> = {},
): Request {
  return {
    header(name: string): string | undefined {
      return headers[name.toLowerCase()];
    },
    socket: { remoteAddress },
  } as unknown as Request;
}

function resolve(
  resolver: EffectiveClientIpResolverPort,
  remoteAddress: string,
  headers?: Record<string, string>,
): string {
  return resolver.resolve(requestDouble(remoteAddress, headers));
}

describe('EffectiveClientIpResolver', () => {
  it('ignores forged forwarding headers on a direct connection', () => {
    const resolver = new EffectiveClientIpResolver([]);

    expect(
      resolve(resolver, '198.51.100.10', {
        'x-forwarded-for': '203.0.113.44',
        'x-real-ip': '203.0.113.45',
        'cf-connecting-ip': '203.0.113.46',
      }),
    ).toBe('198.51.100.10');
  });

  it('uses the client address when the immediate proxy is trusted', () => {
    const resolver = new EffectiveClientIpResolver(['10.0.0.1']);

    expect(
      resolve(resolver, '10.0.0.1', {
        'x-forwarded-for': '203.0.113.44',
      }),
    ).toBe('203.0.113.44');
  });

  it('walks a trusted proxy chain from right to left', () => {
    const resolver = new EffectiveClientIpResolver(['10.0.0.1', '10.0.0.2']);

    expect(
      resolve(resolver, '10.0.0.2', {
        'x-forwarded-for': '203.0.113.44, 10.0.0.1',
      }),
    ).toBe('203.0.113.44');
  });

  it('supports the single-address proxy headers only inside a trusted chain', () => {
    const resolver = new EffectiveClientIpResolver(['::1']);

    expect(
      resolve(resolver, '::1', {
        'cf-connecting-ip': '203.0.113.44',
      }),
    ).toBe('203.0.113.44');
  });

  it('normalizes IPv4-mapped IPv6 connection addresses', () => {
    const resolver = new EffectiveClientIpResolver(['127.0.0.1']);

    expect(
      resolve(resolver, '::ffff:127.0.0.1', {
        'x-forwarded-for': '203.0.113.44',
      }),
    ).toBe('203.0.113.44');
  });

  it('falls back to the trusted connection when forwarded values are invalid', () => {
    const resolver = new EffectiveClientIpResolver(['10.0.0.1']);

    expect(
      resolve(resolver, '10.0.0.1', {
        'x-forwarded-for': 'not-an-ip',
      }),
    ).toBe('10.0.0.1');
  });
});
