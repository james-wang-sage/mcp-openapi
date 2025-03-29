import fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ISpecProcessor } from '../interfaces/ISpecProcessor';
import { SpecScanResult } from '../interfaces/ISpecScanner';
import { DefaultSpecScanner } from '../SpecScanner';

vi.mock('fs/promises');
vi.mock('@apidevtools/json-schema-ref-parser', () => ({
  default: {
    dereference: vi.fn().mockImplementation(async (spec) => spec),
  },
}));

describe('DefaultSpecScanner', () => {
  let specScanner: DefaultSpecScanner;
  let mockSpecProcessor: ISpecProcessor;

  beforeEach(() => {
    mockSpecProcessor = {
      process: vi.fn().mockImplementation(async (spec) => spec),
    };
    specScanner = new DefaultSpecScanner(mockSpecProcessor);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('scan', () => {
    it('should scan JSON and YAML files in a directory', async () => {
      const mockFiles = ['spec1.json', 'spec2.yaml', 'invalid.txt'];
      const mockSpec = {
        info: {
          'x-spec-id': 'test-spec',
        },
        paths: {},
      };

      // Mock fs.readdir
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);

      // Mock fs.readFile
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        return JSON.stringify(mockSpec);
      });

      const results: SpecScanResult[] = [];
      for await (const result of specScanner.scan('/test/path')) {
        results.push(result);
      }

      expect(results).toHaveLength(2); // Only JSON and YAML files
      expect(results[0].filename).toBe('spec1.json');
      expect(results[0].specId).toBe('test-spec');
      expect(results[1].filename).toBe('spec2.yaml');
      expect(results[1].specId).toBe('test-spec');
    });

    it('should use filename as specId when x-spec-id is not present', async () => {
      const mockFiles = ['spec1.json'];
      const mockSpec = {
        info: {},
        paths: {},
      };

      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      vi.mocked(fs.readFile).mockImplementation(async () => JSON.stringify(mockSpec));

      const results: SpecScanResult[] = [];
      for await (const result of specScanner.scan('/test/path')) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].specId).toBe('spec1.json');
    });
  });
}); 