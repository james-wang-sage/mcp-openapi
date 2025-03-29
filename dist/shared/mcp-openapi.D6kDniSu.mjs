import $RefParser from '@apidevtools/json-schema-ref-parser';
import fs from 'fs/promises';
import path from 'path';
import { parse, stringify } from 'yaml';
import Fuse from 'fuse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

class ConsoleLogger {
  isEnabled;
  constructor() {
    this.isEnabled = process.env.LOG_ENABLED === "true";
  }
  log(level, messageOrContext, contextOrMessage) {
    if (!this.isEnabled) {
      return;
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    let message;
    let context;
    if (typeof messageOrContext === "string") {
      message = messageOrContext;
      context = contextOrMessage;
    } else {
      message = contextOrMessage;
      context = messageOrContext;
    }
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    console.log(`${timestamp} [${level}] ${message}${contextStr}`);
  }
  debug(messageOrContext, contextOrMessage) {
    this.log("DEBUG", messageOrContext, contextOrMessage);
  }
  info(messageOrContext, contextOrMessage) {
    this.log("INFO", messageOrContext, contextOrMessage);
  }
  warn(messageOrContext, contextOrMessage) {
    this.log("WARN", messageOrContext, contextOrMessage);
  }
  error(messageOrContext, contextOrMessage) {
    this.log("ERROR", messageOrContext, contextOrMessage);
  }
}

class DefaultSpecProcessor {
  async process(spec) {
    const dereferencedSpec = await $RefParser.dereference(spec, {
      continueOnError: true
    });
    return this.mergeAllOfSchemas(dereferencedSpec);
  }
  /**
   * Recursively traverses the OpenAPI spec and merges any allOf schemas found
   * @param spec The OpenAPI specification to process
   * @returns The processed specification with merged allOf schemas
   */
  mergeAllOfSchemas(spec) {
    const processedSpec = structuredClone(spec);
    if (processedSpec.components?.schemas) {
      for (const [key, schema] of Object.entries(
        processedSpec.components.schemas
      )) {
        processedSpec.components.schemas[key] = this.processSchema(
          schema
        );
      }
    }
    for (const path of Object.values(processedSpec.paths || {})) {
      this.processPathItem(path);
    }
    return processedSpec;
  }
  /**
   * Processes a path item object, handling all nested schemas
   * @param pathItem The path item to process
   */
  processPathItem(pathItem) {
    const operations = [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace"
    ];
    for (const op of operations) {
      const operation = pathItem[op];
      if (!operation) continue;
      if (operation.requestBody) {
        const requestBody = operation.requestBody;
        for (const mediaType of Object.values(requestBody.content || {})) {
          if (mediaType.schema) {
            mediaType.schema = this.processSchema(mediaType.schema);
          }
        }
      }
      for (const response of Object.values(operation.responses || {})) {
        const responseObj = response;
        if (responseObj.content) {
          for (const mediaType of Object.values(responseObj.content)) {
            if (mediaType.schema) {
              mediaType.schema = this.processSchema(mediaType.schema);
            }
          }
        }
      }
      if (operation.parameters) {
        for (const param of operation.parameters) {
          const paramObj = param;
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
  processSchema(schema) {
    if (!this.isSchemaObject(schema)) {
      return schema;
    }
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        schema.properties[key] = this.processSchema(prop);
      }
    }
    if (schema.type === "array" && schema.items) {
      schema.items = this.processSchema(schema.items);
    }
    if (!schema.allOf || !Array.isArray(schema.allOf)) {
      return schema;
    }
    if (schema.allOf.length === 0) {
      const { allOf: allOf2, ...rest2 } = schema;
      return rest2;
    }
    const processedSchemas = schema.allOf.map((s) => this.processSchema(s));
    const mergedSchema = this.mergeSchemas(processedSchemas);
    const { allOf, ...rest } = schema;
    return this.mergeSchemas([mergedSchema, rest]);
  }
  /**
   * Merges multiple schemas into one
   * @param schemas The schemas to merge
   * @returns The merged schema
   */
  mergeSchemas(schemas) {
    const merged = {
      type: "object",
      properties: {},
      required: []
    };
    for (const schema of schemas) {
      if (!this.isSchemaObject(schema)) continue;
      if (schema.properties) {
        merged.properties = {
          ...merged.properties,
          ...schema.properties
        };
      }
      if (schema.required) {
        const requiredSet = /* @__PURE__ */ new Set([
          ...merged.required || [],
          ...schema.required
        ]);
        merged.required = Array.from(requiredSet);
      }
      for (const [key, value] of Object.entries(schema)) {
        if (key !== "properties" && key !== "required" && key !== "type") {
          merged[key] = value;
        }
      }
    }
    if (merged.required?.length === 0) {
      delete merged.required;
    }
    return merged;
  }
  /**
   * Type guard to check if a schema is a SchemaObject (not a ReferenceObject)
   */
  isSchemaObject(schema) {
    return !("$ref" in schema);
  }
}

class SpecScanError extends Error {
  constructor(message, filename, cause) {
    super(message);
    this.filename = filename;
    this.cause = cause;
    this.name = "SpecScanError";
  }
}
class DefaultSpecScanner {
  constructor(specProcessor) {
    this.specProcessor = specProcessor;
  }
  /**
   * Scans a directory for OpenAPI specification files and yields processed results
   * @param folderPath - Path to the directory containing OpenAPI specs
   * @throws {SpecScanError} If the folder doesn't exist or isn't readable
   */
  async *scan(folderPath) {
    if (!folderPath) {
      throw new Error("folderPath is required");
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
            spec: {},
            // Empty spec for error cases
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
  async processFile(folderPath, filename) {
    const fileType = this.getFileType(filename);
    if (fileType === "invalid") {
      return null;
    }
    const filePath = path.join(folderPath, filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const specObject = await this.parseSpec(content, fileType);
      if (!this.isValidSpecObject(specObject)) {
        throw new SpecScanError(
          "Invalid OpenAPI specification format",
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
  getFileType(filePath) {
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
   * Parses the spec content based on the file type
   * @param content - Raw file content
   * @param fileType - Type of the file (json or yaml)
   * @returns Parsed spec object
   */
  async parseSpec(content, fileType) {
    try {
      return fileType === "json" ? JSON.parse(content) : parse(content);
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
  isValidSpecObject(spec) {
    return typeof spec === "object" && spec !== null && "info" in spec && typeof spec.info === "object" && spec.info !== null;
  }
  /**
   * Extracts the spec ID from the spec object
   * @param spec - The parsed spec object
   * @param defaultId - Default ID to use if none is found in the spec
   * @returns The extracted spec ID
   */
  extractSpecId(spec, defaultId) {
    return spec.info["x-spec-id"] || defaultId;
  }
}

class SimpleCache {
  cache;
  maxSize;
  ttl;
  cleanupTimer;
  cleanupInterval;
  constructor(options = {}) {
    this.cache = /* @__PURE__ */ new Map();
    this.maxSize = options.maxSize || 500;
    this.ttl = options.ttl || 60 * 60 * 1e3;
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1e3;
    this.cleanupTimer = null;
    this.startCleanupTimer();
  }
  startCleanupTimer() {
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return void 0;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return void 0;
    }
    return entry.value;
  }
  clear() {
    this.cache.clear();
  }
  destroy() {
    this.stopCleanupTimer();
    this.clear();
  }
}

class SpecServiceError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "SpecServiceError";
  }
}
class FileSystemSpecService {
  constructor(scanner, config, logger) {
    this.scanner = scanner;
    this.config = {
      basePath: config.basePath,
      catalogDir: config.catalogDir || "_catalog",
      dereferencedDir: config.dereferencedDir || "_dereferenced",
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1e3,
      cache: {
        maxSize: config.cache?.maxSize || 500,
        ttl: config.cache?.ttl || 60 * 60 * 1e3
        // 1 hour
      }
    };
    this.logger = logger || new ConsoleLogger();
    this.folderPath = this.config.basePath;
    this.catalogPath = path.join(this.folderPath, this.config.catalogDir);
    this.dereferencedPath = path.join(
      this.folderPath,
      this.config.dereferencedDir
    );
    this.specCache = new SimpleCache({
      maxSize: this.config.cache.maxSize,
      ttl: this.config.cache.ttl
    });
  }
  config;
  logger;
  specCache;
  folderPath;
  catalogPath;
  dereferencedPath;
  specs = {};
  catalog = [];
  async ensureDirectory(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new SpecServiceError(
        `Failed to create directory ${dir}`,
        "INIT_ERROR",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  async ensureDirectories() {
    this.logger.debug("Ensuring required directories exist");
    await Promise.all([
      this.ensureDirectory(this.folderPath),
      this.ensureDirectory(this.catalogPath),
      this.ensureDirectory(this.dereferencedPath)
    ]);
  }
  resetState() {
    this.logger.debug("Resetting service state");
    this.catalog = [];
    this.specs = {};
    this.specCache.clear();
  }
  async loadExistingCatalog() {
    try {
      this.logger.debug("Loading existing catalog");
      this.catalog = await this.loadSpecCatalog();
      const specs = await Promise.all(
        this.catalog.map((spec) => this.loadSpec(spec.uri.specId))
      );
      specs.forEach((spec, index) => {
        const specId = this.catalog[index].uri.specId;
        this.specs[specId] = spec;
        this.specCache.set(specId, spec);
      });
      this.logger.info("Successfully loaded existing catalog");
      return true;
    } catch (error) {
      this.logger.warn({ error }, "Failed to load existing catalog");
      this.resetState();
      return false;
    }
  }
  async initialize() {
    this.logger.debug("Initializing FileSystemSpecService");
    try {
      await this.ensureDirectories();
      await this.loadExistingCatalog();
      await this.scanAndSave(this.folderPath);
      this.logger.info("Successfully initialized FileSystemSpecService");
    } catch (error) {
      this.logger.error(
        { error },
        "Failed to initialize FileSystemSpecService"
      );
      this.resetState();
      throw new SpecServiceError(
        "Failed to initialize FileSystemSpecService",
        "INIT_ERROR",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  async scanAndSave(folderPath) {
    this.logger.debug({ folderPath }, "Starting scan and persist operation");
    const tempCatalog = [];
    const pendingOperations = [];
    try {
      for await (const scanResult of this.scanner.scan(folderPath)) {
        const { filename, spec, specId, error } = scanResult;
        if (error) {
          this.logger.warn({ filename, error }, "Error scanning file");
          continue;
        }
        try {
          const operations = [];
          const schemas = [];
          for (const path2 in spec.paths) {
            const pathItem = spec.paths[path2];
            for (const method in pathItem) {
              if (method === "parameters" || method === "$ref") continue;
              const operation = pathItem[method];
              operations.push({
                path: path2,
                method,
                description: operation.description,
                operationId: operation.operationId
              });
            }
          }
          if (spec.components?.schemas) {
            for (const [name, schema] of Object.entries(
              spec.components.schemas
            )) {
              schemas.push({
                name,
                description: schema.description
              });
            }
          }
          const entry = {
            uri: {
              specId,
              type: "specification",
              identifier: specId
            },
            description: spec.info.description,
            operations,
            schemas
          };
          pendingOperations.push({ spec, entry });
        } catch (error2) {
          this.logger.warn(
            { filename, error: error2 },
            "Error processing specification"
          );
        }
      }
      await this.ensureDirectories();
      await Promise.all(
        pendingOperations.map(async ({ spec, entry }) => {
          await this.saveSpec(spec, entry.uri.specId);
          tempCatalog.push(entry);
        })
      );
      await this.saveSpecCatalog(tempCatalog);
      this.catalog = tempCatalog;
      this.logger.info("Successfully completed scan and persist operation");
    } catch (error) {
      this.logger.error({ error }, "Failed to scan and persist specifications");
      throw new SpecServiceError(
        "Failed to scan and persist specifications",
        "SCAN_ERROR",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  async getApiCatalog() {
    return this.catalog;
  }
  async saveSpec(spec, specId) {
    this.logger.debug({ specId }, "Persisting specification");
    try {
      await this.ensureDirectory(this.dereferencedPath);
      const specPath = path.join(this.dereferencedPath, `${specId}.json`);
      await fs.writeFile(specPath, JSON.stringify(spec, null, 2));
      this.specs[specId] = spec;
      this.specCache.set(specId, spec);
      this.logger.info({ specId }, "Successfully persisted specification");
    } catch (error) {
      this.logger.error({ specId, error }, "Failed to persist specification");
      throw new SpecServiceError(
        `Failed to persist specification ${specId}`,
        "PERSIST_ERROR",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  async saveSpecCatalog(catalog) {
    if (!this.catalogPath) {
      throw new Error("FileSystemSpecService not initialized");
    }
    const catalogPath = path.join(this.catalogPath, "catalog.json");
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
  }
  async loadSpecCatalog() {
    try {
      const catalogPath = path.join(this.catalogPath, "catalog.json");
      const catalog = await fs.readFile(catalogPath, "utf-8");
      return JSON.parse(catalog);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
  async loadSpec(specId) {
    this.logger.debug({ specId }, "Loading specification");
    const cached = this.specCache.get(specId);
    if (cached) {
      this.logger.debug({ specId }, "Returning cached specification");
      return cached;
    }
    try {
      const specPath = path.join(this.dereferencedPath, `${specId}.json`);
      const spec = JSON.parse(await fs.readFile(specPath, "utf-8"));
      this.specCache.set(specId, spec);
      this.logger.info({ specId }, "Successfully loaded specification");
      return spec;
    } catch (error) {
      this.logger.error({ specId, error }, "Failed to load specification");
      if (error.code === "ENOENT") {
        throw new SpecServiceError(
          `Specification not found: ${specId}`,
          "LOAD_ERROR"
        );
      }
      throw new SpecServiceError(
        `Failed to load specification ${specId}`,
        "LOAD_ERROR",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  async refresh() {
    if (!this.folderPath) {
      throw new Error("FileSystemSpecService not initialized");
    }
    await this.initialize();
  }
  async searchOperations(query, specId) {
    const targetSpecs = [];
    if (specId) {
      const spec = this.catalog.find((spec2) => spec2.uri.specId === specId);
      if (spec) {
        targetSpecs.push(spec);
      }
    } else {
      targetSpecs.push(...this.catalog);
    }
    const results = [];
    for (const spec of targetSpecs) {
      const specDoc = this.specs[spec.uri.specId];
      if (!specDoc?.paths) continue;
      for (const path2 in specDoc.paths) {
        const pathItem = specDoc.paths[path2];
        if (!pathItem) continue;
        for (const method in pathItem) {
          if (method === "parameters" || method === "$ref") continue;
          const operation = pathItem[method];
          if (!operation) continue;
          const searchText = [
            operation.operationId,
            operation.summary,
            operation.description,
            ...operation.tags || []
          ].filter(Boolean).join(" ").toLowerCase();
          if (searchText.includes(query.toLowerCase())) {
            results.push({
              path: path2,
              method,
              operation,
              specId: spec.uri.specId,
              uri: `apis://${spec.uri.specId}/operations/${operation.operationId}`
            });
          }
        }
      }
    }
    return results;
  }
  async searchSchemas(query, specId) {
    const targetSpecs = [];
    if (specId) {
      const spec = this.catalog.find((spec2) => spec2.uri.specId === specId);
      if (spec) {
        targetSpecs.push(spec);
      }
    } else {
      targetSpecs.push(...this.catalog);
    }
    const schemaEntries = [];
    for (const spec of targetSpecs) {
      schemaEntries.push(
        ...spec.schemas.map((schema) => ({
          ...schema,
          specId: spec.uri.specId
        }))
      );
    }
    const fuse = new Fuse(schemaEntries, {
      includeScore: true,
      threshold: 0.2,
      keys: ["name", "description"]
    });
    const results = fuse.search(query);
    return results.map((result) => result.item);
  }
  async findSchemaByName(specId, schemaName) {
    const spec = this.specs[specId];
    if (!spec) {
      return null;
    }
    const schema = spec.components?.schemas?.[schemaName];
    if (!schema) {
      return null;
    }
    return {
      name: schemaName,
      description: schema["description"],
      schema,
      uri: `apis://${specId}/schemas/${schemaName}`
    };
  }
  async findOperationById(specId, operationId) {
    const spec = this.specs[specId];
    if (!spec) {
      return null;
    }
    for (const path2 in spec.paths) {
      const pathItem = spec.paths[path2];
      for (const method in pathItem) {
        if (pathItem[method]["operationId"] === operationId) {
          return {
            path: path2,
            method,
            operation: pathItem[method],
            specId,
            uri: `apis://${specId}/operations/${operationId}`
          };
        }
      }
    }
    return null;
  }
  async findOperationByPathAndMethod(specId, path2, method) {
    const spec = this.specs[specId];
    if (!spec) {
      return null;
    }
    const pathItem = spec.paths[path2];
    if (!pathItem) {
      return null;
    }
    const operation = pathItem[method];
    if (!operation) {
      return null;
    }
    return {
      path: path2,
      method,
      operation,
      specId,
      uri: `apis://${specId}/operations/${operation.operationId}`
    };
  }
}

class McpService {
  constructor(specExplorer, logger) {
    this.specExplorer = specExplorer;
    this.logger = logger || new ConsoleLogger();
    this.initializeExplorer().catch((error) => {
      this.logger.error("Failed to initialize spec explorer", { error });
      throw error;
    });
  }
  logger;
  async initializeExplorer() {
    try {
      this.logger.info("Initializing spec explorer");
      await this.specExplorer.initialize();
      this.logger.info("Spec explorer initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize spec explorer", { error });
      throw error;
    }
  }
  createServer() {
    this.logger.info("Creating MCP server");
    const mcpServer = new McpServer({
      name: "reapi-mcp-server",
      version: "0.0.1"
    });
    this.setUpTools(mcpServer);
    this.logger.info("MCP server created successfully");
    return mcpServer;
  }
  setUpTools(server) {
    server.tool("refresh-api-catalog", "Refresh the API catalog", async () => {
      try {
        this.logger.info("Refreshing API catalog");
        await this.specExplorer.refresh();
        this.logger.info("API catalog refreshed successfully");
        return {
          content: [{ type: "text", text: "API catalog refreshed" }]
        };
      } catch (error) {
        this.logger.error("Failed to refresh API catalog", { error });
        throw error;
      }
    });
    server.tool(
      "get-api-catalog",
      "Get the API catalog, the catalog contains metadata about all openapi specifications, their operations and schemas",
      async () => {
        try {
          this.logger.debug("Getting API catalog");
          const catalog = await this.specExplorer.getApiCatalog();
          return {
            content: [
              { type: "text", text: stringify({ catalog }, { indent: 2 }) }
            ]
          };
        } catch (error) {
          this.logger.error("Failed to get API catalog", { error });
          throw error;
        }
      }
    );
    server.tool(
      "search-api-operations",
      "Search for operations across specifications",
      {
        query: z.string(),
        specId: z.string().optional()
      },
      async (args, extra) => {
        try {
          this.logger.debug("Searching API operations", { query: args.query, specId: args.specId });
          const operations = await this.specExplorer.searchOperations(
            args.query,
            args.specId
          );
          return {
            content: [
              { type: "text", text: stringify({ operations }, { indent: 2 }) }
            ]
          };
        } catch (error) {
          this.logger.error("Failed to search API operations", { error, query: args.query });
          throw error;
        }
      }
    );
    server.tool(
      "search-api-schemas",
      "Search for schemas across specifications",
      {
        query: z.string()
      },
      async (args, extra) => {
        try {
          this.logger.debug("Searching API schemas", { query: args.query });
          const schemas = await this.specExplorer.searchSchemas(args.query);
          return {
            content: [
              { type: "text", text: stringify({ schemas }, { indent: 2 }) }
            ]
          };
        } catch (error) {
          this.logger.error("Failed to search API schemas", { error, query: args.query });
          throw error;
        }
      }
    );
    server.tool(
      "load-api-operation-by-operationId",
      "Load an operation by operationId",
      {
        specId: z.string(),
        operationId: z.string()
      },
      async (args, extra) => {
        try {
          this.logger.debug("Loading API operation by ID", { specId: args.specId, operationId: args.operationId });
          const operation = await this.specExplorer.findOperationById(
            args.specId,
            args.operationId
          );
          if (!operation) {
            this.logger.warn("Operation not found", { specId: args.specId, operationId: args.operationId });
          }
          return {
            content: [
              { type: "text", text: stringify(operation, { indent: 2 }) }
            ]
          };
        } catch (error) {
          this.logger.error("Failed to load API operation by ID", {
            error,
            specId: args.specId,
            operationId: args.operationId
          });
          throw error;
        }
      }
    );
    server.tool(
      "load-api-operation-by-path-and-method",
      "Load an operation by path and method",
      {
        specId: z.string(),
        path: z.string(),
        method: z.string()
      },
      async (args, extra) => {
        try {
          this.logger.debug("Loading API operation by path and method", {
            specId: args.specId,
            path: args.path,
            method: args.method
          });
          const operation = await this.specExplorer.findOperationByPathAndMethod(
            args.specId,
            args.path,
            args.method
          );
          if (!operation) {
            this.logger.warn("Operation not found", {
              specId: args.specId,
              path: args.path,
              method: args.method
            });
          }
          return {
            content: [
              { type: "text", text: stringify(operation, { indent: 2 }) }
            ]
          };
        } catch (error) {
          this.logger.error("Failed to load API operation by path and method", {
            error,
            specId: args.specId,
            path: args.path,
            method: args.method
          });
          throw error;
        }
      }
    );
    server.tool(
      "load-api-schema-by-schemaName",
      "Load a schema by schemaName",
      {
        specId: z.string(),
        schemaName: z.string()
      },
      async (args, extra) => {
        try {
          this.logger.debug("Loading API schema", { specId: args.specId, schemaName: args.schemaName });
          const schema = await this.specExplorer.findSchemaByName(
            args.specId,
            args.schemaName
          );
          if (!schema) {
            this.logger.warn("Schema not found", { specId: args.specId, schemaName: args.schemaName });
          }
          return {
            content: [{ type: "text", text: stringify(schema, { indent: 2 }) }]
          };
        } catch (error) {
          this.logger.error("Failed to load API schema", {
            error,
            specId: args.specId,
            schemaName: args.schemaName
          });
          throw error;
        }
      }
    );
  }
  setUpPrompts(server) {
    server.prompt(
      "search-api-operations",
      "Search for operations across specifications",
      {
        query: z.string(),
        specId: z.string().optional()
      },
      async (args, extra) => {
        await this.specExplorer.searchOperations(
          args.query,
          args.specId
        );
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `asdf`
              }
            }
          ]
        };
      }
    );
    server.prompt(
      "find-operation-by-operationId",
      "Find an operation by specId and operationId",
      {
        operationId: z.string(),
        specId: z.string()
      },
      async (args, extra) => {
        const operation = await this.specExplorer.findOperationById(
          args.specId,
          args.operationId
        );
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: operation?.operation.summary ?? ""
              }
            }
          ]
        };
      }
    );
    server.prompt(
      "find-operation-by-path-and-method",
      "Find an operation by path and method",
      {
        specId: z.string(),
        path: z.string(),
        method: z.string()
      },
      async (args, extra) => {
        const operation = await this.specExplorer.findOperationByPathAndMethod(
          args.specId,
          args.path,
          args.method
        );
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: operation?.operation.summary ?? ""
              }
            }
          ]
        };
      }
    );
  }
  setUpResources(server) {
  }
}

export { ConsoleLogger as C, DefaultSpecScanner as D, FileSystemSpecService as F, McpService as M, DefaultSpecProcessor as a };
