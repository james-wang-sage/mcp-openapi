import fs from 'fs/promises';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ISpecProcessor } from '../interfaces/ISpecProcessor';
import { SpecScanResult } from '../interfaces/ISpecScanner';
import { DefaultSpecScanner } from '../SpecScanner';

// Only mock the processor since we want to test actual file scanning
vi.mock('@apidevtools/json-schema-ref-parser', () => ({
  default: {
    dereference: vi.fn().mockImplementation(async (spec) => spec),
  },
}));

describe('DefaultSpecScanner', () => {
  let specScanner: DefaultSpecScanner;
  let mockSpecProcessor: ISpecProcessor;
  let testDataPath: string;

  beforeEach(() => {
    mockSpecProcessor = {
      process: vi.fn().mockImplementation(async (spec) => spec),
    };
    specScanner = new DefaultSpecScanner(mockSpecProcessor);
    testDataPath = path.join(process.cwd(), 'test/data');
  });

  describe('scan', () => {
    it('should scan all OpenAPI specifications in the test/data directory', async () => {
      // First, get all JSON and YAML files from the directory
      const allFiles = await fs.readdir(testDataPath);
      
      // Verify test files exist
      const invalidFiles = ['invalid.txt', 'invalid.yaml'];
      for (const invalidFile of invalidFiles) {
        expect(allFiles).toContain(invalidFile);
      }

      // Scan the directory using SpecScanner
      const results: SpecScanResult[] = [];
      for await (const result of specScanner.scan(testDataPath)) {
        results.push(result);
      }

      // Verify .txt files are not in results (invalid file type)
      const txtResult = results.find(r => r.filename === 'invalid.txt');
      expect(txtResult, 'Text files should not be processed').toBeUndefined();

      // Invalid YAML should be in results but with error and not processed
      const invalidYamlResult = results.find(r => r.filename === 'invalid.yaml');
      expect(invalidYamlResult).toBeDefined();
      expect(invalidYamlResult?.error).toBeDefined();
      expect(invalidYamlResult?.spec).toEqual({});
      
      // Get valid results (those without errors)
      const validResults = results.filter(r => !r.error);

      // Find and verify the petstore spec (with x-spec-id)
      const petstoreSpec = validResults.find(r => r.filename === 'petstore-swagger2.json');
      expect(petstoreSpec).toBeDefined();
      expect(petstoreSpec?.specId).toBe('petstore-swagger2');
      
      // Verify Swagger 2.0 was converted to OpenAPI 3.0
      const convertedSpec = petstoreSpec?.spec;
      expect(convertedSpec).toHaveProperty('openapi', '3.0.0');
      expect(convertedSpec).not.toHaveProperty('swagger');
      expect(convertedSpec).not.toHaveProperty('definitions');
      expect(convertedSpec).toHaveProperty('components.schemas.Pet');
      
      // Verify the converted spec structure
      expect(convertedSpec?.paths?.['/pets']?.get).toMatchObject({
        operationId: 'findPets',
        responses: {
          '200': {
            description: 'A list of pets.',
            content: expect.any(Object)
          }
        }
      });
      
      // Find and verify the basic API spec (without x-spec-id)
      const basicSpec = validResults.find(r => r.filename === 'basic-api.json');
      expect(basicSpec).toBeDefined();
      expect(basicSpec?.specId).toBe('basic-api.json'); // Should use filename as fallback
      
      // Verify only valid specs were processed
      expect(mockSpecProcessor.process).toHaveBeenCalledTimes(validResults.length);
      
      // Verify processor was not called for invalid specs
      for (const result of results) {
        if (result.error) {
          expect(mockSpecProcessor.process).not.toHaveBeenCalledWith(result.spec);
        }
      }
    });
  });
}); 