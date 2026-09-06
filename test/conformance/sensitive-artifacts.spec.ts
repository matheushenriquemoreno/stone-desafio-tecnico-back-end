import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenSentinels = [
  'senha-super-secreta',
  '$argon2id$test$',
  'eyJhbGciOiJIUzI1Ni',
];

function productionSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionSourceFiles(path);
    }

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

function assertDoesNotContainSentinel(path: string): void {
  const content = readFileSync(path, 'utf8');
  for (const sentinel of forbiddenSentinels) {
    expect(content).not.toContain(sentinel);
  }
}

describe('sensitive artifact audit', () => {
  it('finds no test secret, password hash or JWT sentinel in production source', () => {
    for (const path of productionSourceFiles('src')) {
      assertDoesNotContainSentinel(path);
    }
  });

  it('keeps the environment example explicitly placeholder-only', () => {
    const environmentExample = readFileSync('.env.example', 'utf8');

    expect(environmentExample).toContain(
      'JWT_SECRET=replace-me-with-a-random-32-byte-secret-value',
    );
    expect(environmentExample).not.toContain('senha-super-secreta');
    expect(environmentExample).not.toContain('eyJhbGciOiJIUzI1Ni');
  });

  it('scans generated runtime artifacts when the audit directory is provided', () => {
    const artifactDirectory = process.env.CONFORMANCE_ARTIFACTS_DIR;
    if (artifactDirectory === undefined || !existsSync(artifactDirectory)) {
      return;
    }

    const paths = readdirSync(artifactDirectory).map((entry) =>
      join(artifactDirectory, entry),
    );
    for (const path of paths) {
      if (statSync(path).isFile()) {
        assertDoesNotContainSentinel(path);
      }
    }
  });
});
