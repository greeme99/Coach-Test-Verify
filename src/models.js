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

// Convert Excel Serial Date or String to YYYY-MM-DD
function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel base date: 1899-12-30
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim().replace(/^예\)/, '').trim();
  const match = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = String(match[2]).padStart(2, '0');
    const d = String(match[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

