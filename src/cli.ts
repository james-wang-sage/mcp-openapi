#!/usr/bin/env node

import { Command } from 'commander';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SpecServiceConfig } from "./core/interfaces/ISpecService";
import { ConsoleLogger } from "./core/Logger";
import { DefaultSpecProcessor } from "./core/SpecProcessor";
import { DefaultSpecScanner } from "./core/SpecScanner";
import { FileSystemSpecService } from "./core/SpecService";
import { McpService } from "./McpService";

const program = new Command();

program
  .name('@reapi/mcp-openapi')
  .description('MCP OpenAPI CLI tool')
  .version('0.0.2')
  .option('-d, --dir <path>', 'Specify the directory containing OpenAPI specifications', process.cwd())
  .option('--catalog-dir <path>', 'Specify the catalog directory', '_catalog')
  .option('--dereferenced-dir <path>', 'Specify the dereferenced directory', '_dereferenced')
  .parse(process.argv);

const options = program.opts();

// Configuration for the spec service
const specServiceConfig: SpecServiceConfig = {
  basePath: options.dir,
  catalogDir: options.catalogDir,
  dereferencedDir: options.dereferencedDir,
  retryAttempts: 3,
  retryDelay: 1000,
  cache: {
    maxSize: 1000,
    ttl: 60 * 60 * 1000, // 1 hour
  },
};

async function main() {
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
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
}); 