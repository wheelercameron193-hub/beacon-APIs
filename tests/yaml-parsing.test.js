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

describe('YAML parsing validity', () => {
  const yamlFiles = getAllYamlFiles();

  it('should find YAML files in the repo', () => {
    expect(yamlFiles.length).toBeGreaterThan(0);
  });

  describe.each(yamlFiles)('%s', (file) => {
    it('should parse as valid YAML', () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      expect(() => yaml.load(content)).not.toThrow();
    });

    it('should not be empty', () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      const parsed = yaml.load(content);
      expect(parsed).not.toBeNull();
      expect(parsed).not.toBeUndefined();
    });

    it('should contain only valid YAML data types (no functions or undefined)', () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA || undefined });
      expect(parsed).toBeDefined();
    });
  });
});
