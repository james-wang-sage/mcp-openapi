import { OpenAPIV3 } from 'openapi-types';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ConsoleLogger } from '../Logger';
import { DefaultSpecProcessor } from '../SpecProcessor';
import { DefaultSpecScanner } from '../SpecScanner';

/**
 * Interface representing an API endpoint
 */
interface ApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  specId: string;
}

/**
 * Process an operation and create an endpoint object
 */
function createEndpointFromOperation(
  path: string,
  method: string,
  operation: OpenAPIV3.OperationObject,
  specId: string
): ApiEndpoint {
  return {
    path,
    method,
    operationId: operation.operationId,
    summary: operation.summary,
    description: operation.description,
    specId
  };
}

/**
 * Extract endpoints from a single OpenAPI specification
 */
function extractEndpointsFromSpec(spec: OpenAPIV3.Document, specId: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

  // Iterate through all paths in the spec
  Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
    // Skip if pathItem is not defined or is a reference
    if (!pathItem || '$ref' in pathItem) return;

    // Check each HTTP method in the path
    methods.forEach(method => {
      const operation = pathItem[method as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;
      if (operation) {
        endpoints.push(createEndpointFromOperation(path, method, operation, specId));
      }
    });
  });

  return endpoints;
}

/**
 * Lists all endpoints defined in OpenAPI specifications in a directory
 * @param dirPath Path to the directory containing OpenAPI specifications
 * @returns Array of API endpoints
 */
async function listEndpoints(dirPath: string): Promise<ApiEndpoint[]> {
  const logger = new ConsoleLogger();
  logger.info(`Scanning directory: ${dirPath}`);

  // Create scanner and processor
  const specProcessor = new DefaultSpecProcessor();
  const specScanner = new DefaultSpecScanner(specProcessor);
  const endpoints: ApiEndpoint[] = [];

  try {
    // Scan the directory for OpenAPI specifications
    for await (const result of specScanner.scan(dirPath)) {
      if (result.error) {
        logger.warn(`Error scanning file ${result.filename}: ${result.error.message}`);
        continue;
      }

      // Extract endpoints from valid specifications
      const specEndpoints = extractEndpointsFromSpec(result.spec, result.specId);
      endpoints.push(...specEndpoints);
    }

    return endpoints;
  } catch (error) {
    logger.error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

describe('List Endpoints', () => {
  // Use the test/data directory which already contains OpenAPI specs for testing
  const testDir = path.join(process.cwd(), 'test/data');

  it('should list all endpoints from OpenAPI specifications in the specified directory', async () => {
    // List all endpoints
    const endpoints = await listEndpoints(testDir);

    // Log the results
    console.log('Found endpoints:');
    endpoints.forEach(endpoint => {
      console.log(`${endpoint.method.toUpperCase()} ${endpoint.path} (${endpoint.specId})`);
      if (endpoint.operationId) {
        console.log(`  operationId: ${endpoint.operationId}`);
      }
      if (endpoint.summary) {
        console.log(`  summary: ${endpoint.summary}`);
      }
    });

    // Basic assertions
    expect(endpoints).toBeDefined();
    expect(Array.isArray(endpoints)).toBe(true);

    // Verify some expected endpoints from the test data
    expect(endpoints.some(e => e.operationId === 'listPets')).toBe(true);
    expect(endpoints.some(e => e.operationId === 'createPet')).toBe(true);

    // Group endpoints by specification
    const endpointsBySpec = endpoints.reduce((acc, endpoint) => {
      if (!acc[endpoint.specId]) {
        acc[endpoint.specId] = [];
      }
      acc[endpoint.specId].push(endpoint);
      return acc;
    }, {} as Record<string, ApiEndpoint[]>);

    // Log summary by specification
    console.log('\nEndpoints by specification:');
    for (const [specId, specEndpoints] of Object.entries(endpointsBySpec)) {
      console.log(`${specId}: ${specEndpoints.length} endpoints`);
    }

    // Total count
    console.log(`\nTotal: ${endpoints.length} endpoints`);
  });
});
