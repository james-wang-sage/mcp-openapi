import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

/**
 * Interface representing an API operation
 */
class ApiOperation {
  constructor(path, method, operationId, summary, description, specId) {
    this.path = path;
    this.method = method;
    this.operationId = operationId;
    this.summary = summary;
    this.description = description;
    this.specId = specId;
  }
}

/**
 * Process a path item to extract operations
 * @param path API path
 * @param pathItem OpenAPI path item
 * @param specId Specification ID
 * @returns Array of operations for this path
 */
function processPathItem(path, pathItem, specId) {
  const pathOperations = [];

  // Skip if pathItem is not defined or is a reference
  if (!pathItem || '$ref' in pathItem) return pathOperations;

  // Process each HTTP method in the path
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

  for (const method of methods) {
    const operation = pathItem[method];

    if (operation) {
      pathOperations.push(new ApiOperation(
        path,
        method,
        operation.operationId,
        operation.summary,
        operation.description,
        specId
      ));
    }
  }

  return pathOperations;
}

/**
 * Lists all operations defined in OpenAPI specifications in a directory
 * @param dirPath Path to the directory containing OpenAPI specifications
 * @returns Array of API operations
 */
async function listOperations(dirPath) {
  console.log(`Scanning directory: ${dirPath}`);
  
  // Scan the directory for OpenAPI specifications
  const operations = [];
  
  try {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${file}`);
          continue;
        }
        
        const ext = path.extname(file).toLowerCase();
        if (ext !== '.yaml' && ext !== '.yml' && ext !== '.json') {
          console.log(`Skipping non-OpenAPI file: ${file}`);
          continue;
        }
        
        console.log(`Processing file: ${file}`);
        const content = await fs.readFile(filePath, 'utf-8');
        
        let parsedContent;
        try {
          if (ext === '.json') {
            parsedContent = JSON.parse(content);
          } else {
            parsedContent = yaml.parse(content);
          }
          
          // Basic validation of OpenAPI structure
          if (!parsedContent || typeof parsedContent !== 'object') {
            console.error(`Invalid content in ${file}: Not an object`);
            continue;
          }
          
          if (!parsedContent.openapi && !parsedContent.swagger) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'openapi' or 'swagger' field`);
            continue;
          }
          
          if (!parsedContent.info) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'info' field`);
            continue;
          }
          
          if (!parsedContent.paths) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'paths' field`);
            continue;
          }
          
          // Extract specId from the spec
          const specId = parsedContent.info['x-spec-id'] || file;
          
          // Extract operations from the specification
          for (const path in parsedContent.paths) {
            const pathOperations = processPathItem(path, parsedContent.paths[path], specId);
            operations.push(...pathOperations);
          }
          
          console.log(`Successfully processed ${file}`);
          console.log(`Title: ${parsedContent.info.title}`);
          console.log(`Version: ${parsedContent.info.version}`);
          console.log(`Paths: ${Object.keys(parsedContent.paths).length}`);
          
        } catch (parseError) {
          console.error(`Error parsing ${file}: ${parseError.message}`);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}: ${fileError.message}`);
      }
    }
    
    return operations;
  } catch (dirError) {
    console.error(`Failed to scan directory: ${dirError.message}`);
    throw dirError;
  }
}

/**
 * Display operations in text format
 * @param operations List of API operations
 */
function displayOperationsAsText(operations) {
  // Display individual operations
  console.log('\nFound operations:');
  operations.forEach(operation => {
    console.log(`${operation.method.toUpperCase()} ${operation.path} (${operation.specId})`);
    if (operation.operationId) {
      console.log(`  operationId: ${operation.operationId}`);
    }
    if (operation.summary) {
      console.log(`  summary: ${operation.summary}`);
    }
  });

  // Group operations by specification
  const operationsBySpec = operations.reduce((acc, operation) => {
    if (!acc[operation.specId]) {
      acc[operation.specId] = [];
    }
    acc[operation.specId].push(operation);
    return acc;
  }, {});

  // Log summary by specification
  console.log('\nOperations by specification:');
  for (const [specId, specOperations] of Object.entries(operationsBySpec)) {
    console.log(`${specId}: ${specOperations.length} operations`);
  }

  // Total count
  console.log(`\nTotal: ${operations.length} operations`);
}

// Path to scan
const dirPath = process.argv[2] || '/Users/jameswang/projects/oauth2/app/source/openapispec/ap/paths';

// Run the test
listOperations(dirPath)
  .then(operations => {
    displayOperationsAsText(operations);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
