# Decision Log -- COD RTO Decision Engine

This document records key architectural and design decisions made during the development of the COD RTO Decision Engine. Each entry captures the decision, the context that prompted it, the alternatives considered, and the rationale for the choice made.

---

## DL-001: MERN Stack Over Python/Django

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-01                                                                                   |
| **Decision**           | Use MERN (MongoDB, Express.js, React.js, Node.js) as the full technology stack.              |
| **Context**            | The project requires a REST API, a real-time dashboard, and CLI scripting tools. The team has existing JavaScript/Node.js expertise. The decision engine is rule-based, not ML-heavy.  |
| **Alternatives**       | (A) Python + Django + React -- strong for ML workloads, but adds a language boundary between backend and frontend. (B) Python + Flask + vanilla JS -- lighter but weaker on the dashboard side. (C) Full Python with Streamlit -- fast for prototyping but limited UI customization and poor production deployment story. |
| **Rationale**          | The decision engine is deterministic (if/else rules, regex, config lookups), not a machine learning pipeline. Python's advantage in ML libraries (scikit-learn, pandas) is irrelevant here. MERN allows a single language across the entire stack, simplifies hiring and maintenance, and Node.js handles the I/O-bound workload (API requests, database queries, WhatsApp API calls) efficiently. MongoDB's document model maps naturally to order records with variable address fields. If ML scoring is added later, it can be integrated as a microservice without rewriting the core engine. |

---

## DL-002: Four Buckets, Not Two (Ship/Cancel)

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-03                                                                                   |
| **Decision**           | Classify orders into 4 action buckets: Ship As-Is, Ship After Confirmation, Nudge to Prepaid, Hold/Cancel. |
| **Context**            | A binary ship/cancel system is simpler to implement but creates two problems: (1) cancelling ambiguous orders destroys CAC on genuine buyers, (2) shipping all ambiguous orders accepts the full RTO cost. The data shows a wide spectrum of risk (17% RTO in Maharashtra vs. 53% in Bihar) that a binary system cannot accommodate. |
| **Alternatives**       | (A) Binary ship/cancel -- simple but lossy on both ends. (B) Three buckets (ship/confirm/cancel) -- misses the prepaid conversion opportunity. (C) Continuous risk score with a single threshold -- requires choosing one cutoff that either catches too few RTOs or blocks too many genuine orders. |
| **Rationale**          | Four buckets map to four distinct operational responses, each with different cost/benefit profiles. "Ship After Confirmation" preserves genuine orders that a binary system would cancel. "Nudge to Prepaid" converts the RTO risk into a revenue-positive interaction. The 4-bucket model resolves the Operations vs. Marketing tension by giving each team a bucket that serves their interests: Operations gets Hold/Cancel; Marketing gets Ship As-Is and a WhatsApp engagement channel. |

---

## DL-003: State-Level Gating, Not Pincode Blacklisting

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-05                                                                                   |
| **Decision**           | Use state-level risk tiers instead of pincode-level blacklists.                              |
| **Context**            | Industry practice commonly involves maintaining pincode blacklists based on high RTO rates. Analysis of the 2,018-order dataset revealed extreme data sparsity at the pincode level: 1,066 unique pincodes, with the vast majority having only 1-2 orders each. Only 4 pincodes have both 5+ orders and >50% RTO rate. |
| **Alternatives**       | (A) Pincode blacklist -- standard industry approach but statistically unreliable with sparse data. (B) District-level aggregation -- better sample sizes but district data was not in the dataset. (C) Cluster-based geographic zones -- adds complexity without clear benefit over state-level. |
| **Rationale**          | A pincode with 2 orders (1 RTO, 1 delivered) has a 50% RTO rate but zero statistical significance. Blacklisting it blocks all future orders from that area based on a coin flip. At the state level, sample sizes are large enough (Bihar: 146 orders, UP: 197 orders) for rates to be meaningful. The underlying driver -- regional logistics infrastructure quality -- operates at the state level, not the pincode level. The system can adopt pincode-level gating in the future once order volume per pincode reaches statistical significance (suggested minimum: 20 orders). |

---

