#!/usr/bin/env node
'use strict';

const assert = require('assert');

/**
 * Normalize a person name for deterministic comparison and de-duplication.
 * Preserves original DB display names by only transforming comparison values.
 */
function normalizeNameForComparison(name, options = {}) {
  const { collapseWhitespace = true } = options;

  let text = String(name ?? '').trim();
  if (text === '') return '';

  if (collapseWhitespace) {
    text = text.replace(/\s+/g, ' ');
  }

  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US');
}

function runNormalizationSelfTest() {
  assert.strictEqual(normalizeNameForComparison('Ü'), 'u');
  assert.strictEqual(normalizeNameForComparison('ü'), 'u');
  assert.strictEqual(normalizeNameForComparison('Ó'), 'o');
  assert.strictEqual(normalizeNameForComparison('ó'), 'o');
  assert.strictEqual(
    normalizeNameForComparison('José'),
    normalizeNameForComparison('Jose'),
  );
  assert.strictEqual(
    normalizeNameForComparison('Renée'),
    normalizeNameForComparison('Renee'),
  );
  assert.strictEqual(
    normalizeNameForComparison('  Meryl   Streep  '),
    normalizeNameForComparison('meryl streep'),
  );
}

runNormalizationSelfTest();

module.exports = {
  normalizeNameForComparison,
};
