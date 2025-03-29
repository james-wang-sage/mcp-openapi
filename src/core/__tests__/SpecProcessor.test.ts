import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultSpecProcessor } from '../SpecProcessor';
import { OpenAPIV3 } from 'openapi-types';
import $RefParser from '@apidevtools/json-schema-ref-parser';

type DereferenceFunction = typeof $RefParser.dereference;

// Mock $RefParser with proper typing
vi.mock('@apidevtools/json-schema-ref-parser', () => ({
  default: {
    dereference: vi.fn().mockImplementation((spec: unknown) => Promise.resolve(spec)) as unknown as DereferenceFunction,
  },
}));

describe('DefaultSpecProcessor', () => {
  let processor: DefaultSpecProcessor;

  beforeEach(() => {
    processor = new DefaultSpecProcessor();
    vi.clearAllMocks();
  });

  describe('process', () => {
    it('should dereference the OpenAPI spec', async () => {
      const mockSpec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/schemas/TestResponse',
                },
              },
            },
          },
        },
        components: {
          schemas: {
            TestResponse: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                },
              },
            },
          },
        },
      };

      const mockDereferencedSpec: OpenAPIV3.Document = {
        ...mockSpec,
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Successful response',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: {
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      vi.mocked($RefParser.dereference).mockResolvedValue(mockDereferencedSpec as any);

      const result = await processor.process(mockSpec);

      expect($RefParser.dereference).toHaveBeenCalledWith(mockSpec, {
        continueOnError: true,
      });
      expect(result).toEqual(mockDereferencedSpec);
    });

    it('should handle errors during dereferencing', async () => {
      const mockSpec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
      };

      const mockError = new Error('Dereferencing failed');
      vi.mocked($RefParser.dereference).mockRejectedValue(mockError);

      await expect(processor.process(mockSpec)).rejects.toThrow(mockError);
    });

    it('should handle circular references', async () => {
      const mockSpec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/schemas/CircularSchema',
                },
              },
            },
          },
        },
        components: {
          schemas: {
            CircularSchema: {
              type: 'object',
              properties: {
                self: {
                  $ref: '#/components/schemas/CircularSchema',
                },
              },
            },
          },
        },
      };

      // Mock successful dereferencing even with circular references
      const mockDereferencedSpec = { ...mockSpec };
      vi.mocked($RefParser.dereference).mockResolvedValue(mockDereferencedSpec as any);

      const result = await processor.process(mockSpec);

      expect($RefParser.dereference).toHaveBeenCalledWith(mockSpec, {
        continueOnError: true,
      });
      expect(result).toEqual(mockDereferencedSpec);
    });
  });

  describe('allOf merging', () => {
    it('should merge basic allOf schemas', async () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            TestSchema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    age: { type: 'number' }
                  },
                  required: ['name']
                },
                {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    age: { type: 'integer', minimum: 0 }
                  },
                  required: ['email']
                }
              ]
            }
          }
        }
      };

      const expectedSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'integer', minimum: 0 }
        },
        required: ['name', 'email']
      };

      vi.mocked($RefParser.dereference).mockResolvedValueOnce(spec as unknown as any);

      const result = await processor.process(spec);
      expect(result.components?.schemas?.TestSchema).toEqual(expectedSchema);
    });

    it('should handle nested allOf schemas', async () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            NestedSchema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    user: {
                      allOf: [
                        {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' }
                          },
                          required: ['id']
                        },
                        {
                          type: 'object',
                          properties: {
                            email: { type: 'string' }
                          },
                          required: ['email']
                        }
                      ]
                    }
                  }
                },
                {
                  type: 'object',
                  properties: {
                    metadata: { type: 'object' }
                  }
                }
              ]
            }
          }
        }
      };

      const expectedSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['id', 'email']
          },
          metadata: { type: 'object' }
        }
      };

      vi.mocked($RefParser.dereference).mockResolvedValueOnce(spec as unknown as any);

      const result = await processor.process(spec);
      expect(result.components?.schemas?.NestedSchema).toEqual(expectedSchema);
    });

    it('should handle allOf in array items', async () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            ArraySchema: {
              type: 'array',
              items: {
                allOf: [
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string' }
                    },
                    required: ['id']
                  },
                  {
                    type: 'object',
                    properties: {
                      value: { type: 'number' }
                    },
                    required: ['value']
                  }
                ]
              }
            }
          }
        }
      };

      const expectedSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' }
          },
          required: ['id', 'value']
        }
      };

      vi.mocked($RefParser.dereference).mockResolvedValueOnce(spec as unknown as any);

      const result = await processor.process(spec);
      expect(result.components?.schemas?.ArraySchema).toEqual(expectedSchema);
    });

    it('should merge additional properties from parent schema', async () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            TestSchema: {
              description: 'Test schema description',
              allOf: [
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' }
                  }
                }
              ],
              example: { name: 'John' },
              deprecated: true
            }
          }
        }
      };

      const expectedSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        description: 'Test schema description',
        example: { name: 'John' },
        deprecated: true
      };

      vi.mocked($RefParser.dereference).mockResolvedValueOnce(spec as unknown as any);

      const result = await processor.process(spec);
      expect(result.components?.schemas?.TestSchema).toEqual(expectedSchema);
    });

    it('should handle empty allOf array', async () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            EmptyAllOf: {
              type: 'object',
              properties: {
                test: { type: 'string' }
              },
              allOf: []
            }
          }
        }
      };

      const expectedSchema = {
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      };

      vi.mocked($RefParser.dereference).mockResolvedValueOnce(spec as unknown as any);

      const result = await processor.process(spec);
      expect(result.components?.schemas?.EmptyAllOf).toStrictEqual(expectedSchema);
    });

    it('should process allOf in request bodies', async () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      allOf: [
                        {
                          type: 'object',
                          properties: {
                            name: { type: 'string' }
                          }
                        },
                        {
                          type: 'object',
                          properties: {
                            age: { type: 'number' }
                          }
                        }
                      ]
                    }
                  }
                }
              },
              responses: {}
            }
          }
        }
      };

      const expectedSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      vi.mocked($RefParser.dereference).mockResolvedValueOnce(spec as unknown as any);

      const result = await processor.process(spec);
      const requestSchema = (result.paths['/test']?.post?.requestBody as OpenAPIV3.RequestBodyObject)
        ?.content?.['application/json']?.schema;
      expect(requestSchema).toEqual(expectedSchema);
    });
  });
}); 