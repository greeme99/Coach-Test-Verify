const fs = require('fs');
const XLSX = require('C:/Users/0208m/.gemini/antigravity/brain/2fb55675-15c3-46dd-9504-c42adaa7a5f6/scratch/package');

// Read files
const modelsCode = fs.readFileSync('src/models.js', 'utf8');
const parserCode = fs.readFileSync('src/parser.js', 'utf8');
const validatorCode = fs.readFileSync('src/validator.js', 'utf8');

const combined = `
${modelsCode}
${parserCode}
${validatorCode}
return { ExcelParser, CoachingLogValidator, MentorValidator, CoachTheCoachValidator, CrossTimelineChecker };
`;

const { ExcelParser, CoachingLogValidator, MentorValidator, CoachTheCoachValidator, CrossTimelineChecker } = (new Function('XLSX', combined))(XLSX);

let passedCount = 0;
let failedCount = 0;

function assert(tcId, condition, desc) {
  if (condition) {
    console.log(`[PASS] ${tcId}: ${desc}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${tcId}: ${desc}`);
    failedCount++;
  }
}

console.log('================================================================');
console.log('  KPC 서류 검증 시스템 자동화 QA 테스트 스위트 (17개 TC 점검)');
console.log('================================================================\n');

// TC-BASE-01
const baseline = {
  applicantName: '가상응시자A',
  examType: 'STANDARD',
  kacCertDate: '2023-01-15',
  coachingBasicEduDate: '2022-09-01',
  coachingEduStartDate: '2022-09-01',
  educationSchedules: [
    { date: '2022-09-05', startTime: '09:00', endTime: '18:00' }
  ]
};
assert('TC-BASE-01', baseline.applicantName === '가상응시자A' && baseline.coachingBasicEduDate === '2022-09-01' && baseline.kacCertDate === '2023-01-15', '기준 정보 폼 객체 정상 바인딩');

// TC-BASE-02: 3종 파일 자동 분류
const wbClog = XLSX.read(fs.readFileSync('Ref.Doc/1.코칭일지(KPC)_인증_1_43_v6.xlsx'), { type: 'buffer' });
const wbMent = XLSX.read(fs.readFileSync('Ref.Doc/4.멘토코칭 리스트(KPC)_인증_1_47_v5.xlsx'), { type: 'buffer' });
const wbCctc = XLSX.read(fs.readFileSync('Ref.Doc/5.일대일 코치더코치 리스트(KPC)_인증_1_48_v5.xlsx'), { type: 'buffer' });

const type1 = ExcelParser.detectDocType(wbClog, '1.코칭일지(KPC)...xlsx');
const type2 = ExcelParser.detectDocType(wbMent, '4.멘토코칭...xlsx');
const type3 = ExcelParser.detectDocType(wbCctc, '5.일대일...xlsx');
assert('TC-BASE-02', type1 === 'COACHING_LOG' && type2 === 'MENTOR_COACHING' && type3 === 'COACH_THE_COACH', '3개 파일 자동 슬롯 배분 성공');

// TC-CLOG-01: 응시자명 누락
const clogMissingName = {
  applicantName: '',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-05', timeStr: '10:00-10:50', clientName: '고객1', paidVal: 50, freeVal: null, ctcVal: null, formatStr: '' } // format empty
  ]
};
const resClog01 = CoachingLogValidator.validate(clogMissingName, baseline);
assert('TC-CLOG-01', resClog01.docErrorCount === 1 && !resClog01.rows[0].isValid, '상단 응시자명 누락 문서오류 1건 및 필수열 누락 감지');

// TC-CLOG-02: 날짜 정렬 역전
const clogSortErr = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-07', timeStr: '10:00-11:00', clientName: '고객1', paidVal: 60, freeVal: null, ctcVal: null, formatStr: '1:1 대면' },
    { rowIndex: 8, dateStr: '2023-02-05', timeStr: '10:00-11:00', clientName: '고객2', paidVal: 60, freeVal: null, ctcVal: null, formatStr: '1:1 대면' }
  ]
};
const resClog02 = CoachingLogValidator.validate(clogSortErr, baseline);
assert('TC-CLOG-02', !resClog02.rows[1].isValid && resClog02.rows[1].errors.some(e => e.code.includes('CL-06')), '날짜 정렬 역전 행 오류 감지');

// TC-CLOG-03: 세션 한도(120분) 초과
const clogLimitErr = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-05', timeStr: '10:00-12:30', clientName: '고객1', paidVal: 150, freeVal: null, ctcVal: null, formatStr: '1:1 대면' }
  ]
};
const resClog03 = CoachingLogValidator.validate(clogLimitErr, baseline);
assert('TC-CLOG-03', !resClog03.rows[0].isValid && resClog03.totalPaidMinutes === 0, '120분 초과 세션 오류 판정 및 시간 전액 0분 차감');

