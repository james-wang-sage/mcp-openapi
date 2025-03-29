import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stringify } from "yaml";
import { z } from "zod";
import { SpecServiceError } from "./core/SpecService";
import { ISpecExplorer } from "./core/interfaces/ISpecService";
import { Logger, ConsoleLogger } from "./core/Logger";

export class McpService {
  private readonly logger: Logger;

  constructor(
    private readonly specExplorer: ISpecExplorer,
    logger?: Logger
  ) {
    this.logger = logger || new ConsoleLogger();
    this.initializeExplorer().catch(error => {
      this.logger.error('Failed to initialize spec explorer', { error });
      throw error;
    });
  }

  private async initializeExplorer() {
    try {
      this.logger.info('Initializing spec explorer');
      await this.specExplorer.initialize();
      this.logger.info('Spec explorer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize spec explorer', { error });
      throw error;
    }
  }

  createServer() {
    this.logger.info('Creating MCP server');
    const mcpServer = new McpServer({
      name: "reapi-mcp-server",
      version: "0.0.1",
    });

    this.setUpTools(mcpServer);
    this.logger.info('MCP server created successfully');

    return mcpServer;
  }

  private setUpTools(server: McpServer) {
    server.tool("refresh-api-catalog", "Refresh the API catalog", async () => {
      try {
        this.logger.info('Refreshing API catalog');
        await this.specExplorer.refresh();
        this.logger.info('API catalog refreshed successfully');
        return {
          content: [{ type: "text", text: "API catalog refreshed" }],
        };
      } catch (error) {
        this.logger.error('Failed to refresh API catalog', { error });
        throw error;
      }
    });

    // server.tool(
    //   'sync-api-catalog',
    //   'Sync the API catalog',
    //   async () => {
    //     await this.specExplorer.sync();
    //     return {
    //       content: [{ type: "text", text: "API catalog synced" }],
    //     };
    //   }
    // );

    server.tool(
      "get-api-catalog",
      "Get the API catalog, the catalog contains metadata about all openapi specifications, their operations and schemas",
      async () => {
        try {
          this.logger.debug('Getting API catalog');
          const catalog = await this.specExplorer.getApiCatalog();
          return {
            content: [
              { type: "text", text: stringify({ catalog }, { indent: 2 }) },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to get API catalog', { error });
          throw error;
        }
      }
    );

    server.tool(
      "search-api-operations",
      "Search for operations across specifications",
      {
        query: z.string(),
        specId: z.string().optional(),
      },
      async (args, extra) => {
        try {
          this.logger.debug('Searching API operations', { query: args.query, specId: args.specId });
          const operations = await this.specExplorer.searchOperations(
            args.query,
            args.specId
          );
          return {
            content: [
              { type: "text", text: stringify({ operations }, { indent: 2 }) },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to search API operations', { error, query: args.query });
          throw error;
        }
      }
    );

    server.tool(
      "search-api-schemas",
      "Search for schemas across specifications",
      {
        query: z.string(),
        specId: z.string().optional(),
      },
      async (args, extra) => {
        try {
          this.logger.debug('Searching API schemas', { query: args.query, specId: args.specId });
          const schemas = await this.specExplorer.searchSchemas(args.query, args.specId);
          return {
            content: [
              { type: "text", text: stringify({ schemas }, { indent: 2 }) },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to search API schemas', { error, query: args.query });
          throw error;
        }
      }
    );

    server.tool(
      "load-api-operation-by-operationId",
      "Load an operation by operationId",
      {
        specId: z.string(),
        operationId: z.string(),
      },
      async (args, extra) => {
        try {
          this.logger.debug('Loading API operation by ID', { specId: args.specId, operationId: args.operationId });
          const operation = await this.specExplorer.findOperationById(
            args.specId,
            args.operationId
          );
          if (!operation) {
            this.logger.warn('Operation not found', { specId: args.specId, operationId: args.operationId });
          }
          return {
            content: [
              { type: "text", text: stringify(operation, { indent: 2 }) },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to load API operation by ID', { 
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
        method: z.string(),
      },
      async (args, extra) => {
        try {
          this.logger.debug('Loading API operation by path and method', {
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
            this.logger.warn('Operation not found', {
              specId: args.specId,
              path: args.path,
              method: args.method
            });
          }
          return {
            content: [
              { type: "text", text: stringify(operation, { indent: 2 }) },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to load API operation by path and method', {
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
        schemaName: z.string(),
      },
      async (args, extra) => {
        try {
          this.logger.debug('Loading API schema', { specId: args.specId, schemaName: args.schemaName });
          const schema = await this.specExplorer.findSchemaByName(
            args.specId,
            args.schemaName
          );
          if (!schema) {
            this.logger.warn('Schema not found', { specId: args.specId, schemaName: args.schemaName });
          }
          return {
            content: [{ type: "text", text: stringify(schema, { indent: 2 }) }],
          };
        } catch (error) {
          this.logger.error('Failed to load API schema', {
            error,
            specId: args.specId,
            schemaName: args.schemaName
          });
          throw error;
        }
      }
    );
  }

  private setUpPrompts(server: McpServer) {
    server.prompt(
      "search-api-operations",
      "Search for operations across specifications",
      {
        query: z.string(),
        specId: z.string().optional(),
      },
      async (args, extra) => {
        const operations = await this.specExplorer.searchOperations(
          args.query,
          args.specId
        );
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `asdf`,
              },
            },
          ],
        };
      }
    );

    server.prompt(
      "find-operation-by-operationId",
      "Find an operation by specId and operationId",
      {
        operationId: z.string(),
        specId: z.string(),
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
                text: operation?.operation.summary ?? "",
              },
            },
          ],
        };
      }
    );

    server.prompt(
      "find-operation-by-path-and-method",
      "Find an operation by path and method",
      {
        specId: z.string(),
        path: z.string(),
        method: z.string(),
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
                text: operation?.operation.summary ?? "",
              },
            },
          ],
        };
      }
    );
  }

  private setUpResources(server: McpServer) {
    // server.resource({
    //   name: "api-operations",
    //   description: "API operations",
    //   schema: z.object({}),
    // });
  }
}
