import { OpenAPIV3 } from "openapi-types";

/**
 * Supported file types for OpenAPI specifications
 */
export type SpecFileType = "json" | "yaml" | "invalid";

/**
 * Result of scanning a single OpenAPI spec file
 */
export interface SpecScanResult {
  /** Name of the scanned file */
  filename: string;
  /** Unique identifier for the specification */
  specId: string;
  /** The parsed and processed OpenAPI specification */
  spec: OpenAPIV3.Document;
  /** Optional error if scanning failed */
  error?: Error;
}

/**
 * Entry in the specification catalog
 */
export interface SpecCatalogEntry {
  /** Unique identifier */
  id: string;
  /** Human readable title */
  title: string;
  /** Description of the specification */
  description: string;
}

/**
 * Scan a folder for OpenAPI specifications
 * Uses async generator for memory-efficient processing
 * The scanner can use cache strategy to determine if a file has changed
 * and only process files that have changed
 *
 * The default implementation will scan all files in the folder
 * and yield them one at a time
 *
 * The scanner can be extended to use a custom cache strategy
 * or to add additional processing logic
 */
export interface ISpecScanner {
  /**
   * Scan a folder for OpenAPI specs and yield them one at a time
   * This allows for memory-efficient processing of large specs
   * @param folderPath Path to folder containing OpenAPI specs
   */
  scan(folderPath: string): AsyncGenerator<SpecScanResult, void, unknown>;
} 