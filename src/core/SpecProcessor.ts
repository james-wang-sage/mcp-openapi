import $RefParser from "@apidevtools/json-schema-ref-parser";
import { OpenAPIV3 } from "openapi-types";
import { ISpecProcessor } from "./interfaces/ISpecProcessor";

/**
 * Identifies a specific OpenAPI specification
 */
export interface SpecIdentifier {
  /** Unique identifier for the specification */
  specId: string;
  /** Optional title of the specification */
  title?: string;
  /** Optional version of the specification */
  version?: string;
}

/**
 * Process OpenAPI specifications into a dereferenced version.
 * Can optionally validate the spec and remove unused components.
 */
export interface SpecProcessor {
  /**
   * Process an OpenAPI document by dereferencing and transforming it
   * @param spec The OpenAPI document to process
   * @returns A processed version of the OpenAPI document
   */
  process(spec: OpenAPIV3.Document): Promise<OpenAPIV3.Document>;
}

/**
 * Represents a JSON Schema object with potential allOf combinations
 */
type SchemaObject = OpenAPIV3.SchemaObject;

/**
 * Represents a reference to another schema using $ref
 */
type ReferenceObject = OpenAPIV3.ReferenceObject;

/**
 * Union type representing either a schema object or a reference to one
 */
type SchemaOrRef = SchemaObject | ReferenceObject;

export class DefaultSpecProcessor implements ISpecProcessor {
  async process(spec: OpenAPIV3.Document): Promise<OpenAPIV3.Document> {
    // First dereference all $refs
    const dereferencedSpec = (await $RefParser.dereference(spec, {
      continueOnError: true,
    })) as OpenAPIV3.Document;

    // Then merge all allOf schemas
    return this.mergeAllOfSchemas(dereferencedSpec);
  }

  /**
   * Recursively traverses the OpenAPI spec and merges any allOf schemas found
   * @param spec The OpenAPI specification to process
   * @returns The processed specification with merged allOf schemas
   */
  private mergeAllOfSchemas(spec: OpenAPIV3.Document): OpenAPIV3.Document {
    // Deep clone the spec to avoid modifying the input
    const processedSpec = structuredClone(spec);

    // Process components schemas if they exist
    if (processedSpec.components?.schemas) {
      for (const [key, schema] of Object.entries(
        processedSpec.components.schemas
      )) {
        processedSpec.components.schemas[key] = this.processSchema(
          schema as SchemaOrRef
        );
      }
    }

    // Process schemas in paths
    for (const path of Object.values(processedSpec.paths || {})) {
      this.processPathItem(path as OpenAPIV3.PathItemObject);
    }

    return processedSpec;
  }

  /**
   * Processes a path item object, handling all nested schemas
   * @param pathItem The path item to process
   */
  private processPathItem(pathItem: OpenAPIV3.PathItemObject): void {
    const operations = [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
    ];

    for (const op of operations) {
      const operation = pathItem[
        op as keyof OpenAPIV3.PathItemObject
      ] as OpenAPIV3.OperationObject;
      if (!operation) continue;

      // Process request body schema
      if (operation.requestBody) {
        const requestBody =
          operation.requestBody as OpenAPIV3.RequestBodyObject;
        for (const mediaType of Object.values(requestBody.content || {})) {
          if (mediaType.schema) {
            mediaType.schema = this.processSchema(mediaType.schema);
          }
        }
      }

      // Process response schemas
      for (const response of Object.values(operation.responses || {})) {
        const responseObj = response as OpenAPIV3.ResponseObject;
        if (responseObj.content) {
          for (const mediaType of Object.values(responseObj.content)) {
            if (mediaType.schema) {
              mediaType.schema = this.processSchema(mediaType.schema);
            }
          }
        }
      }

      // Process parameter schemas
      if (operation.parameters) {
        for (const param of operation.parameters) {
          const paramObj = param as OpenAPIV3.ParameterObject;
          if (paramObj.schema) {
            paramObj.schema = this.processSchema(paramObj.schema);
          }
        }
      }
    }
  }

  /**
   * Processes a schema object, merging allOf if present
   * @param schema The schema to process
   * @returns The processed schema
   */
  private processSchema(schema: SchemaOrRef): SchemaObject {
    if (!this.isSchemaObject(schema)) {
      return schema as SchemaObject;
    }

    // Process nested schemas first
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        schema.properties[key] = this.processSchema(prop as SchemaOrRef);
      }
    }

    // Process array items if present
    if (schema.type === "array" && schema.items) {
      schema.items = this.processSchema(schema.items as SchemaOrRef);
    }

    // Handle empty or non-existent allOf
    if (!schema.allOf || !Array.isArray(schema.allOf)) {
      return schema;
    }

    // If allOf is empty, remove it and return the rest of the schema
    if (schema.allOf.length === 0) {
      const { allOf, ...rest } = schema;
      return rest;
    }

    // Process each schema in allOf array
    const processedSchemas = schema.allOf.map((s) => this.processSchema(s));

    // Merge the schemas
    const mergedSchema = this.mergeSchemas(processedSchemas);

    // Remove the allOf property and merge with any other properties from the original schema
    const { allOf, ...rest } = schema;
    return this.mergeSchemas([mergedSchema, rest]);
  }

  /**
   * Merges multiple schemas into one
   * @param schemas The schemas to merge
   * @returns The merged schema
   */
  private mergeSchemas(schemas: SchemaOrRef[]): SchemaObject {
    const merged: SchemaObject = {
      type: "object",
      properties: {},
      required: [] as string[],
    };

    for (const schema of schemas) {
      if (!this.isSchemaObject(schema)) continue;

      // Merge properties
      if (schema.properties) {
        merged.properties = {
          ...merged.properties,
          ...schema.properties,
        };
      }

      // Merge required fields
      if (schema.required) {
        const requiredSet = new Set([
          ...(merged.required || []),
          ...schema.required,
        ]);
        merged.required = Array.from(requiredSet);
      }

      // Merge other fields
      for (const [key, value] of Object.entries(schema)) {
        if (key !== "properties" && key !== "required" && key !== "type") {
          (merged as any)[key] = value;
        }
      }
    }

    // Clean up empty arrays
    if (merged.required?.length === 0) {
      delete merged.required;
    }

    return merged;
  }

  /**
   * Type guard to check if a schema is a SchemaObject (not a ReferenceObject)
   */
  private isSchemaObject(schema: SchemaOrRef): schema is SchemaObject {
    return !("$ref" in schema);
  }
}
