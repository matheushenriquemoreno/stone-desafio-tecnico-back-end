import { isIP } from 'node:net';
import type { Request } from 'express';

export const EFFECTIVE_CLIENT_IP_RESOLVER = Symbol('EFFECTIVE_CLIENT_IP_RESOLVER');

export interface EffectiveClientIpResolverPort {
  resolve(request: Request): string;
}

function normalizeIp(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const candidate = value.trim().replace(/^\[|\]$/g, '').toLowerCase();
  const mappedIpv4 = candidate.startsWith('::ffff:')
    ? candidate.slice('::ffff:'.length)
    : candidate;

  return isIP(mappedIpv4) > 0 ? mappedIpv4 : undefined;
}

function headerValues(request: Request): string[] {
  const forwardedFor = request.header('X-Forwarded-For');
  if (forwardedFor !== undefined) {
    return forwardedFor.split(',');
  }

  const singleForwardedIp =
    request.header('X-Real-IP') ?? request.header('CF-Connecting-IP');
  return singleForwardedIp === undefined ? [] : [singleForwardedIp];
}

export class EffectiveClientIpResolver implements EffectiveClientIpResolverPort {
  private readonly trustedProxyIps: ReadonlySet<string>;

  constructor(trustedProxyIps: readonly string[]) {
    this.trustedProxyIps = new Set(
      trustedProxyIps
        .map((ip) => normalizeIp(ip))
        .filter((ip): ip is string => ip !== undefined),
    );
  }

  resolve(request: Request): string {
    const connectionIp = normalizeIp(request.socket.remoteAddress);
    if (connectionIp === undefined || !this.trustedProxyIps.has(connectionIp)) {
      return connectionIp ?? 'unknown';
    }

    const chain = [...headerValues(request), connectionIp]
      .map((ip) => normalizeIp(ip))
      .filter((ip): ip is string => ip !== undefined);

    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const candidate = chain[index];
      if (candidate !== undefined && !this.trustedProxyIps.has(candidate)) {
        return candidate;
      }
    }

    return chain[0] ?? connectionIp;
  }
}
