<script setup>
defineProps({ name: String, size: { type: Number, default: 20 } });
const paths = {
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  cohorts: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  people: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  arrow: ["M7 17 17 7", "M7 7h10v10"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 17v4h14v-4"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M4 16v5h16v-5"],
  chevron: ["m9 5 7 7-7 7"],
  search: ["M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13", "m16 16 5 5"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M12 11v6", "M12 7h.01"],
  close: ["m6 6 12 12", "m6 18 12-12"],
  calendar: ["M4 5h16v16H4z", "M8 3v4", "M16 3v4", "M4 11h16"],
  check: ["m5 12 4 4L19 6"],
  leaf: ["M20 3C8 3 3 8 5 15c3 8 15 3 15-12Z", "M4 21 15 10"],
  coin: [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    "M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",
    "M12 6v12",
  ],
  chart: ["M3 3v18h18", "m6 15 5-5 4 3 5-7"],
  refresh: [
    "M20 7v5h-5",
    "M4 17v-5h5",
    "M6 6a8 8 0 0 1 14 6",
    "M18 18a8 8 0 0 1-14-6",
  ],
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, i) in paths[name] || paths.chart" :key="i" :d="path" />
  </svg>
</template>
