import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

async function scanDirectory(dirPath) {
  console.log(`Scanning directory: ${dirPath}`);

  try {
    const files = await fs.readdir(dirPath);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${file}`);
          skippedCount++;
          continue;
        }

        const ext = path.extname(file).toLowerCase();
        if (ext !== '.yaml' && ext !== '.yml' && ext !== '.json') {
          console.log(`Skipping non-OpenAPI file: ${file}`);
          skippedCount++;
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
            errorCount++;
            continue;
          }

          // Check for OpenAPI version
          const hasOpenApiVersion = (
            "openapi" in parsedContent ||
            ("swagger" in parsedContent && parsedContent.swagger === "2.0")
          );

          if (!hasOpenApiVersion) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'openapi' or 'swagger' field`);
            errorCount++;
            continue;
          }

          if (!parsedContent.info) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'info' field`);
            errorCount++;
            continue;
          }

          // For OpenAPI 3.0, paths is required
          if ("openapi" in parsedContent && !parsedContent.paths) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'paths' field`);
            errorCount++;
            continue;
          }

          // Check for external references
          const refs = [];
          const findRefs = (obj, path) => {
            if (!obj || typeof obj !== 'object') return;

            if (obj.$ref && typeof obj.$ref === 'string' && !obj.$ref.startsWith('#')) {
              refs.push(`${path} -> ${obj.$ref}`);
            }

            for (const key in obj) {
              findRefs(obj[key], `${path}.${key}`);
            }
          };

          findRefs(parsedContent, 'root');

          successCount++;
          console.log(`Successfully parsed ${file}`);
          console.log(`Title: ${parsedContent.info.title}`);
          console.log(`Version: ${parsedContent.info.version}`);
          console.log(`Paths: ${Object.keys(parsedContent.paths || {}).length}`);

          if (refs.length > 0) {
            console.log(`Found ${refs.length} external $ref values:`);
            refs.slice(0, 5).forEach(ref => console.log(`  ${ref}`));
            if (refs.length > 5) {
              console.log(`  ... and ${refs.length - 5} more`);
            }
          }

        } catch (parseError) {
          console.error(`Error parsing ${file}: ${parseError.message}`);
          errorCount++;
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}: ${fileError.message}`);
        errorCount++;
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Successfully processed: ${successCount} files`);
    console.log(`  Failed to process: ${errorCount} files`);
    console.log(`  Skipped: ${skippedCount} files`);
    console.log(`  Total: ${successCount + errorCount + skippedCount} files`);

  } catch (dirError) {
    console.error(`Error reading directory: ${dirError.message}`);
    throw dirError;
  }
}

// Path to scan
const dirPath = process.argv[2] || '/Users/jameswang/projects/oauth2/app/source/openapispec/ap/paths';

scanDirectory(dirPath).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
