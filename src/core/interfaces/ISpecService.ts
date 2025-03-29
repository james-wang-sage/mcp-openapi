import { OpenAPIV3 } from "openapi-types";

/**
 * Configuration options for the FileSystemSpecService
 */
export interface SpecServiceConfig {
  /** Base path for all spec-related files */
  basePath: string;
  /** Directory name for catalog files */
  catalogDir?: string;
  /** Directory name for dereferenced specs */
  dereferencedDir?: string;
  /** Number of retry attempts for file operations */
  retryAttempts?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Cache options */
  cache?: {
    /** Maximum number of specs to cache */
    maxSize?: number;
    /** Time to live for cached items in milliseconds */
    ttl?: number;
  };
}

/**
 * URI format: apis://{specId}/operations/{operationId}
 * or apis://{specId}/schemas/{schemaName}
 */
export interface SpecUri {
  /** Unique identifier for the specification */
  specId: string;
  /** Type of the URI target */
  type: "operation" | "schema" | "specification";
  /** Identifier within the type (e.g., operationId or schemaName) */
  identifier: string;
}

/**
 * Entry representing an OpenAPI operation
 */
export interface SpecOperationEntry {
  /** The path of the operation */
  path: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Optional description of the operation */
  description?: string;
  /** Unique identifier for the operation */
  operationId?: string;
}

/**
 * Entry representing a schema in the OpenAPI spec
 */
export interface SpecSchemaEntry {
  /** Name of the schema */
  name: string;
  /** Optional description of the schema */
  description?: string;
}

/**
 * Summary information about an available spec
 */
export interface SpecCatalogEntry {
  /** URI identifying the specification */
  uri: SpecUri;
  /** Optional description of the specification */
  description?: string;
  /** List of operations in the specification */
  operations: SpecOperationEntry[];
  /** List of schemas in the specification */
  schemas: SpecSchemaEntry[];
}

/**
 * Result of loading a schema
 */
export interface LoadSchemaResult {
  /** Name of the schema */
  name: string;
  /** Description of the schema */
  description: string;
  /** The actual schema object */
  schema: OpenAPIV3.SchemaObject;
  /** URI identifying the schema */
  uri: string;
}

/**
 * Result of loading an operation
 */
export interface LoadOperationResult {
  /** Path of the operation */
  path: string;
  /** HTTP method */
  method: string;
  /** The operation object */
  operation: OpenAPIV3.OperationObject;
  /** ID of the specification containing the operation */
  specId: string;
  /** URI identifying the operation */
  uri: string;
}

/**
 * Interface for persisting OpenAPI specifications
 */
export interface ISpecStore {
  /**
   * Scan a directory and persist found specifications
   */
  scanAndSave(folderPath: string): Promise<void>;

  /**
   * Persist the catalog of specifications
   */
  saveSpecCatalog(catalog: SpecCatalogEntry[]): Promise<void>;

  /**
   * Load the catalog of specifications
   */
  loadSpecCatalog(): Promise<SpecCatalogEntry[]>;

  /**
   * Persist a single specification
   */
  saveSpec(spec: OpenAPIV3.Document, specId: string): Promise<void>;

  /**
   * Load a single specification by ID
   */
  loadSpec(specId: string): Promise<OpenAPIV3.Document>;
}

/**
 * Interface for exploring and querying OpenAPI specifications
 */
export interface ISpecExplorer {
  /**
   * Initialize the spec explorer
   */
  initialize(): Promise<void>;

  /**
   * Refresh the spec explorer
   */
  refresh(): Promise<void>;

  /**
   * List all specifications in the catalog
   */
  getApiCatalog(): Promise<SpecCatalogEntry[]>;

  /**
   * Find a schema by name within a specification
   */
  findSchemaByName(
    specId: string,
    schemaName: string
  ): Promise<LoadSchemaResult | null>;

  /**
   * Find an operation by its ID within a specification
   */
  findOperationById(
    specId: string,
    operationId: string
  ): Promise<LoadOperationResult | null>;

  /**
   * Find an operation by path and method when operationId is not known
   */
  findOperationByPathAndMethod(
    specId: string,
    path: string,
    method: string
  ): Promise<LoadOperationResult | null>;

  /**
   * Search for operations across specifications
   */
  searchOperations(
    query: string,
    specId?: string
  ): Promise<LoadOperationResult[]>;

  /**
   * Search for schemas across specifications
   */
  searchSchemas(query: string, specId?: string): Promise<SpecSchemaEntry[]>;
}

/**
 * Interface for serializing operation and schema results
 */
export interface IResultSerializer {
  /**
   * Serialize an operation result to string
   */
  serializeOperation(result: LoadOperationResult): string;

  /**
   * Serialize a schema result to string
   */
  serializeSchema(result: LoadSchemaResult): string;
}
