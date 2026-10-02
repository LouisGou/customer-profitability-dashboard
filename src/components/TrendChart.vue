<script setup>
import { computed, ref } from "vue";
import { dollars, monthLabel } from "../data.js";
const props = defineProps({ series: Array, mode: String });
const hovered = ref(null);
const width = 760,
  height = 240,
  left = 54,
  top = 18,
  bottom = 35;
const maximum = computed(
  () =>
    Math.max(
      100,
      ...props.series.map((r) =>
        props.mode === "profit" ? Math.abs(r.profit) : r.revenue,
      ),
    ) * 1.22,
);
const minimum = computed(() =>
  props.mode === "profit"
    ? Math.min(0, ...props.series.map((r) => r.profit)) * 1.1
    : 0,
);
const x = (i) =>
  left + i * ((width - left - 14) / Math.max(1, props.series.length - 1));
const y = (value) =>
  top +
  ((maximum.value - value) / (maximum.value - minimum.value)) *
    (height - top - bottom);
const value = (row) => (props.mode === "profit" ? row.profit : row.revenue);
const path = computed(() =>
  props.series
    .map((row, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(value(row))}`)
    .join(" "),
);
const area = computed(() =>
  props.series.length
    ? `${path.value} L${x(props.series.length - 1)},${y(minimum.value)} L${x(0)},${y(minimum.value)} Z`
    : "",
);
const ticks = computed(() =>
  Array.from(
    { length: 4 },
    (_, i) => minimum.value + ((maximum.value - minimum.value) * i) / 3,
  ),
);
const shown = computed(() =>
  hovered.value === null ? null : props.series[hovered.value],
);
</script>
<template>
  <div class="trend-chart" @mouseleave="hovered = null">
    <div class="chart-tooltip" v-if="shown" aria-live="polite">
      <strong>{{ monthLabel(shown.month) }}</strong
      ><span
        >{{ mode === "profit" ? "Gross profit" : "Revenue" }} ·
        {{ dollars(value(shown)) }}</span
      >
    </div>
    <svg
      viewBox="0 0 760 240"
      role="img"
      :aria-label="`${mode === 'profit' ? 'Gross profit' : 'Revenue'} by month. Exact amounts are available in the monthly data table below.`"
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#70ad8c" stop-opacity=".26" />
          <stop offset="100%" stop-color="#70ad8c" stop-opacity=".015" />
        </linearGradient>
      </defs>
      <g v-for="tick in ticks" :key="tick">
        <line
          :x1="left"
          :x2="width - 14"
          :y1="y(tick)"
          :y2="y(tick)"
          stroke="#e9ebe4"
          stroke-dasharray="3 5"
        />
        <text
          :x="left - 12"
          :y="y(tick) + 4"
          text-anchor="end"
          fill="#88918a"
          font-size="11"
        >
          {{
            Math.abs(tick) >= 1000
              ? `$${(tick / 1000).toFixed(0)}k`
              : dollars(tick)
          }}
        </text>
      </g>
      <path :d="area" fill="url(#chart-fill)" />
      <path
        :d="path"
        stroke="#367f60"
        stroke-width="2.7"
        fill="none"
        stroke-linejoin="round"
      />
      <g v-for="(row, i) in series" :key="row.month">
        <rect
          :x="x(i) - 20"
          :y="top"
          width="40"
          :height="height - top"
          fill="transparent"
          @mouseenter="hovered = i"
        />
        <circle
          :cx="x(i)"
          :cy="y(value(row))"
          :r="hovered === i ? 5 : 3"
          fill="#367f60"
          stroke="#fff"
          stroke-width="2"
        />
        <text
          v-if="series.length <= 12 || i % 3 === 0"
          :x="x(i)"
          :y="height - 8"
          text-anchor="middle"
          fill="#88918a"
          font-size="11"
        >
          {{ monthLabel(row.month, true) }}
        </text>
      </g>
      <line
        v-if="shown"
        :x1="x(hovered)"
        :x2="x(hovered)"
        :y1="top"
        :y2="height - bottom"
        stroke="#367f60"
        stroke-opacity=".35"
        stroke-dasharray="3 4"
      />
    </svg>
  </div>
</template>
