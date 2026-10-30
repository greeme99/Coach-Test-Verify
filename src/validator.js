/**
 * Comprehensive Validation Engine for KPC Certification
 * SSOT: KCA Ref.Doc guidelines + Interview Decisions (DEC-001..046)
 */

class CoachingLogValidator {
  static validate(sheetData, baseline) {
    const { rows, applicantName } = sheetData;
    const errors = [];
    const warnings = [];
    
    // Track row errors (Row Index -> Array of error objects)
    const rowErrorMap = new Map();
    let docErrorCount = 0;

    // Helper to add row error
    const addRowError = (rowIndex, code, message, fixGuide) => {
      if (!rowErrorMap.has(rowIndex)) {
        rowErrorMap.set(rowIndex, []);
      }
      rowErrorMap.get(rowIndex).push({ code, message, fixGuide });
    };

    // 1. Check Document-Level Applicant Name (tolerant of whitespace)
    const cleanExtracted = (applicantName || '').replace(/\s+/g, '');
    const cleanBaseline = (baseline.applicantName || '').replace(/\s+/g, '');

    if (!cleanExtracted) {
      docErrorCount += 1;
      errors.push({
        code: 'CL-01',
        message: "상단 '응시자 명(필수작성)'이 누락되었습니다.",
        fixGuide: "엑셀 상단 A4/B4 셀에 응시자 성명을 반드시 기재하십시오. (오류 1건 산정)"
      });
    } else if (cleanBaseline && cleanExtracted !== cleanBaseline) {
      warnings.push({
        code: 'CL-01-WARN',
        message: `엑셀의 응시자 명('${applicantName}')이 입력한 기준 정보('${baseline.applicantName}')와 다릅니다.`,
        fixGuide: "응시자 성명이 본인의 공식 성명과 일치하는지 확인하십시오."
      });
    }

    // 2. Validate Rows Sequentially
    let prevDate = null;
    let prevStartTimeMinutes = null;
    const dailyClientMap = new Map(); // Date -> Map(ClientName -> { count, totalMinutes })
    const uniqueClients = new Set();
    
    let totalPaidMinutes = 0;
    let totalFreeMinutes = 0;
    let totalCtcMinutesBeforeKac = 0;
    let totalCtcMinutesAfterKac = 0;

    rows.forEach((row) => {
      const { rowIndex, dateStr, timeStr, clientName, paidVal, freeVal, ctcVal, formatStr } = row;
      
      // Parse Date
      const normDate = normalizeDate(dateStr);
      if (!normDate || !isStrictDateFormat(normDate)) {
        addRowError(rowIndex, 'CL-02-DATE', `날짜 형식이 올바르지 않습니다: '${dateStr}'`, "날짜는 'YYYY-MM-DD' 형식으로 작성해야 합니다.");
      }

      // Check Coaching Basic Education Completion Date Precedence
      const eduDate = baseline.coachingBasicEduDate || baseline.coachingEduStartDate;
      if (normDate && eduDate) {
        if (compareDates(normDate, eduDate) < 0) {
          addRowError(rowIndex, 'CL-05', `코칭 기초(Basic) 교육완료일(${eduDate}) 이전 실습입니다.`, "코칭 기초(Basic) 교육 완료 이후에 진행한 실습만 인정됩니다.");
        }
      }

      // Parse Time Range
      const timeParsed = parseTimeRange(timeStr);
      if (!timeParsed) {
        addRowError(rowIndex, 'CL-02-TIME', `시간 형식이 올바르지 않습니다: '${timeStr}'`, "시간은 'HH:MM-HH:MM' 형식으로 작성해야 합니다.");
      } else if (timeParsed.isOverMidnight) {
        addRowError(rowIndex, 'CL-15-MIDNIGHT', "세션 시간이 자정을 넘길 수 없습니다.", "동일 날짜 내에서 시작하고 종료되도록 기재하십시오.");
      }

      // Chronological Sorting Check (Adjacent Row Comparison)
      if (normDate && timeParsed) {
        if (prevDate) {
          const dateComp = compareDates(prevDate, normDate);
          if (dateComp > 0) {
            addRowError(rowIndex, 'CL-06-DATE', `날짜 순서가 역전되었습니다 (${prevDate} -> ${normDate})`, "코칭일지는 전체 행을 날짜 오름차순으로 정렬해야 합니다.");
          } else if (dateComp === 0 && prevStartTimeMinutes !== null) {
            if (timeParsed.startMinutes < prevStartTimeMinutes) {
              addRowError(rowIndex, 'CL-06-TIME', `동일 날짜 내 시간 순서가 역전되었습니다.`, "같은 날짜에서는 시작 시간 순서대로 정렬해야 합니다.");
            }
          }
        }
        prevDate = normDate;
        prevStartTimeMinutes = timeParsed.startMinutes;
      }

      // Check Client Name
      const cleanClient = String(clientName || '').trim();
      if (!cleanClient) {
        addRowError(rowIndex, 'CL-02-CLIENT', "고객명이 비어 있습니다.", "고객명을 필수로 기재하십시오.");
      }

      // Parse Minutes & Multi-Column Check
      const numPaid = (paidVal !== null && paidVal !== undefined && paidVal !== '') ? Number(paidVal) : null;
      const numFree = (freeVal !== null && freeVal !== undefined && freeVal !== '') ? Number(freeVal) : null;
      const numCtc = (ctcVal !== null && ctcVal !== undefined && ctcVal !== '') ? Number(ctcVal) : null;

      const activeMinuteCols = [numPaid, numFree, numCtc].filter(v => v !== null && !isNaN(v) && v > 0);
      if (activeMinuteCols.length === 0) {
        addRowError(rowIndex, 'CL-02-MIN', "유료, 무료, 받은 코치더코치 중 하나의 시간을 기재해야 합니다.", "해당 세션에 해당하는 열에 진행 시간(분)을 입력하십시오.");
      } else if (activeMinuteCols.length > 1) {
        addRowError(rowIndex, 'CL-15-MULTI', "유료, 무료, 받은CTC 중 2개 이상의 열에 시간이 동시 기재되었습니다.", "한 세션은 유료, 무료, 받은 코치더코치 중 한 열에만 기재해야 합니다.");
      }

      // Coaching Format & Participant Count
      const cleanFormat = String(formatStr || '').trim().replace(/\s+/g, '');
      const isFormatValid = /1:[1-9]/.test(cleanFormat) && (cleanFormat.includes('대면') || cleanFormat.includes('비대면'));
      const isForbiddenMedium = /(문자|sns|카카오|카톡|메일|이메일)/i.test(cleanFormat);

      if (!cleanFormat || !isFormatValid) {
        addRowError(rowIndex, 'CL-07-FORMAT', `코칭형태 표기가 규정에 맞지 않습니다: '${formatStr}'`, "'1:1 대면', '1:1 비대면'과 같이 인원수와 대면 여부를 명시해야 합니다.");
      }
      if (isForbiddenMedium) {
        addRowError(rowIndex, 'CL-07-FORBIDDEN', "문자, SNS, 이메일 등의 비인가 코칭 형태입니다.", "대면 또는 비대면(전화/화상) 코칭만 인정됩니다.");
      }

      // Parse Participant Count
      let participantCount = 1;
      const partMatch = cleanFormat.match(/1:(\d+)/);
      if (partMatch) {
        participantCount = parseInt(partMatch[1], 10);
      }
      if (participantCount > 9) {
        addRowError(rowIndex, 'CL-10-GROUP', `그룹코칭 인원 초과(1:${participantCount})`, "그룹코칭은 최대 1:9(총 9명)까지만 기재 가능합니다.");
      }

      // Duration & Coach-the-Coach Checks
      const isCtcRow = numCtc !== null && numCtc > 0;
      const duration = timeParsed ? timeParsed.duration : 0;

      if (timeParsed) {
        if (!isCtcRow) {
          // Normal Paid/Free Session: 30 <= duration <= 120
          if (duration < 30 || duration > 120) {
            addRowError(rowIndex, 'CL-08-LIMIT', `한 세션 시간(실제 ${duration}분)은 30분 이상 120분 이하여야 합니다.`, "30분 미만이거나 120분을 초과하는 세션은 인정되지 않습니다.");
          }
          // Minute Consistency Check
          const recordedMin = numPaid || numFree || 0;
          if (Math.abs(recordedMin - duration) > 1) {
            addRowError(rowIndex, 'CL-15-DIFF', `기재된 시간(${recordedMin}분)과 시작-종료 시간차(${duration}분)가 불일치합니다.`, "기재 분 값과 시간차를 일치시키십시오.");
          }
        } else {
          // Received Coach-The-Coach (F Column is ALREADY 2x for 1:1, 1:2)
          if (participantCount === 1 || participantCount === 2) {
            // 2x counted
            const expected2x = duration * 2;
            if (Math.abs(numCtc - expected2x) > 2) {
              addRowError(rowIndex, 'CL-11-2X', `1:1 또는 1:2 코치더코치는 2배 환산값(${expected2x}분)으로 기재해야 하나 ${numCtc}분이 기재되었습니다.`, "1:1, 1:2 코치더코치는 실제 시간의 2배로 계산하여 60~120분 범위로 기재하십시오.");
            }
            if (numCtc < 60 || numCtc > 120) {
              addRowError(rowIndex, 'CL-11-RANGE', `2배 환산된 코치더코치 시간(${numCtc}분)은 60분에서 120분 사이여야 합니다.`, "2배 카운트된 시간은 행당 60분~120분까지만 유효합니다.");
            }
          } else if (participantCount >= 3 && participantCount <= 5) {
            // Group CTC: 1x counted
            if (Math.abs(numCtc - duration) > 2) {
              addRowError(rowIndex, 'CL-11-1X', `그룹 코치더코치는 1배 시간(${duration}분)으로 기재해야 합니다.`, "그룹(3~5명) 코치더코치는 1배 시간으로 기재하십시오.");
            }
          } else {
            addRowError(rowIndex, 'CL-11-PEOPLE', "코치더코치 구성 인원 부적합 (1:1, 1:2, 또는 3~5명 그룹만 허용)", "코치더코치는 1:1, 1:2, 또는 3~5명 그룹으로만 구성해야 합니다.");
          }

          // Check Coach Name & Cert No in F row
          const hasKpcOrKsc = /(KPC|KSC)\s*\d+/i.test(cleanClient);
          if (!hasKpcOrKsc) {
            addRowError(rowIndex, 'CL-06-COACH', "받은 코치더코치 고객명에는 상위코치 이름과 KPC/KSC 자격번호를 기재해야 합니다.", "예: 홍길동(KPC90124)");
          }
        }
      }

      // Daily Limit Check (Max 2 sessions & 120 min per day for same client)
      if (normDate && cleanClient && !isCtcRow && timeParsed) {
        if (!dailyClientMap.has(normDate)) {
          dailyClientMap.set(normDate, new Map());
        }
        const clientDayMap = dailyClientMap.get(normDate);
        const prevData = clientDayMap.get(cleanClient) || { count: 0, totalMinutes: 0, rows: [] };
        
        prevData.count += 1;
        prevData.totalMinutes += duration;
        prevData.rows.push(rowIndex);
        clientDayMap.set(cleanClient, prevData);

        if (prevData.count > 2) {
          addRowError(rowIndex, 'CL-09-COUNT', `동일 고객('${cleanClient}') 하루 2회 초과 진행 (현재 ${prevData.count}회차)`, "하루에 동일인을 코칭할 경우 최대 2회까지만 허용됩니다.");
        }
        if (prevData.totalMinutes > 120) {
          addRowError(rowIndex, 'CL-09-HOURS', `동일 고객('${cleanClient}') 일일 합산 시간 초과 (총 ${prevData.totalMinutes}분)`, "하루 동일인 코칭 합산 시간은 최대 120분을 초과할 수 없습니다.");
        }
      }

      // Collect Unique Clients (excluding CTC rows)
      if (!isCtcRow && cleanClient) {
        // Split multi-client cells by newline or comma
        const names = cleanClient.split(/[\n,\/]/).map(s => s.trim().replace(/\(.*\)/, '').trim()).filter(Boolean);
        names.forEach(n => uniqueClients.add(n));
      }

      // Time Accumulation if Row is Valid so far
      const isRowValid = !rowErrorMap.has(rowIndex);
      row.isValid = isRowValid;
      row.errors = rowErrorMap.get(rowIndex) || [];
      row.duration = duration;
      row.normDate = normDate;
      row.timeParsed = timeParsed;

      if (isRowValid) {
        if (numPaid) totalPaidMinutes += numPaid;
        if (numFree) totalFreeMinutes += numFree;
        if (numCtc) {
          const isBeforeKac = baseline.kacCertDate && normDate && (compareDates(normDate, baseline.kacCertDate) < 0);
          if (isBeforeKac) {
            totalCtcMinutesBeforeKac += numCtc;
          } else {
            totalCtcMinutesAfterKac += numCtc;
          }
        }
      }
    });

    // 3. Apply Coach-the-Coach Caps
    // Max 25h (1,500m) before KAC
    const creditedCtcBeforeKac = Math.min(totalCtcMinutesBeforeKac, 1500);
    const ctcBeforeKacCut = totalCtcMinutesBeforeKac - creditedCtcBeforeKac;
    
    // Overall Max 80h (4,800m)
    const creditedCtcTotal = Math.min(creditedCtcBeforeKac + totalCtcMinutesAfterKac, 4800);
    const ctcTotalCut = (creditedCtcBeforeKac + totalCtcMinutesAfterKac) - creditedCtcTotal;

    if (ctcBeforeKacCut > 0) {
      warnings.push({
        code: 'CL-12-KAC-CAP',
        message: `KAC 취득 전 받은 코치더코치 시간(${formatMinutes(totalCtcMinutesBeforeKac)}) 중 상한선(25시간)을 초과한 ${formatMinutes(ctcBeforeKacCut)}이 인정 제외(절사)되었습니다.`,
        fixGuide: "규정상 KAC 취득 전 코치더코치는 최대 25시간까지만 인정됩니다."
      });
    }
    if (ctcTotalCut > 0) {
      warnings.push({
        code: 'CL-12-TOTAL-CAP',
        message: `받은 코치더코치 총 시간 중 전체 상한선(80시간)을 초과한 ${formatMinutes(ctcTotalCut)}이 인정 제외(절사)되었습니다.`,
        fixGuide: "규정상 받은 코치더코치는 총 80시간까지만 코칭시간에 포함 가능합니다."
      });
    }

    // Total Valid Coaching Hours
    const finalTotalMinutes = totalPaidMinutes + totalFreeMinutes + creditedCtcTotal;

    // 4. Overall Requirements & Elimination Checks
    const totalRowErrors = rowErrorMap.size;
    const finalErrorCount = totalRowErrors + docErrorCount;

    if (finalErrorCount > 10) {
      errors.push({
        code: 'CL-14',
        message: `코칭일지 작성 오류가 ${finalErrorCount}건 발생하여 허용 한도(최대 10개)를 초과했습니다. (서류 탈락 사유)`,
        fixGuide: "오류 항목들을 10건 이하로 수정해야 서류 심사를 통과할 수 있습니다."
      });
    }

    if (finalTotalMinutes < 12000) {
      errors.push({
        code: 'CL-03-TOTAL',
        message: `유효 총 코칭시간(${formatMinutes(finalTotalMinutes)})이 의무 기준인 200시간(12,000분)에 미달합니다.`,
        fixGuide: "오류로 제외된 시간 또는 부족한 코칭 실습 시간을 보완하십시오."
      });
    }

    if (totalPaidMinutes < 2400) {
      errors.push({
        code: 'CL-03-PAID',
        message: `유효 유료 코칭시간(${formatMinutes(totalPaidMinutes)})이 의무 기준인 40시간(2,400분)에 미달합니다.`,
        fixGuide: "유료 코칭 실습을 최소 40시간 이상 확보하십시오."
      });
    }

    if (uniqueClients.size < 5) {
      errors.push({
        code: 'CL-04',
        message: `코칭 고객 수(${uniqueClients.size}명)가 최소 기준인 5명 미만입니다.`,
        fixGuide: "KPC 응시자는 최소 5명 이상의 다양한 고객으로 구성해야 합니다."
      });
    }

    return {
      isValid: errors.length === 0,
      errorCount: finalErrorCount,
      docErrorCount,
      rowErrorCount: totalRowErrors,
      errors,
      warnings,
      rowErrorMap,
      totalPaidMinutes,
      totalFreeMinutes,
      creditedCtcTotal,
      finalTotalMinutes,
      clientCount: uniqueClients.size,
      rows
    };
  }
}

