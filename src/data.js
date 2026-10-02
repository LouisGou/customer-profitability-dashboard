export const channelColors = ["#27775e", "#e7a071", "#8a9cca", "#baaa7a"];
export const sampleChannels = [
  "Organic",
  "Paid search",
  "Referral",
  "Partnerships",
];
export const monthLabel = (value, short = false) =>
  new Date(`${value}-02T00:00:00Z`).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
export const monthIndex = (value) =>
  Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
export const indexMonth = (index) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
export const dollars = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(value);
export const percent = (value) =>
  value === null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(1)}%`;

export function makeSampleData() {
  let seed = 7319;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const names = [
    "Juniper",
    "Orbit",
    "Slate",
    "Mosaic",
    "Cedar",
    "Northstar",
    "Willow",
    "Beacon",
    "Forma",
    "Atlas",
    "Bloom",
    "Kinfolk",
    "Lumen",
    "Tandem",
    "Olive",
    "Sunday",
    "Studio",
    "Pebble",
    "Aster",
    "Cove",
  ];
  const suffixes = [
    "Studio",
    "Labs",
    "Collective",
    "Works",
    "& Co.",
    "Digital",
    "Systems",
    "Design",
  ];
  const rows = [];
  let id = 0;
  for (let signup = 0; signup < 12; signup++) {
    const count = 28 + signup * 3 + Math.floor(random() * 7);
    for (let c = 0; c < count; c++) {
      id++;
      const draw = random();
      const ch = draw < 0.36 ? 0 : draw < 0.67 ? 1 : draw < 0.85 ? 2 : 3;
      const tier = random();
      const plan =
        tier < (ch === 1 ? 0.64 : 0.4)
          ? "Starter"
          : tier < 0.85
            ? "Growth"
            : "Scale";
      const price = { Starter: 49, Growth: 99, Scale: 199 }[plan];
      const costRatio = [0.19, 0.32, 0.17, 0.24][ch] + random() * 0.05;
      const cac = Math.round([85, 290, 55, 155][ch] * (0.8 + random() * 0.4));
      const name = `${names[id % names.length]} ${suffixes[Math.floor(random() * suffixes.length)]} ${String(id).padStart(3, "0")}`;
      for (let m = signup; m < 12; m++) {
        if (m > signup && random() < [0.055, 0.16, 0.035, 0.075][ch]) break;
        const revenue = +(
          price * (m - signup >= 5 && id % 7 === 0 ? 1.2 : 1)
        ).toFixed(2);
        rows.push({
          customer_id: `C${String(id).padStart(4, "0")}`,
          name,
          signup_month: indexMonth(2025 * 12 + signup),
          channel: sampleChannels[ch],
          plan,
          month: indexMonth(2025 * 12 + m),
          revenue,
          service_cost: +(revenue * costRatio).toFixed(2),
          acquisition_cost: m === signup ? cac : 0,
        });
      }
    }
  }
  return rows;
}

export function buildDataset(rows) {
  const customers = new Map();
  const first = Math.min(...rows.map((r) => monthIndex(r.signup_month)));
  const last = Math.max(...rows.map((r) => monthIndex(r.month)));
  for (const row of rows) {
    if (!customers.has(row.customer_id))
      customers.set(row.customer_id, {
        id: row.customer_id,
        name: row.name,
        channel: row.channel,
        plan: row.plan,
        signup: row.signup_month,
        cac: 0,
        payments: [],
      });
    const customer = customers.get(row.customer_id);
    customer.cac += row.acquisition_cost;
    customer.payments.push({
      month: row.month,
      revenue: row.revenue,
      cost: row.service_cost,
      profit: row.revenue - row.service_cost,
    });
  }
  for (const customer of customers.values())
    customer.payments.sort((a, b) => a.month.localeCompare(b.month));
  return {
    rows,
    customers: [...customers.values()],
    months: Array.from({ length: last - first + 1 }, (_, i) =>
      indexMonth(first + i),
    ),
    channels: [...new Set(rows.map((r) => r.channel))].sort(),
    last: indexMonth(last),
  };
}

export function customerPayback(customer) {
  if (customer.cac === 0) return 0;
  let total = 0;
  for (const payment of customer.payments) {
    total += payment.profit;
    if (total >= customer.cac)
      return monthIndex(payment.month) - monthIndex(customer.signup) + 1;
  }
  return null;
}

export function cohortData(dataset, channel = null) {
  const selected = dataset.customers.filter(
    (c) => channel === null || c.channel === channel,
  );
  return dataset.months
    .map((signup) => {
      const members = selected.filter((c) => c.signup === signup);
      if (!members.length) return null;
      const retention = Array.from({ length: 12 }, (_, age) => {
        const month = indexMonth(monthIndex(signup) + age);
        if (month > dataset.last) return null;
        return (
          members.filter((c) => c.payments.some((p) => p.month === month))
            .length / members.length
        );
      });
      return { signup, count: members.length, retention };
    })
    .filter(Boolean);
}

export function analyse(dataset, channel = null, period = "all") {
  const size = period === "all" ? dataset.months.length : Number(period);
  const months = dataset.months.slice(-size);
  const start = months[0];
  const customers = dataset.customers.filter(
    (c) => channel === null || c.channel === channel,
  );
  const scoped = dataset.rows.filter(
    (r) => (channel === null || r.channel === channel) && r.month >= start,
  );
  const revenue = scoped.reduce((s, r) => s + r.revenue, 0);
  const serviceCost = scoped.reduce((s, r) => s + r.service_cost, 0);
  const acquisitionSpend = scoped.reduce((s, r) => s + r.acquisition_cost, 0);
  const active = customers.filter((c) =>
    c.payments.some((p) => p.month === dataset.last),
  ).length;
  const acquired = customers.filter((c) => c.signup >= start);
  const paybacks = acquired
    .map(customerPayback)
    .filter((x) => x !== null)
    .sort((a, b) => a - b);
  const mid = Math.floor(paybacks.length / 2);
  const medianPayback = !paybacks.length
    ? null
    : paybacks.length % 2
      ? paybacks[mid]
      : (paybacks[mid - 1] + paybacks[mid]) / 2;
  const series = months.map((month) => {
    const values = scoped.filter((r) => r.month === month);
    return {
      month,
      revenue: values.reduce((s, r) => s + r.revenue, 0),
      profit: values.reduce((s, r) => s + r.revenue - r.service_cost, 0),
    };
  });
  const channelStats = dataset.channels
    .filter((ch) => channel === null || ch === channel)
    .map((ch) => {
      const members = customers.filter((c) => c.channel === ch);
      const newMembers = members.filter((c) => c.signup >= start);
      const entries = scoped.filter((r) => r.channel === ch);
      const rev = entries.reduce((s, r) => s + r.revenue, 0);
      const profit = entries.reduce(
        (s, r) => s + r.revenue - r.service_cost,
        0,
      );
      const spend = newMembers.reduce((s, c) => s + c.cac, 0);
      const eligible = members.filter(
        (c) => monthIndex(dataset.last) - monthIndex(c.signup) >= 6,
      );
      const retained = eligible.filter((c) =>
        c.payments.some(
          (p) => monthIndex(p.month) === monthIndex(c.signup) + 6,
        ),
      );
      const recovered = newMembers.filter(
        (c) => customerPayback(c) !== null,
      ).length;
      return {
        channel: ch,
        customers: newMembers.length,
        revenue: rev,
        profit,
        contribution: profit - spend,
        cac: newMembers.length ? spend / newMembers.length : null,
        retention: eligible.length ? retained.length / eligible.length : null,
        eligible: eligible.length,
        recovered,
        newMembers: newMembers.length,
        margin: rev ? profit / rev : null,
      };
    });
  return {
    months,
    start,
    revenue,
    serviceCost,
    acquisitionSpend,
    grossProfit: revenue - serviceCost,
    contribution: revenue - serviceCost - acquisitionSpend,
    margin: revenue ? (revenue - serviceCost) / revenue : null,
    active,
    acquired: acquired.length,
    medianPayback,
    recovered: paybacks.length,
    series,
    channelStats,
  };
}

export const csvHeaders = [
  "customer_id",
  "name",
  "signup_month",
  "channel",
  "plan",
  "month",
  "revenue",
  "service_cost",
  "acquisition_cost",
];
export function toCSV(
  rows,
  headers = rows.length ? Object.keys(rows[0]) : csvHeaders,
  spreadsheetSafe = false,
) {
  const escape = (value) => {
    let text = String(value ?? "");
    if (
      spreadsheetSafe &&
      typeof value === "string" &&
      /^[\s]*[=+\-@]/.test(text)
    )
      text = "'" + text;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\r\n");
}

export function parseCSV(text) {
  const table = [];
  let row = [],
    field = "",
    quoted = false,
    afterQuote = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else field += char;
    } else if (char === '"') {
      if (field || afterQuote)
        throw new Error(
          "Unexpected quote in CSV. Wrap fields containing commas in double quotes.",
        );
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(field);
      field = "";
      afterQuote = false;
      if (char !== ",") {
        if (row.some((x) => x.trim())) table.push(row);
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (afterQuote && char.trim())
        throw new Error("Unexpected text after a quoted CSV field.");
      if (!afterQuote) field += char;
    }
  }
  if (quoted)
    throw new Error("A quoted CSV field is missing its closing quote.");
  row.push(field);
  if (row.some((x) => x.trim())) table.push(row);
  if (table.length < 2)
    throw new Error(
      "Add at least one customer payment row beneath the CSV header.",
    );
  const headers = table.shift().map((h) => h.trim());
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV column names must be unique.");
  const missing = csvHeaders.filter((h) => !headers.includes(h));
  if (missing.length)
    throw new Error(
      `Missing columns: ${missing.join(", ")}. Download the sample CSV for the required format.`,
    );
  if (table.length > 50000)
    throw new Error("Please use a CSV with 50,000 rows or fewer.");
  const keys = new Set(),
    metadata = new Map(),
    signupPayments = new Set();
  let first = Infinity,
    last = -Infinity;
  const rows = table.map((values, i) => {
    const line = i + 2;
    if (values.length !== headers.length)
      throw new Error(
        `Row ${line}: expected ${headers.length} columns, found ${values.length}.`,
      );
    const result = Object.fromEntries(
      csvHeaders.map((h) => [h, values[headers.indexOf(h)].trim()]),
    );
    for (const key of csvHeaders.slice(0, 6))
      if (!result[key]) throw new Error(`Row ${line}: ${key} is required.`);
    if (
      [result.name, result.channel, result.plan, result.customer_id].some(
        (x) => x.length > 120,
      )
    )
      throw new Error(
        `Row ${line}: names and labels must be 120 characters or fewer.`,
      );
    for (const key of ["month", "signup_month"])
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(result[key]))
        throw new Error(
          `Row ${line}: ${key} must use YYYY-MM, for example 2025-01.`,
        );
    if (result.month < result.signup_month)
      throw new Error(`Row ${line}: payment month cannot precede signup.`);
    for (const key of ["revenue", "service_cost", "acquisition_cost"]) {
      if (
        !/^\d+(\.\d{1,2})?$/.test(result[key]) ||
        !Number.isFinite(Number(result[key])) ||
        Number(result[key]) > 1e9
      )
        throw new Error(
          `Row ${line}: ${key} must be a non-negative amount with at most two decimal places, without currency symbols.`,
        );
      result[key] = Number(result[key]);
    }
    if (result.revenue <= 0)
      throw new Error(
        `Row ${line}: include only months with positive customer revenue.`,
      );
    if (result.month !== result.signup_month && result.acquisition_cost !== 0)
      throw new Error(
        `Row ${line}: acquisition_cost belongs only in the signup month.`,
      );
    const key = `${result.customer_id}\u0000${result.month}`;
    if (keys.has(key))
      throw new Error(
        `Row ${line}: duplicate customer and month. Combine payments into one monthly row.`,
      );
    keys.add(key);
    const info = JSON.stringify([
      result.name,
      result.signup_month,
      result.channel,
      result.plan,
    ]);
    if (
      metadata.has(result.customer_id) &&
      metadata.get(result.customer_id) !== info
    )
      throw new Error(
        `Row ${line}: customer details differ across payment rows.`,
      );
    metadata.set(result.customer_id, info);
    if (result.month === result.signup_month)
      signupPayments.add(result.customer_id);
    first = Math.min(first, monthIndex(result.signup_month));
    last = Math.max(last, monthIndex(result.month));
    return result;
  });
  if (last - first >= 36)
    throw new Error("Please use a dataset covering 36 months or fewer.");
  if ([...metadata.keys()].some((id) => !signupPayments.has(id)))
    throw new Error(
      "Every customer needs a payment row in their signup month, including their acquisition cost.",
    );
  return rows;
}
