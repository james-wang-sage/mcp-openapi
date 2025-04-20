import { DefaultSpecProcessor } from './src/core/SpecProcessor.ts';
import { DefaultSpecScanner } from './src/core/SpecScanner.ts';

async function testScan(dirPath: string) {
  console.log(`Scanning directory: ${dirPath}`);

  // Create scanner and processor
  const specProcessor = new DefaultSpecProcessor();
  const specScanner = new DefaultSpecScanner(specProcessor);

  let successCount = 0;
  let errorCount = 0;

  try {
    for await (const result of specScanner.scan(dirPath)) {
      if (result.error) {
        errorCount++;
        console.warn(`Warning: Issues with file ${result.filename}: ${result.error.message}`);
        // Still have some data
        console.log(`  But we still got specId: ${result.specId}`);
        console.log(`  Paths: ${Object.keys(result.spec.paths || {}).length}`);
      } else {
        successCount++;
        console.log(`Successfully processed: ${result.filename} (ID: ${result.specId})`);
        console.log(`  Paths: ${Object.keys(result.spec.paths || {}).length}`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Successfully processed: ${successCount} files`);
    console.log(`  Processed with warnings: ${errorCount} files`);
    console.log(`  Total: ${successCount + errorCount} files`);
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
