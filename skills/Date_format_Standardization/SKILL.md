---
name: Date_format_Standardization
description: 다양한 형태의 비정형 날짜 문자열(YY-M-D, YY/M/D, YYYY/M/D, M/D/YY, MM/DD/YY, MM/DD/YYYY, YYYY.MM.DD, 한글 날짜, 엑셀 시리얼 번호 등)을 분석하여 ISO 8601 표준 형식인 'YYYY-MM-DD'로 자동 정규화하는 범용 유틸리티 및 가이드 스킬입니다. Antigravity, Codex, Claude Code 전역/로컬 환경을 모두 지원합니다.
---

# Date_format_Standardization (날짜 형식 표준화 및 자동 정규화 스킬)

본 스킬은 엑셀 서류 검증, CSV 데이터 파이프라인, 공공/협회 서식 처리, 데이터베이스 입력 등에서 빈번히 발생하는 비정형 날짜 표기를 지능적으로 판별하여 **ISO 8601 표준 규격(`YYYY-MM-DD`)**으로 무손실 자동 정규화(Normalization)하는 표준 솔루션입니다.

---

## 1. 지원 날짜 형식 매트릭스 (Supported Formats)

| 입력 패턴 예시 | 판정 원리 및 변환 규칙 | 정규화 결과 (`YYYY-MM-DD`) |
| :--- | :--- | :---: |
| **`23-2-5`** | 2자리 연도(`23` >= 13이므로 연도 확정, 2000+YY) + 하이픈 구분 | `2023-02-05` |
| **`23/2/5`** | 2자리 연도(`23` >= 13, 월 불가) + 슬래시 구분 | `2023-02-05` |
| **`2023/2/5`** | 4자리 연도(`2023`) + 슬래시 구분 | `2023-02-05` |
| **`2/5/23`** | 미국식(US) 월/일 + 2자리 연도(`23`) | `2023-02-05` |
| **`02/05/23`** | 미국식(US) 2자리 월/일 + 2자리 연도(`23`) | `2023-02-05` |
| **`02/05/2023`** | 미국식(US) 2자리 월/일 + 4자리 연도(`2023`) | `2023-02-05` |
| **`2023-02-05`** | 표준 ISO 8601 형식 | `2023-02-05` |
| **`2023.2.5`** / **`23.2.5`** | 마침표 구분 표기 | `2023-02-05` |
| **`2023 - 2 - 5`** | 구분자 전후 공백 포함 표기 | `2023-02-05` |
| **`2023년 2월 5일`** | 한글 연월일 표기 (일 누락 `2023년 2월 5` 허용) | `2023-02-05` |
| **`20230205`** / **`230205`** | 8자리/6자리 연속 숫자 표기 | `2023-02-05` |
| **`44962`** (숫자/문자열) | 엑셀 시리얼 넘버 (1899-12-30 기준일 에포크 계산) | `2023-02-05` |
| **`Date` 객체** | JavaScript/Python Date/datetime 객체 자동 직렬화 | `2023-02-05` |

---

## 2. 지능형 판별 알고리즘 (Disambiguation Logic)

날짜 구성 요소(3개 파트 `[p1, p2, p3]`)가 주어졌을 때 다음과 같은 우선순위 원칙으로 모호성을 해소합니다:

1. **4자리 연도 우선**:
   - `p1`이 4자리(`>= 1900`)이면 `YYYY-MM-DD` 구조로 확정.
   - `p3`이 4자리(`>= 1900`)이면 `MM/DD/YYYY` 구조로 확정. (단, `p1 > 12`인 경우 `DD/MM/YYYY`로 지능 역전)
2. **값 범위 기반 월/연도 배타적 판별**:
   - 월(Month)은 `1 ~ 12` 사이여야 하므로, `p1 >= 13`이면 `p1`은 절대로 월이 될 수 없으며 **2자리 연도(`2000 + p1`)**로 확정됩니다. (`23-2-5`, `23/2/5`)
   - 마찬가지로 `p3 >= 13`이고 `p1 <= 12`이면 `p3`이 2자리 연도(`2000 + p3`), `p1`이 월, `p2`가 일로 확정됩니다. (`2/5/23`, `02/05/23`)
