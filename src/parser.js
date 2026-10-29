/**
 * Excel Parser & Document Type Classifier
 */

const DOC_TYPES = {
  COACHING_LOG: 'COACHING_LOG',
  MENTOR_COACHING: 'MENTOR_COACHING',
  COACH_THE_COACH: 'COACH_THE_COACH',
  UNKNOWN: 'UNKNOWN'
};

class ExcelParser {
  // Classify workbook type based on cell keywords
  static detectDocType(workbook, filename = '') {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return DOC_TYPES.UNKNOWN;

    const a1 = sheet['A1']?.v ? String(sheet['A1'].v).trim() : '';
    const a2 = sheet['A2']?.v ? String(sheet['A2'].v).trim() : '';
    const file = filename.toLowerCase();

    // 1. Strict Form Number Matching on A1
    if (a1.includes('1_43')) return DOC_TYPES.COACHING_LOG;
    if (a1.includes('1_47')) return DOC_TYPES.MENTOR_COACHING;
    if (a1.includes('1_48') || a1.includes('48_v5')) return DOC_TYPES.COACH_THE_COACH;

    // 2. Title Matching on A2
    if (a2.includes('코칭일지')) return DOC_TYPES.COACHING_LOG;
    if (a2.includes('멘토코칭')) return DOC_TYPES.MENTOR_COACHING;
    if (a2.includes('코치더코치')) return DOC_TYPES.COACH_THE_COACH;

    // 3. Filename Fallback
    if (file.includes('코칭일지')) return DOC_TYPES.COACHING_LOG;
    if (file.includes('멘토코칭')) return DOC_TYPES.MENTOR_COACHING;
    if (file.includes('코치더코치') || file.includes('일대일')) return DOC_TYPES.COACH_THE_COACH;

    return DOC_TYPES.UNKNOWN;
  }

  // Parse applicant name from header rows with high tolerance for spacing, colons, and parentheses
  static extractApplicantName(sheet) {
    // Check rows 3 to 6, columns A to D
    for (let r = 3; r <= 6; r++) {
      for (const col of ['A', 'B', 'C', 'D']) {
        const cell = sheet[`${col}${r}`];
        const val = cell ? String(cell.w || cell.v || '').trim() : '';
        if (!val) continue;

        // Check if this cell contains applicant label keywords
        if (val.includes('응시자') || val.includes('성명')) {
          // Case 1: Name is in the SAME cell
          // Handles:
          // '응시자 명 : 김철규', '응시자 명:김철규', '응시자 명 :김철규', '응시자 명: 김철규'
          // '응시자 명(필수작성):김철규', '응시자 명(필수작성): 김철규'
          // '응시자명: 김철규', '응시자명 : 김철규', '성명 : 김철규', '응시자 : 김철규' 등
          const inlineMatch = val.match(/(?:응시자\s*명|성\s*명|응시자)\s*(?:\([^)]*\))?\s*[:：]?\s*([가-힣a-zA-Z\s]{2,15})$/);
          if (inlineMatch && inlineMatch[1]) {
            const candidate = inlineMatch[1].trim();
            // Ensure candidate is not just a label
            if (candidate && !candidate.includes('필수') && !candidate.includes('작성')) {
              return candidate;
            }
          }

          // Case 2: Name is in the ADJACENT cell(s) in the same row
          const colCode = col.charCodeAt(0);
          for (let offset = 1; offset <= 3; offset++) {
            const nextCol = String.fromCharCode(colCode + offset);
            const nextCell = sheet[`${nextCol}${r}`];
            const nextVal = nextCell ? String(nextCell.w || nextCell.v || '').trim() : '';
            if (nextVal && !nextVal.includes('필수') && !nextVal.includes('작성') && !nextVal.includes('날짜')) {
              // Valid name candidate (Korean/English letters and spaces, 2~15 chars)
              if (/^[가-힣a-zA-Z\s]{2,15}$/.test(nextVal)) {
                return nextVal;
              }
            }
          }
        }
      }
    }
    return '';
  }

  // Parse raw sheet into array of row objects
  static parseSheet(sheet, docType) {
    if (!sheet || !sheet['!ref']) return { applicantName: '', rows: [], headerRow: 6 };

    const applicantName = this.extractApplicantName(sheet);
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Find header row (usually contains '날짜' or '일자')
    let headerRow = 6;
    for (let r = 0; r <= Math.min(10, range.e.r); r++) {
      const aVal = sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (aVal && String(aVal).includes('날짜')) {
        headerRow = r + 1;
        break;
      }
    }

    const rows = [];
    let isEnded = false;

    for (let r = headerRow; r <= range.e.r; r++) {
      if (isEnded) break;

      // Check first cell for '합계' or termination
      const aCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
      const aVal = aCell ? String(aCell.w || aCell.v || '').trim() : '';

      if (aVal.includes('합계') || aVal.includes('총 시간')) {
        isEnded = true;
        break;
      }

      // Skip example rows starting with '예)'
      if (aVal.startsWith('예)')) {
        continue;
      }

      // Collect cells for this row
      const rowData = {
        rowIndex: r + 1, // 1-based index
        rawValues: []
      };

      let hasContent = false;
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const text = cell ? String(cell.w || cell.v || '').trim() : '';
        const raw = cell ? cell.v : null;
        rowData.rawValues.push({ text, raw });
        if (text) hasContent = true;
      }

      if (!hasContent) continue; // Skip completely empty row

      // Parse fields based on docType
      if (docType === DOC_TYPES.COACHING_LOG) {
        // Cols: 0:날짜, 1:시간, 2:고객명, 3:유료, 4:무료, 5:받은CTC, 6:코칭형태
        rowData.dateStr = rowData.rawValues[0]?.text || '';
        rowData.timeStr = rowData.rawValues[1]?.text || '';
        rowData.clientName = rowData.rawValues[2]?.text || '';
        rowData.paidVal = rowData.rawValues[3]?.raw;
        rowData.freeVal = rowData.rawValues[4]?.raw;
        rowData.ctcVal = rowData.rawValues[5]?.raw;
        rowData.formatStr = rowData.rawValues[6]?.text || '';
      } else if (docType === DOC_TYPES.MENTOR_COACHING) {
        // Cols: 0:날짜, 1:시간, 2:멘토코치명, 3:코치인증자격, 4:진행세션(분), 5:코칭형태
        rowData.dateStr = rowData.rawValues[0]?.text || '';
        rowData.timeStr = rowData.rawValues[1]?.text || '';
        rowData.coachName = rowData.rawValues[2]?.text || '';
        rowData.certStatus = rowData.rawValues[3]?.text || '';
        rowData.sessionMinutesVal = rowData.rawValues[4]?.raw;
        rowData.formatStr = rowData.rawValues[5]?.text || '';
      } else if (docType === DOC_TYPES.COACH_THE_COACH) {
        // Cols: 0:날짜, 1:시간, 2:코치명, 3:코치인증자격, 4:진행세션(분), 5:코칭형태
        rowData.dateStr = rowData.rawValues[0]?.text || '';
        rowData.timeStr = rowData.rawValues[1]?.text || '';
        rowData.coachName = rowData.rawValues[2]?.text || '';
        rowData.certStatus = rowData.rawValues[3]?.text || '';
        rowData.sessionMinutesVal = rowData.rawValues[4]?.raw;
        rowData.formatStr = rowData.rawValues[5]?.text || '';
      }

      rows.push(rowData);
    }

    return {
      applicantName,
      rows,
      headerRow
    };
  }
}
