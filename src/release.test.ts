import { describe, expect, it } from 'vitest';
import { createReleaseMetadata } from './release';

describe('createReleaseMetadata', () => {
  it('binds the closed-beta version to a full commit SHA', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    expect(createReleaseMetadata(sha)).toEqual({
      version: '0.2.0-beta.1',
      sha,
      shortSha: '0123456789ab',
      channel: 'closed-beta',
      realMoney: false,
    });
  });

  it('uses an explicit development marker only when no SHA is compiled', () => {
    expect(createReleaseMetadata()).toMatchObject({
      sha: 'local-development',
      shortSha: 'local',
    });
  });

  it('rejects ambiguous release identifiers', () => {
    expect(() => createReleaseMetadata('abc123')).toThrow('40-character Git SHA');
  });
});
