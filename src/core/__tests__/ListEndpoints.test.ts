import { OpenAPIV3 } from 'openapi-types';
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

  // Scan the directory for OpenAPI specifications
  const endpoints: ApiEndpoint[] = [];

  try {
    for await (const result of specScanner.scan(dirPath)) {
      if (result.error) {
        logger.warn(`Error scanning file ${result.filename}: ${result.error.message}`);
        continue;
      }

      const { spec, specId } = result;

      // Extract endpoints from the specification
      for (const path in spec.paths) {
        const pathItem = spec.paths[path];

        // Skip if pathItem is not defined or is a reference
        if (!pathItem || '$ref' in pathItem) continue;

        // Process each HTTP method in the path
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
        for (const method of methods) {
          const operation = pathItem[method as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;

          if (operation) {
            endpoints.push({
              path,
              method,
              operationId: operation.operationId,
              summary: operation.summary,
              description: operation.description,
              specId
            });
          }
        }
      }
    }

    return endpoints;
  } catch (error) {
    logger.error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

describe('List Endpoints', () => {
  it('should list all endpoints from OpenAPI specifications in the specified directory', async () => {
    // Use the directory path provided in the command line
    const dirPath = '/Users/jameswang/projects/oauth2/app/source/openapispec/ap/paths';

    // List all endpoints
    const endpoints = await listEndpoints(dirPath);

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
