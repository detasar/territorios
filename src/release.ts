import packageJson from '../package.json';

declare const __TERRITORIOS_RELEASE_SHA__: string | undefined;

const LOCAL_RELEASE_SHA = 'local-development';
const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;

export type ReleaseMetadata = {
  version: string;
  sha: string;
  shortSha: string;
  channel: 'closed-beta';
  realMoney: false;
};

export function createReleaseMetadata(rawSha?: string): ReleaseMetadata {
  const sha = rawSha?.trim() || LOCAL_RELEASE_SHA;
  if (sha !== LOCAL_RELEASE_SHA && !FULL_GIT_SHA.test(sha)) {
    throw new Error('Release identity requires a full 40-character Git SHA.');
  }
  return {
    version: packageJson.version,
    sha,
    shortSha: sha === LOCAL_RELEASE_SHA ? 'local' : sha.slice(0, 12),
    channel: 'closed-beta',
    realMoney: false,
  };
}

const compiledSha = typeof __TERRITORIOS_RELEASE_SHA__ === 'undefined'
  ? undefined
  : __TERRITORIOS_RELEASE_SHA__;

export const RELEASE_METADATA = createReleaseMetadata(compiledSha);