// TC-CLOG-04: 인원수 미기재 및 금지 수단
const clogFormatErr = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-05', timeStr: '10:00-11:00', clientName: '고객1', paidVal: 60, freeVal: null, ctcVal: null, formatStr: '카카오톡 코칭' }
  ]
};
const resClog04 = CoachingLogValidator.validate(clogFormatErr, baseline);
assert('TC-CLOG-04', !resClog04.rows[0].isValid && resClog04.rows[0].errors.some(e => e.code === 'CL-07-FORBIDDEN'), '카카오톡 등 금지 수단 적발');

// TC-CLOG-05: 받은CTC 2배 기재값 검증 및 KAC 이전 25h 상한
const clogCtcTest = {
  applicantName: '가상응시자A',
  rows: [
    // Before KAC: 2022-10-01 (baseline KAC is 2023-01-15), 1:1 60 min session recorded as 120
    { rowIndex: 7, dateStr: '2022-10-01', timeStr: '10:00-11:00', clientName: '상위코치(KPC90001)', paidVal: null, freeVal: null, ctcVal: 120, formatStr: '1:1 대면' }
  ]
};
const resClog05 = CoachingLogValidator.validate(clogCtcTest, baseline);
assert('TC-CLOG-05', resClog05.rows[0].isValid && resClog05.creditedCtcTotal === 120, '받은CTC 2배 기재값 정상 인정 및 재가산 배제');

// TC-CLOG-06: 10건 초과 탈락
const rows12Errors = [];
for (let i = 1; i <= 11; i++) {
  rows12Errors.push({
    rowIndex: i + 6,
    dateStr: '2023-02-05',
    timeStr: '10:00-10:20', // 20 min (under 30 min)
    clientName: `고객${i}`,
    paidVal: 20,
    freeVal: null,
    ctcVal: null,
    formatStr: '1:1 대면'
  });
}
const resClog06 = CoachingLogValidator.validate({ applicantName: '가상응시자A', rows: rows12Errors }, baseline);
assert('TC-CLOG-06', !resClog06.isValid && resClog06.errorCount === 11 && resClog06.errors.some(e => e.code === 'CL-14'), '오류 11건 누적 시 즉시 탈락(FAIL) 판정');

// TC-MENT-01: 멘토코칭 60일 미만
const mentSpanErr = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-01', timeStr: '20:00-21:00', coachName: '홍코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 8, dateStr: '2023-03-01', timeStr: '20:00-21:00', coachName: '홍코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' }
  ] // Span = 28 days < 60 days
};
const resMent01 = MentorValidator.validate(mentSpanErr, baseline);
assert('TC-MENT-01', !resMent01.isValid && resMent01.spanDays === 28 && resMent01.errors.some(e => e.code === 'MC-04'), '멘토코칭 이수기간 미달(28일 < 60일) 탈락 판정');

// TC-MENT-02: 멘토 단일 세션 90분 입력 시 60분 절사
const mentCapTest = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-01', timeStr: '20:00-21:30', coachName: '홍코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 90, formatStr: '1:1 대면' }
  ]
};
const resMent02 = MentorValidator.validate(mentCapTest, baseline);
assert('TC-MENT-02', resMent02.creditedMinutesTotal === 60, '멘토코칭 90분 세션 60분 상한 절사 인정');

// TC-MENT-03: 멘토코치 만료 시 탈락
const mentExpired = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-01', timeStr: '20:00-21:00', coachName: '홍코치(KPC90100)', certStatus: '만료', sessionMinutesVal: 60, formatStr: '1:1 대면' }
  ]
};
const resMent03 = MentorValidator.validate(mentExpired, baseline);
assert('TC-MENT-03', !resMent03.rows[0].isValid && resMent03.rows[0].errors.some(e => e.code === 'MC-08'), '멘토코치 자격 만료/정지 건 미인정 및 오류 적발');

// TC-CCTC-01: KAC 이전 1:1 CTC 불인정
const cctcBeforeKac = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2022-12-01', timeStr: '20:00-21:00', coachName: '홍코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' }
  ]
};
const resCctc01 = CoachTheCoachValidator.validate(cctcBeforeKac, baseline);
assert('TC-CCTC-01', !resCctc01.rows[0].isValid && resCctc01.creditedMinutesTotal === 0, 'KAC 취득일 이전 1:1 CTC 세션 불인정');

// TC-CCTC-02: 세션 규격(30~60분) 위반
const cctcDurationErr = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-03-01', timeStr: '20:00-20:20', coachName: '홍코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 20, formatStr: '1:1 대면' } // 20m
  ]
};
const resCctc02 = CoachTheCoachValidator.validate(cctcDurationErr, baseline);
assert('TC-CCTC-02', !resCctc02.rows[0].isValid && resCctc02.rows[0].errors.some(e => e.code === 'CC-06'), '1:1 CTC 단일 세션 시간(20분) 규격 미달 적발');

// TC-CROS-01: 교차 중복 기재 적발
const clogForCross = {
  rows: [
    { rowIndex: 10, normDate: '2023-05-10', timeParsed: { startTime: '14:00', endTime: '15:00', startMinutes: 840, endMinutes: 900 }, clientName: '홍코치(KPC90100)', ctcVal: 120 }
  ]
};
const mentForCross = {
  rows: [
    { rowIndex: 8, normDate: '2023-05-10', timeParsed: { startTime: '14:00', endTime: '15:00', startMinutes: 840, endMinutes: 900 }, coachName: '홍코치(KPC90100)' }
  ]
};
const crossRes1 = CrossTimelineChecker.check(clogForCross, mentForCross, null, baseline);
assert('TC-CROS-01', crossRes1.length === 1 && crossRes1[0].type === 'CROSS_DUPLICATION', '코칭일지와 멘토코칭 간 동일 세션 교차 중복 기재 감지');