class MentorValidator {
  static validate(sheetData, baseline) {
    const { rows, applicantName } = sheetData;
    const errors = [];
    const warnings = [];
    const rowErrorMap = new Map();

    const addRowError = (rowIndex, code, message, fixGuide) => {
      if (!rowErrorMap.has(rowIndex)) rowErrorMap.set(rowIndex, []);
      rowErrorMap.get(rowIndex).push({ code, message, fixGuide });
    };

    const cleanExtracted = (applicantName || '').replace(/\s+/g, '');
    const cleanBaseline = (baseline.applicantName || '').replace(/\s+/g, '');

    if (!cleanExtracted) {
      warnings.push({
        code: 'MC-01',
        message: "멘토코칭 리스트 상단 '응시자 명'이 누락되었습니다.",
        fixGuide: "응시자 성명을 명확히 기재하십시오."
      });
    } else if (cleanBaseline && cleanExtracted !== cleanBaseline) {
      warnings.push({
        code: 'MC-01-WARN',
        message: `멘토코칭 리스트의 응시자 명('${applicantName}')이 입력한 기준 정보('${baseline.applicantName}')와 다릅니다.`,
        fixGuide: "응시자 성명이 본인의 공식 성명과 일치하는지 확인하십시오."
      });
    }

    const isPortfolio = baseline.examType === 'PORTFOLIO';
    const requiredSpanDays = isPortfolio ? 90 : 60;
    const requiredMinutes = isPortfolio ? 600 : 300; // 10h vs 5h
    const requiredSessions = isPortfolio ? 0 : 5;   // 5 sessions for standard

    let creditedMinutesTotal = 0;
    let validSessionCount = 0;
    const validDates = [];

    rows.forEach((row) => {
      const { rowIndex, dateStr, timeStr, coachName, certStatus, sessionMinutesVal, formatStr } = row;
      const normDate = normalizeDate(dateStr);
      const timeParsed = parseTimeRange(timeStr);

      if (!normDate || !isStrictDateFormat(normDate)) {
        addRowError(rowIndex, 'MC-02-DATE', `날짜 형식 오류: '${dateStr}'`, "YYYY-MM-DD 형식으로 기재하십시오.");
      }

      if (normDate && baseline.kacCertDate) {
        if (compareDates(normDate, baseline.kacCertDate) < 0) {
          addRowError(rowIndex, 'MC-03', `KAC 취득일(${baseline.kacCertDate}) 이전 이수 건입니다.`, "멘토코칭은 반드시 KAC 취득 후에 이수해야 합니다.");
        }
      }

      if (!timeParsed) {
        addRowError(rowIndex, 'MC-02-TIME', `시간 형식 오류: '${timeStr}'`, "HH:MM-HH:MM 형식으로 기재하십시오.");
      }

      // Coach Name & Cert Number Check
      const cleanCoach = String(coachName || '').trim();
      if (!/(KPC|KSC)\s*\d+/i.test(cleanCoach)) {
        addRowError(rowIndex, 'MC-07', `멘토코치명에 KPC/KSC 인증번호가 누락되었습니다: '${cleanCoach}'`, "예: 홍길동(KPC90124)");
      } else if (/KAC\s*\d+/i.test(cleanCoach)) {
        addRowError(rowIndex, 'MC-07-KAC', "멘토코치는 KPC 또는 KSC 자격 보유자여야 합니다 (KAC 불가).", "KPC 이상의 인증 코치에게 받아야 합니다.");
      }

      // Cert Status Check
      const cleanCertStatus = String(certStatus || '').trim();
      if (cleanCertStatus !== '유효') {
        addRowError(rowIndex, 'MC-08', `코치인증자격 상태가 '유효'가 아닙니다 ('${cleanCertStatus}')`, "자격 만료 또는 정지 코치로부터 받은 멘토코칭은 탈락 사유입니다.");
      }

      // Duration & 60 min Cap Check
      const duration = timeParsed ? timeParsed.duration : 0;
      let sessionCredit = Math.min(duration, 60);

      if (duration > 60) {
        warnings.push({
          code: 'MC-06-CAP',
          message: `엑셀 ${rowIndex}행: 멘토코칭 단일 세션(${duration}분)은 최대 60분까지만 인정되어 초과분이 절사되었습니다.`,
          fixGuide: "규정상 단일 세션은 최대 60분까지만 가산됩니다."
        });
      }

      const cleanFormat = String(formatStr || '').trim();
      if (!cleanFormat.includes('대면') && !cleanFormat.includes('비대면')) {
        addRowError(rowIndex, 'MC-09', `코칭형태 오류: '${formatStr}'`, "대면 또는 비대면으로 기재하십시오.");
      }

      const isRowValid = !rowErrorMap.has(rowIndex);
      row.isValid = isRowValid;
      row.errors = rowErrorMap.get(rowIndex) || [];
      row.normDate = normDate;
      row.timeParsed = timeParsed;
      row.creditedMinutes = isRowValid ? sessionCredit : 0;

      if (isRowValid) {
        creditedMinutesTotal += sessionCredit;
        validSessionCount += 1;
        validDates.push(normDate);
      }
    });

    // Check Period (Start Date to End Date Span)
    let spanDays = 0;
    if (validDates.length >= 2) {
      validDates.sort();
      const firstDate = validDates[0];
      const lastDate = validDates[validDates.length - 1];
      spanDays = diffDays(firstDate, lastDate);
    }

    if (spanDays < requiredSpanDays) {
      errors.push({
        code: 'MC-04',
        message: `멘토코칭 이수 기간(${spanDays}일)이 의무 기준인 ${requiredSpanDays}일 이상에 미달합니다. (탈락 사유)`,
        fixGuide: `첫 세션부터 마지막 세션까지의 기간이 최소 ${requiredSpanDays}일 이상이어야 합니다.`
      });
    }

    if (creditedMinutesTotal < requiredMinutes) {
      errors.push({
        code: 'MC-05-HOURS',
        message: `멘토코칭 인정 시간(${formatMinutes(creditedMinutesTotal)})이 의무 기준인 ${formatMinutes(requiredMinutes)}에 미달합니다. (탈락 사유)`,
        fixGuide: "의무 멘토코칭 시간을 충족하십시오."
      });
    }

    if (requiredSessions > 0 && validSessionCount < requiredSessions) {
      errors.push({
        code: 'MC-05-COUNT',
        message: `멘토코칭 회기 수(${validSessionCount}회기)가 의무 기준인 ${requiredSessions}회기에 미달합니다. (탈락 사유)`,
        fixGuide: "일반 응시는 최소 5회기 이상 이수해야 합니다."
      });
    }

    return {
      isValid: errors.length === 0,
      creditedMinutesTotal,
      validSessionCount,
      spanDays,
      requiredSpanDays,
      requiredMinutes,
      errors,
      warnings,
      rowErrorMap,
      rows
    };
  }
}

