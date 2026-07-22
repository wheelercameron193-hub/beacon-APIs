import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

const ROOT = path.resolve(import.meta.dirname, '..');
const VALID_PARAM_LOCATIONS = ['query', 'header', 'path', 'cookie'];

function loadYaml(relPath) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  return yaml.load(content);
}

function getApiFiles() {
  return glob.sync('apis/**/*.yaml', {
    cwd: ROOT,
    ignore: ['node_modules/**'],
  });
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

function extractParams(parsed) {
  const params = [];
  for (const method of HTTP_METHODS) {
    if (!parsed[method]?.parameters) continue;
    for (const param of parsed[method].parameters) {
      params.push({ method, param });
    }
  }
  return params;
}

describe('shared parameters (params/index.yaml)', () => {
  const parsed = loadYaml('params/index.yaml');

  it('should define shared parameters', () => {
    expect(parsed).toBeDefined();
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(parsed))('%s should have required fields', (name, param) => {
    expect(param.name, `${name} missing "name"`).toBeDefined();
    expect(param.in, `${name} missing "in"`).toBeDefined();
    expect(
      VALID_PARAM_LOCATIONS,
      `${name} has invalid "in" value: ${param.in}`
    ).toContain(param.in);
  });

  it.each(Object.entries(parsed))('%s should have a schema or $ref', (name, param) => {
    const hasSchema = param.schema !== undefined;
    const hasRef = param['$ref'] !== undefined;
    expect(hasSchema || hasRef, `${name} missing both schema and $ref`).toBe(true);
  });

  it('path parameters should be required', () => {
    for (const [name, param] of Object.entries(parsed)) {
      if (param.in === 'path') {
        expect(param.required, `Path parameter "${name}" must be required`).toBe(true);
      }
    }
  });
});

describe('root spec component parameters', () => {
  const rootSpec = loadYaml('beacon-node-oapi.yaml');

  it('should define component parameters', () => {
    expect(rootSpec.components.parameters).toBeDefined();
    expect(Object.keys(rootSpec.components.parameters).length).toBeGreaterThan(0);
  });

  it('should include StateId and BlockId', () => {
    expect(rootSpec.components.parameters.StateId).toBeDefined();
    expect(rootSpec.components.parameters.BlockId).toBeDefined();
  });
});

describe('inline parameters in API files', () => {
  const apiFiles = getApiFiles();

  for (const file of apiFiles) {
    const parsed = loadYaml(file);
    const params = extractParams(parsed);

    if (params.length === 0) continue;

    describe(`${file}`, () => {
      for (const { method, param } of params) {
        const paramName = param.name || param['$ref'] || 'unknown';

        it(`${method.toUpperCase()} param "${paramName}" should have name and in (or $ref)`, () => {
          if (param['$ref']) return;
          expect(param.name, `Missing name for param in ${method} ${file}`).toBeDefined();
          expect(param.in, `Missing "in" for param "${param.name}" in ${method} ${file}`).toBeDefined();
          expect(VALID_PARAM_LOCATIONS).toContain(param.in);
        });

        it(`${method.toUpperCase()} param "${paramName}" should have schema or content (or $ref)`, () => {
          if (param['$ref']) return;
          const hasSchema = param.schema !== undefined;
          const hasContent = param.content !== undefined;
          expect(
            hasSchema || hasContent,
            `Param "${param.name}" in ${method} ${file} missing schema/content`
          ).toBe(true);
        });

        it(`${method.toUpperCase()} path param "${paramName}" should be required`, () => {
          if (param['$ref']) return;
          if (param.in !== 'path') return;
          expect(
            param.required,
            `Path param "${param.name}" in ${method} ${file} must be required`
          ).toBe(true);
        });
      }
    });
  }
});

describe('path parameters match URL patterns', () => {
  const rootSpec = loadYaml('beacon-node-oapi.yaml');

  for (const [pathKey, pathDef] of Object.entries(rootSpec.paths)) {
    const urlParams = [...pathKey.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (urlParams.length === 0) continue;

    it(`${pathKey} URL params should match referenced file`, () => {
      const refFile = pathDef['$ref'];
      if (!refFile) return;

      const absPath = path.resolve(ROOT, refFile);
      if (!fs.existsSync(absPath)) return;

      const parsed = loadYaml(refFile);

      for (const method of HTTP_METHODS) {
        if (!parsed[method]) continue;
        const methodParams = parsed[method].parameters || [];
        const definedPathParams = methodParams
          .filter((p) => !p['$ref'] && p.in === 'path')
          .map((p) => p.name);
        const refParams = methodParams
          .filter((p) => p['$ref'] || p.name?.startsWith('$'))
          .length;

        if (refParams > 0) continue;

        for (const urlParam of urlParams) {
          expect(
            definedPathParams,
            `${method.toUpperCase()} ${pathKey}: URL param "{${urlParam}}" not defined in parameters`
          ).toContain(urlParam);
        }
      }
    });
  }
});
