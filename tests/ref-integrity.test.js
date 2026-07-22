import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

const ROOT = path.resolve(import.meta.dirname, '..');

function getAllYamlFiles() {
  return glob.sync('**/*.yaml', {
    cwd: ROOT,
    ignore: ['node_modules/**', 'dist/**'],
  });
}

function extractRefs(obj, refs = [], jsonPath = '') {
  if (obj === null || obj === undefined) return refs;
  if (typeof obj === 'object') {
    if (obj['$ref'] !== undefined) {
      refs.push({ ref: obj['$ref'], path: jsonPath });
    }
    for (const [key, value] of Object.entries(obj)) {
      extractRefs(value, refs, `${jsonPath}.${key}`);
    }
  }
  return refs;
}

function resolveRefFile(refString, sourceFile) {
  if (refString.startsWith('#/')) return null;
  const [filePart] = refString.split('#');
  if (!filePart) return null;
  const sourceDir = path.dirname(path.join(ROOT, sourceFile));
  return path.resolve(sourceDir, filePart);
}

function resolveRefAnchor(refString, parsedTarget) {
  const hashIdx = refString.indexOf('#');
  if (hashIdx === -1) return true;
  const anchor = refString.substring(hashIdx + 1);
  if (!anchor || anchor === '/') return true;

  const parts = anchor.split('/').filter(Boolean);
  let current = parsedTarget;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    if (!(part in current)) return false;
    current = current[part];
  }
  return true;
}

describe('$ref integrity', () => {
  const yamlFiles = getAllYamlFiles();
  const fileCache = new Map();

  function loadYaml(absPath) {
    if (fileCache.has(absPath)) return fileCache.get(absPath);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const parsed = yaml.load(content);
      fileCache.set(absPath, parsed);
      return parsed;
    } catch {
      fileCache.set(absPath, null);
      return null;
    }
  }

  for (const file of yamlFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    const parsed = yaml.load(content);
    const refs = extractRefs(parsed);

    if (refs.length === 0) continue;

    describe(`${file}`, () => {
      for (const { ref, path: jsonPath } of refs) {
        it(`$ref "${ref}" at ${jsonPath} should resolve`, () => {
          expect(typeof ref).toBe('string');
          expect(ref.length).toBeGreaterThan(0);

          const targetFile = resolveRefFile(ref, file);
          if (targetFile) {
            expect(
              fs.existsSync(targetFile),
              `Referenced file does not exist: ${targetFile}`
            ).toBe(true);

            const targetParsed = loadYaml(targetFile);
            expect(targetParsed, `Failed to parse referenced file: ${targetFile}`).not.toBeNull();

            const anchorResolved = resolveRefAnchor(ref, targetParsed);
            expect(
              anchorResolved,
              `Anchor path not found in ${targetFile} for ref: ${ref}`
            ).toBe(true);
          }
        });
      }
    });
  }
});
