# AI Usage Log -- Where AI Helped, Where It Failed

This document provides a transparent account of how AI tools were used during the development of the COD RTO Decision Engine, where AI-generated output required correction, and how every AI suggestion was validated before inclusion.

---

## 1. Overview

**AI tools used:**
- Gemini (Google) -- code generation, data analysis assistance, documentation drafting
- LLM-based address quality assessment -- optional runtime component for evaluating messy Indian addresses

**Scope of AI involvement:**
- Initial data exploration and pattern identification
- Code scaffolding for the Express.js API, React components, and CLI scripts
- Documentation drafting (this file, README, Business Memo, Decision Log)
- Address quality classification logic (the one area where AI is used at runtime)

**AI was NOT used for:**
- Final decision engine rule thresholds (all validated against actual data distributions)
- Financial calculations (deterministic arithmetic, verified manually)
- Database schema design (standard Mongoose modeling)
- Security or authentication logic

---

## 2. The Line Between Code and AI

The decision engine draws a deliberate boundary between what code handles and where AI/LLM assistance is appropriate.

### Code Handles (Deterministic, No AI Needed)

| Task                        | Implementation           | Why Code Is Sufficient                               |
|-----------------------------|--------------------------|------------------------------------------------------|
| Phone number validation     | 10-digit regex           | A phone number is either 10 digits or it is not. No ambiguity, no context needed. A regex is 100% accurate and costs zero compute. |
| Financial calculations      | Arithmetic operations    | AOV x margin percentage = gross margin per order. RTO count x shipping cost = total RTO loss. These are exact formulas with exact inputs. An LLM adds nothing. |
| Customer history lookup     | MongoDB query            | "How many prior RTOs does this customer have?" is a database count query. It returns a number. No interpretation needed. |
| State/city risk tier        | Config lookup            | Bihar is in the high-risk list or it is not. A hash map lookup is O(1), deterministic, and free. |
| Gibberish address detection | Regex pattern matching   | Single-character addresses ("."), known placeholder strings ("xyz", "test", "asdf"), and all-whitespace inputs can be reliably caught with regex patterns. |
| Fake name detection         | Regex pattern matching   | Names like "test", "xyz", "aaa", and single-character entries are unambiguous fraud signals detectable by pattern matching. |
| Rule evaluation + bucketing | If/else logic            | The 4-bucket classification is a deterministic decision tree. Given the same inputs and config, it must always produce the same output. Non-determinism here would be a bug, not a feature. |

### AI Handles (Semantic Understanding Required)

| Task                        | Implementation           | Why AI Is Needed                                      |
|-----------------------------|--------------------------|-------------------------------------------------------|
| Address quality assessment  | LLM call (optional)      | Indian addresses mix Hindi, English, and local delivery conventions. "ph krke aana Govt School ke paas" is a valid delivery instruction that means "call before coming, near the Government School." A regex cannot parse this; it requires understanding of Hinglish, Indian geography, and delivery logistics conventions. |
| Edge-case name evaluation   | LLM call (optional)      | While "test" and "xyz" are caught by regex, names like "Sunny Leone" or "Ab Cd" are ambiguous -- they could be real names or fake entries. An LLM can assess plausibility with cultural context that a regex cannot. |

### Why This Boundary Exists

The boundary is drawn at the point where deterministic logic stops being reliable. Consider the following address inputs:

| Address                              | Regex Assessment | Correct Assessment     |
|--------------------------------------|------------------|------------------------|
| "."                                  | Gibberish        | Gibberish -- correct   |
| "xyz"                                | Gibberish        | Gibberish -- correct   |
| "near temple"                        | Unclear          | Insufficient but real  |
| "ph krke aana Govt School ke paas"   | Unclear          | Valid Hinglish landmark |
| "H.No 45, Sector 12, Noida"         | Structured       | Structured -- correct  |
| "home"                               | Unclear          | Gibberish -- needs AI  |
| "call me"                            | Unclear          | Not an address -- needs AI |

Regex correctly classifies the extremes (obvious gibberish and well-structured addresses) but fails on the middle ground. The middle ground is precisely where Indian addresses live: a mix of Hindi transliteration, English fragments, delivery instructions, and landmark references. This is the only area where an LLM adds value.

---

## 3. Where AI Generated Weak Output

AI tools were helpful for initial scaffolding and exploration, but produced incorrect or suboptimal output in several cases. Each required manual correction backed by data analysis.

### Example 1: AI Suggested Blocking Hinglish Landmark Addresses

**What AI suggested:** The initial AI-generated rule set flagged any address containing Hinglish phrases like "ke paas" (near), "ke samne" (in front of), or "wali gali" (that street) as "low quality" and recommended placing these orders in the Hold/Cancel bucket.

**Why it was wrong:** The AI was pattern-matching on the presence of Hindi words in an address field and assumed that non-English content indicates low quality. It did not consider that in Tier-2/3 Indian cities, these phrases _are_ the address. There are no street numbers or postal addressing conventions in many areas.

**What the data showed:** Orders with Hinglish landmark addresses had a 24.75% RTO rate -- _lower_ than the overall 28.41% average. These buyers were more likely to receive their orders successfully, not less. The AI's suggestion would have penalized the brand's best-performing non-metro customer segment.

