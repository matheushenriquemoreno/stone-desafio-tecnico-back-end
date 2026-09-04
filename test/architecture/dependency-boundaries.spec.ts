import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const sharedInnerLayerDirectories = ['src/shared/domain', 'src/shared/application'].map(
  (directory) => join(projectRoot, directory),
);
const modulesDirectory = join(projectRoot, 'src/modules');
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

function collectModuleInnerLayerFiles(directory: string): string[] {
  if (!statExists(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (!entry.isDirectory()) {
      return [];
    }

    if (entry.name === 'domain' || entry.name === 'application') {
      return collectTypeScriptFiles(entryPath);
    }

    return collectModuleInnerLayerFiles(entryPath);
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
    const sourceFiles = [
      ...sharedInnerLayerDirectories.flatMap(collectTypeScriptFiles),
      ...collectModuleInnerLayerFiles(modulesDirectory),
    ];
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