## DL-004: Rs.50 Prepaid Discount (Financial Justification)

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-07                                                                                   |
| **Decision**           | Offer a Rs.50 prepaid discount to nudge high-risk COD orders to prepaid payment.             |
| **Context**            | High-risk COD orders have an expected RTO cost of Rs.169.40. Converting to prepaid eliminates this risk entirely and also removes the COD collection fee (~Rs.49.75 at 2-3% of AOV). The discount must be large enough to motivate conversion but small enough to remain profitable. |
| **Alternatives**       | (A) Rs.25 discount -- may be too small to motivate behavior change. (B) Rs.100 discount -- motivating but erodes margin significantly (Rs.100 out of Rs.402.38 gross margin = 24.9% margin hit). (C) Free shipping offer instead of discount -- unclear value perception; shipping is already included in most D2C pricing. (D) No incentive, just a request -- low conversion expected. |
| **Rationale**          | At Rs.50 discount: the brand loses Rs.50 per conversion but saves Rs.169.40 in avoided RTO cost and Rs.49.75 in COD fees. Net saving per conversion: Rs.169.15. Even at a 20% conversion rate from a batch of 100 nudged orders, the brand saves approximately Rs.3,383. The Rs.50 amount is psychologically meaningful (visible on a Rs.649 order) without being so large that it trains customers to always wait for discounts. The math is decisively positive at any conversion rate above 4%. |

---

## DL-005: LLM for Address Parsing Only, Not All Decisions

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-08                                                                                   |
| **Decision**           | Use LLM/AI assistance only for address quality assessment (when enabled). All other decision logic is deterministic code. |
| **Context**            | The decision engine could theoretically use an LLM for all order evaluation (pass the entire order to GPT and ask "is this risky?"). This would be simpler to code but introduces latency, cost, non-determinism, and an inability to explain individual decisions. |
| **Alternatives**       | (A) Full LLM evaluation -- simple prompt but non-deterministic, expensive at scale (Rs.0.50-2.00 per call x 3,000 orders/month), and impossible to audit. (B) ML model trained on historical data -- better than LLM for latency but requires ongoing retraining and still lacks explainability. (C) Pure regex for everything including addresses -- fast and deterministic but cannot distinguish "near temple" (valid) from "near" (insufficient). |
| **Rationale**          | Phone validation is a 10-digit regex check -- 100% accurate, zero ambiguity. Financial math is arithmetic -- deterministic by definition. Customer history is a database lookup -- factual. State/city risk is a config lookup -- deterministic. Only address quality assessment in the Indian context requires semantic understanding: distinguishing "ph krke aana Govt School ke paas" (valid Hinglish delivery instruction, 24.75% RTO) from "asdfgh" (gibberish, 63.69% RTO). The LLM is used only where code genuinely cannot replicate human judgment. Everything else stays in code for speed, cost, determinism, and auditability. |

---

## DL-006: Hinglish Landmarks Treated as Valid Addresses

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-09                                                                                   |
| **Decision**           | Treat addresses containing Hinglish landmark phrases ("ke paas", "ke samne", "wali gali", "ph krke aana") as valid delivery instructions, not as suspicious or low-quality inputs. |
| **Context**            | Initial rule drafts flagged all non-standard addresses as risky. Data analysis revealed that addresses with Hinglish landmarks have a 24.75% RTO rate -- lower than the overall 28.41% average. These addresses come from genuine Tier-2/3 buyers in areas where formal street addresses do not exist. |
| **Alternatives**       | (A) Flag all informal addresses as risky -- penalizes genuine Tier-2/3 buyers, increases false positives. (B) Ignore address quality entirely -- misses the strong signal from gibberish addresses (63.69% RTO). (C) Manually categorize every address pattern -- not scalable. |
| **Rationale**          | The data is unambiguous. Hinglish landmark addresses perform better than average. Penalizing them would disproportionately affect the brand's growth segment (Tier-2/3 cities) and destroy the Meta Ads investment targeting these buyers. The system explicitly whitelists known Hinglish landmark patterns and only flags addresses that lack any meaningful delivery information. |

---

## DL-007: max_prior_rto = 2, Not 1

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-10                                                                                   |
| **Decision**           | Set the Hold/Cancel threshold at 2 or more prior RTOs, not 1.                               |
| **Context**            | Customers with 2+ prior RTOs have a 76.47% RTO rate (26 out of 34 orders). Customers with exactly 1 prior RTO show mixed behavior, with RTO rates varying from 10% to 45% depending on their total order history and other factors. |
| **Alternatives**       | (A) Threshold at 1 -- catches more RTOs but significantly increases false positives. A customer with 1 RTO out of 5 orders is likely genuine; blocking them destroys the relationship. (B) Threshold at 3 -- too permissive; allows customers with 2 prior RTOs (76.47% RTO) to continue placing COD orders. (C) No threshold; use a continuous score -- adds complexity without clear benefit given the sharp jump at the 2-RTO boundary. |
| **Rationale**          | The data shows a clear inflection point at 2 prior RTOs. Below this threshold, behavior is ambiguous. Above it, the RTO rate is extreme (76.47%). Setting the threshold at 1 would catch some additional RTOs but at an unacceptable false positive cost -- blocking customers who had a single delivery issue (wrong item, not home, etc.) and are otherwise good buyers. The 1-prior-RTO group is instead placed in the "Ship After Confirmation" bucket, where WhatsApp verification separates genuine buyers from repeat offenders. |

