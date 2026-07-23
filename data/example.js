/* eduloan-explained — the worked example shown on the page.
   Every rupee figure displayed in index.html lives HERE, and the self-tests
   re-derive each one with the same paise-exact conventions as the eduloan
   calculator itself (closed-form annuity EMI rounded half-up to the paisa;
   per-row interest = round2(openingRupees × monthlyRate); final schedule row
   pays opening + interest so the balance closes at exactly 0). The figures
   match the fixture set asserted by eduloan's own test suite.

   Runs in the browser (global EDULOAN_EXAMPLE) and under node --test. */

"use strict";

/** Round half-up to 2 decimal places (paisa). */
function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Rupees (float, ≤2dp intent) → integer paise. */
function toPaise(rupees) {
  return Math.round(round2(rupees) * 100);
}

/** Integer paise → rupee number with exact 2dp value. */
function toRupees(paise) {
  return paise / 100;
}

/** Closed-form annuity EMI in rupees (2dp). Zero-rate degenerates to P/n. */
function emi(principal, annualRate, months) {
  if (months <= 0) throw new RangeError("months must be > 0");
  if (annualRate === 0) return round2(principal / months);
  const i = annualRate / 12;
  const pow = Math.pow(1 + i, months);
  return round2((principal * i * pow) / (pow - 1));
}

/** Simple interest accrued on a single lump sum over `months`, rupees 2dp. */
function accruedSimple(principal, annualRate, months) {
  return round2((principal * annualRate * months) / 12);
}

/**
 * Amortization schedule (paise ints). Convention: per-row interest =
 * round2(openingRupees × i); payment = EMI except the final row, which pays
 * opening + interest exactly, so the balance closes at 0.
 * Returns { emi, rows, totalPaidP, totalInterestP }.
 */
function amortize(balance, annualRate, months) {
  const i = annualRate / 12;
  const emiRupees = emi(balance, annualRate, months);
  const emiP = toPaise(emiRupees);
  let balP = toPaise(balance);
  const rows = [];
  let totalPaidP = 0;
  let totalInterestP = 0;
  for (let m = 1; m <= months && balP > 0; m++) {
    const intP = toPaise(round2(toRupees(balP) * i));
    let payP = emiP;
    if (m === months || balP + intP <= emiP) payP = balP + intP;
    const prinP = payP - intP;
    const closP = balP - prinP;
    rows.push({ m, openingP: balP, interestP: intP, principalP: prinP, paymentP: payP, closingP: closP });
    totalPaidP += payP;
    totalInterestP += intP;
    balP = closP;
  }
  return { emi: emiRupees, rows, totalPaidP, totalInterestP };
}

/** Format rupees with Indian digit grouping: ₹23,78,713.27 / ₹10,00,000. */
function formatINR(value, decimals) {
  const d = decimals === undefined ? 2 : decimals;
  const neg = value < 0;
  const fixed = Math.abs(value).toFixed(d);
  const parts = fixed.split(".");
  let head = parts[0];
  let grouped = "";
  if (head.length > 3) {
    grouped = "," + head.slice(-3);
    head = head.slice(0, -3);
    while (head.length > 2) {
      grouped = "," + head.slice(-2) + grouped;
      head = head.slice(0, -2);
    }
    grouped = head + grouped;
  } else {
    grouped = head;
  }
  return (neg ? "−₹" : "₹") + grouped + (parts[1] ? "." + parts[1] : "");
}

/* ------------------------------------------------------------------ */
/* The worked loan shown throughout the explainer.                     */
/* Same fixture eduloan's own test suite asserts to the paisa.         */
/* ------------------------------------------------------------------ */

const WORKED = {
  amount: 1000000,        // ₹10,00,000 sanctioned, lump-sum at month 0
  annualRate: 0.10,       // 10% p.a., held constant for the whole tenor
  courseMonths: 48,       // 4-year course
  tailMonths: 12,         // + 12 months, the IBA model-scheme repayment holiday
  moratoriumMonths: 60,   // courseMonths + tailMonths
  tenureMonths: 120,      // 10-year repayment
  partialAmount: 3000     // Scenario C: ₹3,000 per month during the moratorium
};

/* Displayed figures — each one re-derived by test/example.test.js. */
const FIGURES = {
  emiNoMoratorium: 13215.07,   // emi(10L, 10%, 120): the number generic tools stop at
  accrued: 500000,             // simple interest over the 60-month moratorium
  capitalisedA: 1500000,       // principal + accrued (Scenario A)
  emiA: 19822.61,
  outflowA: 2378713.27,
  interestA: 1378713.27,
  servicingMonthly: 8333.33,   // Scenario B: round2(10L × 10% / 12)
  paidDuringB: 500000,         // 59 × 8333.33 + trued-up final month
  emiB: 13215.07,              // EMI on the untouched ₹10L
  outflowB: 2085809.12,
  interestB: 1085809.12,
  paidDuringC: 180000,         // 60 × ₹3,000
  capitalisedC: 1320000,       // 10L + 5L − 1.8L
  emiC: 17443.90,
  outflowC: 2273267.48,
  interestC: 1273267.48,
  savesB: 292904.15,           // outflowA − outflowB
  savesC: 105445.79            // outflowA − outflowC
};

const APP_URL = "https://sreenivas-sadhu-prabhakara.github.io/eduloan/";

if (typeof module !== "undefined") {
  module.exports = { round2, toPaise, toRupees, emi, accruedSimple, amortize, formatINR, WORKED, FIGURES, APP_URL };
} else {
  window.EDULOAN_EXAMPLE = { round2, toPaise, toRupees, emi, accruedSimple, amortize, formatINR, WORKED, FIGURES, APP_URL };
}
