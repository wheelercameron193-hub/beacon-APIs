import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

const ROOT = path.resolve(import.meta.dirname, '..');
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
const VALID_TAGS = ['Beacon', 'Config', 'Debug', 'Events', 'Node', 'Validator', 'ValidatorRequiredApi', 'Rewards'];

function getApiFiles() {
  return glob.sync('apis/**/*.yaml', {
    cwd: ROOT,
    ignore: ['node_modules/**'],
  });
}

function loadYaml(relPath) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  return yaml.load(content);
}

describe('API endpoint structure', () => {
  const apiFiles = getApiFiles();

  it('should find API files', () => {
    expect(apiFiles.length).toBeGreaterThan(0);
  });

  describe('root spec paths', () => {
    const rootSpec = loadYaml('beacon-node-oapi.yaml');

    it('should define paths', () => {
      expect(rootSpec.paths).toBeDefined();
      expect(Object.keys(rootSpec.paths).length).toBeGreaterThan(0);
    });

    it('all paths should start with /eth/', () => {
      for (const pathKey of Object.keys(rootSpec.paths)) {
        expect(pathKey).toMatch(/^\/eth\//);
      }
    });

    it('all paths should use $ref to external files', () => {
      for (const [pathKey, pathDef] of Object.entries(rootSpec.paths)) {
        expect(pathDef['$ref'], `Path ${pathKey} should use $ref`).toBeDefined();
      }
    });

    it('should have no duplicate paths', () => {
      const pathKeys = Object.keys(rootSpec.paths);
      const unique = new Set(pathKeys);
      expect(pathKeys.length).toBe(unique.size);
    });
  });

  describe.each(apiFiles)('%s', (file) => {
    const parsed = loadYaml(file);

    it('should define at least one HTTP method', () => {
      const methods = Object.keys(parsed).filter((k) => HTTP_METHODS.includes(k));
      expect(methods.length, `No HTTP methods found in ${file}`).toBeGreaterThan(0);
    });

    it('each method should have an operationId', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        expect(
          parsed[method].operationId,
          `${method.toUpperCase()} in ${file} missing operationId`
        ).toBeDefined();
        expect(typeof parsed[method].operationId).toBe('string');
        expect(parsed[method].operationId.length).toBeGreaterThan(0);
      }
    });

    it('each method should have tags', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        expect(
          parsed[method].tags,
          `${method.toUpperCase()} in ${file} missing tags`
        ).toBeDefined();
        expect(Array.isArray(parsed[method].tags)).toBe(true);
        expect(parsed[method].tags.length).toBeGreaterThan(0);
      }
    });

    it('tags should be from the defined set', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        for (const tag of parsed[method].tags) {
          expect(
            VALID_TAGS,
            `Unknown tag "${tag}" in ${method.toUpperCase()} ${file}`
          ).toContain(tag);
        }
      }
    });

    it('each method should have a summary', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        expect(
          parsed[method].summary,
          `${method.toUpperCase()} in ${file} missing summary`
        ).toBeDefined();
        expect(typeof parsed[method].summary).toBe('string');
      }
    });

    it('each method should have responses', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        expect(
          parsed[method].responses,
          `${method.toUpperCase()} in ${file} missing responses`
        ).toBeDefined();
        expect(Object.keys(parsed[method].responses).length).toBeGreaterThan(0);
      }
    });

    it('response codes should be valid HTTP status codes', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        for (const code of Object.keys(parsed[method].responses)) {
          const numCode = parseInt(code, 10);
          expect(
            numCode,
            `Invalid response code "${code}" in ${method.toUpperCase()} ${file}`
          ).toBeGreaterThanOrEqual(100);
          expect(numCode).toBeLessThanOrEqual(599);
        }
      }
    });

    it('should include a success response (2xx)', () => {
      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        const codes = Object.keys(parsed[method].responses).map((c) => parseInt(c, 10));
        const has2xx = codes.some((c) => c >= 200 && c < 300);
        expect(
          has2xx,
          `${method.toUpperCase()} in ${file} has no 2xx success response`
        ).toBe(true);
      }
    });
  });
});

describe('operationId uniqueness', () => {
  const apiFiles = getApiFiles();
  const operationIds = [];

  for (const file of apiFiles) {
    const parsed = loadYaml(file);
    for (const method of HTTP_METHODS) {
      if (parsed[method]?.operationId) {
        operationIds.push({
          id: parsed[method].operationId,
          file,
          method,
        });
      }
    }
  }

  it('all operationIds should be unique across the entire API', () => {
    const seen = new Map();
    const duplicates = [];
    for (const { id, file, method } of operationIds) {
      if (seen.has(id)) {
        duplicates.push(`"${id}" in ${method} ${file} (also in ${seen.get(id)})`);
      }
      seen.set(id, `${method} ${file}`);
    }
    expect(duplicates, `Duplicate operationIds: ${duplicates.join(', ')}`).toHaveLength(0);
  });
});