---

## DL-008: WhatsApp Confirmation Over IVR Calling

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-12                                                                                   |
| **Decision**           | Use WhatsApp Business API for order confirmation, not IVR (Interactive Voice Response) calling. |
| **Context**            | The "Ship After Confirmation" bucket requires contacting the buyer to verify their order. Two primary channels are available: WhatsApp messages and automated IVR phone calls. |
| **Alternatives**       | (A) IVR calling -- higher answer rates in some demographics, but expensive (Rs.2-5 per call), requires telephony infrastructure, and has lower engagement quality (pressing "1" to confirm vs. responding with address details). (B) SMS -- universal reach but low engagement rates (10-15% response) and no rich media support. (C) Email -- near-zero engagement for COD buyers in Tier-2/3 India. (D) Manual calling by agents -- highest quality but not scalable at 3,000 orders/month and costs Rs.15-25 per call with agent time. |
| **Rationale**          | WhatsApp has 95%+ penetration in India's smartphone user base. The WhatsApp Business API supports templated messages at Rs.0.50-1.00 per conversation. Response rates for WhatsApp order confirmations typically range from 60-80%, significantly higher than SMS (10-15%). WhatsApp also supports rich media (product images, address maps) and interactive buttons ("Confirm" / "Edit Address"), making it both the cheapest and most effective channel. The confirmation flow doubles as a customer engagement touchpoint that Marketing can leverage for future communication. |

---

## DL-009: Deterministic Rules First, ML Later

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-14                                                                                   |
| **Decision**           | Launch with a deterministic, rule-based decision engine. Defer machine learning scoring to a future phase. |
| **Context**            | ML models (logistic regression, gradient boosting, neural networks) could potentially achieve higher accuracy than hand-crafted rules. However, they require larger training datasets, ongoing retraining, feature engineering, and model monitoring infrastructure. |
| **Alternatives**       | (A) Train an ML model on the 2,018-order dataset -- possible but the dataset is small for ML, especially for rare classes (e.g., 34 orders with 2+ prior RTOs). Overfitting risk is high. (B) Use a pre-trained fraud detection service (Signifyd, Riskified) -- expensive ($0.50-2.00 per order), designed for Western markets, poor Hinglish address understanding. (C) Hybrid: rules for clear signals, ML for edge cases -- adds complexity without a clear dataset to train the ML component. |
| **Rationale**          | With 2,018 orders, the dataset is large enough to identify strong rule-based patterns but too small for reliable ML generalization. The strongest signals in the data (prior RTOs, gibberish addresses, fake names) are easily captured by deterministic rules with 100% reproducibility and zero per-query cost. Rules are transparent: every decision can be explained with "this order was held because the customer has 3 prior RTOs." An ML model that says "risk score 0.73" requires additional infrastructure to interpret. The plan is to accumulate 10,000+ orders with the rule-based system running, then evaluate whether an ML layer adds meaningful accuracy improvement. |

---

## DL-010: Not Blocking All Meta Ads Orders Despite Higher RTO

| Field                  | Detail                                                                                       |
|------------------------|----------------------------------------------------------------------------------------------|
| **Date**               | 2024-10-15                                                                                   |
| **Decision**           | Do not block, restrict, or deprioritize COD orders originating from Meta Ads campaigns.      |
| **Context**            | Meta Ads orders have a 31.32% RTO rate compared to 22.66% for direct/organic orders. Operations has suggested disabling COD for Meta-sourced traffic or adding a blanket confirmation step for all Meta orders. |
| **Alternatives**       | (A) Disable COD for Meta traffic -- immediately reduces RTO but also immediately reduces order volume by 38.6% (779 orders). The revenue loss vastly exceeds the RTO savings. (B) Add confirmation step to all Meta orders -- adds friction to 779 orders to prevent RTOs on ~244 of them. The other 535 genuine buyers experience unnecessary delay. (C) Increase Meta campaign quality (audience refinement, lookalike optimization) -- correct long-term but does not address the current order pipeline. |
| **Rationale**          | Meta Ads contributed 779 of 2,017 orders (38.6% of volume). At Rs.649 AOV and 62% gross margin, the delivered Meta orders generated approximately Rs.649 x 535 x 0.62 = Rs.2,15,287 in gross margin. Blocking all Meta COD orders to avoid Rs.244 x Rs.169.40 = Rs.41,334 in RTO costs would sacrifice over Rs.2,15,000 in margin. The correct approach is to apply the same 4-bucket evaluation to Meta orders as to all others, using the _order-level_ risk signals (address quality, customer history, state) rather than punishing the _channel_. Meta orders with clean signals ship normally. Meta orders with risk signals go through confirmation or prepaid nudge. The channel is not the problem; specific order characteristics within the channel are. |
