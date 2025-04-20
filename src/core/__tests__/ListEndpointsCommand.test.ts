import fs from 'fs/promises';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
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

describe('List Endpoints Command', () => {
  const testDir = path.join(process.cwd(), 'test/temp-api-specs');

  // Sample OpenAPI specs for testing
  const petStoreSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: 'Pet Store API',
      version: '1.0.0',
      description: 'A sample Pet Store API'
    },
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          summary: 'List all pets',
          responses: {
            '200': {
              description: 'A list of pets',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          operationId: 'createPet',
          summary: 'Create a pet',
          responses: {
            '201': {
              description: 'Pet created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      },
      '/pets/{petId}': {
        get: {
          operationId: 'getPet',
          summary: 'Get a pet by ID',
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'A pet',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        },
        delete: {
          operationId: 'deletePet',
          summary: 'Delete a pet',
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '204': {
              description: 'Pet deleted'
            }
          }
        }
      }
    }
  };

  const userApiSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: 'User API',
      version: '1.0.0',
      description: 'A sample User API'
    },
    paths: {
      '/users': {
        get: {
          operationId: 'listUsers',
          summary: 'List all users',
          responses: {
            '200': {
              description: 'A list of users',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          operationId: 'createUser',
          summary: 'Create a user',
          responses: {
            '201': {
              description: 'User created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  // Set up test directory with sample OpenAPI specs
  beforeAll(async () => {
    try {
      // Create test directory
      await fs.mkdir(testDir, { recursive: true });

      // Write sample OpenAPI specs to test directory
      await fs.writeFile(
        path.join(testDir, 'petstore.json'),
        JSON.stringify(petStoreSpec, null, 2)
      );

      await fs.writeFile(
        path.join(testDir, 'user-api.json'),
        JSON.stringify(userApiSpec, null, 2)
      );

      // Create an invalid file to test error handling
      await fs.writeFile(
        path.join(testDir, 'invalid.yaml'),
        'This is not a valid YAML file: :'
      );

      // Create a non-OpenAPI file to test filtering
      await fs.writeFile(
        path.join(testDir, 'readme.txt'),
        'This is a readme file, not an OpenAPI spec'
      );
    } catch (error) {
      console.error('Error setting up test directory:', error);
    }
  });

  // Comment out cleanup to allow manual testing
  // afterAll(async () => {
  //   try {
  //     await fs.rm(testDir, { recursive: true, force: true });
  //   } catch (error) {
  //     console.error('Error cleaning up test directory:', error);
  //   }
  // });

  it('should list all endpoints from OpenAPI specifications in the specified directory', async () => {
    // List all endpoints in the test directory
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
    expect(endpoints.length).toBe(6); // 4 from petstore + 2 from user-api

    // Verify petstore endpoints
    const petstoreEndpoints = endpoints.filter(e => e.specId === 'petstore.json');
    expect(petstoreEndpoints.length).toBe(4);
    expect(petstoreEndpoints.some(e => e.path === '/pets' && e.method === 'get')).toBe(true);
    expect(petstoreEndpoints.some(e => e.path === '/pets' && e.method === 'post')).toBe(true);
    expect(petstoreEndpoints.some(e => e.path === '/pets/{petId}' && e.method === 'get')).toBe(true);
    expect(petstoreEndpoints.some(e => e.path === '/pets/{petId}' && e.method === 'delete')).toBe(true);

    // Verify user-api endpoints
    const userApiEndpoints = endpoints.filter(e => e.specId === 'user-api.json');
    expect(userApiEndpoints.length).toBe(2);
    expect(userApiEndpoints.some(e => e.path === '/users' && e.method === 'get')).toBe(true);
    expect(userApiEndpoints.some(e => e.path === '/users' && e.method === 'post')).toBe(true);

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

    // Verify that the command line version would work with the specified path
    console.log(`\nTo run this as a command, use:\n`);
    console.log(`npm run list-endpoints -- --dir "${testDir}"`);
  });
});
