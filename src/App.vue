<script setup>
import { computed, nextTick, ref, watch } from "vue";
import Icon from "./components/Icon.vue";
import TrendChart from "./components/TrendChart.vue";
import {
  makeSampleData,
  buildDataset,
  analyse,
  cohortData,
  customerPayback,
  dollars,
  percent,
  monthLabel,
  channelColors,
  parseCSV,
  toCSV,
} from "./data.js";

const dataset = ref(buildDataset(makeSampleData()));
const page = ref("overview"),
  channel = ref(null),
  period = ref("all"),
  chartMode = ref("revenue");
const search = ref(""),
  status = ref("All customers"),
  sort = ref("contribution"),
  customerPage = ref(1);
const importDialog = ref(false),
  methodsDialog = ref(false),
  importError = ref(""),
  importing = ref(false);
const uploadedName = ref(""),
  notice = ref(""),
  uploadInput = ref(null),
  dialogClose = ref(null),
  lastFocus = ref(null);
const stats = computed(() =>
  analyse(dataset.value, channel.value, period.value),
);
const cohorts = computed(() =>
  cohortData(dataset.value, channel.value).filter(
    (c) => c.signup >= stats.value.start,
  ),
);
const active = (customer) =>
  customer.payments.some((p) => p.month === dataset.value.last);
const lifetimeRevenue = (c) => c.payments.reduce((s, p) => s + p.revenue, 0);
const lifetimeProfit = (c) => c.payments.reduce((s, p) => s + p.profit, 0);
const filteredCustomers = computed(() => {
  const list = dataset.value.customers.filter(
    (c) =>
      (channel.value === null || c.channel === channel.value) &&
      c.signup >= stats.value.start &&
      `${c.name} ${c.id} ${c.channel} ${c.plan}`
        .toLowerCase()
        .includes(search.value.toLowerCase()) &&
      (status.value === "All customers" ||
        active(c) === (status.value === "Active")),
  );
  return list.sort((a, b) =>
    sort.value === "name"
      ? a.name.localeCompare(b.name)
      : sort.value === "revenue"
        ? lifetimeRevenue(b) - lifetimeRevenue(a)
        : lifetimeProfit(b) - b.cac - (lifetimeProfit(a) - a.cac),
  );
});
const customerPages = computed(() =>
  Math.max(1, Math.ceil(filteredCustomers.value.length / 10)),
);
const displayedCustomers = computed(() =>
  filteredCustomers.value.slice(
    (customerPage.value - 1) * 10,
    customerPage.value * 10,
  ),
);
watch([channel, period, search, status, sort], () => {
  customerPage.value = 1;
});
const bestRetention = computed(
  () =>
    [...stats.value.channelStats]
      .filter((c) => c.retention !== null)
      .sort((a, b) => b.retention - a.retention)[0],
);
const recoveredPercent = computed(() =>
  stats.value.acquired ? stats.value.recovered / stats.value.acquired : null,
);
const totalChannelRevenue = computed(() =>
  stats.value.channelStats.reduce((s, c) => s + c.revenue, 0),
);
const dateRange = computed(() => {
  const first = stats.value.months[0],
    last = dataset.value.last;
  return `${monthLabel(first, true)}${first.slice(0, 4) !== last.slice(0, 4) ? " " + first.slice(0, 4) : ""} – ${monthLabel(last, true)} ${last.slice(0, 4)}`;
});
const title = computed(
  () =>
    ({
      overview: "Customer economics",
      cohorts: "Retention, over time",
      customers: "Behind every number",
    })[page.value],
);
const subtitle = computed(
  () =>
    ({
      overview:
        "A clearer picture of who stays, what they spend, and what you earn.",
      cohorts: "See how each signup group holds on to its customers.",
      customers:
        "Explore the customers driving your business, one account at a time.",
    })[page.value],
);
const colorFor = (ch) =>
  channelColors[dataset.value.channels.indexOf(ch) % channelColors.length];
