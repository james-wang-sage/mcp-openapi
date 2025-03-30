import fs from "fs/promises";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import { parse } from "yaml";
// Using require for swagger2openapi since it doesn't have TypeScript types
const swagger2openapi = require('swagger2openapi');
import { ISpecProcessor } from "./interfaces/ISpecProcessor";
import { ISpecScanner, SpecFileType, SpecScanResult } from "./interfaces/ISpecScanner";

/**
 * Custom error class for spec scanning related errors
 */
export class SpecScanError extends Error {
  constructor(
    message: string,
    public readonly filename: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SpecScanError';
  }
}

/**
 * Default implementation of the SpecScanner interface
 * Scans a directory for OpenAPI specification files (JSON or YAML)
 * and processes them using the provided SpecProcessor
 */
export class DefaultSpecScanner implements ISpecScanner {
  constructor(private readonly specProcessor: ISpecProcessor) {}

  /**
   * Scans a directory for OpenAPI specification files and yields processed results
   * @param folderPath - Path to the directory containing OpenAPI specs
   * @throws {SpecScanError} If the folder doesn't exist or isn't readable
   */
  async *scan(
    folderPath: string
  ): AsyncGenerator<SpecScanResult, void, unknown> {
    // Validate input
    if (!folderPath) {
      throw new Error('folderPath is required');
    }

    try {
      const files = await fs.readdir(folderPath);
      
      for (const file of files) {
        try {
          const result = await this.processFile(folderPath, file);
          if (result) {
            yield result;
          }
        } catch (error) {
          yield {
            filename: file,
            specId: file,
            spec: {} as OpenAPIV3.Document, // Empty spec for error cases
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    } catch (error) {
      throw new SpecScanError(
        `Failed to read directory: ${folderPath}`,
        folderPath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Processes a single OpenAPI specification file
   * @param folderPath - Path to the directory containing the file
   * @param filename - Name of the file to process
   * @returns The processed spec result or null if the file type is invalid
   * @throws {SpecScanError} If there's an error processing the file
   */
  private async processFile(
    folderPath: string,
    filename: string
  ): Promise<SpecScanResult | null> {
    const fileType = this.getFileType(filename);
    if (fileType === "invalid") {
      return null;
    }

    const filePath = path.join(folderPath, filename);
    
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const specObject = await this.parseSpec(content, fileType);
      
      // Validate basic spec structure
      if (!this.isValidSpecObject(specObject)) {
        throw new SpecScanError(
          'Invalid OpenAPI specification format',
          filename
        );
      }

      const specId = this.extractSpecId(specObject, filename);
      const processedSpec = await this.specProcessor.process(specObject);

      return {
        filename,
        spec: processedSpec,
        specId
      };
    } catch (error) {
      throw new SpecScanError(
        `Failed to process spec file: ${filename}`,
        filename,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Determines the file type based on the file extension
   * @param filePath - Path to the file
   * @returns The detected file type
   */
  private getFileType(filePath: string): SpecFileType {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".json") {
      return "json";
    }
    if (ext === ".yaml" || ext === ".yml") {
      return "yaml";
    }
    return "invalid";
  }

  /**
   * Parses the spec content based on the file type and converts Swagger 2.0 to OpenAPI 3.0 if needed
   * @param content - Raw file content
   * @param fileType - Type of the file (json or yaml)
   * @returns Parsed and potentially converted spec object
   */
  private async parseSpec(
    content: string,
    fileType: "json" | "yaml"
  ): Promise<unknown> {
    try {
      const parsedContent = fileType === "json" ? JSON.parse(content) : parse(content);
      
      // Check if this is a Swagger 2.0 spec
      if (typeof parsedContent === 'object' && 
          parsedContent !== null && 
          'swagger' in parsedContent && 
          parsedContent.swagger === '2.0') {
        
        // Convert Swagger 2.0 to OpenAPI 3.0
        const options = {
          patch: true,  // fix up small errors in the source
          warnOnly: true,  // do not throw on non-patchable errors
        };
        
        try {
          const converted = await new Promise<OpenAPIV3.Document>((resolve, reject) => {
            swagger2openapi.convertObj(parsedContent, options, (err: Error | null, result: { openapi: OpenAPIV3.Document }) => {
              if (err) {
                reject(new Error(`Swagger 2.0 conversion failed: ${err.message}`));
              } else {
                resolve(result.openapi);
              }
            });
          });
          
          return converted;
        } catch (error) {
          throw new Error(`Failed to convert Swagger 2.0 spec: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      return parsedContent;
    } catch (error) {
      throw new Error(
        `Failed to parse ${fileType} content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validates that the parsed object has the basic structure of an OpenAPI spec
   * @param spec - The parsed spec object
   * @returns true if the spec has the basic required structure
   */
  private isValidSpecObject(spec: unknown): spec is OpenAPIV3.Document {
    return (
      typeof spec === 'object' &&
      spec !== null &&
      'info' in spec &&
      typeof spec.info === 'object' &&
      spec.info !== null
    );
  }

  /**
   * Extracts the spec ID from the spec object
   * @param spec - The parsed spec object
   * @param defaultId - Default ID to use if none is found in the spec
   * @returns The extracted spec ID
   */
  private extractSpecId(spec: OpenAPIV3.Document, defaultId: string): string {
    return (spec.info as any)['x-spec-id'] || defaultId;
  }
}
