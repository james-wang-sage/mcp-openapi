import fs from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';

async function scanDirectory(dirPath: string) {
  console.log(`Scanning directory: ${dirPath}`);

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
            parsedContent = parse(content);
          }

          // Basic validation of OpenAPI structure
          if (!parsedContent || typeof parsedContent !== 'object') {
            console.error(`Invalid content in ${file}: Not an object`);
            continue;
          }

          if (!parsedContent.openapi) {
            console.error(`Invalid OpenAPI spec in ${file}: Missing 'openapi' field`);
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

          console.log(`Successfully parsed ${file}`);
          console.log(`Title: ${parsedContent.info.title}`);
          console.log(`Version: ${parsedContent.info.version}`);
          console.log(`Paths: ${Object.keys(parsedContent.paths).length}`);

          // Check for potential issues that might cause SpecScanner to fail

          // 1. Check for $ref values that might be problematic
          const refs: string[] = [];
          const findRefs = (obj: any, path: string) => {
            if (!obj || typeof obj !== 'object') return;

            if (obj.$ref && typeof obj.$ref === 'string') {
              refs.push(`${path} -> ${obj.$ref}`);
            }

            for (const key in obj) {
              findRefs(obj[key], `${path}.${key}`);
            }
          };

          findRefs(parsedContent, 'root');

          if (refs.length > 0) {
            console.log(`Found ${refs.length} $ref values:`);
            refs.slice(0, 5).forEach(ref => console.log(`  ${ref}`));
            if (refs.length > 5) {
              console.log(`  ... and ${refs.length - 5} more`);
            }
          }

          // 2. Check for potential circular references
          const components = parsedContent.components;
          if (components && components.schemas) {
            const schemas = Object.keys(components.schemas);
            console.log(`Found ${schemas.length} schemas in components`);

            // Look for schemas that reference themselves
            const selfRefs = refs.filter(ref => {
              for (const schema of schemas) {
                if (ref.includes(`root.components.schemas.${schema}`) &&
                    ref.includes(`-> #/components/schemas/${schema}`)) {
                  return true;
                }
              }
              return false;
            });

            if (selfRefs.length > 0) {
              console.log(`WARNING: Found ${selfRefs.length} potential circular references:`);
              selfRefs.forEach(ref => console.log(`  ${ref}`));
            }
          }

          // 3. Check for invalid path templates
          const invalidPaths = Object.keys(parsedContent.paths).filter(p => {
            // Check for unbalanced braces
            const openBraces = (p.match(/{/g) || []).length;
            const closeBraces = (p.match(/}/g) || []).length;
            return openBraces !== closeBraces;
          });

          if (invalidPaths.length > 0) {
            console.log(`WARNING: Found ${invalidPaths.length} paths with unbalanced braces:`);
            invalidPaths.forEach(p => console.log(`  ${p}`));
          }

        } catch (parseError) {
          console.error(`Error parsing ${file}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          if (parseError instanceof Error && parseError.stack) {
            console.error(`Stack: ${parseError.stack}`);
          }
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      }
    }
  } catch (dirError) {
    console.error(`Error reading directory: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
    throw dirError;
  }
}

// Path to scan
const dirPath = process.argv[2] || '/Users/jameswang/projects/oauth2/app/source/openapispec/ap/paths';

scanDirectory(dirPath).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
