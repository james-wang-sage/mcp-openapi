import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SpecServiceConfig } from "./core/interfaces/ISpecService";
import { ConsoleLogger } from "./core/Logger";
import { DefaultSpecProcessor } from "./core/SpecProcessor";
import { DefaultSpecScanner } from "./core/SpecScanner";
import { FileSystemSpecService } from "./core/SpecService";
import { McpService } from "./McpService";

// Configuration for the spec service
const specServiceConfig: SpecServiceConfig = {
  basePath: "/Users/peisong/Documents/apis",
  catalogDir: "_catalog",
  dereferencedDir: "_dereferenced",
  retryAttempts: 3,
  retryDelay: 1000,
  cache: {
    maxSize: 1000,
    ttl: 60 * 60 * 1000, // 1 hour
  },
};

// Create logger instance
const logger = new ConsoleLogger();

// Initialize the service with proper configuration
const specService = new FileSystemSpecService(
  new DefaultSpecScanner(new DefaultSpecProcessor()),
  specServiceConfig,
  logger
);

// Create and configure the MCP service
const server = new McpService(specService).createServer();

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
