#!/usr/bin/env node

import { Command } from "commander";
import { DefaultSpecScanner } from "../core/SpecScanner";
import { DefaultSpecProcessor } from "../core/SpecProcessor";
import { ConsoleLogger } from "../core/Logger";
import { OpenAPIV3 } from "openapi-types";

/**
 * Interface representing an API endpoint
 */
interface ApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  specId: string;
}

/**
 * Lists all endpoints defined in OpenAPI specifications in a directory
 * @param dirPath Path to the directory containing OpenAPI specifications
 * @returns Array of API endpoints
 */
async function listEndpoints(dirPath: string): Promise<ApiEndpoint[]> {
  const logger = new ConsoleLogger();
  logger.info(`Scanning directory: ${dirPath}`);
  
  // Create scanner and processor
  const specProcessor = new DefaultSpecProcessor();
  const specScanner = new DefaultSpecScanner(specProcessor);
  
  // Scan the directory for OpenAPI specifications
  const endpoints: ApiEndpoint[] = [];
  
  try {
    for await (const result of specScanner.scan(dirPath)) {
      if (result.error) {
        logger.warn(`Error scanning file ${result.filename}: ${result.error.message}`);
        continue;
      }
      
      const { spec, specId } = result;
      
      // Extract endpoints from the specification
      for (const path in spec.paths) {
        const pathItem = spec.paths[path];
        
        // Skip if pathItem is not defined or is a reference
        if (!pathItem || '$ref' in pathItem) continue;
        
        // Process each HTTP method in the path
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
        for (const method of methods) {
          const operation = pathItem[method as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;
          
          if (operation) {
            endpoints.push({
              path,
              method,
              operationId: operation.operationId,
              summary: operation.summary,
              description: operation.description,
              specId
            });
          }
        }
      }
    }
    
    return endpoints;
  } catch (error) {
    logger.error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Set up command line interface
const program = new Command();

program
  .name("list-endpoints")
  .description("List all endpoints defined in OpenAPI specifications in a directory")
  .version("1.0.0")
  .requiredOption("-d, --dir <path>", "Directory containing OpenAPI specifications")
  .option("-f, --format <format>", "Output format (text, json)", "text")
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    const endpoints = await listEndpoints(options.dir);
    
    if (options.format === "json") {
      console.log(JSON.stringify(endpoints, null, 2));
    } else {
      // Default text format
      console.log('Found endpoints:');
      endpoints.forEach(endpoint => {
        console.log(`${endpoint.method.toUpperCase()} ${endpoint.path} (${endpoint.specId})`);
        if (endpoint.operationId) {
          console.log(`  operationId: ${endpoint.operationId}`);
        }
        if (endpoint.summary) {
          console.log(`  summary: ${endpoint.summary}`);
        }
      });
      
      // Group endpoints by specification
      const endpointsBySpec = endpoints.reduce((acc, endpoint) => {
        if (!acc[endpoint.specId]) {
          acc[endpoint.specId] = [];
        }
        acc[endpoint.specId].push(endpoint);
        return acc;
      }, {} as Record<string, ApiEndpoint[]>);
      
      // Log summary by specification
      console.log('\nEndpoints by specification:');
      for (const [specId, specEndpoints] of Object.entries(endpointsBySpec)) {
        console.log(`${specId}: ${specEndpoints.length} endpoints`);
      }
      
      // Total count
      console.log(`\nTotal: ${endpoints.length} endpoints`);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
