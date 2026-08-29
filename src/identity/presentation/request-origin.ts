import type { Request } from 'express';
import type { SessionOrigin } from '@/identity/application';

// Absurd-size ceilings only, the same rule DTOs follow: a real user agent is
// a few hundred characters and an IPv6 address is at most 45.
const USER_AGENT_MAX = 1024;
const IP_ADDRESS_MAX = 64;

/**
 * What a login records about where it came from. Trimmed and capped; `null`
 * for absent or blank. `request.ip` is the socket peer until Express's
 * `trust proxy` is configured, so behind a proxy this records the proxy.
 */
export function originOf(request: Request): SessionOrigin {
  return {
    userAgent: bounded(request.headers['user-agent'], USER_AGENT_MAX),
    ipAddress: bounded(request.ip, IP_ADDRESS_MAX),
  };
}

function bounded(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? '';

  return trimmed === '' ? null : trimmed.slice(0, max);
}
