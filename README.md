# COD RTO Decision Engine -- AI-Powered Order Risk Management

## Overview

Cash-on-Delivery (COD) remains the dominant payment method for D2C e-commerce in India, but it carries a hidden tax: Return-to-Origin (RTO). When a COD order fails delivery -- the customer refuses the package, provides a fake address, or is unreachable -- the brand absorbs the full round-trip shipping cost with zero revenue. For a haircare brand shipping approximately 3,000 COD orders per month at an average order value (AOV) of Rs.649, a 28% RTO rate translates to roughly 840 failed deliveries and Rs.1,42,296 in direct monthly losses before accounting for wasted packaging, inventory lock-up, and the Meta Ads customer acquisition cost (Rs.300+) spent to acquire each of those buyers.

The conventional response -- cancel all suspicious orders -- creates a different problem. It destroys the marketing investment in genuine customers who simply have informal addresses or live in Tier-2/3 cities with less structured logistics infrastructure. This engine takes a data-driven middle path: a deterministic 4-tier decision framework that segments every incoming COD order into one of four action buckets (Ship As-Is, Ship After Confirmation, Nudge to Prepaid, Hold/Cancel) based on address quality, customer history, regional risk, order source, and phone validation signals.

The system was designed and calibrated against a real dataset of 2,018 historical orders. Every rule threshold was validated against actual RTO rates in that data. The result is an engine that protects high-intent buyers (including those writing Hinglish landmark addresses, who have a _lower_ RTO rate than average) while precisely targeting the 10-15% of orders responsible for 40%+ of RTO losses.

---

## Key Features

- **Decision Engine**: Deterministic, rule-based order evaluation with a transparent risk score and 4-bucket classification. No black-box ML -- every decision is explainable.
- **WhatsApp Confirmation Flow**: Automated WhatsApp messages for orders in the "Ship After Confirmation" bucket. Genuine buyers confirm in seconds; fraudulent orders self-select out.
- **Live Dashboard**: React-based interface with KPI cards, bucket distribution charts, order simulation, WhatsApp flow preview, and configuration editor.
- **Backtest CLI**: Run the engine against all historical orders and generate a detailed report showing bucket distribution, accuracy analysis, and financial impact.
- **Configurable Rules**: All thresholds (prior RTO limits, high-risk states, address patterns) are stored in a single configuration file and can be adjusted via the dashboard or directly.

---

## Tech Stack

| Layer     | Technology          | Purpose                              |
|-----------|---------------------|--------------------------------------|
| Frontend  | React.js            | Dashboard, simulator, config editor  |
| Backend   | Express.js (Node)   | REST API, decision engine, services  |
| Database  | MongoDB             | Order storage, decision logs         |
| CLI Tools | Node.js scripts     | Database seeding, backtesting        |

---

## Prerequisites

- **Node.js** 18.0 or later
- **MongoDB** 6.0 or later (local install or MongoDB Atlas connection string)
- **npm** 9.0 or later

---

## Quick Start

### 1. Clone or download the project

```bash
git clone <repository-url>
cd cod-rto-engine
```

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Install client dependencies

```bash
cd ../client
npm install
```

### 4. Configure MongoDB

For a local MongoDB instance, no configuration is needed (the default URI is `mongodb://localhost:27017/cod_rto_engine`).

For MongoDB Atlas or a remote instance, create a `server/.env` file:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/cod_rto_engine
PORT=5000
```

### 5. Seed the database

```bash
cd ..
node scripts/seedDatabase.js
```

This reads `data/orders_sample.csv`, inserts all valid orders into MongoDB, runs the decision engine on each order, stores the results, and prints a summary report.

### 6. Start the backend

```bash
cd server
npm run dev
```

The API server starts on `http://localhost:5000`.

### 7. Start the frontend

```bash
cd ../client
npm start
```

The React dashboard opens at `http://localhost:3000`.

### 8. Open the dashboard

