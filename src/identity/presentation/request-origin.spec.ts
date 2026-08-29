import type { Request } from 'express';
import { originOf } from './request-origin';

const requestWith = (
  headers: Record<string, string>,
  ip: string | undefined,
): Request => ({ headers, ip }) as unknown as Request;

describe('originOf', () => {
  it('reads and trims the user agent and the peer address', () => {
    expect(
      originOf(requestWith({ 'user-agent': '  Firefox/142 ' }, '10.0.0.1')),
    ).toEqual({ userAgent: 'Firefox/142', ipAddress: '10.0.0.1' });
  });

  it('spells absence as null, including a blank header', () => {
    expect(originOf(requestWith({ 'user-agent': '   ' }, undefined))).toEqual({
      userAgent: null,
      ipAddress: null,
    });
  });

  it('caps both values at an absurd-size ceiling', () => {
    const origin = originOf(
      requestWith({ 'user-agent': 'a'.repeat(5000) }, 'b'.repeat(500)),
    );

    expect(origin.userAgent).toHaveLength(1024);
    expect(origin.ipAddress).toHaveLength(64);
  });
});
