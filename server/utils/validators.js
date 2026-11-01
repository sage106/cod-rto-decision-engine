/**
 * validators.js
 *
 * Pure validation functions for order data fields.  These are used by the
 * decision engine to quickly flag suspicious input before deeper analysis.
 *
 * IMPORTANT DESIGN NOTE
 * ---------------------
 * Hinglish landmark addresses ("ph krke aana", "mandir ke paas", "water tank
 * ke saamne") are common in Tier-2/3 India and have a 24.75% RTO rate --
 * lower than the overall 28.41%.  They must NOT be flagged as gibberish.
 */

/**
 * Set of common fake / test names.  Normalised to lowercase for comparison.
 * @type {Set<string>}
 */
const FAKE_NAMES = new Set([
  'test', 'testing', 'asdf', 'qwerty', 'abc', 'xyz', 'na', 'n/a',
  'aaa', 'bbb', 'ccc', 'xxx', 'zzz', 'dummy', 'fake', 'sample',
  'null', 'none', 'abcd', 'abcde', 'unknown', 'customer',
]);

/**
 * Determine whether a customer name looks fake or auto-generated.
 *
 * @param {string} name - The customer name to check.
 * @returns {boolean} True if the name matches a known fake pattern.
 */
function isFakeName(name) {
  if (!name || typeof name !== 'string') return true;

  const normalised = name.trim().toLowerCase();

  // Empty after trimming
  if (normalised.length === 0) return true;

  // Direct match against known fakes
  if (FAKE_NAMES.has(normalised)) return true;

  // Single character repeated (e.g. "aaaa", "bbbb")
  if (/^(.)\1+$/.test(normalised)) return true;

  // Keyboard mash patterns -- all consonants, no vowels, length >= 3
  if (normalised.length >= 3 && !/[aeiou\s]/.test(normalised)) return true;

  return false;
}

/**
 * Validate a 10-digit Indian mobile number.
 * Accepts optional +91 or 0 prefix.  The core number must start with 6-9.
 *
 * @param {string|number} phone - The phone number to validate.
 * @returns {boolean} True if the phone number is a valid Indian mobile.
 */
function isValidPhone(phone) {
  if (phone === null || phone === undefined) return false;

  const cleaned = String(phone).replace(/[\s\-()]+/g, '');

  // Strip country code or leading zero
  const stripped = cleaned.replace(/^(\+91|91|0)/, '');

  // Must be exactly 10 digits starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(stripped);
}

/**
 * Gibberish address words (normalised to lowercase).
 * This set is checked via exact match against the full trimmed address and
 * also via inclusion within the address string.
 * @type {string[]}
 */
const GIBBERISH_TOKENS = [
  '.', 'xyz', 'home', 'call me', 'near station', 'na', 'test', 'abc',
  'address', 'x', 'xx', 'xxx', 'abcd', 'asdf', 'qwerty', 'none',
  'n/a', 'null', '-', '--', '...',
];

/**
 * Determine whether an address is gibberish / a placeholder.
 *
 * Design priorities:
 *  1. Flag obvious placeholders (".", "xyz", "home", "call me", <= 4 chars).
 *  2. Do NOT flag Hinglish landmark phrases -- these are legitimate delivery
 *     instructions in Indian logistics.
 *
 * @param {string} address - The delivery address to evaluate.
 * @returns {boolean} True if the address appears to be gibberish.
 */
function isGibberishAddress(address) {
  if (!address || typeof address !== 'string') return true;

  const trimmed = address.trim();

  // Empty or extremely short
  if (trimmed.length === 0) return true;

  const lower = trimmed.toLowerCase();

  // Exact match against gibberish tokens
  for (const token of GIBBERISH_TOKENS) {
    if (lower === token) return true;
  }

  // Too short to be a real address (4 chars or fewer), but first check
  // it is not a valid Hinglish landmark phrase that happens to be short
  if (trimmed.length <= 4) {
    return true;
  }

  // Check if the entire address is just a gibberish phrase (with possible
  // whitespace padding) -- but only if it does NOT contain Hinglish landmark
  // cues that indicate a real delivery instruction.
  const hinglishCues = [
    'ke paas', 'ke pass', 'ke saamne', 'ke samne', 'ke peeche',
    'ke piche', 'ke aage', 'ke age', 'wali gali', 'ph krke',
    'phone krke', 'call krke', 'mandir', 'masjid', 'gurudwara',
    'chowk', 'tiraha', 'mod', 'nagar', 'colony', 'mohalla',
    'gali', 'tola', 'ward', 'panchayat', 'block',
  ];

  const hasHinglishCue = hinglishCues.some((cue) => lower.includes(cue));

  // If the address is short-ish and has no landmark cues, check for
  // gibberish token inclusion
  if (!hasHinglishCue) {
    for (const token of GIBBERISH_TOKENS) {
      // Only match multi-char tokens as whole words to avoid false positives
      if (token.length <= 1) continue;
      const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(lower) && trimmed.length < 10) return true;
    }
  }

  return false;
}

/**
 * Validate a 6-digit Indian pincode.
 * Indian pincodes range from 100000 to 999999 and the first digit is 1-9.
 *
 * @param {string|number} pincode - The pincode to validate.
 * @returns {boolean} True if the pincode is a valid 6-digit Indian pincode.
 */
function isValidPincode(pincode) {
  if (pincode === null || pincode === undefined) return false;
  const str = String(pincode).trim();
  return /^[1-9]\d{5}$/.test(str);
}

module.exports = {
  isFakeName,
  isValidPhone,
  isGibberishAddress,
  isValidPincode,
};
