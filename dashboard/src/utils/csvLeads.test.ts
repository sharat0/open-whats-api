import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvLeads } from './csvLeads.ts';

test('successfully parses simple valid CSV leads', () => {
  const csvText = 'phone,name,url,customization\n15550199001,Alice,https://example.com/alice,VIP\n15550199002,Bob,https://example.com/bob,Gold';
  const result = parseCsvLeads(csvText);

  assert.equal(result.error, undefined);
  assert.deepEqual(result.headers, ['phone', 'name', 'url', 'customization']);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], {
    phone: '15550199001@c.us',
    variables: {
      phone: '15550199001',
      name: 'Alice',
      url: 'https://example.com/alice',
      customization: 'VIP',
    },
  });
});

test('auto-detects phone number column from headers', () => {
  const csvText = 'name,Number,url\nCharlie,15550199003,https://example.com/charlie';
  const result = parseCsvLeads(csvText);

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0].phone, '15550199003@c.us');
});

test('defaults to the first column if no phone header is recognized', () => {
  const csvText = 'unrecognized,name,url\n15550199004,David,https://example.com/david';
  const result = parseCsvLeads(csvText);

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0].phone, '15550199004@c.us');
});

test('handles quoted values containing commas and quotes correctly', () => {
  const csvText = 'phone,name,message\n15550199005,"Smith, John","Hello ""World"""';
  const result = parseCsvLeads(csvText);

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0].variables['name'], 'Smith, John');
  assert.equal(result.rows[0].variables['message'], 'Hello "World"');
});

test('returns error for empty or invalid CSV text', () => {
  const resultEmpty = parseCsvLeads('');
  assert.ok(resultEmpty.error);

  const resultNoData = parseCsvLeads('phone,name,url');
  assert.ok(resultNoData.error);
});
