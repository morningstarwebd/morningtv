// scripts/run-frontend-tests.mjs
// Unified test runner for frontend test suites with graceful Node version validation

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const testFiles = [
  'tests/frontend.test.mjs',
  'tests/store.test.mjs',
  'tests/audioBooster.test.mjs',
  'tests/slices.test.mjs',
];

const major = parseInt(process.versions.node.split('.')[0], 10);
const minor = parseInt(process.versions.node.split('.')[1], 10);

if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `\x1b[31m[Error]\x1b[0m Node.js >= 22.6.0 is required for native TypeScript test execution. Current: v${process.versions.node}`,
  );
  console.error('Please upgrade Node.js to v22 (LTS) or later.');
  process.exit(1);
}

for (const testFile of testFiles) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', testFile],
    {
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
