/**
 * addressEvaluator.test.js
 *
 * Unit tests for the address evaluation logic, verifying that Hinglish
 * landmarks are correctly identified as valid, gibberish is caught,
 * and structured addresses are parsed.
 */

const { evaluateAddress } = require('../engine/addressEvaluator');

describe('Address Evaluator', () => {
  test('Identifies Hinglish landmark delivery instruction as valid', async () => {
    const address = 'ph krke aana Govt School ke paas';
    const result = await evaluateAddress(address);

    expect(result.is_valid).toBe(true);
    expect(result.completeness).toBe('landmark_only');
    expect(result.has_landmark).toBe(true);
  });

  test('Identifies mandir/temple landmark as valid', async () => {
    const address = 'Shiv Mandir ke saamne, gali number 3';
    const result = await evaluateAddress(address);

    expect(result.is_valid).toBe(true);
    expect(result.completeness).toBe('landmark_only');
    expect(result.has_landmark).toBe(true);
  });

  test('Flags single period or punctuation as gibberish', async () => {
    const address = '...';
    const result = await evaluateAddress(address);

    expect(result.is_valid).toBe(false);
    expect(result.completeness).toBe('gibberish');
  });

  test('Flags test placeholder string as gibberish', async () => {
    const address = 'xyz';
    const result = await evaluateAddress(address);

    expect(result.is_valid).toBe(false);
    expect(result.completeness).toBe('gibberish');
  });

  test('Identifies structured address with flat number and sector', async () => {
    const address = 'Flat 402, Royal Palms, Sector 62';
    const result = await evaluateAddress(address);

    expect(result.is_valid).toBe(true);
    expect(result.completeness).toBe('complete');
  });

  test('Identifies long descriptive address as complete', async () => {
    const address = 'House number 12 near water tank main market area';
    const result = await evaluateAddress(address);

    expect(result.is_valid).toBe(true);
    expect(result.completeness).toBe('complete');
  });
});
