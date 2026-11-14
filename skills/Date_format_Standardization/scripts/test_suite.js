const { normalizeDate, isStrictDateFormat, compareDates, diffDays } = require('./normalize_date');

const testCases = [
  { input: '23-2-5', expected: '2023-02-05', desc: 'YY-M-D with hyphens' },
  { input: '23/2/5', expected: '2023-02-05', desc: 'YY/M/D with slashes' },
  { input: '2023/2/5', expected: '2023-02-05', desc: 'YYYY/M/D with slashes' },
  { input: '2/5/23', expected: '2023-02-05', desc: 'M/D/YY US format' },
  { input: '02/05/23', expected: '2023-02-05', desc: 'MM/DD/YY US format' },
  { input: '02/05/2023', expected: '2023-02-05', desc: 'MM/DD/YYYY US format' },
  { input: '2023-02-05', expected: '2023-02-05', desc: 'Standard YYYY-MM-DD' },
  { input: '2023.2.5', expected: '2023-02-05', desc: 'YYYY.M.D with dots' },
  { input: '23.2.5', expected: '2023-02-05', desc: 'YY.M.D with dots' },
  { input: '2023- 2- 5', expected: '2023-02-05', desc: 'Spaces around hyphens' },
  { input: '2023 / 2 / 5', expected: '2023-02-05', desc: 'Spaces around slashes' },
  { input: '2023년 2월 5일', expected: '2023-02-05', desc: 'Korean text format' },
  { input: '20230205', expected: '2023-02-05', desc: '8-digit compact' },
  { input: '230205', expected: '2023-02-05', desc: '6-digit compact' },
  { input: 44962, expected: '2023-02-05', desc: 'Excel serial number' },
  { input: '44962', expected: '2023-02-05', desc: 'Excel serial as string' }
];

console.log('================================================================');
console.log('  Date_format_Standardization 자동화 테스트 스위트 (16개 TC)');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

testCases.forEach((tc, idx) => {
  const actual = normalizeDate(tc.input);
  const isValid = isStrictDateFormat(actual);
  const pass = actual === tc.expected && isValid;

  if (pass) {
    console.log(`[PASS] TC-${String(idx + 1).padStart(2, '0')}: ${tc.input} (${tc.desc}) -> ${actual}`);
    passCount++;
  } else {
    console.error(`[FAIL] TC-${String(idx + 1).padStart(2, '0')}: ${tc.input} (${tc.desc}) -> actual: ${actual}, expected: ${tc.expected}`);
    failCount++;
  }
});

console.log('\n================================================================');
console.log(`  결과 요약: 총 16건 중 통과: ${passCount}건 / 실패: ${failCount}건`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('>>> 16개 테스트 케이스 100% 전수 통과 (ALL TESTS PASSED) <<<\n');
}
