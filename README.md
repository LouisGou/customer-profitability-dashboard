# Margin — Customer Profitability Dashboard

A local Vue app that helps explore which customers stay, how much gross profit they generate, and whether acquisition costs have been recovered.

## Run locally

Requires Node.js 22.12+ (or a newer supported release).

```sh
cd /Users/louis/Documents/Codex/customer-profitability-dashboard
npm ci
npm run dev
```

Open the address printed by Vite. To build and check the project:

```sh
npm test
npm run build
```

The dashboard runs locally without account integrations or an external database.

## Features

- Overview with revenue, gross margin, final-month active customers, and observed acquisition payback.
- Monthly revenue and gross-profit charts, plus exact monthly figures.
- Acquisition-channel comparisons, including CAC, month-6 retention, and contribution.
- Customer retention by signup cohort, with unobserved months shown as dashes.
- Searchable, sortable, paginated customers with active/inactive filters.
- Reporting-period and acquisition-channel filters.
- Local CSV import with validation; sample CSV download and report exports.
- Responsive layouts, keyboard navigation, accessible tables, and calculation notes.

## Sample data

The default Nova subscription business is **fictional**, generated deterministically: 570 customers and 2,467 positive-revenue monthly payment rows from January to December 2025. It covers Organic, Paid search, Partnerships, and Referral acquisition channels. The sample is designed to illustrate tradeoffs, not industry benchmarks. Reloading the app restores this data.

## CSV format

Use one row per customer per month with positive revenue. Combine multiple transactions into a monthly total. The sample is at `public/sample-payments.csv`.

| Column           | Meaning                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| customer_id      | Unique, consistent customer identifier                                              |
| name             | Customer name                                                                       |
| signup_month     | First revenue month, YYYY-MM                                                        |
| channel          | Original acquisition channel                                                        |
| plan             | Fixed plan label for this version                                                   |
| month            | Revenue month, YYYY-MM                                                              |
| revenue          | Positive monthly customer revenue                                                   |
| service_cost     | Non-negative direct costs attributable to serving this customer                     |
| acquisition_cost | Non-negative acquisition cost, entered once in the signup row; 0 in subsequent rows |

Use numeric dollar amounts without currency symbols or thousands separators, with up to two decimal places. Every customer must have a signup-month row. Names, signup date, plan, and channel must stay consistent for a customer. Missing monthly rows indicate inactivity. Direct service costs may exceed revenue, preserving negative margins.

Imports accept up to 5 MB, 50,000 rows, and 36 calendar months. Include complete history through the last reported month. Plan changes, multiple currencies, refunds, zero-revenue activity, taxes, and separately scheduled cash collections are outside this version's data model. All displayed amounts are labelled USD.

## Financial definitions

- **Revenue:** customer revenue recognised in the selected reporting months; this is not a cash-flow forecast.
- **Gross profit:** revenue minus direct service costs.
- **Gross margin:** gross profit / revenue. Undefined ratios display a dash.
- **Contribution:** gross profit minus acquisition spending. This excludes overhead, financing, and tax; it is not net profit.
- **Average CAC:** acquisition spending / new customers in the selected reporting period.
- **Observed CAC payback:** first elapsed month when a customer's cumulative gross profit covers their acquisition cost. Signup is month 1. Zero-cost acquisitions have immediate, 0-month payback. The overview shows the median **only among recovered new customers**, alongside the recovered count and full new-customer count. It does not estimate payback for unrecovered customers.
- **M6 retention:** customers with positive revenue six months after signup / customers in cohorts observed for at least six months. The channel table uses all eligible cohorts independently of the overview reporting period. A returning customer counts as paying again.
- **Active customers:** customers with revenue in the dataset's final reported month. This count uses the selected channel but is independent of the overview reporting period.

Retention tables show M0 through M11. The period filter selects signup cohorts on the Retention and Customers views; customer financial totals show all observed history for those selected customers. Export respects the current view, channel, signup/reporting period, customer search, and status filters. Customer export includes all matching pages.

## Privacy and implementation

CSV contents are processed in the browser and never sent to a server. Imported data is held in memory; refresh clears it. Google Fonts are fetched for typography, but are not given customer data. Financial calculations are separated in `src/data.js` and tested against hand-calculated fixtures. The UI uses Vue and native SVG charts; no paid services or account integrations are required.

```text
src/App.vue                  Dashboard screens, filters, and local imports/exports
src/data.js                  Synthetic dataset, metric calculations, CSV validation
src/components/TrendChart.vue Monthly SVG chart
src/components/Icon.vue      Small SVG icon set
src/style.css                Responsive visual design
public/sample-payments.csv   Importable fictional dataset
tests/metrics.test.js        Regression checks for calculations and CSV handling
docs/case-study.md           Example analysis and limitations
```
