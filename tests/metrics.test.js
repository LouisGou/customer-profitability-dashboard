import test from "node:test";
import assert from "node:assert/strict";
import {
  analyse,
  buildDataset,
  cohortData,
  customerPayback,
  makeSampleData,
  parseCSV,
  toCSV,
  csvHeaders,
} from "../src/data.js";

const payment = (id, signup, channel, month, revenue, cost, cac = 0) => ({
  customer_id: id,
  name: `Customer ${id}`,
  signup_month: signup,
  channel,
  plan: "Starter",
  month,
  revenue,
  service_cost: cost,
  acquisition_cost: cac,
});
const fixture = [
  payment("A", "2025-01", "Organic", "2025-01", 50, 20, 90),
  payment("A", "2025-01", "Organic", "2025-02", 50, 20),
  payment("A", "2025-01", "Organic", "2025-03", 50, 20),
  payment("A", "2025-01", "Organic", "2025-07", 50, 20),
  payment("B", "2025-01", "Paid", "2025-01", 50, 30, 200),
  payment("C", "2025-07", "Organic", "2025-07", 50, 20),
];
const data = buildDataset(fixture);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("hand-calculated revenue, costs, margin, CAC, contribution, and active customers", () => {
  const result = analyse(data);
  assert.equal(result.revenue, 300);
  assert.equal(result.serviceCost, 130);
  assert.equal(result.acquisitionSpend, 290);
  assert.equal(result.grossProfit, 170);
  assert.equal(result.contribution, -120);
  close(result.margin, 170 / 300);
  assert.equal(result.active, 2);
  const organic = result.channelStats.find((c) => c.channel === "Organic");
  assert.equal(organic.cac, 45);
  assert.equal(organic.contribution, 60);
});

test("payback includes elapsed months, zero-cost customers, and explicitly excludes unrecovered accounts from the median", () => {
  assert.equal(customerPayback(data.customers.find((c) => c.id === "A")), 3);
  assert.equal(customerPayback(data.customers.find((c) => c.id === "B")), null);
  assert.equal(customerPayback(data.customers.find((c) => c.id === "C")), 0);
  const result = analyse(data);
  assert.equal(result.recovered, 2);
  assert.equal(result.acquired, 3);
  assert.equal(result.medianPayback, 1.5);
  const gaps = buildDataset([
    payment("D", "2025-01", "Organic", "2025-01", 50, 20, 50),
    payment("D", "2025-01", "Organic", "2025-04", 50, 20),
  ]);
  assert.equal(customerPayback(gaps.customers[0]), 4);
});

test("reporting filters count only selected revenue and new acquisitions, while active status uses the final reporting month", () => {
  const result = analyse(data, null, "3");
  assert.deepEqual(result.months, ["2025-05", "2025-06", "2025-07"]);
  assert.equal(result.revenue, 100);
  assert.equal(result.grossProfit, 60);
  assert.equal(result.acquisitionSpend, 0);
  assert.equal(result.acquired, 1);
  assert.equal(result.active, 2);
  assert.equal(result.medianPayback, 0);
  assert.equal(result.channelStats.find((c) => c.channel === "Paid").cac, null);
  assert.equal(analyse(data, "Organic").revenue, 250);
});

test("retention uses signup-month denominators, observed gaps, returning customers, and null for immature ages", () => {
  const cohorts = cohortData(data);
  assert.equal(cohorts[0].retention[0], 1);
  assert.equal(cohorts[0].retention[1], 0.5);
  assert.equal(cohorts[0].retention[3], 0);
  assert.equal(cohorts[0].retention[6], 0.5);
  assert.equal(cohorts[1].retention[1], null);
  const stats = analyse(data);
  assert.equal(
    stats.channelStats.find((c) => c.channel === "Organic").retention,
    1,
  );
  assert.equal(
    stats.channelStats.find((c) => c.channel === "Organic").eligible,
    1,
  );
  assert.equal(
    stats.channelStats.find((c) => c.channel === "Paid").retention,
    0,
  );
});

test("sample CSV round-trips quoted commas, line breaks, and quotes without changing payments", () => {
  const rows = fixture.map((row) => ({
    ...row,
    name: row.customer_id === "A" ? 'Example, "quoted"\ncompany' : row.name,
  }));
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
  const sample = makeSampleData();
  assert.deepEqual(parseCSV(toCSV(sample)), sample);
  const summary = analyse(buildDataset(sample));
  close(summary.revenue, 222726.4);
  close(summary.grossProfit, 166747.26);
  close(summary.contribution, 78091.26);
  assert.equal(summary.active, 391);
  assert.equal(summary.acquired, 570);
});

test("CSV validation rejects duplicates, incomplete customer history, malformed dates and repeated acquisition spending", () => {
  assert.throws(
    () => parseCSV(toCSV([...fixture, fixture[0]])),
    /duplicate customer and month/,
  );
  assert.throws(() => parseCSV(toCSV(fixture.slice(1))), /signup month/);
  assert.throws(
    () => parseCSV(toCSV([{ ...fixture[0], month: "2025-13" }])),
    /YYYY-MM/,
  );
  assert.throws(
    () =>
      parseCSV(toCSV([fixture[0], { ...fixture[1], acquisition_cost: 90 }])),
    /belongs only/,
  );
  assert.throws(
    () => parseCSV(toCSV([{ ...fixture[0], revenue: "NaN" }])),
    /non-negative amount/,
  );
  assert.throws(
    () => parseCSV(toCSV([{ ...fixture[0], revenue: "" }])),
    /non-negative amount/,
  );
  assert.throws(
    () => parseCSV(toCSV([{ ...fixture[0], revenue: 0 }])),
    /positive customer revenue/,
  );
  assert.throws(
    () => parseCSV("customer_id,name\nA,Example"),
    /Missing columns/,
  );
  assert.throws(
    () => parseCSV('customer_id,name\nA,"unclosed'),
    /closing quote/,
  );
});

test("negative gross profit is preserved and no payback is invented", () => {
  const losses = buildDataset([
    payment("L", "2025-01", "Paid", "2025-01", 50, 100, 20),
  ]);
  const result = analyse(losses);
  assert.equal(result.grossProfit, -50);
  assert.equal(result.margin, -1);
  assert.equal(result.contribution, -70);
  assert.equal(result.medianPayback, null);
  assert.equal(customerPayback(losses.customers[0]), null);
});

test("a channel named All channels can be filtered independently", () => {
  const named = buildDataset([
    ...fixture,
    payment("E", "2025-07", "All channels", "2025-07", 75, 25, 10),
  ]);
  assert.equal(analyse(named, "All channels").revenue, 75);
  assert.equal(analyse(named).revenue, 375);
});

test("spreadsheet-safe report exports neutralize formula-like strings without changing numerical signs", () => {
  const output = toCSV(
    [{ name: "=1+1", channel: "@SUM(A1)", amount: -15 }],
    ["name", "channel", "amount"],
    true,
  );
  assert.ok(output.includes("'=1+1"));
  assert.ok(output.includes("'@SUM(A1)"));
  assert.ok(output.endsWith(",-15"));
  assert.ok(toCSV([{ name: "=1+1" }]).endsWith("=1+1"));
});