3. **구분자 기반 기본값**:
   - `p1`, `p3` 모두 12 이하인 경우:
     - 하이픈(`-`) 구분자: 한국/ISO 표준 관례에 따라 `YY-MM-DD`로 해석.
     - 슬래시(`/`) 구분자: 글로벌 스프레드시트/미국식 관례에 따라 `MM/DD/YY`로 해석.
4. **유효성 검증(Validation)**:
   - 정규화된 월(`1 <= M <= 12`)과 일(`1 <= D <= 31`) 범위를 확인하여 비정상 날짜는 원본을 유지하거나 오류 플래그를 반환.

---

## 3. 언어별 구현 코드 (Zero-Dependency)

### JavaScript / Node.js (`scripts/normalize_date.js`)
```javascript
function normalizeDate(val, rawVal = null) {
  if (val === null || val === undefined || val === '') {
    if (rawVal === null || rawVal === undefined || rawVal === '') return null;
  }
  // Date 객체
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  // 엑셀 시리얼 넘버
  const checkSerial = (num) => {
    if (typeof num === 'number' && !isNaN(num) && num > 30000 && num < 70000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    return null;
  };
  const s1 = checkSerial(val) || checkSerial(rawVal);
  if (s1) return s1;

  let str = String(val !== null && val !== undefined && val !== '' ? val : rawVal).trim().replace(/^예\)/, '').trim();
  if (!str) return null;
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const s2 = checkSerial(parseFloat(str));
    if (s2) return s2;
  }

  // 한글 날짜
  const kor = str.match(/^(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (kor) {
    let y = parseInt(kor[1], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(kor[2]).padStart(2, '0')}-${String(kor[3]).padStart(2, '0')}`;
  }

  // 구분자 (-, /, .)
  const parts = str.split(/\s*[-/.]\s*/).filter(Boolean);
  if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
    let [p1, p2, p3] = parts;
    let [n1, n2, n3] = [parseInt(p1, 10), parseInt(p2, 10), parseInt(p3, 10)];
    let y, m, d;
    if (p1.length === 4 || n1 >= 1900) {
      y = n1; m = n2; d = n3;
    } else if (p3.length === 4 || n3 >= 1900) {
      y = n3;
      if (n1 > 12 && n2 <= 12) { d = n1; m = n2; } else { m = n1; d = n2; }
    } else {
      if (n1 >= 13) {
        y = 2000 + n1; m = n2; d = n3;
      } else if (n3 >= 13) {
        y = 2000 + n3;
        if (n1 > 12 && n2 <= 12) { d = n1; m = n2; } else { m = n1; d = n2; }
      } else {
        if (str.includes('-')) { y = 2000 + n1; m = n2; d = n3; }
        else { y = 2000 + n3; m = n1; d = n2; }
      }
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return str;
}
```

---

## 4. CLI 사용법 (Command Line Interface)

스킬 번들에 포함된 스크립트를 통해 터미널에서 즉시 단일 변환 또는 일괄 검증을 수행할 수 있습니다.

```bash
# Node.js CLI 단일 테스트
node scripts/normalize_date.js "23-2-5"
# 출력: 2023-02-05

node scripts/normalize_date.js "02/05/23"
# 출력: 2023-02-05

# Python CLI 단일 테스트
python scripts/normalize_date.py "23/2/5"
# 출력: 2023-02-05

# 전체 자동화 검증 스위트 실행
node scripts/test_suite.js
```

---

## 5. 다중 에이전트 전역/로컬 적용 가이드

- **Antigravity (AGY)**: `~/.gemini/config/skills/Date_format_Standardization` 연결 (자동 인식)
- **Codex**: `~/.codex/skills/Date_format_Standardization` 연결
- **Claude Code**: `~/.claude/skills/Date_format_Standardization` 연결
- **단일 원본(Source of Truth)**: `~/.agents/skills/Date_format_Standardization`
