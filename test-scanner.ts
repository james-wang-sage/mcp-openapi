import { DefaultSpecProcessor } from './src/core/SpecProcessor.js';
import { DefaultSpecScanner, SpecScanError } from './src/core/SpecScanner.js';

async function testScan(dirPath: string) {
  console.log(`Scanning directory: ${dirPath}`);

  // Create scanner and processor
  const specProcessor = new DefaultSpecProcessor();
  const specScanner = new DefaultSpecScanner(specProcessor);

  try {
    for await (const result of specScanner.scan(dirPath)) {
      if (result.error) {
        console.warn(`Error scanning file ${result.filename}: ${result.error.message}`);
        if (result.error instanceof SpecScanError && result.error.cause) {
          console.warn(`Cause: ${result.error.cause.message}`);
          console.warn(`Stack: ${result.error.cause.stack}`);
        }
        continue;
      }

      console.log(`Successfully processed: ${result.filename} (ID: ${result.specId})`);
    }
  } catch (error) {
    console.error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Path to scan
const dirPath = process.argv[2] || '/Users/jameswang/projects/oauth2/app/source/openapispec/ap/paths';

testScan(dirPath).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
