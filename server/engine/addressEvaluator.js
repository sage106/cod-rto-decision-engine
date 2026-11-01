/**
 * addressEvaluator.js
 *
 * Evaluates the quality and completeness of a delivery address using a
 * two-stage approach:
 *
 *  1. Deterministic fast path -- regex and token matching for gibberish,
 *     Hinglish landmarks, and structured addresses.
 *  2. Optional LLM-based evaluation -- when config.llm_enabled is true,
 *     an external LLM is called for ambiguous cases (currently stubbed).
 *
 * CRITICAL DESIGN RULE
 * --------------------
 * Hinglish landmark addresses ("ph krke aana", "mandir ke paas") are VALID
 * delivery instructions.  They have a 24.75% RTO rate -- lower than the
 * overall 28.41%.  The evaluator must return is_valid=true for these.
 */

const { isGibberishAddress } = require('../utils/validators');

// ---------------------------------------------------------------------------
// Regex patterns for Hinglish landmark detection
// ---------------------------------------------------------------------------

const HINGLISH_LANDMARK_PATTERNS = [
  /ke\s*pa+s/i,        // "ke paas", "ke pass", "ke pas"
  /ke\s*saa?mne/i,     // "ke saamne", "ke samne"
  /ke\s*pee?che/i,     // "ke peeche", "ke piche"
  /ke\s*aa?ge/i,       // "ke aage", "ke age"
  /wali\s*gali/i,      // "wali gali"
  /ph\s*krke/i,        // "ph krke" (phone karke)
  /phone\s*krke/i,     // "phone krke"
  /call\s*krke/i,      // "call krke"
  /mandir/i,           // temple reference
  /masjid/i,           // mosque reference
  /gurudwara/i,        // gurudwara reference
  /chowk/i,            // intersection
  /tiraha/i,           // three-way intersection
  /chauraha/i,         // four-way intersection
  /ke\s*pass/i,        // alternate spelling
];

// ---------------------------------------------------------------------------
// Regex patterns for structured / complete addresses
// ---------------------------------------------------------------------------

const STRUCTURED_ADDRESS_PATTERNS = [
  /\d+.*(?:road|rd|street|st|lane|nagar|colony|sector|block|phase|plot|flat|house|floor|apartment|apt|bldg|building)/i,
  /(?:flat|house|plot|hno|h\.no|door)\s*(?:no\.?)?\s*\d+/i,
  /sector\s*\d+/i,
  /\b\d{1,4}\s*[,/\-]\s*\d/i,  // patterns like "12/3", "302, Block"
];

/**
 * Evaluate the quality and completeness of a delivery address.
 *
 * @param {string} address - The raw delivery address string.
 * @param {Object} config  - Engine configuration (must include llm_enabled at minimum).
 * @returns {Promise<{
 *   method: string,
 *   is_valid: boolean,
 *   completeness: string,
 *   has_landmark: boolean,
 *   detail: string
 * }>}
 */
async function evaluateAddress(address, config) {
  const cfg = config || {};

  // ------------------------------------------------------------------
  // Stage 1: Deterministic fast path
  // ------------------------------------------------------------------

  // 1a. Check for Hinglish landmark patterns FIRST, before gibberish check,
  //     because some landmark addresses are short and could be false-positived.
  const hasHinglishLandmark = HINGLISH_LANDMARK_PATTERNS.some((pattern) =>
    pattern.test(address || '')
  );

  if (hasHinglishLandmark) {
    return {
      method: 'deterministic',
      is_valid: true,
      completeness: 'landmark_only',
      has_landmark: true,
      detail: 'Address contains Hinglish landmark reference. Valid for delivery with local knowledge.',
    };
  }

  // 1b. Check gibberish
  if (isGibberishAddress(address)) {
    return {
      method: 'deterministic',
      is_valid: false,
      completeness: 'gibberish',
      has_landmark: false,
      detail: 'Address appears to be a placeholder or gibberish. Cannot be delivered.',
    };
  }

  // 1c. Check structured address patterns
  const isStructured = STRUCTURED_ADDRESS_PATTERNS.some((pattern) =>
    pattern.test(address || '')
  );

  if (isStructured) {
    return {
      method: 'deterministic',
      is_valid: true,
      completeness: 'complete',
      has_landmark: false,
      detail: 'Address contains structured elements (house/flat number, road, sector). Complete address.',
    };
  }

  // 1d. If the address is long enough and has multiple words, treat as
  //     reasonably complete even without structured patterns.
  const words = (address || '').trim().split(/\s+/);
  if (words.length >= 4 && (address || '').trim().length >= 15) {
    return {
      method: 'deterministic',
      is_valid: true,
      completeness: 'complete',
      has_landmark: false,
      detail: 'Address has sufficient length and detail. Considered complete.',
    };
  }

  // ------------------------------------------------------------------
  // Stage 2: LLM evaluation (if enabled)
  // ------------------------------------------------------------------

  if (cfg.llm_enabled) {
    try {
      const llmResult = await callLLMForAddressEvaluation(address);
      return {
        method: 'llm',
        ...llmResult,
      };
    } catch (err) {
      // LLM failure -- fall through to conservative default
    }
  }

  // ------------------------------------------------------------------
  // Fallback: conservative default
  // Prefer confirmation over cancellation -- return landmark_only so the
  // engine routes to SHIP_AFTER_CONFIRMATION rather than HOLD_CANCEL.
  // ------------------------------------------------------------------

  return {
    method: 'deterministic',
    is_valid: true,
    completeness: 'landmark_only',
    has_landmark: false,
    detail: 'Address could not be fully classified. Defaulting to landmark_only for safety.',
  };
}

/**
 * Stub for LLM-based address evaluation.
 * When implemented, this should call an external LLM API with the address
 * and return a structured JSON response.
 *
 * @param {string} address - The address to evaluate.
 * @returns {Promise<{ is_valid: boolean, completeness: string, has_landmark: boolean, detail: string }>}
 */
async function callLLMForAddressEvaluation(address) {
  // STUB: In production, this would call an external API (e.g. OpenAI, Anthropic)
  // with a prompt asking it to classify the address.
  //
  // Expected response shape:
  // {
  //   is_valid: true/false,
  //   completeness: 'complete' | 'landmark_only' | 'gibberish',
  //   has_landmark: true/false,
  //   detail: 'Explanation of the evaluation'
  // }

  return {
    is_valid: true,
    completeness: 'landmark_only',
    has_landmark: false,
    detail: 'LLM evaluation stub -- defaulting to landmark_only.',
  };
}

module.exports = { evaluateAddress };
