/** Minimal zero-dependency test harness. */
let passed = 0, failed = 0, current = '';
const failures = [];

export function suite(name, fn) {
  current = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  fn();
}

export function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32mpass\x1b[0m  ${name}`);
  } catch (e) {
    failed++;
    failures.push(`${current} > ${name}\n      ${e.message}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        \x1b[31m${e.message}\x1b[0m`);
  }
}

export function close(actual, expected, tol, what = '') {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${what} expected ${expected} +/-${tol}, got ${actual}`);
  }
}

export function between(actual, lo, hi, what = '') {
  if (!(actual >= lo && actual <= hi)) {
    throw new Error(`${what} expected within [${lo}, ${hi}], got ${actual}`);
  }
}

export function ok(cond, what = '') {
  if (!cond) throw new Error(what || 'expected truthy');
}

export function report() {
  console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} passed, ${failed} failed\x1b[0m`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}
