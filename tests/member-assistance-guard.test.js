// Guardrails for the unfinished admin-assisted member account feature.
// Run with: node tests/member-assistance-guard.test.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('stage202-patch.js', 'utf8');
const chain = fs.readFileSync('stage51-patch.js', 'utf8');
assert.ok(source.includes('delegatedMemberV207'), 'Expected staged delegated-member implementation');
assert.ok(!source.includes('UPDATE transactions SET created_by_account_id'),
  'Never retroactively assign transactions to an admin using a time window');
assert.ok(!chain.includes("require('./stage202-patch.js')"),
  'Incomplete delegated-member implementation must not be enabled in production build');
console.log('PASS: assisted-account guardrails; feature still not enabled.');
