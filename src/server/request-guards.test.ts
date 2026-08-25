import { describe, expect, it } from 'vitest';
import { validateMutationRequest } from './request-guards';

describe('mutation request guard', () => {
  it('accepts same-origin JSON commands with an idempotency key', () => {
    const request = new Request('https://territorios.example/api/game/support', {
      method: 'POST',
      headers: {
        origin: 'https://territorios.example',
        'content-type': 'application/json',
        'idempotency-key': 'support-018d2f10-47ab-7fa2-81ca-000000000001',
      },
    });

    expect(validateMutationRequest(request)).toEqual({
      ok: true,
      idempotencyKey: 'support-018d2f10-47ab-7fa2-81ca-000000000001',
    });
  });

  it('rejects cross-origin and non-JSON commands', () => {
    expect(
      validateMutationRequest(
        new Request('https://territorios.example/api/game/support', {
          method: 'POST',
          headers: {
            origin: 'https://attacker.example',
            'content-type': 'application/json',
            'idempotency-key': 'valid-enough-key',
          },
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateMutationRequest(
        new Request('https://territorios.example/api/game/support', {
          method: 'POST',
          headers: {
            origin: 'https://territorios.example',
            'content-type': 'text/plain',
            'idempotency-key': 'valid-enough-key',
          },
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects absent, oversized, or malformed idempotency keys', () => {
    for (const key of [null, 'x', 'spaces are invalid', 'x'.repeat(129)]) {
      const headers = new Headers({
        origin: 'https://territorios.example',
        'content-type': 'application/json',
      });
      if (key) headers.set('idempotency-key', key);
      expect(
        validateMutationRequest(
          new Request('https://territorios.example/api/game/support', {
            method: 'POST',
            headers,
          }),
        ).ok,
      ).toBe(false);
    }
  });
});
