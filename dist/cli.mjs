#!/usr/bin/env node
import { Command } from 'commander';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { C as ConsoleLogger, F as FileSystemSpecService, D as DefaultSpecScanner, a as DefaultSpecProcessor, M as McpService } from './shared/mcp-openapi.D6kDniSu.mjs';
import '@apidevtools/json-schema-ref-parser';
import 'fs/promises';
import 'path';
import 'yaml';
import 'fuse.js';
import '@modelcontextprotocol/sdk/server/mcp.js';
import 'zod';

const program = new Command();
program.name("@reapi/mcp-openapi").description("MCP OpenAPI CLI tool").version("1.0.0").option("-d, --dir <path>", "Specify the directory containing OpenAPI specifications", process.cwd()).option("--catalog-dir <path>", "Specify the catalog directory", "_catalog").option("--dereferenced-dir <path>", "Specify the dereferenced directory", "_dereferenced").parse(process.argv);
const options = program.opts();
const specServiceConfig = {
  basePath: options.dir,
  catalogDir: options.catalogDir,
  dereferencedDir: options.dereferencedDir,
  retryAttempts: 3,
  retryDelay: 1e3,
  cache: {
    maxSize: 1e3,
    ttl: 60 * 60 * 1e3
    // 1 hour
  }
};
async function main() {
  const logger = new ConsoleLogger();
  const specService = new FileSystemSpecService(
    new DefaultSpecScanner(new DefaultSpecProcessor()),
    specServiceConfig,
    logger
  );
  const server = new McpService(specService).createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
