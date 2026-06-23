import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');

function loadYaml(relPath) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  return yaml.load(content);
}

describe('root OpenAPI spec structure', () => {
  const spec = loadYaml('beacon-node-oapi.yaml');

  it('should specify OpenAPI 3.x version', () => {
    expect(spec.openapi).toBeDefined();
    expect(spec.openapi).toMatch(/^3\./);
  });

  it('should have info block with required fields', () => {
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBeDefined();
    expect(typeof spec.info.title).toBe('string');
    expect(spec.info.version).toBeDefined();
    expect(typeof spec.info.version).toBe('string');
  });

  it('should have a license', () => {
    expect(spec.info.license).toBeDefined();
    expect(spec.info.license.name).toBeDefined();
  });

  it('should have a contact', () => {
    expect(spec.info.contact).toBeDefined();
    expect(spec.info.contact.url).toBeDefined();
  });

  it('should define servers', () => {
    expect(spec.servers).toBeDefined();
    expect(Array.isArray(spec.servers)).toBe(true);
    expect(spec.servers.length).toBeGreaterThan(0);
  });

  it('should define tags', () => {
    expect(spec.tags).toBeDefined();
    expect(Array.isArray(spec.tags)).toBe(true);
    expect(spec.tags.length).toBeGreaterThan(0);
  });

  it('each tag should have name and description', () => {
    for (const tag of spec.tags) {
      expect(tag.name, 'Tag missing name').toBeDefined();
      expect(tag.description, `Tag "${tag.name}" missing description`).toBeDefined();
    }
  });

  it('should define components', () => {
    expect(spec.components).toBeDefined();
    expect(spec.components.schemas).toBeDefined();
    expect(spec.components.parameters).toBeDefined();
    expect(spec.components.responses).toBeDefined();
    expect(spec.components.headers).toBeDefined();
  });

  it('should define standard error responses in components', () => {
    const expectedResponses = [
      'InvalidRequest',
      'NotFound',
      'NotAcceptable',
      'UnsupportedMediaType',
      'InternalError',
      'CurrentlySyncing',
    ];
    for (const name of expectedResponses) {
      expect(
        spec.components.responses[name],
        `Missing standard response: ${name}`
      ).toBeDefined();
    }
  });

  it('should define Eth-Consensus-Version header', () => {
    expect(spec.components.headers['Eth-Consensus-Version']).toBeDefined();
    expect(spec.components.headers['Eth-Consensus-Version'].required).toBe(true);
  });
});

describe('API group coverage', () => {
  const spec = loadYaml('beacon-node-oapi.yaml');
  const paths = Object.keys(spec.paths);

  it('should have beacon endpoints', () => {
    const beaconPaths = paths.filter((p) => p.includes('/beacon/'));
    expect(beaconPaths.length).toBeGreaterThan(0);
  });

  it('should have node endpoints', () => {
    const nodePaths = paths.filter((p) => p.includes('/node/'));
    expect(nodePaths.length).toBeGreaterThan(0);
  });

  it('should have config endpoints', () => {
    const configPaths = paths.filter((p) => p.includes('/config/'));
    expect(configPaths.length).toBeGreaterThan(0);
  });

  it('should have validator endpoints', () => {
    const validatorPaths = paths.filter((p) => p.includes('/validator/'));
    expect(validatorPaths.length).toBeGreaterThan(0);
  });

  it('should have debug endpoints', () => {
    const debugPaths = paths.filter((p) => p.includes('/debug/'));
    expect(debugPaths.length).toBeGreaterThan(0);
  });

  it('should have events endpoint', () => {
    const eventPaths = paths.filter((p) => p.includes('/events'));
    expect(eventPaths.length).toBeGreaterThan(0);
  });
});

describe('versioned paths', () => {
  const spec = loadYaml('beacon-node-oapi.yaml');
  const paths = Object.keys(spec.paths);

  it('all paths should include a version (v1, v2, v3)', () => {
    for (const p of paths) {
      expect(p, `Path ${p} missing version segment`).toMatch(/\/v\d+\//);
    }
  });
});