const shortMoney = (value) =>
  Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}k` : dollars(value);
const profitAfter = (c) => lifetimeProfit(c) - c.cac;

function download(content, name) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCurrent() {
  let rows;
  if (page.value === "overview")
    rows = stats.value.channelStats.map((c) => ({
      channel: c.channel,
      reporting_start: stats.value.start,
      reporting_end: dataset.value.last,
      new_customers: c.customers,
      revenue: c.revenue.toFixed(2),
      gross_profit: c.profit.toFixed(2),
      contribution_after_acquisition: c.contribution.toFixed(2),
      average_cac: c.cac === null ? "" : c.cac.toFixed(2),
      month_6_retention: c.retention === null ? "" : c.retention.toFixed(4),
      month_6_eligible_customers: c.eligible,
      recovered_new_customers: c.recovered,
    }));
  else if (page.value === "cohorts")
    rows = cohorts.value.map((c) => ({
      signup_month: c.signup,
      customers: c.count,
      ...Object.fromEntries(
        c.retention.map((v, i) => [
          `month_${i}_retention`,
          v === null ? "" : v.toFixed(4),
        ]),
      ),
    }));
  else
    rows = filteredCustomers.value.map((c) => ({
      customer_id: c.id,
      name: c.name,
      channel: c.channel,
      plan: c.plan,
      signup_month: c.signup,
      status: active(c) ? "Active" : "Inactive",
      observed_revenue: lifetimeRevenue(c).toFixed(2),
      observed_gross_profit: lifetimeProfit(c).toFixed(2),
      acquisition_cost: c.cac,
      contribution_after_acquisition: profitAfter(c).toFixed(2),
      observed_payback_months: customerPayback(c) ?? "",
    }));
  const headers = rows.length
    ? Object.keys(rows[0])
    : page.value === "customers"
      ? [
          "customer_id",
          "name",
          "channel",
          "plan",
          "signup_month",
          "status",
          "observed_revenue",
          "observed_gross_profit",
          "acquisition_cost",
          "contribution_after_acquisition",
          "observed_payback_months",
        ]
      : [
          "signup_month",
          "customers",
          ...Array.from({ length: 12 }, (_, i) => `month_${i}_retention`),
        ];
  download(toCSV(rows, headers, true), `margin-${page.value}.csv`);
  notice.value = "Your current view has been exported.";
}
function resetDemo() {
  dataset.value = buildDataset(makeSampleData());
  uploadedName.value = "";
  channel.value = null;
  period.value = "all";
  search.value = "";
  status.value = "All customers";
  customerPage.value = 1;
  notice.value = "The fictional Nova dataset is loaded.";
}
async function importFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  importing.value = true;
  importError.value = "";
  try {
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Please select a CSV smaller than 5 MB.");
    const rows = parseCSV(await file.text());
    dataset.value = buildDataset(rows);
    uploadedName.value = file.name;
    channel.value = null;
    period.value = "all";
    search.value = "";
    status.value = "All customers";
    customerPage.value = 1;
    closeDialogs();
    notice.value = `${rows.length.toLocaleString()} payment rows imported from ${file.name}.`;
  } catch (error) {
    importError.value = error.message;
  } finally {
    importing.value = false;
    event.target.value = "";
  }
}
function openDialog(which) {
  lastFocus.value = document.activeElement;
  if (which === "import") {
    importError.value = "";
    importDialog.value = true;
  } else methodsDialog.value = true;
  nextTick(() => dialogClose.value?.focus());
}
function closeDialogs() {
  importDialog.value = false;
  methodsDialog.value = false;
  nextTick(() => lastFocus.value?.focus());
}
function handleDialogKeys(event) {
  if (event.key === "Escape") {
    closeDialogs();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [
    ...event.currentTarget.querySelectorAll(
      'button, input, a, select, [tabindex="0"]',
    ),
  ].filter((el) => !el.disabled);
  const first = focusable[0],
    last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && document.activeElement === last) {
    first.focus();
    event.preventDefault();
  }
}
</script>

<template>
  <a class="skip-link" href="#main">Skip to dashboard</a>
  <div class="app-shell" :inert="importDialog || methodsDialog">
    <aside class="sidebar">
      <a
        href="#"
        class="brand"
        @click.prevent="page = 'overview'"
        aria-label="Margin overview"
        ><span class="brand-mark">m</span
        ><span>margin<span class="brand-period">.</span></span></a
      >
      <div class="workspace">
        <span class="workspace-avatar">N</span>
        <div>
          <strong>{{
            uploadedName ? "Your workspace" : "Nova workspace"
          }}</strong
          ><small>{{
            uploadedName ? "Imported customer data" : "Subscription business"
          }}</small>
        </div>
        <span class="workspace-dot"></span>
      </div>
      <p class="nav-caption">YOUR BUSINESS, IN FOCUS</p>
      <nav aria-label="Main navigation">
        <button
          v-for="item in [
            { id: 'overview', icon: 'grid', label: 'Overview' },
            { id: 'cohorts', icon: 'cohorts', label: 'Retention cohorts' },
            { id: 'customers', icon: 'people', label: 'Customers' },
          ]"
          :key="item.id"
          :class="['nav-item', { selected: page === item.id }]"
          @click="page = item.id"
          :aria-current="page === item.id ? 'page' : undefined"
        >
          <Icon :name="item.icon" /><span>{{ item.label }}</span
          ><span v-if="item.id === 'customers'" class="nav-count">{{
            dataset.customers.length
          }}</span>
        </button>
      </nav>
      <div class="sidebar-note">
        <div class="note-emblem"><Icon name="leaf" :size="24" /></div>
        <h3>Make growth count.</h3>
        <p>
          The best customers bring more than revenue. Find the ones that stay.
        </p>
        <button @click="openDialog('methods')">
          How the numbers work <Icon name="arrow" :size="15" />
        </button>
      </div>
      <div class="sidebar-footer">
        <span class="user-avatar">LG</span>
        <div>
          <strong>Louis’s analytics lab</strong
          ><small>Customer profitability project</small>
        </div>
      </div>
    </aside>

    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumbs">
          <span>Analytics</span><Icon name="chevron" :size="13" /><strong>{{
            page === "overview"
              ? "Overview"
              : page === "cohorts"
                ? "Retention cohorts"
                : "Customers"
          }}</strong>
        </div>
        <div class="topbar-right">
          <span class="data-pill"
            ><span></span
            >{{ uploadedName ? "Imported data" : "Fictional demo data" }}</span
          ><button
            class="icon-button"
            @click="openDialog('methods')"
            aria-label="Explain dashboard calculations"
          >
            <Icon name="info" :size="19" />
          </button>
        </div>
      </header>
      <main id="main">
        <div class="page-heading">
          <div>
            <p class="eyebrow">
              {{
                page === "overview"
                  ? "THE BIG PICTURE"
                  : page === "cohorts"
                    ? "CUSTOMERS WHO STAY"
                    : "YOUR CUSTOMER BASE"
              }}
            </p>
            <h1>{{ title }}</h1>
            <p class="subtitle">{{ subtitle }}</p>
          </div>
          <div class="heading-actions">
            <button class="button secondary" @click="exportCurrent">
              <Icon name="download" :size="16" />Export CSV</button
            ><button class="button primary" @click="openDialog('import')">
              <Icon name="upload" :size="16" />Import data
            </button>
          </div>
        </div>
        <div v-if="notice" class="notice" role="status">
          <Icon name="check" :size="17" /><span>{{ notice }}</span
          ><button
            class="icon-button"
            @click="notice = ''"
            aria-label="Dismiss notification"
          >
            <Icon name="close" :size="15" />
          </button>
        </div>
        <div class="filterbar">
          <div class="scope-label">
            <span class="scope-dot"></span
            >{{ uploadedName || "Nova · Demo subscription business" }}
          </div>
          <div class="filter-controls">
            <label class="select-wrap"
              ><Icon name="calendar" :size="16" /><span class="sr-only">{{
                page === "overview" ? "Reporting period" : "Signup period"
              }}</span
              ><select v-model="period">
                <option value="all">
                  {{
                    page === "overview"
                      ? "Full reporting period"
                      : "All signup months"
                  }}
                </option>
                <option value="6">
                  {{
                    page === "overview"
                      ? "Last 6 months"
                      : "Signed up in last 6 months"
                  }}
                </option>
                <option value="3">
                  {{
                    page === "overview"
                      ? "Last 3 months"
                      : "Signed up in last 3 months"
                  }}
                </option>
              </select></label
            ><label class="select-wrap"
              ><span class="sr-only">Acquisition channel</span
              ><select v-model="channel">
                <option :value="null">All channels</option>
                <option v-for="ch in dataset.channels" :key="ch">
                  {{ ch }}
                </option>
              </select></label
            >
          </div>
        </div>

        <template v-if="page === 'overview'">
          <div class="metric-grid">
            <article class="metric-card">
              <div class="metric-label">
                Total revenue<Icon name="coin" :size="18" />
              </div>
              <strong class="metric-value">{{ dollars(stats.revenue) }}</strong
              ><span class="metric-foot"
                ><span class="mini-dot green"></span>{{ dateRange }} · USD</span
              >
            </article>
            <article class="metric-card">
              <div class="metric-label">
                Gross margin<Icon name="chart" :size="18" />
              </div>
              <strong class="metric-value">{{ percent(stats.margin) }}</strong
              ><span class="metric-foot"
                >{{ dollars(stats.grossProfit) }} gross profit</span
              >
            </article>
            <article class="metric-card">
              <div class="metric-label">
                Active customers<Icon name="people" :size="18" />
              </div>
              <strong class="metric-value">{{
                stats.active.toLocaleString()
              }}</strong
              ><span class="metric-foot"
                >Paying in {{ monthLabel(dataset.last, true) }}
                {{ dataset.last.slice(0, 4) }}</span
              >
            </article>
            <article class="metric-card">
              <div class="metric-label">
                Observed CAC payback<Icon name="refresh" :size="18" />
              </div>
              <strong class="metric-value"
                >{{
                  stats.medianPayback === null
                    ? "—"
                    : stats.medianPayback.toFixed(1)
                }}<small v-if="stats.medianPayback !== null">mo</small></strong
              ><span class="metric-foot"
                >Median among {{ stats.recovered }} of {{ stats.acquired }} new
                customers recovered</span
              >
            </article>
          </div>
          <div class="chart-grid">
            <section class="panel revenue-panel">
              <div class="panel-head">
                <div>
                  <h2>The shape of your growth</h2>
                  <p>
                    {{
                      chartMode === "revenue"
                        ? "Monthly revenue from your paying customers"
                        : "Monthly revenue less direct service costs"
                    }}
                  </p>
                </div>
                <div class="segmented" aria-label="Chart metric">
                  <button
                    :class="{ active: chartMode === 'revenue' }"
                    :aria-pressed="chartMode === 'revenue'"
                    @click="chartMode = 'revenue'"
                  >
                    Revenue</button
                  ><button
                    :class="{ active: chartMode === 'profit' }"
                    :aria-pressed="chartMode === 'profit'"
                    @click="chartMode = 'profit'"
                  >
                    Gross profit
                  </button>
                </div>
              </div>
              <TrendChart :series="stats.series" :mode="chartMode" />
              <div class="chart-footer">
                <span
                  ><span class="mini-dot green"></span
                  >{{
                    chartMode === "revenue" ? "Revenue" : "Gross profit"
                  }}</span
                ><span>{{ dateRange }}</span>
              </div>
            </section>
            <section class="panel mix-panel">
              <div class="panel-head">
                <div>
                  <h2>Where revenue comes from</h2>
                  <p>Share by acquisition channel</p>
                </div>
              </div>
              <div class="mix-total">
                <strong>{{ shortMoney(stats.revenue) }}</strong
                ><span>total revenue</span>
              </div>
              <div
                class="stacked-bar"
                role="img"
                aria-label="Revenue share by acquisition channel"
              >
                <div
                  v-for="ch in stats.channelStats"
                  :key="ch.channel"
                  :style="{
                    width: `${totalChannelRevenue ? (ch.revenue / totalChannelRevenue) * 100 : 0}%`,
                    background: colorFor(ch.channel),
                  }"
                ></div>
              </div>
              <div class="mix-rows">
                <div v-for="ch in stats.channelStats" :key="ch.channel">
                  <span
                    ><i :style="{ background: colorFor(ch.channel) }"></i
                    >{{ ch.channel }}</span
                  ><strong>{{
                    percent(
                      totalChannelRevenue
                        ? ch.revenue / totalChannelRevenue
                        : null,
                    )
                  }}</strong
                  ><small>{{ shortMoney(ch.revenue) }}</small>
                </div>
              </div>
              <p class="mix-note">
                <Icon name="info" :size="14" />Revenue share is different from
                profitability.
              </p>
            </section>
          </div>
          <div class="analysis-grid">
            <section class="panel channel-panel">
              <div class="panel-head">
                <div>
                  <h2>Every channel has a story</h2>
                  <p>Acquisition cost, customer loyalty, and contribution</p>
                </div>
                <span class="quiet-tag"
                  >{{ stats.channelStats.length }} channels</span
                >
              </div>
              <div class="table-scroll">
                <table class="channel-table">
                  <thead>
                    <tr>
                      <th scope="col">Channel</th>
                      <th scope="col">New customers</th>
                      <th scope="col">
                        <abbr
                          title="Acquisition spending divided by new customers in the reporting period"
                          >Avg. CAC</abbr
                        >
                      </th>
                      <th scope="col">
                        <abbr
                          title="Customers still paying six months after signup, among customers with at least six months of history. Uses all observed cohorts."
                          >M6 retention</abbr
                        >
                      </th>
                      <th scope="col">
                        <abbr
                          title="Reporting-period revenue less direct service costs and acquisition spending. Excludes overhead and tax."
                          >Contribution</abbr
                        >
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="ch in stats.channelStats" :key="ch.channel">
                      <th scope="row">
                        <i
                          class="channel-dot"
                          :style="{ background: colorFor(ch.channel) }"
                        ></i
                        >{{ ch.channel }}
                      </th>
                      <td>{{ ch.customers }}</td>
                      <td>{{ ch.cac === null ? "—" : dollars(ch.cac) }}</td>
                      <td>
                        <span
                          class="retention-badge"
                          :class="{
                            strong: ch.retention >= 0.6,
                            weak: ch.retention !== null && ch.retention < 0.4,
                          }"
                          >{{ percent(ch.retention) }}</span
                        >
                      </td>
                      <td
                        class="money-cell"
                        :class="{ negative: ch.contribution < 0 }"
                      >
                        {{ dollars(ch.contribution) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="table-footnote">
                M6 retention uses all eligible signup groups. Contribution
                excludes overhead and tax.
              </div>
            </section>
            <aside class="insight-card">
              <div class="insight-label">
                <Icon name="leaf" :size="16" />A CLOSER LOOK
              </div>
              <template v-if="bestRetention"
                ><h2>
                  {{ bestRetention.channel }} customers are sticking around.
                </h2>
                <p>
                  <strong>{{ percent(bestRetention.retention) }}</strong> are
                  still paying at month 6 — the highest observed retention
                  {{
                    channel === null ? "among your channels" : "in this view"
                  }}.
                </p>
                <div class="insight-rule"></div>
                <p class="insight-small">
                  Based on {{ bestRetention.eligible }} customers with enough
                  history. Compare cohort sizes before changing your budget.
                </p>
                <button
                  @click="
                    channel = bestRetention.channel;
                    page = 'cohorts';
                  "
                >
                  Explore these cohorts<Icon
                    name="arrow"
                    :size="17"
                  /></button></template
              ><template v-else
                ><h2>Good decisions take a little history.</h2>
                <p>
                  Month-6 retention will appear when a signup group has six
                  months of payment history.
                </p>
                <button @click="page = 'cohorts'">
                  Explore cohorts<Icon name="arrow" :size="17" /></button
              ></template>
            </aside>
          </div>
          <section class="panel bottom-summary">
            <div>
              <span class="summary-icon"><Icon name="coin" :size="22" /></span>
              <div>
                <h2>From revenue to contribution</h2>
                <p>The money left after serving and acquiring customers.</p>
              </div>
            </div>
            <div class="contribution-equation">
              <span
                ><small>Gross profit</small
                ><strong>{{ dollars(stats.grossProfit) }}</strong></span
              ><b>−</b
              ><span
                ><small>Acquisition spend</small
                ><strong>{{ dollars(stats.acquisitionSpend) }}</strong></span
              ><b>=</b
              ><span class="contribution-result"
                ><small>Contribution</small
                ><strong :class="{ negative: stats.contribution < 0 }">{{
                  dollars(stats.contribution)
                }}</strong></span
              >
            </div>
          </section>
          <details class="monthly-details">
            <summary>
              View monthly figures behind the chart<Icon
                name="chevron"
                :size="16"
              />
            </summary>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th>Gross profit</th>
                    <th>Gross margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stats.series" :key="row.month">
                    <th>{{ monthLabel(row.month) }}</th>
                    <td>{{ dollars(row.revenue, 2) }}</td>
                    <td>{{ dollars(row.profit, 2) }}</td>
                    <td>
                      {{
                        percent(row.revenue ? row.profit / row.revenue : null)
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </template>

        <template v-else-if="page === 'cohorts'">
          <div class="cohort-intro">
            <div>
              <h2>One signup month. A longer story.</h2>
              <p>
                Each row follows the same group of customers. Read across to see
                who is still paying.
              </p>
            </div>
            <div class="heat-legend">
              <span>Lower retention</span
              ><i
                v-for="n in 5"
                :key="n"
                :style="{ background: `rgba(49, 125, 88, ${n * 0.17})` }"
              ></i
              ><span>Higher</span>
            </div>
          </div>
          <section class="panel cohort-panel">
            <div class="table-scroll">
              <table class="cohort-table">
                <thead>
                  <tr>
                    <th scope="col">Signup cohort</th>
                    <th scope="col">Customers</th>
                    <th v-for="age in 12" :key="age" scope="col">
                      M{{ age - 1 }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cohort in cohorts" :key="cohort.signup">
                    <th scope="row">
                      {{ monthLabel(cohort.signup, true) }}
                      {{ cohort.signup.slice(0, 4) }}
                    </th>
                    <td class="cohort-count">{{ cohort.count }}</td>
                    <td v-for="(value, age) in cohort.retention" :key="age">
                      <span
                        v-if="value !== null"
                        class="heat-cell"
                        :style="{
                          background: `rgba(49, 125, 88, ${0.06 + value * 0.76})`,
                          color: value > 0.68 ? '#ffffff' : '#285c43',
                        }"
                        :title="`${monthLabel(cohort.signup)}: ${percent(value)} of ${cohort.count} customers paying at month ${age}`"
                        >{{ Math.round(value * 100) }}%</span
                      ><span
                        v-else
                        class="not-observed"
                        title="This cohort has not reached this age by the final reporting month"
                        >—</span
                      >
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="table-footnote">
              <Icon name="info" :size="15" />M0 is the signup month. A dash
              means that month has not been observed, rather than 0% retention.
            </div>
          </section>
          <div class="explanation-grid">
            <article class="panel explain-card">
              <span class="explain-number">01</span>
              <h3>Compare customers at the same age</h3>
              <p>
                January’s M6 and June’s M6 both measure six months after signup,
                even though they fall in different calendar months.
              </p>
            </article>
            <article class="panel explain-card">
              <span class="explain-number">02</span>
              <h3>Keep the group size in view</h3>
              <p>
                A cohort of five customers is more sensitive to one cancellation
                than a cohort of fifty. The customer count stays fixed across
                each row.
              </p>
            </article>
            <article class="panel explain-card">
              <span class="explain-number">03</span>
              <h3>Separate retention from revenue</h3>
              <p>
                This view measures customers with positive revenue in each
                month. It does not measure revenue retention or account
                expansion.
              </p>
            </article>
          </div>
        </template>

        <template v-else>
          <section class="panel customers-panel">
            <div class="customer-tools">
              <div class="segmented customer-segments">
                <button
                  v-for="item in ['All customers', 'Active', 'Inactive']"
                  :key="item"
                  :class="{ active: status === item }"
                  :aria-pressed="status === item"
                  @click="status = item"
                >
                  {{ item }}
                </button>
              </div>
              <div class="customer-search">
                <label class="search-wrap"
                  ><Icon name="search" :size="17" /><input
                    v-model="search"
                    placeholder="Search customers…"
                    aria-label="Search customer names, IDs, channels, or plans" /></label
                ><label class="sort-wrap"
                  ><span class="sr-only">Sort customers</span
                  ><select v-model="sort">
                    <option value="contribution">Highest contribution</option>
                    <option value="revenue">Highest revenue</option>
                    <option value="name">Name: A–Z</option>
                  </select></label
                >
              </div>
            </div>
            <div class="table-scroll">
              <table class="customer-table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Channel / plan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Observed revenue</th>
                    <th scope="col">Contribution</th>
                    <th scope="col">CAC payback</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in displayedCustomers" :key="c.id">
                    <th scope="row">
                      <div class="customer-name">
                        <span
                          class="customer-avatar"
                          :style="{
                            background: colorFor(c.channel) + '19',
                            color: colorFor(c.channel),
                          }"
                          >{{ c.name.slice(0, 2).toUpperCase() }}</span
                        >
                        <div>
                          {{ c.name
                          }}<small
                            >{{ c.id }} · {{ monthLabel(c.signup, true) }}
                            {{ c.signup.slice(0, 4) }}</small
                          >
                        </div>
                      </div>
                    </th>
                    <td>
                      {{ c.channel
                      }}<small class="cell-subtitle">{{ c.plan }}</small>
                    </td>
                    <td>
                      <span
                        class="status-badge"
                        :class="{ inactive: !active(c) }"
                        ><i></i>{{ active(c) ? "Active" : "Inactive" }}</span
                      >
                    </td>
                    <td>{{ dollars(lifetimeRevenue(c)) }}</td>
                    <td
                      class="money-cell"
                      :class="{ negative: profitAfter(c) < 0 }"
                    >
                      {{ dollars(profitAfter(c)) }}
                    </td>
                    <td>
                      <span v-if="customerPayback(c) !== null"
                        >{{ customerPayback(c) }}
                        {{
                          customerPayback(c) === 1 ? "month" : "months"
                        }}</span
                      ><span v-else class="unrecovered">Unrecovered</span>
                    </td>
                  </tr>
                  <tr v-if="!displayedCustomers.length">
                    <td colspan="6" class="empty-state">
                      <Icon name="search" :size="28" />
                      <h3>No matching customers</h3>
                      <p>Try another name, channel, or customer status.</p>
                      <button
                        class="button secondary"
                        @click="
                          search = '';
                          status = 'All customers';
                          channel = null;
                          period = 'all';
                        "
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pagination">
              <span
                >{{
                  filteredCustomers.length ? (customerPage - 1) * 10 + 1 : 0
                }}–{{
                  Math.min(customerPage * 10, filteredCustomers.length)
                }}
                of {{ filteredCustomers.length }} customers</span
              >
              <div>
                <button
                  :disabled="customerPage <= 1"
                  @click="customerPage--"
                  aria-label="Previous customer page"
                >
                  <Icon name="chevron" :size="15" class="rotate" /></button
                ><span>{{ customerPage }} / {{ customerPages }}</span
                ><button
                  :disabled="customerPage >= customerPages"
                  @click="customerPage++"
                  aria-label="Next customer page"
                >
                  <Icon name="chevron" :size="15" />
                </button>
              </div>
            </div>
          </section>
          <p class="view-note">
            Totals cover each customer’s observed history through
            {{ monthLabel(dataset.last) }}. The period filter selects signup
            dates. “Inactive” means no payment in the final reporting month.
          </p>
        </template>
        <footer class="page-footer">
          <span
            ><span class="mini-dot green"></span
            >{{
              uploadedName
                ? "Your CSV stays in this browser session."
                : "Built with fictional customer data. All amounts in USD."
            }}</span
          ><button @click="resetDemo">
            <Icon name="refresh" :size="14" />Reset demo</button
          ><button @click="openDialog('methods')">
            Calculation notes<Icon name="arrow" :size="13" />
          </button>
        </footer>
      </main>
    </div>
  </div>

  <div
    v-if="importDialog || methodsDialog"
    class="modal-backdrop"
    @click.self="closeDialogs"
    @keydown="handleDialogKeys"
  >
    <section
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="importDialog ? 'import-title' : 'methods-title'"
    >
      <button
        ref="dialogClose"
        class="icon-button modal-close"
        @click="closeDialogs"
        aria-label="Close dialog"
      >
        <Icon name="close" />
      </button>
      <template v-if="importDialog"
        ><span class="modal-emblem"><Icon name="upload" :size="25" /></span>
        <p class="eyebrow">BRING YOUR OWN NUMBERS</p>
        <h2 id="import-title">A clearer view starts here.</h2>
        <p class="modal-lead">
          Import one CSV of monthly customer payments. Your file is processed
          locally and is never uploaded.
        </p>
        <div class="import-instructions">
          <strong>One row per paying customer, per month</strong>
          <p>
            Include customer details, revenue, direct service cost, and
            acquisition cost in the signup month. Use one currency throughout;
            this dashboard labels amounts as USD.
          </p>
          <button
            @click="
              download(toCSV(makeSampleData()), 'margin-sample-payments.csv')
            "
          >
            <Icon name="download" :size="16" />Download a ready-to-use sample
          </button>
        </div>
        <input
          ref="uploadInput"
          type="file"
          accept=".csv,text/csv"
          @change="importFile"
          class="sr-only"
          tabindex="-1"
        /><button
          class="upload-zone"
          @click="uploadInput.click()"
          :disabled="importing"
        >
          <Icon name="upload" :size="28" /><strong>{{
            importing ? "Checking your data…" : "Choose your CSV file"
          }}</strong
          ><span>Up to 5 MB · 50,000 rows · 36 months</span>
        </button>
        <p v-if="importError" class="import-error" role="alert">
          {{ importError }}
        </p>
        <p class="modal-small">
          A successful import replaces the demo. Refreshing or choosing Reset
          demo restores the fictional dataset.
        </p></template
      >
      <template v-else
        ><span class="modal-emblem"><Icon name="chart" :size="25" /></span>
        <p class="eyebrow">THE NUMBERS, EXPLAINED</p>
        <h2 id="methods-title">Clear inputs. Honest metrics.</h2>
        <dl class="methods-list">
          <dt>Revenue & gross margin</dt>
          <dd>
            Revenue is the sum of monthly customer revenue. Gross profit is
            revenue minus direct service costs. Gross margin is gross profit
            divided by revenue. These are revenue metrics, not cash-flow
            projections.
          </dd>
          <dt>Contribution after acquisition</dt>
          <dd>
            Gross profit minus acquisition spending. Overhead, taxes, financing,
            and other operating expenses are excluded, so this is not net
            profit.
          </dd>
          <dt>Customer acquisition cost (CAC)</dt>
          <dd>
            Acquisition spend divided by customers signed up during the selected
            reporting period. Assign each customer’s acquisition cost once, in
            their signup month.
          </dd>
          <dt>Observed payback</dt>
          <dd>
            The first month when cumulative customer gross profit covers their
            acquisition cost. Signup is month 1 for payback. The displayed
            median includes only recovered customers signed up in the selected
            period; {{ percent(recoveredPercent) }} of those customers have
            recovered their cost. Unrecovered customers remain visible in the
            customer table. Zero-cost acquisition has immediate payback (0
            months).
          </dd>
          <dt>Month-6 customer retention</dt>
          <dd>
            Customers paying six months after signup divided by customers in
            signup groups old enough to reach that age. Signup is M0 in the
            retention table. Channel retention uses all eligible cohorts,
            regardless of the overview reporting-period filter.
          </dd>
          <dt>Observation & data assumptions</dt>
          <dd>
            A missing monthly payment counts as inactive for that month; a
            returning customer counts as retained again. Missing end-of-file
            months cannot be inferred. Use complete data through the last
            reported month. All amounts are labelled USD; there is no currency
            conversion. Plan and channel are fixed customer attributes. We show
            observed history rather than estimated lifetime value.
          </dd>
        </dl></template
      >
    </section>
  </div>
</template>