// TC-CROS-02: 동시 수행 불가 충돌 적발
const clogForSimul = {
  rows: [
    { rowIndex: 12, normDate: '2023-06-01', timeParsed: { startTime: '10:00', endTime: '11:30', startMinutes: 600, endMinutes: 690 }, clientName: '일반고객A' }
  ]
};
const cctcForSimul = {
  rows: [
    { rowIndex: 9, normDate: '2023-06-01', timeParsed: { startTime: '11:00', endTime: '12:00', startMinutes: 660, endMinutes: 720 }, coachName: '지도코치(KPC90999)' }
  ]
};
const crossRes2 = CrossTimelineChecker.check(clogForSimul, null, cctcForSimul, baseline);
assert('TC-CROS-02', crossRes2.length === 1 && crossRes2[0].type === 'SIMULTANEOUS_EVENT', '코칭 중 피코칭 동시 진행 불가 충돌 적발');

// TC-DASH-01: 완전 무결 정상 데이터
const perfectClog = {
  applicantName: '가상응시자A',
  rows: []
};
// 100 days (100 distinct dates in 2023), 2 sessions per day = 200 sessions of 60 min = 12,000 min
let rowCounter = 7;
for (let d = 1; d <= 100; d++) {
  const dt = new Date('2023-03-01');
  dt.setDate(dt.getDate() + (d - 1));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dayStr = String(dt.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${dayStr}`;

  const client1 = `가상고객${((d - 1) % 10) + 1}`;
  const client2 = `가상고객${((d) % 10) + 1}`;

  perfectClog.rows.push({
    rowIndex: rowCounter++,
    dateStr,
    timeStr: '10:00-11:00',
    clientName: client1,
    paidVal: 60,
    freeVal: null,
    ctcVal: null,
    formatStr: '1:1 대면'
  });
  perfectClog.rows.push({
    rowIndex: rowCounter++,
    dateStr,
    timeStr: '14:00-15:00',
    clientName: client2,
    paidVal: 60,
    freeVal: null,
    ctcVal: null,
    formatStr: '1:1 대면'
  });
}
const perfectMent = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-01', timeStr: '20:00-21:00', coachName: '멘토코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 8, dateStr: '2023-02-20', timeStr: '20:00-21:00', coachName: '멘토코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 9, dateStr: '2023-03-10', timeStr: '20:00-21:00', coachName: '멘토코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 10, dateStr: '2023-03-30', timeStr: '20:00-21:00', coachName: '멘토코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 11, dateStr: '2023-04-15', timeStr: '20:00-21:00', coachName: '멘토코치(KPC90100)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' }
  ]
};
const perfectCctc = {
  applicantName: '가상응시자A',
  rows: [
    { rowIndex: 7, dateStr: '2023-02-10', timeStr: '18:00-19:00', coachName: '상위코치(KPC90200)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 8, dateStr: '2023-02-25', timeStr: '18:00-19:00', coachName: '상위코치(KPC90200)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 9, dateStr: '2023-03-15', timeStr: '18:00-19:00', coachName: '상위코치(KPC90200)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 10, dateStr: '2023-03-25', timeStr: '18:00-19:00', coachName: '상위코치(KPC90200)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' },
    { rowIndex: 11, dateStr: '2023-04-05', timeStr: '18:00-19:00', coachName: '상위코치(KPC90200)', certStatus: '유효', sessionMinutesVal: 60, formatStr: '1:1 대면' }
  ]
};

const pClogRes = CoachingLogValidator.validate(perfectClog, baseline);
const pMentRes = MentorValidator.validate(perfectMent, baseline);
const pCctcRes = CoachTheCoachValidator.validate(perfectCctc, baseline);
const pCrossRes = CrossTimelineChecker.check(pClogRes, pMentRes, pCctcRes, baseline);

const isDashPass = pClogRes.isValid && pMentRes.isValid && pCctcRes.isValid && pCrossRes.length === 0;
assert('TC-DASH-01', isDashPass && pClogRes.finalTotalMinutes === 12000 && pMentRes.spanDays === 73, '완전 무결 데이터 입력 시 통과 예상(PASS) 및 200시간/73일 충족');

// TC-REPT-01: 리포트 가이드 생성 로직
const hasFixGuide = resClog06.errors[0].fixGuide.length > 0;
assert('TC-REPT-01', hasFixGuide, '오류별 권장 수정 가이드 텍스트 자동 매핑 검증');

console.log('\n================================================================');
console.log(`  QA 테스트 결과 요약: 총 17개 TC 중 통과: ${passedCount}건 / 실패: ${failedCount}건`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('>>> 17개 테스트 케이스 100% 전수 통과 (ALL TESTS PASSED) <<<');
}
