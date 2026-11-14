/**
 * Domain Models & Time/Date Utilities
 */

// Format minutes to "X시간 Y분"
function formatMinutes(minutes) {
  if (isNaN(minutes) || minutes === null || minutes === undefined) return "0분";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

// Convert Excel Serial Date or String in various formats to YYYY-MM-DD
// Supports: 23-2-5, 23/2/5, 2023/2/5, 2/5/23, 02/05/23, 02/05/2023, 2023-02-05, etc.
function normalizeDate(val, rawVal = null) {
  if (val === null || val === undefined || val === '') {
    if (rawVal === null || rawVal === undefined || rawVal === '') return null;
  }

  // 1. Date object check
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    const y = rawVal.getFullYear();
    const m = String(rawVal.getMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Numeric Excel Serial Date check (e.g. 44962)
  const checkSerial = (num) => {
    if (typeof num === 'number' && !isNaN(num) && num > 30000 && num < 70000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  };

  const serialFromVal = checkSerial(val);
  if (serialFromVal) return serialFromVal;
  const serialFromRaw = checkSerial(rawVal);
  if (serialFromRaw) return serialFromRaw;

  // 3. String processing
  let str = String(val !== null && val !== undefined && val !== '' ? val : rawVal).trim();
  str = str.replace(/^예\)/, '').trim();
  if (!str) return null;

  // If string is 5-digit number (Excel serial as string)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const parsedSerial = checkSerial(parseFloat(str));
    if (parsedSerial) return parsedSerial;
  }

  // 4. Korean date format: YYYY년 M월 D일 or YY년 M월 D일
  const korMatch = str.match(/^(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (korMatch) {
    let y = parseInt(korMatch[1], 10);
    if (y < 100) y += 2000;
    const m = parseInt(korMatch[2], 10);
    const d = parseInt(korMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 5. 8-digit or 6-digit compact date string without separators (e.g. 20230205, 230205)
  const compact8 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact8) {
    const y = parseInt(compact8[1], 10);
    const m = parseInt(compact8[2], 10);
    const d = parseInt(compact8[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const compact6 = str.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (compact6) {
    const y = 2000 + parseInt(compact6[1], 10);
    const m = parseInt(compact6[2], 10);
    const d = parseInt(compact6[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 6. Split by delimiter: -, /, or . (with optional surrounding whitespace)
  const parts = str.split(/\s*[-/.]\s*/).filter(Boolean);
  if (parts.length === 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
    const p1 = parts[0];
    const p2 = parts[1];
    const p3 = parts[2];
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    const n3 = parseInt(p3, 10);

    let year = null;
    let month = null;
    let day = null;

    if (p1.length === 4 || n1 >= 1900) {
      // YYYY-MM-DD, YYYY/M/D, YYYY.M.D
      year = n1;
      month = n2;
      day = n3;
    } else if (p3.length === 4 || n3 >= 1900) {
      // MM/DD/YYYY or DD/MM/YYYY
      year = n3;
      if (n1 > 12 && n2 <= 12) {
        day = n1;
        month = n2;
      } else {
        month = n1;
        day = n2;
      }
    } else {
      // 2-digit years
      if (n1 >= 13) {
        // e.g. 23-2-5, 23/2/5
        year = 2000 + n1;
        month = n2;
        day = n3;
      } else if (n3 >= 13) {
        // e.g. 2/5/23, 02/05/23
        year = 2000 + n3;
        if (n1 > 12 && n2 <= 12) {
          day = n1;
          month = n2;
        } else {
          month = n1;
          day = n2;
        }
      } else {
        if (str.includes('-')) {
          year = 2000 + n1;
          month = n2;
          day = n3;
        } else {
          year = 2000 + n3;
          month = n1;
          day = n2;
        }
      }
    }

    if (year !== null && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return str;
}

// Check strictly if date matches YYYY-MM-DD
function isStrictDateFormat(str) {
  if (!str) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Parse "HH:MM-HH:MM" or "HH:MM~HH:MM"
function parseTimeRange(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().replace(/^예\)/, '').trim();
  const parts = clean.split(/[-~]/).map(s => s.trim());
  if (parts.length !== 2) return null;
  
  const startMatch = parts[0].match(/^(\d{1,2}):(\d{2})$/);
  const endMatch = parts[1].match(/^(\d{1,2}):(\d{2})$/);
  if (!startMatch || !endMatch) return null;
  
  const startH = parseInt(startMatch[1], 10);
  const startM = parseInt(startMatch[2], 10);
  const endH = parseInt(endMatch[1], 10);
  const endM = parseInt(endMatch[2], 10);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const duration = endMinutes - startMinutes;
  
  return {
    raw: clean,
    startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
    endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    startMinutes,
    endMinutes,
    duration,
    isOverMidnight: endMinutes < startMinutes
  };
}

// Calculate days difference between two YYYY-MM-DD strings (D2 - D1)
function diffDays(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Compare two YYYY-MM-DD strings (-1, 0, 1)
function compareDates(d1, d2) {
  if (!d1 && !d2) return 0;
  if (!d1) return -1;
  if (!d2) return 1;
  return d1.localeCompare(d2);
}

