import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

const ROOT = path.resolve(import.meta.dirname, '..');

function loadYaml(relPath) {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  return yaml.load(content);
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

function getOperations(file) {
  const parsed = loadYaml(file);
  const ops = [];
  for (const method of HTTP_METHODS) {
    if (parsed[method]) {
      ops.push({ method, op: parsed[method] });
    }
  }
  return ops;
}

describe('beacon/states endpoints', () => {
  const files = glob.sync('apis/beacon/states/*.yaml', { cwd: ROOT });

  it('should have state endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      it('should have at least one operation', () => {
        expect(ops.length).toBeGreaterThan(0);
      });

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Beacon tag`, () => {
          expect(op.tags).toContain('Beacon');
        });

        it(`${method.toUpperCase()} should have a description`, () => {
          expect(op.description).toBeDefined();
          expect(op.description.length).toBeGreaterThan(0);
        });
      }
    });
  }
});

describe('beacon/blocks endpoints', () => {
  const files = glob.sync('apis/beacon/blocks/*.yaml', { cwd: ROOT });

  it('should have block endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Beacon tag`, () => {
          expect(op.tags).toContain('Beacon');
        });

        it(`${method.toUpperCase()} responses should handle errors`, () => {
          const codes = Object.keys(op.responses).map(Number);
          const hasError = codes.some((c) => c >= 400);
          expect(hasError, `${method.toUpperCase()} in ${file} has no error responses`).toBe(true);
        });
      }
    });
  }
});

describe('beacon/pool endpoints', () => {
  const files = glob.sync('apis/beacon/pool/*.yaml', { cwd: ROOT });

  it('should have pool endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should have operationId`, () => {
          expect(op.operationId).toBeDefined();
        });

        if (method === 'post') {
          it('POST should define a request body or have parameters', () => {
            const hasBody = op.requestBody !== undefined;
            const hasParams = op.parameters !== undefined && op.parameters.length > 0;
            expect(
              hasBody || hasParams,
              `POST in ${file} has no requestBody or parameters`
            ).toBe(true);
          });
        }
      }
    });
  }
});

describe('node endpoints', () => {
  const files = glob.sync('apis/node/*.yaml', { cwd: ROOT });

  it('should have node endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Node tag`, () => {
          expect(op.tags).toContain('Node');
        });
      }
    });
  }
});

describe('config endpoints', () => {
  const files = glob.sync('apis/config/*.yaml', { cwd: ROOT });

  it('should have all three config endpoints', () => {
    const names = files.map((f) => path.basename(f, '.yaml'));
    expect(names).toContain('fork_schedule');
    expect(names).toContain('spec');
    expect(names).toContain('deposit_contract');
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Config tag`, () => {
          expect(op.tags).toContain('Config');
        });

        it(`${method.toUpperCase()} should have 200 response`, () => {
          expect(op.responses['200']).toBeDefined();
        });
      }
    });
  }
});

describe('validator endpoints', () => {
  const files = glob.sync('apis/validator/**/*.yaml', { cwd: ROOT });

  it('should have validator endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Validator or ValidatorRequiredApi tag`, () => {
          const hasTag = op.tags.includes('Validator') || op.tags.includes('ValidatorRequiredApi');
          expect(hasTag, `${file} ${method} missing Validator/ValidatorRequiredApi tag`).toBe(true);
        });
      }
    });
  }
});

describe('debug endpoints', () => {
  const files = glob.sync('apis/debug/*.yaml', { cwd: ROOT });

  it('should have debug endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Debug tag`, () => {
          expect(op.tags).toContain('Debug');
        });
      }
    });
  }
});

describe('events endpoint', () => {
  const file = 'apis/eventstream/index.yaml';

  it('should exist', () => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
  });

  it('should define SSE event topics', () => {
    const parsed = loadYaml(file);
    expect(parsed.get).toBeDefined();
    const topicsParam = parsed.get.parameters.find((p) => p.name === 'topics');
    expect(topicsParam).toBeDefined();
    expect(topicsParam.schema.items.enum).toBeDefined();
    expect(topicsParam.schema.items.enum.length).toBeGreaterThan(0);
  });

  it('should include key event types', () => {
    const parsed = loadYaml(file);
    const topics = parsed.get.parameters.find((p) => p.name === 'topics').schema.items.enum;
    const expectedTopics = ['head', 'block', 'attestation', 'voluntary_exit', 'finalized_checkpoint'];
    for (const topic of expectedTopics) {
      expect(topics, `Missing event topic: ${topic}`).toContain(topic);
    }
  });

  it('should return text/event-stream content', () => {
    const parsed = loadYaml(file);
    expect(parsed.get.responses['200'].content['text/event-stream']).toBeDefined();
  });
});

describe('rewards endpoints', () => {
  const files = glob.sync('apis/beacon/rewards/*.yaml', { cwd: ROOT });

  it('should have rewards endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const ops = getOperations(file);

      for (const { method, op } of ops) {
        it(`${method.toUpperCase()} should include Rewards tag`, () => {
          expect(op.tags).toContain('Rewards');
        });
      }
    });
  }
});

describe('light client endpoints', () => {
  const files = glob.sync('apis/beacon/light_client/*.yaml', { cwd: ROOT });

  it('should have light client endpoints', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should include bootstrap, updates, finality, and optimistic endpoints', () => {
    const names = files.map((f) => path.basename(f, '.yaml'));
    expect(names).toContain('bootstrap');
    expect(names).toContain('updates');
    expect(names).toContain('finality_update');
    expect(names).toContain('optimistic_update');
  });
});
