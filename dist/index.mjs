import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { C as ConsoleLogger, F as FileSystemSpecService, D as DefaultSpecScanner, a as DefaultSpecProcessor, M as McpService } from './shared/mcp-openapi.D6kDniSu.mjs';
import '@apidevtools/json-schema-ref-parser';
import 'fs/promises';
import 'path';
import 'yaml';
import 'fuse.js';
import '@modelcontextprotocol/sdk/server/mcp.js';
import 'zod';

const specServiceConfig = {
  basePath: "/Users/peisong/Documents/apis",
  catalogDir: "_catalog",
  dereferencedDir: "_dereferenced",
  retryAttempts: 3,
  retryDelay: 1e3,
  cache: {
    maxSize: 1e3,
    ttl: 60 * 60 * 1e3
    // 1 hour
  }
};
const logger = new ConsoleLogger();
const specService = new FileSystemSpecService(
  new DefaultSpecScanner(new DefaultSpecProcessor()),
  specServiceConfig,
  logger
);
const server = new McpService(specService).createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
