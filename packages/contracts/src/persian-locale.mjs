/**
 * NX-016 — Persian localisation toolbox.
 *
 * Pure functions with no dependency on the host's ICU data: the same input gives the same output
 * on every machine. Covers explicit Jalali (Solar Hijri) calendar conversion, digit conversion,
 * number and Rial/Toman display, and the search normaliser that the UI already used.
 *
 * Boundaries: display only (no currency conversion, no exchange rates); the calendar works on a
 * calendar date, so time zones are out of scope; supported Jalali years are 1178 to 1633.
 */

export const PERSIAN_LOCALE_CONTRACT_VERSION = "1.0";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const JALALI_MONTHS = Object.freeze(["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]);
/** Saturday first, the Iranian week order. */
export const JALALI_WEEKDAYS = Object.freeze(["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]);

export function toPersianDigits(value) {
  return String(value).replace(/\d/g, digit => FA_DIGITS[Number(digit)]);
}

/** Persian and Arabic-Indic digits become ASCII digits; everything else is untouched. */
export function toLatinDigits(value) {
  return String(value).replace(/[۰-۹]/g, digit => String(FA_DIGITS.indexOf(digit))).replace(/[٠-٩]/g, digit => String(AR_DIGITS.indexOf(digit)));
}

/**
 * The UI search normaliser, moved here unchanged (Back Office search, Portfolio filter). It is also
 * serialised into browser scripts with `.toString()`, so it must stay self-contained.
 */
export function normalizeHeroSearch(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s\u200c\u200d\u064b-\u065f]/g, "");
}

/* ------------------------------------------------------------------ Jalali calendar */

// Leap-year break points of the Solar Hijri calendar (Borkowski's algorithm, as used by jalaali-js).
const BREAKS = Object.freeze([-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]);
const MIN_YEAR = 1178;
const MAX_YEAR = 1633;

const div = (a, b) => Math.trunc(a / b);
const mod = (a, b) => a - Math.trunc(a / b) * b;

function jalaliCycle(jy) {
  if (!Number.isInteger(jy) || jy < MIN_YEAR || jy > MAX_YEAR) throw new RangeError(`Jalali year must be an integer from ${MIN_YEAR} to ${MAX_YEAR}.`);
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function gregorianToDayNumber(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function dayNumberToGregorian(dayNumber) {
  let j = 4 * dayNumber + 139361631;
  j += div(div(4 * dayNumber + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);
  return { year, month, day };
}

export function isJalaliLeapYear(year) {
  return jalaliCycle(year).leap === 0;
}

export function jalaliMonthLength(year, month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("Jalali month must be 1 to 12.");
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

function assertGregorian(year, month, day) {
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1) throw new RangeError("A valid Gregorian date is required.");
  const length = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > length) throw new RangeError("A valid Gregorian date is required.");
}

export function gregorianToJalali(gregorianYear, gregorianMonth, gregorianDay) {
  assertGregorian(gregorianYear, gregorianMonth, gregorianDay);
  const dayNumber = gregorianToDayNumber(gregorianYear, gregorianMonth, gregorianDay);
  let year = dayNumberToGregorian(dayNumber).year - 621;
  if (year < MIN_YEAR - 1 || year > MAX_YEAR + 1) throw new RangeError(`The date is outside the supported Jalali years ${MIN_YEAR}-${MAX_YEAR}.`);
  let cycle = jalaliCycle(Math.min(Math.max(year, MIN_YEAR), MAX_YEAR));
  year = Math.min(Math.max(year, MIN_YEAR), MAX_YEAR);
  const firstOfYear = gregorianToDayNumber(cycle.gy, 3, cycle.march);
  let k = dayNumber - firstOfYear;
  if (k >= 0) {
    if (k <= 185) return Object.freeze({ year, month: 1 + div(k, 31), day: mod(k, 31) + 1 });
    k -= 186;
  } else {
    year -= 1;
    k += 179;
    if (cycle.leap === 1) k += 1;
  }
  return Object.freeze({ year, month: 7 + div(k, 30), day: mod(k, 30) + 1 });
}

export function jalaliToGregorian(jalaliYear, jalaliMonth, jalaliDay) {
  if (!Number.isInteger(jalaliDay) || jalaliDay < 1 || jalaliDay > jalaliMonthLength(jalaliYear, jalaliMonth)) throw new RangeError("A valid Jalali date is required.");
  const cycle = jalaliCycle(jalaliYear);
  const dayNumber = gregorianToDayNumber(cycle.gy, 3, cycle.march) + (jalaliMonth - 1) * 31 - div(jalaliMonth, 7) * (jalaliMonth - 7) + jalaliDay - 1;
  return Object.freeze(dayNumberToGregorian(dayNumber));
}

/** Weekday index with Saturday = 0, from a Gregorian calendar date. */
export function jalaliWeekdayIndex(gregorianYear, gregorianMonth, gregorianDay) {
  assertGregorian(gregorianYear, gregorianMonth, gregorianDay);
  const jsDay = new Date(Date.UTC(gregorianYear, gregorianMonth - 1, gregorianDay)).getUTCDay();
  return (jsDay + 1) % 7;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;

/** Accepts "YYYY-MM-DD" (or an ISO timestamp, whose UTC calendar date is used) or { year, month, day } in Gregorian. */
export function parseGregorianDate(input) {
  if (typeof input === "string") {
    const match = ISO_DATE.exec(input.trim());
    if (!match) throw new RangeError("Dates are given as YYYY-MM-DD or an ISO timestamp.");
    const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    assertGregorian(parts.year, parts.month, parts.day);
    return parts;
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError("Invalid date.");
    return { year: input.getUTCFullYear(), month: input.getUTCMonth() + 1, day: input.getUTCDate() };
  }
  if (input && typeof input === "object") {
    assertGregorian(input.year, input.month, input.day);
    return { year: input.year, month: input.month, day: input.day };
  }
  throw new RangeError("A date is required.");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * Formats a Gregorian date as a Jalali date. `numeric` gives 1405/07/29; `long` gives
 * "چهارشنبه ۲۹ مهر ۱۴۰۵" (weekday optional). `digits: "fa"` (default) or "latin".
 */
export function formatJalaliDate(input, { style = "numeric", digits = "fa", weekday = false } = {}) {
  if (!["numeric", "long"].includes(style) || !["fa", "latin"].includes(digits)) throw new RangeError("Unsupported date format options.");
  const gregorian = parseGregorianDate(input);
  const jalali = gregorianToJalali(gregorian.year, gregorian.month, gregorian.day);
  const dayName = JALALI_WEEKDAYS[jalaliWeekdayIndex(gregorian.year, gregorian.month, gregorian.day)];
  const text = style === "numeric"
    ? `${jalali.year}/${pad(jalali.month)}/${pad(jalali.day)}`
    : `${weekday ? `${dayName} ` : ""}${jalali.day} ${JALALI_MONTHS[jalali.month - 1]} ${jalali.year}`;
  return digits === "fa" ? toPersianDigits(text) : text;
}

/* ------------------------------------------------------------------ numbers and money */

function group(integerText, separator) {
  return integerText.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Groups thousands. Persian digits use the Persian thousands separator "٬", Latin digits use ",". */
export function formatNumber(value, { digits = "fa" } = {}) {
  if (!["fa", "latin"].includes(digits)) throw new RangeError("Unsupported digit option.");
  if (typeof value !== "bigint" && !(Number.isSafeInteger(value))) throw new RangeError("Only integers are formatted; pass a safe integer or a BigInt.");
  const negative = value < 0;
  const absolute = (negative ? -value : value).toString();
  const grouped = group(absolute, digits === "fa" ? "٬" : ",");
  const text = `${negative ? "-" : ""}${grouped}`;
  return digits === "fa" ? toPersianDigits(text) : text;
}

/**
 * Money is always given in Rial. `unit: "rial"` shows it as is; `unit: "toman"` shows rial / 10 and
 * refuses an amount that is not a multiple of 10 instead of rounding it silently. No conversion
 * between currencies is ever performed.
 */
export function formatMoney(rialAmount, { unit = "toman", digits = "fa", withUnit = true } = {}) {
  if (!["rial", "toman"].includes(unit)) throw new RangeError("unit must be rial or toman.");
  if (typeof rialAmount !== "bigint" && !Number.isSafeInteger(rialAmount)) throw new RangeError("The amount must be an integer number of Rial.");
  let shown = BigInt(rialAmount);
  if (unit === "toman") {
    if (shown % 10n !== 0n) throw new RangeError("The Rial amount is not a whole number of Toman; it is not rounded silently.");
    shown /= 10n;
  }
  const number = formatNumber(shown, { digits });
  return withUnit ? `${number} ${unit === "toman" ? "تومان" : "ریال"}` : number;
}