**How it was fixed:** The rule was inverted. Hinglish landmark patterns were added to a whitelist of valid address indicators, not a blacklist. The data distribution was analyzed before any rule was coded: RTO rate by address type was computed for gibberish, Hinglish landmarks, short non-gibberish, and structured addresses. Only gibberish (63.69% RTO) was placed in the Hold/Cancel bucket.

### Example 2: AI Suggested Pincode-Level Blacklisting

**What AI suggested:** Following common industry practice, the AI recommended building a pincode blacklist based on historical RTO rates. Pincodes with RTO rates above 40% would have all future COD orders blocked.

**Why it was wrong:** The AI applied a standard e-commerce fraud prevention pattern without checking whether the underlying data supported it. In large-scale e-commerce (millions of orders), pincode-level data is statistically robust. In a 2,018-order dataset spread across 1,066 unique pincodes, it is not.

**What the data showed:** The average number of orders per pincode was 1.89. Only 4 out of 1,066 pincodes had both 5 or more orders and a >50% RTO rate. A pincode with 2 orders (1 RTO) has a "50% RTO rate" that is statistically meaningless. Blacklisting it blocks all future orders from that area based on a sample size of 2.

**How it was fixed:** The geographic risk model was elevated to the state level, where sample sizes are large enough for meaningful analysis (Bihar: 146 orders at 53.42% RTO; UP: 197 orders at 44.67% RTO). The system was designed to accommodate pincode-level gating in the future, once order volume per pincode reaches a minimum threshold of 20 orders with at least 30 days of data.

### Example 3: AI Miscalculated Prepaid Discount Savings

**What AI suggested:** The initial financial model for the prepaid nudge calculated the saving per conversion as simply RTO cost minus discount: Rs.169.40 - Rs.50 = Rs.119.40 per conversion.

**Why it was wrong:** The calculation omitted the COD collection fee. When a buyer pays COD, the brand pays the courier a collection fee (typically 2-3% of order value). When the buyer converts to prepaid, this fee is eliminated entirely.

**What the correct calculation is:**
- RTO cost avoided per conversion: Rs.169.40
- Prepaid discount given: -Rs.50.00
- COD collection fee saved: +Rs.49.75 (estimated at ~2.5% of Rs.649 AOV, plus a fixed component)
- Net saving per conversion: Rs.169.15

The difference (Rs.169.15 vs. Rs.119.40) is material. Over 100 nudged orders at a 20% conversion rate, the correct calculation shows Rs.3,383 in savings versus the AI's Rs.2,388 -- a 42% understatement.

**How it was fixed:** The financial model was rebuilt from first principles, enumerating every cost component that changes when an order converts from COD to prepaid. The corrected model was used in all financial projections in the Business Memo, the backtest script, and the dashboard KPI calculations.

---

## 4. Verification Approach

Every AI-suggested rule or threshold was validated through the following process before inclusion in the decision engine:

1. **Hypothesis formation**: The AI suggestion (or human intuition) generates a candidate rule. Example: "Customers with 2+ prior RTOs should be blocked."

2. **Data segmentation**: The historical dataset is filtered to the relevant segment. Example: all orders where `customer_prior_rto >= 2` (34 orders found).

3. **Outcome measurement**: The actual RTO rate for that segment is calculated. Example: 26 of 34 orders were RTO = 76.47%.

4. **Comparison to baseline**: The segment RTO rate is compared to the overall RTO rate (28.41%). Example: 76.47% vs. 28.41% = 2.69x the baseline risk.

5. **False positive assessment**: The number of genuine (DELIVERED) orders in that segment is counted. Example: 8 of 34 orders were delivered = 23.53% false positive rate. These are genuine buyers who would be blocked.

6. **Financial trade-off**: The cost of blocking false positives (8 x Rs.402.38 = Rs.3,219.04 in lost margin) is weighed against the savings from blocking true positives (26 x Rs.169.40 = Rs.4,404.40 in avoided RTO costs). Example: net positive Rs.1,185.36.

7. **Threshold sensitivity**: Adjacent thresholds are tested. Example: what happens at `customer_prior_rto >= 1`? At `>= 3`? The threshold that maximizes net financial impact while keeping false positives below 5% is selected.

8. **Implementation**: Only after steps 1-7 confirm the rule is data-supported, financially positive, and acceptably precise is it coded into the decision engine.

This process was applied to every rule in the system: the prior RTO threshold, state risk tiers, gibberish patterns, fake name patterns, Hinglish landmark whitelist, phone validation, and prepaid nudge triggers.

---

## 5. Ongoing AI Usage in Production

In the deployed system, AI/LLM usage is:

- **Optional**: The decision engine functions fully without any LLM calls. The LLM is an enhancement for borderline address cases, not a dependency.
- **Cached**: LLM evaluations for address quality are cached by address hash. Repeated orders from the same address do not trigger additional LLM calls.
- **Auditable**: Every LLM call is logged with input, output, and the decision it influenced. The logs are available in the dashboard under the "AI Evaluations" tab.
- **Overridable**: If the LLM assessment disagrees with the rule-based assessment, the rule-based assessment takes precedence by default. The configuration can be changed to give the LLM assessment higher priority, but this is not the default.

**Cost at scale**: At Rs.0.50-1.00 per LLM call (WhatsApp Business API pricing for template messages is separate), with approximately 15-20% of orders requiring address quality assessment, the monthly LLM cost for 3,000 orders is approximately Rs.225-600. This is negligible compared to the Rs.1,42,296 monthly RTO cost the system aims to reduce.