Navigate to [http://localhost:3000](http://localhost:3000) in your browser. The dashboard displays:

- KPI cards (total orders, RTO rate, cost avoided, bucket distribution)
- Bucket distribution chart
- Order simulator (enter order details, see the engine's decision in real time)
- WhatsApp flow simulator
- Configuration editor

### 9. (Optional) Run the backtest

```bash
node scripts/runBacktest.js
```

Supports optional flag overrides:

```bash
node scripts/runBacktest.js --max-prior-rto 3 --high-value 1200
```

### 10. (Optional) Run tests

```bash
cd server
npm test
```

---

## Project Structure

```
cod-rto-engine/
|
|-- client/                          # React.js frontend
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |   |-- KPICards.jsx         # Summary metric cards
|   |   |   |-- BucketChart.jsx      # Bucket distribution visualization
|   |   |   |-- OrderSimulator.jsx   # Interactive order evaluation
|   |   |   |-- WhatsAppSimulator.jsx# WhatsApp flow preview
|   |   |   |-- ConfigEditor.jsx     # Rules configuration UI
|   |   |-- App.jsx
|   |   |-- index.js
|   |-- package.json
|
|-- server/                          # Express.js backend
|   |-- config/
|   |   |-- rulesConfig.js           # All decision thresholds and constants
|   |-- engine/
|   |   |-- decisionEngine.js        # Core 4-bucket evaluation logic
|   |-- models/
|   |   |-- Order.js                 # Mongoose order schema
|   |   |-- Decision.js              # Mongoose decision schema
|   |-- routes/
|   |   |-- orders.js                # Order CRUD + evaluation endpoints
|   |   |-- analytics.js             # Aggregation and reporting endpoints
|   |   |-- config.js                # Configuration read/update endpoints
|   |-- services/
|   |   |-- whatsapp.js              # WhatsApp Business API integration
|   |-- app.js                       # Express app setup
|   |-- server.js                    # Server entry point
|   |-- .env                         # Environment variables (not committed)
|   |-- package.json
|
|-- scripts/
|   |-- seedDatabase.js              # CSV import + engine run + summary
|   |-- runBacktest.js               # Historical backtest with reports
|
|-- data/
|   |-- orders_sample.csv            # 2,018-order historical dataset
|
|-- README.md                        # This file
|-- BUSINESS_MEMO.md                 # Executive business case
|-- DECISION_LOG.md                  # Architectural decision log
|-- AI_USAGE_LOG.md                  # AI tool usage documentation
```

---

## Decision Engine Rules

The engine evaluates each order through a series of rule checks and assigns it to one of four buckets. Rules are evaluated in priority order; the first matching high-severity rule determines the bucket.

### Bucket 1: Hold / Cancel

Orders with definitive fraud or waste signals. These are blocked outright.

| Signal                      | Threshold / Pattern                     | Data Basis                     |
|-----------------------------|-----------------------------------------|-------------------------------|
| Chronic RTO                 | `customer_prior_rto >= 2`               | 76.47% RTO rate (34 orders)   |
| Gibberish address           | Single chars, "xyz", "test", "."        | 63.69% RTO rate (157 orders)  |
| Fake customer name          | "test", "xyz", single-char names        | 63.41% RTO rate (41 orders)   |
| Invalid phone               | Not 10 digits, all same digit           | 47.06% RTO for 9-digit phones |

### Bucket 2: Nudge to Prepaid

High-risk orders where offering a Rs.50 prepaid discount is financially rational.

| Signal                      | Threshold / Pattern                     | Data Basis                     |
|-----------------------------|-----------------------------------------|-------------------------------|
| High-risk state + new cust. | Bihar, UP, MP + 0 prior orders          | 44-53% state RTO rates        |
| High-risk city              | Gorakhpur, Bareilly, Darbhanga, etc.    | 50-63% city RTO rates         |
| Meta Ads + high risk state  | `order_source = Meta` + risk state      | 31.32% Meta RTO rate          |

### Bucket 3: Ship After Confirmation

Ambiguous orders that need a quick WhatsApp verification before shipping.

| Signal                      | Threshold / Pattern                     | Data Basis                     |
|-----------------------------|-----------------------------------------|-------------------------------|
| Moderate risk state         | Rajasthan, Assam + first-time buyer     | 29-35% state RTO rates        |
| Short address (not gibberish)| Address < 15 chars but has real words  | Insufficient for delivery      |
| 1 prior RTO                 | `customer_prior_rto == 1`               | Mixed signals (10-45% RTO)    |

### Bucket 4: Ship As-Is

Clean orders with low risk indicators. These ship without any intervention.

| Signal                      | Threshold / Pattern                     | Data Basis                     |
|-----------------------------|-----------------------------------------|-------------------------------|
| Repeat buyer, 0 prior RTO   | `customer_prior_orders >= 1`, no RTOs  | Significantly lower RTO        |
| Metro city                  | Mumbai, Delhi, Pune, Chennai, etc.      | 17-21% RTO rates              |
| Structured address          | Contains house/flat number, street name | Delivery-ready formatting      |
| Hinglish landmark address   | "ke paas", "ke samne", "wali gali"     | 24.75% RTO -- below average   |

> **Note on Hinglish Landmarks**: Addresses containing phrases like "ph krke aana" or "Govt School ke paas" are delivery instructions written by genuine Tier-2/3 buyers. Their 24.75% RTO rate is _lower_ than the overall 28.41% average. These addresses are treated as valid, not suspicious.

---

## Unit Economics

| Metric                        | Value       | Source / Calculation              |
|-------------------------------|-------------|----------------------------------|
| Average Order Value (AOV)     | Rs.649      | Dataset mean                     |
| Gross Margin                  | 62%         | Brand financials                 |
| Gross Margin per Order        | Rs.402.38   | Rs.649 x 0.62                    |
| RTO Cost (round-trip shipping)| Rs.169.40   | Forward + return shipping        |
| Meta Ads CAC                  | Rs.300+     | Marketing spend / acquisitions   |
| Prepaid Discount Offered      | Rs.50       | Nudge incentive                  |
| Net Saving per Prepaid Convert| Rs.70.65    | RTO cost saved - discount given  |
| Monthly COD Orders            | ~3,000      | Brand operations data            |
| Current RTO Rate              | 28.41%      | 573 / 2,017 valid COD orders     |
| Monthly RTO Cost (current)    | Rs.1,42,296 | 840 RTOs x Rs.169.40             |

---

## API Reference

| Method | Path                          | Description                                    |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/orders`                 | List all orders (paginated)                    |
| GET    | `/api/orders/:id`             | Get a single order by ID                       |
| POST   | `/api/orders/evaluate`        | Evaluate an order and return bucket + flags    |
| GET    | `/api/analytics/summary`      | Dashboard KPI summary                          |
| GET    | `/api/analytics/buckets`      | Bucket distribution with RTO breakdown         |
| GET    | `/api/analytics/states`       | State-wise RTO rates                           |
| GET    | `/api/analytics/cities`       | City-wise RTO rates                            |
| GET    | `/api/analytics/sources`      | Order source RTO comparison                    |
| GET    | `/api/analytics/couriers`     | Courier partner performance                    |
| GET    | `/api/config`                 | Get current rules configuration                |
| PUT    | `/api/config`                 | Update rules configuration                     |
| POST   | `/api/whatsapp/send`          | Trigger WhatsApp confirmation for an order     |
| GET    | `/api/whatsapp/status/:id`    | Check WhatsApp confirmation status             |

---

## Configuration

All decision thresholds are defined in [`server/config/rulesConfig.js`](file:///c:/New%20folder%20(6)/server/config/rulesConfig.js). Key parameters:

| Parameter              | Default Value                                  | Description                                     |
|------------------------|------------------------------------------------|-------------------------------------------------|
| `maxPriorRTO`          | `2`                                            | Prior RTO count triggering Hold/Cancel           |
| `highRiskStates`       | `["Bihar", "Uttar Pradesh", "Madhya Pradesh"]` | States flagged for elevated risk                 |
| `moderateRiskStates`   | `["Rajasthan", "Assam"]`                       | States requiring WhatsApp confirmation           |
| `highRiskCities`       | `["Gorakhpur", "Bareilly", "Darbhanga", ...]`  | Cities with >50% RTO rates                      |
| `metroCities`          | `["Mumbai", "Delhi", "Pune", "Chennai", ...]`  | Low-risk metro areas                             |
| `gibberishPatterns`    | Regex array                                    | Patterns matching fake/insufficient addresses    |
| `fakeNamePatterns`     | Regex array                                    | Patterns matching test/fake customer names       |
| `hinglishLandmarks`    | String array                                   | Phrases indicating valid Hinglish delivery notes |
| `prepaidDiscount`      | `50`                                           | Rs. discount offered for prepaid conversion      |
| `rtoCost`              | `169.40`                                       | Cost per RTO (forward + return shipping)         |
| `highValueThreshold`   | `1200`                                         | Order value above which prepaid nudge applies    |
| `midValueThreshold`    | `800`                                          | Mid-range order value threshold                  |

To modify thresholds:

1. **Via Dashboard**: Navigate to the Configuration tab, adjust values, and save.
2. **Via API**: `PUT /api/config` with a JSON body containing the fields to update.
3. **Via File**: Edit `server/config/rulesConfig.js` directly and restart the server.

---

## LLM Usage Boundary

This project draws a deliberate line between deterministic code and AI/LLM assistance:

| Responsibility              | Handled By        | Reason                                                  |
|-----------------------------|-------------------|---------------------------------------------------------|
| Phone validation            | Regex (code)      | A 10-digit check is 100% deterministic                  |
| Financial calculations      | Arithmetic (code) | Margin, RTO cost, and ROI are exact formulas             |
| Customer history lookup     | Database query    | Prior orders/RTOs are factual counts                     |
| State/city risk lookup      | Config lookup     | Deterministic mapping from data analysis                 |
| Gibberish detection         | Regex (code)      | Pattern matching for known junk inputs                   |
| Address quality assessment  | LLM (optional)    | "ph krke aana Govt School ke paas" requires semantic understanding of Hinglish delivery instructions |
| Name plausibility           | Regex + LLM       | Regex catches "test"/"xyz"; LLM can assess edge cases   |

The LLM is used only where regex fails -- specifically, understanding the semantics of messy Indian addresses that mix Hindi, English, and delivery instructions. For everything else, deterministic code is faster, cheaper, and more reliable.

---

## Testing

Run the server-side test suite:

```bash
cd server
npm test
```

The test suite covers:

- **Decision Engine**: Unit tests for each bucket classification, edge cases, and boundary conditions
- **API Endpoints**: Integration tests for order evaluation, analytics, and configuration
- **Financial Calculations**: Verification of margin, RTO cost, and savings arithmetic
- **Address Parsing**: Tests for gibberish detection, Hinglish landmark recognition, and structured address validation

To run the backtest against historical data:

```bash
node scripts/runBacktest.js
```

This provides a comprehensive accuracy and financial impact report using all orders in the database.
