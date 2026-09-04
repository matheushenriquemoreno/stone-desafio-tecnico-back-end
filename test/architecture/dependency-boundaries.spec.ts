import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = join(__dirname, '..', '..');
const innerLayerDirectories = [
  'src/shared/domain',
  'src/shared/application',
  'src/modules',
].map((directory) => join(projectRoot, directory));
const forbiddenImportPatterns = [
  /(?:from|import\s*\()\s*['"]@nestjs\//,
  /(?:from|import\s*\()\s*['"]@aws-sdk\//,
  /(?:from|import\s*\()\s*['"]aws-sdk['"]/,
  /(?:from|import\s*\()\s*['"](?:jsonwebtoken|jose|passport(?:-[^'"]*)?)['"]/,
  /(?:from|import\s*\()\s*['"](?:express|fastify|node:(?:http|https|net))['"]/,
];

function collectTypeScriptFiles(directory: string): string[] {
  if (!statExists(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTypeScriptFiles(entryPath);
    }

    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

function statExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

describe('inner-layer dependency boundaries', () => {
  it('does not import framework, transport, persistence or JWT details', () => {
    const sourceFiles = innerLayerDirectories.flatMap(collectTypeScriptFiles);
    const violations = sourceFiles.flatMap((sourceFile) => {
      const source = readFileSync(sourceFile, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some((pattern) =>
        pattern.test(source),
      );

      return hasForbiddenImport ? [relative(projectRoot, sourceFile)] : [];
    });

    expect(violations).toEqual([]);
  });
});
