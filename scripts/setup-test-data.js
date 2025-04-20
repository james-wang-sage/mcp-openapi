#!/usr/bin/env node

/**
 * This script ensures that all required test data files exist
 * Run this script before running tests to ensure all test files are in place
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(path.resolve(__dirname, '..'), 'test/data');

// Files that should exist in the test data directory
const REQUIRED_FILES = [
  {
    name: 'invalid.yaml',
    content: 'invalid: yaml: content'
  },
  {
    name: 'invalid.txt',
    content: 'Not a spec file'
  }
];

// Ensure test data directory exists
if (!fs.existsSync(TEST_DATA_DIR)) {
  console.log(`Creating test data directory: ${TEST_DATA_DIR}`);
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// Create any missing required files
for (const file of REQUIRED_FILES) {
  const filePath = path.join(TEST_DATA_DIR, file.name);

  if (!fs.existsSync(filePath)) {
    console.log(`Creating missing test file: ${file.name}`);
    fs.writeFileSync(filePath, file.content);
  } else {
    console.log(`Test file exists: ${file.name}`);
  }
}

console.log('Test data setup complete!');
