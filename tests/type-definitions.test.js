import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

const ROOT = path.resolve(import.meta.dirname, '..');
const VALID_OPENAPI_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];

function getTypeFiles() {
  return glob.sync('types/**/*.yaml', {
    cwd: ROOT,
    ignore: ['node_modules/**'],
  });
}

function loadYaml(relPath) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  return yaml.load(content);
}

function collectSchemas(obj, schemas = [], prefix = '') {
  if (obj === null || obj === undefined || typeof obj !== 'object') return schemas;
  if (obj.type || obj['$ref'] || obj.allOf || obj.anyOf || obj.oneOf) {
    schemas.push({ path: prefix, schema: obj });
  }
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      collectSchemas(value, schemas, prefix ? `${prefix}.${key}` : key);
    }
  }
  return schemas;
}

describe('type definitions', () => {
  const typeFiles = getTypeFiles();

  it('should find type files', () => {
    expect(typeFiles.length).toBeGreaterThan(0);
  });

  describe('root spec components/schemas', () => {
    const rootSpec = loadYaml('beacon-node-oapi.yaml');

    it('should define components.schemas', () => {
      expect(rootSpec.components).toBeDefined();
      expect(rootSpec.components.schemas).toBeDefined();
      expect(Object.keys(rootSpec.components.schemas).length).toBeGreaterThan(0);
    });

    it('all component schemas should use $ref', () => {
      for (const [name, schema] of Object.entries(rootSpec.components.schemas)) {
        if (schema['$ref']) continue;
        if (schema.type) continue;
        expect.unreachable(`Schema "${name}" has neither $ref nor type`);
      }
    });
  });

  describe.each(typeFiles)('%s', (file) => {
    const parsed = loadYaml(file);

    it('should define at least one type', () => {
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
      expect(Object.keys(parsed).length).toBeGreaterThan(0);
    });

    it('object types should have required fields listed', () => {
      const schemas = collectSchemas(parsed);
      for (const { path: schemaPath, schema } of schemas) {
        if (schema.type !== 'object' || !schema.properties) continue;
        const propCount = Object.keys(schema.properties).length;
        if (propCount > 0 && !schemaPath.includes('properties.')) {
          expect(
            schema.required,
            `Object at "${schemaPath}" in ${file} has properties but no required field`
          ).toBeDefined();
        }
      }
    });

    it('schemas with type should use valid OpenAPI types', () => {
      const schemas = collectSchemas(parsed);
      for (const { path: schemaPath, schema } of schemas) {
        if (!schema.type) continue;
        expect(
          VALID_OPENAPI_TYPES,
          `Invalid type "${schema.type}" at "${schemaPath}" in ${file}`
        ).toContain(schema.type);
      }
    });

    it('array types should have items defined', () => {
      const schemas = collectSchemas(parsed);
      for (const { path: schemaPath, schema } of schemas) {
        if (schema.type !== 'array') continue;
        expect(
          schema.items,
          `Array at "${schemaPath}" in ${file} missing items`
        ).toBeDefined();
      }
    });
  });
});

describe('primitive types', () => {
  const parsed = loadYaml('types/primitive.yaml');

  it('should define core primitives', () => {
    const expected = ['Pubkey', 'Root', 'Signature', 'Uint64', 'Uint256'];
    for (const name of expected) {
      expect(parsed[name], `Missing primitive type: ${name}`).toBeDefined();
    }
  });

  it('hex-formatted strings should have a pattern', () => {
    for (const [name, schema] of Object.entries(parsed)) {
      if (schema.format === 'hex') {
        expect(
          schema.pattern,
          `Hex type "${name}" should have a regex pattern`
        ).toBeDefined();
        expect(schema.pattern).toMatch(/^\^0x/);
      }
    }
  });

  it('hex patterns should be valid regexes', () => {
    for (const [name, schema] of Object.entries(parsed)) {
      if (!schema.pattern) continue;
      expect(() => new RegExp(schema.pattern), `Invalid regex for "${name}"`).not.toThrow();
    }
  });

  it('hex types with examples should match their patterns', () => {
    for (const [name, schema] of Object.entries(parsed)) {
      if (!schema.pattern || !schema.example) continue;
      if (schema['$ref']) continue;
      const re = new RegExp(schema.pattern);
      expect(
        re.test(schema.example),
        `Example for "${name}" does not match pattern ${schema.pattern}: ${schema.example}`
      ).toBe(true);
    }
  });
});

describe('consensus version types', () => {
  const rootSpec = loadYaml('beacon-node-oapi.yaml');

  it('should define ConsensusVersion enum', () => {
    const cv = rootSpec.components.schemas.ConsensusVersion;
    expect(cv).toBeDefined();
    expect(cv.type).toBe('string');
    expect(cv.enum).toBeDefined();
    expect(Array.isArray(cv.enum)).toBe(true);
  });

  it('ConsensusVersion should include all known forks', () => {
    const cv = rootSpec.components.schemas.ConsensusVersion;
    const expectedForks = ['phase0', 'altair', 'bellatrix', 'capella', 'deneb', 'electra'];
    for (const fork of expectedForks) {
      expect(cv.enum, `Missing fork "${fork}" in ConsensusVersion`).toContain(fork);
    }
  });
});

describe('fork-specific type directories', () => {
  const expectedForkDirs = ['phase0', 'altair', 'bellatrix', 'capella', 'deneb', 'electra', 'fulu', 'gloas'];

  it.each(expectedForkDirs)('types/%s directory should exist', (fork) => {
    const dirPath = path.join(ROOT, 'types', fork);
    expect(fs.existsSync(dirPath), `Missing types directory for fork: ${fork}`).toBe(true);
  });

  it.each(expectedForkDirs)('types/%s should contain at least one YAML file', (fork) => {
    const files = glob.sync(`types/${fork}/*.yaml`, { cwd: ROOT });
    expect(files.length, `No YAML files in types/${fork}`).toBeGreaterThan(0);
  });
});

describe('http types', () => {
  const parsed = loadYaml('types/http.yaml');

  it('should define standard error responses', () => {
    const expectedResponses = [
      'InvalidRequest',
      'InternalError',
      'NotFound',
      'NotAcceptable',
      'UnsupportedMediaType',
      'CurrentlySyncing',
    ];
    for (const name of expectedResponses) {
      expect(parsed[name], `Missing HTTP response type: ${name}`).toBeDefined();
    }
  });

  it('should define ErrorMessage schema', () => {
    expect(parsed.ErrorMessage).toBeDefined();
    expect(parsed.ErrorMessage.type).toBe('object');
    expect(parsed.ErrorMessage.required).toContain('code');
    expect(parsed.ErrorMessage.required).toContain('message');
  });

  it('should define IndexedErrorMessage schema', () => {
    expect(parsed.IndexedErrorMessage).toBeDefined();
    expect(parsed.IndexedErrorMessage.type).toBe('object');
    expect(parsed.IndexedErrorMessage.required).toContain('failures');
  });
});
