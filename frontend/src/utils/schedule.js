export const SCHEDULE = [
  { prefix: 125, book: "June 5 – 19, 2026", exam: "June 8 – 19, 2026", bookStart: new Date("2026-06-05"), bookEnd: new Date("2026-06-19"), examStart: new Date("2026-06-08") },
  { prefix: 124, book: "June 17 – July 4, 2026", exam: "June 20 – July 4, 2026", bookStart: new Date("2026-06-17"), bookEnd: new Date("2026-07-04"), examStart: new Date("2026-06-20") },
  { prefix: 123, book: "July 3 – 16, 2026", exam: "July 6 – 16, 2026", bookStart: new Date("2026-07-03"), bookEnd: new Date("2026-07-16"), examStart: new Date("2026-07-06") },
  { prefix: 122, book: "July 17 – 27, 2026", exam: "July 17 – 27, 2026", bookStart: new Date("2026-07-17"), bookEnd: new Date("2026-07-27"), examStart: new Date("2026-07-17") },
  { prefix: 0,   book: "July 25 – 31, 2026", exam: "July 28 – 31, 2026", bookStart: new Date("2026-07-25"), bookEnd: new Date("2026-07-31"), examStart: new Date("2026-07-28") },
];

export function getSchedule(id) {
  const p = parseInt(id.slice(0, 3));
  if (p === 125) return SCHEDULE[0];
  if (p === 124) return SCHEDULE[1];
  if (p === 123) return SCHEDULE[2];
  if (p === 122) return SCHEDULE[3];
  if (p <= 121)  return SCHEDULE[4];
  return null;
}

export function daysUntil(date) {
  return Math.ceil((date - new Date()) / 86400000);
}