class CoachTheCoachValidator {
  static validate(sheetData, baseline) {
    const { rows, applicantName } = sheetData;
    const errors = [];
    const warnings = [];
    const rowErrorMap = new Map();

    const addRowError = (rowIndex, code, message, fixGuide) => {
      if (!rowErrorMap.has(rowIndex)) rowErrorMap.set(rowIndex, []);
      rowErrorMap.get(rowIndex).push({ code, message, fixGuide });
    };

    const cleanExtracted = (applicantName || '').replace(/\s+/g, '');
    const cleanBaseline = (baseline.applicantName || '').replace(/\s+/g, '');

    if (!cleanExtracted) {
      warnings.push({
        code: 'CC-01',
        message: "1:1 코치더코치 리스트 상단 '응시자 명'이 누락되었습니다.",
        fixGuide: "응시자 성명을 기재하십시오."
      });
    } else if (cleanBaseline && cleanExtracted !== cleanBaseline) {
      warnings.push({
        code: 'CC-01-WARN',
        message: `1:1 코치더코치 리스트의 응시자 명('${applicantName}')이 입력한 기준 정보('${baseline.applicantName}')와 다릅니다.`,
        fixGuide: "응시자 성명이 본인의 공식 성명과 일치하는지 확인하십시오."
      });
    }

    const isPortfolio = baseline.examType === 'PORTFOLIO';
    const requiredMinutes = isPortfolio ? 480 : 300; // 8h vs 5h

    let creditedMinutesTotal = 0;

    rows.forEach((row) => {
      const { rowIndex, dateStr, timeStr, coachName, certStatus, sessionMinutesVal, formatStr } = row;
      const normDate = normalizeDate(dateStr);
      const timeParsed = parseTimeRange(timeStr);

      if (!normDate || !isStrictDateFormat(normDate)) {
        addRowError(rowIndex, 'CC-02-DATE', `날짜 형식 오류: '${dateStr}'`, "YYYY-MM-DD 형식으로 기재하십시오.");
      }

      if (normDate && baseline.kacCertDate) {
        if (compareDates(normDate, baseline.kacCertDate) < 0) {
          addRowError(rowIndex, 'CC-04', `KAC 취득일(${baseline.kacCertDate}) 이전 이수 건입니다.`, "1:1 코치더코치는 반드시 KAC 취득 후에 이수해야 합니다.");
        }
      }

      if (!timeParsed) {
        addRowError(rowIndex, 'CC-02-TIME', `시간 형식 오류: '${timeStr}'`, "HH:MM-HH:MM 형식으로 기재하십시오.");
      }

      const cleanFormat = String(formatStr || '').trim().replace(/\s+/g, '');
      if (!cleanFormat.startsWith('1:1')) {
        addRowError(rowIndex, 'CC-03', "1:1 코치더코치 리스트에는 1:1 형태만 기재할 수 있습니다.", "그룹 코치더코치는 코칭일지에만 작성 가능합니다.");
      }

      const duration = timeParsed ? timeParsed.duration : 0;
      if (duration < 30 || duration > 60) {
        addRowError(rowIndex, 'CC-06', `단일 세션 시간(${duration}분) 규격 위반 (30분 이상 60분 이하만 유효)`, "세션당 30분~60분 범위만 인정됩니다.");
      }

      const cleanCoach = String(coachName || '').trim();
      if (!/(KPC|KSC)\s*\d+/i.test(cleanCoach)) {
        addRowError(rowIndex, 'CC-07', `코치명에 KPC/KSC 인증번호가 누락되었습니다: '${cleanCoach}'`, "예: 홍길동(KPC90124)");
      }

      const cleanCertStatus = String(certStatus || '').trim();
      if (cleanCertStatus !== '유효') {
        addRowError(rowIndex, 'CC-08', `코치자격 상태가 '유효'가 아닙니다 ('${cleanCertStatus}')`, "자격 만료 또는 정지 코치로부터 받은 세션은 미인정 처리됩니다.");
      }

      const isRowValid = !rowErrorMap.has(rowIndex);
      row.isValid = isRowValid;
      row.errors = rowErrorMap.get(rowIndex) || [];
      row.normDate = normDate;
      row.timeParsed = timeParsed;
      row.creditedMinutes = isRowValid ? duration : 0;

      if (isRowValid) {
        creditedMinutesTotal += duration;
      }
    });

    if (creditedMinutesTotal < requiredMinutes) {
      errors.push({
        code: 'CC-05',
        message: `1:1 코치더코치 유효 시간(${formatMinutes(creditedMinutesTotal)})이 의무 기준인 ${formatMinutes(requiredMinutes)}에 미달합니다. (탈락 사유)`,
        fixGuide: `KAC 취득 후 1:1 코치더코치 ${formatMinutes(requiredMinutes)}를 충족하십시오.`
      });
    }

    return {
      isValid: errors.length === 0,
      creditedMinutesTotal,
      requiredMinutes,
      errors,
      warnings,
      rowErrorMap,
      rows
    };
  }
}

