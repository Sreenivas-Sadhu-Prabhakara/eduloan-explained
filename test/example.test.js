"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  round2, toPaise, toRupees, emi, accruedSimple, amortize, formatINR, WORKED, FIGURES, APP_URL
} = require("../data/example.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* ---------------- core formula re-derivation ---------------- */

test("closed-form annuity EMI matches the paise-exact fixtures", () => {
  assert.equal(emi(1000000, 0.10, 120), 13215.07);
  assert.equal(emi(1500000, 0.10, 120), 19822.61);
  assert.equal(emi(1320000, 0.10, 120), 17443.90);
});

test("zero-rate EMI degenerates to P/n with zero interest", () => {
  assert.equal(emi(120000, 0, 12), 10000);
  const am = amortize(120000, 0, 12);
  assert.equal(am.totalInterestP, 0);
  assert.equal(toRupees(am.totalPaidP), 120000);
});

test("simple-interest accrual over the worked moratorium", () => {
  assert.equal(accruedSimple(WORKED.amount, WORKED.annualRate, WORKED.moratoriumMonths), FIGURES.accrued);
  assert.equal(WORKED.moratoriumMonths, WORKED.courseMonths + WORKED.tailMonths);
});

test("capitalised balances derive from principal + accrued − paid", () => {
  assert.equal(WORKED.amount + FIGURES.accrued, FIGURES.capitalisedA);
  assert.equal(FIGURES.paidDuringC, WORKED.partialAmount * WORKED.moratoriumMonths);
  assert.equal(WORKED.amount + FIGURES.accrued - FIGURES.paidDuringC, FIGURES.capitalisedC);
});

test("Scenario B monthly servicing figure", () => {
  assert.equal(round2(WORKED.amount * WORKED.annualRate / 12), FIGURES.servicingMonthly);
  // 59 rounded months + a trued-up final month sum exactly to the closed form
  const truedFinalP = toPaise(FIGURES.paidDuringB) - 59 * toPaise(FIGURES.servicingMonthly);
  assert.equal(59 * toPaise(FIGURES.servicingMonthly) + truedFinalP, toPaise(FIGURES.paidDuringB));
});

/* ---------------- full-schedule simulation to the paisa ---------------- */

function scenarioTotals(capitalised, paidDuring) {
  const am = amortize(capitalised, WORKED.annualRate, WORKED.tenureMonths);
  const last = am.rows[am.rows.length - 1];
  assert.equal(last.closingP, 0, "schedule must close at exactly 0");
  for (const r of am.rows) {
    assert.ok(r.interestP >= 0 && r.principalP >= 0 && r.paymentP >= 0, "no negative cells");
  }
  const outflowP = toPaise(paidDuring) + am.totalPaidP;
  return { emi: am.emi, outflow: toRupees(outflowP), interest: toRupees(outflowP - toPaise(WORKED.amount)) };
}

test("Scenario A (full moratorium) totals", () => {
  const a = scenarioTotals(FIGURES.capitalisedA, 0);
  assert.equal(a.emi, FIGURES.emiA);
  assert.equal(a.outflow, FIGURES.outflowA);
  assert.equal(a.interest, FIGURES.interestA);
});

test("Scenario B (interest served) totals", () => {
  const b = scenarioTotals(WORKED.amount, FIGURES.paidDuringB);
  assert.equal(b.emi, FIGURES.emiB);
  assert.equal(b.outflow, FIGURES.outflowB);
  assert.equal(b.interest, FIGURES.interestB);
});

test("Scenario C (partial ₹3,000/mo) totals", () => {
  const c = scenarioTotals(FIGURES.capitalisedC, FIGURES.paidDuringC);
  assert.equal(c.emi, FIGURES.emiC);
  assert.equal(c.outflow, FIGURES.outflowC);
  assert.equal(c.interest, FIGURES.interestC);
});

test("headline deltas are exact differences of simulated outflows", () => {
  assert.equal(toRupees(toPaise(FIGURES.outflowA) - toPaise(FIGURES.outflowB)), FIGURES.savesB);
  assert.equal(toRupees(toPaise(FIGURES.outflowA) - toPaise(FIGURES.outflowC)), FIGURES.savesC);
});

test("principal conservation: Σ principal components === capitalised balance", () => {
  for (const cap of [FIGURES.capitalisedA, WORKED.amount, FIGURES.capitalisedC]) {
    const am = amortize(cap, WORKED.annualRate, WORKED.tenureMonths);
    let sumPrinP = 0;
    for (const r of am.rows) sumPrinP += r.principalP;
    assert.equal(sumPrinP, toPaise(cap));
  }
});

test("property: 400 seeded loans — schedule closes at 0 and conserves principal", () => {
  let seed = 0xC0FFEE;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let k = 0; k < 400; k++) {
    const bal = round2(50000 + rand() * 5000000);
    const rate = round2(0.06 + rand() * 0.09);
    const months = 12 + Math.floor(rand() * 168);
    const am = amortize(bal, rate, months);
    assert.equal(am.rows[am.rows.length - 1].closingP, 0);
    let sumPrinP = 0;
    for (const r of am.rows) sumPrinP += r.principalP;
    assert.equal(sumPrinP, toPaise(bal));
    assert.equal(am.totalPaidP, sumPrinP + am.totalInterestP);
  }
});

/* ---------------- Indian formatting ---------------- */

test("formatINR groups Indian style", () => {
  assert.equal(formatINR(2378713.27), "₹23,78,713.27");
  assert.equal(formatINR(1000000, 0), "₹10,00,000");
  assert.equal(formatINR(105445.79), "₹1,05,445.79");
  assert.equal(formatINR(999, 0), "₹999");
  assert.equal(formatINR(8333.33), "₹8,333.33");
});

/* ---------------- the page displays exactly these figures ---------------- */

test("every displayed figure on the page matches the derived value", () => {
  const shown2dp = ["emiNoMoratorium", "emiA", "emiB", "emiC", "outflowA", "outflowB",
    "outflowC", "interestA", "interestB", "interestC", "savesB", "savesC", "servicingMonthly"];
  for (const key of shown2dp) {
    assert.ok(html.includes(formatINR(FIGURES[key])), `index.html must show ${key} = ${formatINR(FIGURES[key])}`);
  }
  const shownWhole = ["accrued", "capitalisedA", "capitalisedC", "paidDuringC"];
  for (const key of shownWhole) {
    assert.ok(html.includes(formatINR(FIGURES[key], 0)), `index.html must show ${key} = ${formatINR(FIGURES[key], 0)}`);
  }
  assert.ok(html.includes(formatINR(WORKED.amount, 0)), "sanctioned amount shown");
});

/* ---------------- page contract gates ---------------- */

test("CSP meta is exact and the page is network-silent", () => {
  assert.ok(html.includes(
    "default-src 'self'; connect-src 'none'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"
  ));
  assert.ok(!/\bfetch\s*\(/.test(html));
  assert.ok(!/XMLHttpRequest/.test(html));
  assert.ok(!/\son[a-z]+\s*=/.test(html), "no inline event handlers");
});

test("H1 is keyword-first and the CTA links to the live calculator", () => {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1, "has an h1");
  assert.ok(/^Education loan moratorium/i.test(h1[1].replace(/<[^>]+>/g, "").trim()));
  assert.ok(html.includes(APP_URL));
});

test("disclaimer present on the page", () => {
  assert.ok(/not financial, tax, or investment advice/i.test(html));
});