class CrossTimelineChecker {
  static check(clogData, mentData, cctcData, baseline) {
    const conflicts = [];
    const allSessions = [];

    // Flatten all valid or parsed sessions
    if (clogData?.rows) {
      clogData.rows.forEach(r => {
        if (r.normDate && r.timeParsed) {
          allSessions.push({
            source: 'COACHING_LOG',
            sourceName: '코칭일지',
            rowIndex: r.rowIndex,
            date: r.normDate,
            startTime: r.timeParsed.startTime,
            endTime: r.timeParsed.endTime,
            startMinutes: r.timeParsed.startMinutes,
            endMinutes: r.timeParsed.endMinutes,
            person: r.clientName,
            isCtc: (r.ctcVal !== null && r.ctcVal > 0),
            rawRow: r
          });
        }
      });
    }

    if (mentData?.rows) {
      mentData.rows.forEach(r => {
        if (r.normDate && r.timeParsed) {
          allSessions.push({
            source: 'MENTOR_COACHING',
            sourceName: '멘토코칭',
            rowIndex: r.rowIndex,
            date: r.normDate,
            startTime: r.timeParsed.startTime,
            endTime: r.timeParsed.endTime,
            startMinutes: r.timeParsed.startMinutes,
            endMinutes: r.timeParsed.endMinutes,
            person: r.coachName,
            rawRow: r
          });
        }
      });
    }

    if (cctcData?.rows) {
      cctcData.rows.forEach(r => {
        if (r.normDate && r.timeParsed) {
          allSessions.push({
            source: 'COACH_THE_COACH',
            sourceName: '1:1 코치더코치',
            rowIndex: r.rowIndex,
            date: r.normDate,
            startTime: r.timeParsed.startTime,
            endTime: r.timeParsed.endTime,
            startMinutes: r.timeParsed.startMinutes,
            endMinutes: r.timeParsed.endMinutes,
            person: r.coachName,
            rawRow: r
          });
        }
      });
    }

    // Pairwise overlap check
    for (let i = 0; i < allSessions.length; i++) {
      for (let j = i + 1; j < allSessions.length; j++) {
        const s1 = allSessions[i];
        const s2 = allSessions[j];

        if (s1.date === s2.date) {
          // Check 1-minute overlap: S1.start < S2.end && S2.start < S1.end
          if (s1.startMinutes < s2.endMinutes && s2.startMinutes < s1.endMinutes) {
            const isSameDoc = s1.source === s2.source;
            const cleanP1 = String(s1.person || '').replace(/\s+/g, '');
            const cleanP2 = String(s2.person || '').replace(/\s+/g, '');
            const isSamePerson = cleanP1 && cleanP2 && (cleanP1.includes(cleanP2) || cleanP2.includes(cleanP1));

            let conflictType = 'SIMULTANEOUS_EVENT';
            let title = '동시 진행 불가 충돌';
            let desc = `${s1.date} ${s1.startTime}~${s1.endTime} [${s1.sourceName} ${s1.rowIndex}행]과 [${s2.sourceName} ${s2.rowIndex}행]의 시간이 겹칩니다.`;
            let fixGuide = "동일 시간대에 두 세션을 동시에 진행할 수 없습니다. 엑셀 원본의 시간을 확인하여 수정하십시오.";

            if (!isSameDoc && isSamePerson) {
              conflictType = 'CROSS_DUPLICATION';
              title = '서류 간 상호 이중 기재';
              desc = `${s1.date} [${s1.sourceName} ${s1.rowIndex}행]과 [${s2.sourceName} ${s2.rowIndex}행]에 동일 세션이 중복 기재되었습니다.`;
              fixGuide = "코칭일지, 멘토코칭, 1:1 코치더코치 간에 동일 세션을 중복 기재할 수 없습니다. 한 곳에서 삭제하십시오.";
            }

            conflicts.push({
              type: conflictType,
              title,
              desc,
              fixGuide,
              sessionA: s1,
              sessionB: s2
            });

            // Mark error on row objects
            if (s1.rawRow) {
              s1.rawRow.hasCrossConflict = true;
            }
            if (s2.rawRow) {
              s2.rawRow.hasCrossConflict = true;
            }
          }
        }
      }
    }

    // Check conflict with Education Schedules
    if (baseline.educationSchedules && baseline.educationSchedules.length > 0) {
      allSessions.forEach(s => {
        baseline.educationSchedules.forEach((edu, eduIdx) => {
          if (edu.date && edu.startTime && edu.endTime && s.date === edu.date) {
            const eduParsed = parseTimeRange(`${edu.startTime}-${edu.endTime}`);
            if (eduParsed) {
              if (s.startMinutes < eduParsed.endMinutes && eduParsed.startMinutes < s.endMinutes) {
                conflicts.push({
                  type: 'EDUCATION_CONFLICT',
                  title: '코칭 교육 시간 중 실습 위반',
                  desc: `${s.date} [${s.sourceName} ${s.rowIndex}행] 세션이 등록된 코칭 교육 시간(${edu.startTime}~${edu.endTime})과 겹칩니다.`,
                  fixGuide: "코칭 교육 시간 중에 실시한 실습(멘토코칭, 코치더코치 포함)은 서류에 기재할 수 없습니다.",
                  sessionA: s
                });
                if (s.rawRow) s.rawRow.hasCrossConflict = true;
              }
            }
          }
        });
      });
    }

    return conflicts;
  }
}

