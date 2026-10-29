/**
 * Main Application Logic & UI Controller
 */

// Global App State
const state = {
  baseline: {
    applicantName: '',
    examType: 'STANDARD', // 'STANDARD' | 'PORTFOLIO'
    kacCertDate: '',
    coachingEduStartDate: '',
    educationSchedules: []
  },
  files: {
    COACHING_LOG: null,
    MENTOR_COACHING: null,
    COACH_THE_COACH: null
  },
  parsedData: {
    COACHING_LOG: null,
    MENTOR_COACHING: null,
    COACH_THE_COACH: null
  },
  results: {
    clog: null,
    ment: null,
    cctc: null,
    cross: []
  },
  activeTab: 'clog',
  filterOnlyErrors: false,
  theme: 'light'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindFormEvents();
  bindUploadEvents();
  bindTabEvents();
  bindActionEvents();
  updateUI();
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('kpc_verifier_theme') || 'light';
  setTheme(savedTheme);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTheme = e.currentTarget.getAttribute('data-theme');
      setTheme(targetTheme);
    });
  });
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('kpc_verifier_theme', theme);
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}

// Form Events
function bindFormEvents() {
  const nameInput = document.getElementById('applicant-name');
  const typeRadios = document.querySelectorAll('input[name="exam-type"]');
  const kacDateInput = document.getElementById('kac-cert-date');
  const eduStartDateInput = document.getElementById('edu-start-date');

  nameInput.addEventListener('input', (e) => {
    state.baseline.applicantName = e.target.value.trim();
    runValidation();
  });

  typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.baseline.examType = e.target.value;
      runValidation();
    });
  });

  kacDateInput.addEventListener('change', (e) => {
    state.baseline.kacCertDate = e.target.value;
    runValidation();
  });

  eduStartDateInput.addEventListener('change', (e) => {
    state.baseline.coachingEduStartDate = e.target.value;
    runValidation();
  });

  // Education Schedules
  const addEduBtn = document.getElementById('add-edu-btn');
  addEduBtn.addEventListener('click', addEducationSchedule);
}

function addEducationSchedule() {
  const dateInput = document.getElementById('new-edu-date');
  const startInput = document.getElementById('new-edu-start');
  const endInput = document.getElementById('new-edu-end');

  const date = dateInput.value;
  const startTime = startInput.value;
  const endTime = endInput.value;

  if (!date || !startTime || !endTime) {
    alert("코칭 교육 일정의 날짜, 시작 시간, 종료 시간을 모두 입력하십시오.");
    return;
  }

  state.baseline.educationSchedules.push({ date, startTime, endTime });
  dateInput.value = '';
  startInput.value = '';
  endInput.value = '';

  renderEduScheduleList();
  runValidation();
}

function removeEducationSchedule(index) {
  state.baseline.educationSchedules.splice(index, 1);
  renderEduScheduleList();
  runValidation();
}

function renderEduScheduleList() {
  const listEl = document.getElementById('edu-schedule-list');
  if (state.baseline.educationSchedules.length === 0) {
    listEl.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-muted);">등록된 코칭 교육 일정이 없습니다.</span>`;
    return;
  }

  listEl.innerHTML = state.baseline.educationSchedules.map((item, idx) => `
    <div class="edu-item">
      <span>• ${item.date} (${item.startTime} ~ ${item.endTime})</span>
      <button type="button" class="btn-sm danger" onclick="removeEducationSchedule(${idx})">삭제</button>
    </div>
  `).join('');
}

// Upload & Drag-Drop Events
function bindUploadEvents() {
  const slots = [
    { id: 'slot-clog', type: DOC_TYPES.COACHING_LOG, inputId: 'file-clog' },
    { id: 'slot-ment', type: DOC_TYPES.MENTOR_COACHING, inputId: 'file-ment' },
    { id: 'slot-cctc', type: DOC_TYPES.COACH_THE_COACH, inputId: 'file-cctc' }
  ];

  slots.forEach(slot => {
    const el = document.getElementById(slot.id);
    const input = document.getElementById(slot.inputId);

    el.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleSingleFile(file, slot.type);
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragover');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('dragover');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 1) {
        handleSingleFile(files[0], slot.type);
      } else if (files.length > 1) {
        handleMultipleFiles(files);
      }
    });
  });

  // Global Drop on Container
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) {
      handleMultipleFiles(files);
    }
  });
}

// Process Single Uploaded File
async function handleSingleFile(file, specifiedType = null) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const detectedType = specifiedType || ExcelParser.detectDocType(workbook, file.name);

    if (detectedType === DOC_TYPES.UNKNOWN) {
      alert(`[${file.name}] 파일의 서식(코칭일지, 멘토코칭, 1:1 코치더코치)을 자동으로 감지하지 못했습니다.`);
      return;
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const parsed = ExcelParser.parseSheet(firstSheet, detectedType);

    state.files[detectedType] = file;
    state.parsedData[detectedType] = parsed;

    // Auto-fill applicant name if not entered yet
    if (parsed.applicantName && !state.baseline.applicantName) {
      state.baseline.applicantName = parsed.applicantName;
      document.getElementById('applicant-name').value = parsed.applicantName;
    }

    updateSlotUI(detectedType, file.name, parsed.rows.length);
    runValidation();
  } catch (err) {
    console.error("Excel parse error:", err);
    alert(`파일을 읽는 중 오류가 발생했습니다: ${err.message}`);
  }
}

// Process Multi-file Drag & Drop (Smart Slot Allocation)
async function handleMultipleFiles(files) {
  let matchedCount = 0;
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const detectedType = ExcelParser.detectDocType(workbook, file.name);

      if (detectedType !== DOC_TYPES.UNKNOWN) {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = ExcelParser.parseSheet(firstSheet, detectedType);
        state.files[detectedType] = file;
        state.parsedData[detectedType] = parsed;

        if (parsed.applicantName && !state.baseline.applicantName) {
          state.baseline.applicantName = parsed.applicantName;
          document.getElementById('applicant-name').value = parsed.applicantName;
        }

        updateSlotUI(detectedType, file.name, parsed.rows.length);
        matchedCount++;
      }
    } catch (err) {
      console.warn("Error auto-processing file:", file.name, err);
    }
  }

  if (matchedCount > 0) {
    runValidation();
  } else {
    alert("드롭한 파일 중 협회 표준 서식을 감지하지 못했습니다.");
  }
}

function updateSlotUI(type, filename, rowCount) {
  let slotId = '';
  if (type === DOC_TYPES.COACHING_LOG) slotId = 'slot-clog';
  if (type === DOC_TYPES.MENTOR_COACHING) slotId = 'slot-ment';
  if (type === DOC_TYPES.COACH_THE_COACH) slotId = 'slot-cctc';

  const el = document.getElementById(slotId);
  if (!el) return;

  el.classList.add('loaded');
  const statusEl = el.querySelector('.slot-status');
  statusEl.innerHTML = `<span style="color: var(--success-text);">✓ ${filename} (${rowCount}행)</span>`;
}

// Tab Switching
function bindTabEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.getAttribute('data-tab');
      setTab(targetTab);
    });
  });

  const filterCheckbox = document.getElementById('filter-error-checkbox');
  if (filterCheckbox) {
    filterCheckbox.addEventListener('change', (e) => {
      state.filterOnlyErrors = e.target.checked;
      renderTabContent();
    });
  }
}

function setTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  renderTabContent();
}

// Action Buttons
function bindActionEvents() {
  document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-copy-guide').addEventListener('click', copyFixGuideToClipboard);
  document.getElementById('btn-reset-all').addEventListener('click', resetAll);
}

// Copy Actionable Fix Guide to Clipboard
function copyFixGuideToClipboard() {
  const guideLines = [];
  guideLines.push("# KPC 자격인증 서류 사전 검증 결과 및 조치 가이드");
  guideLines.push(`- 응시자: ${state.baseline.applicantName || '미지정'} (응시트랙: ${state.baseline.examType})`);
  guideLines.push(`- 검증일시: ${new Date().toLocaleString('ko-KR')}\n`);

  // Coaching Log Errors
  if (state.results.clog) {
    guideLines.push("## [1] 코칭일지 오류 내역");
    if (state.results.clog.errors.length === 0 && state.results.clog.rowErrorCount === 0) {
      guideLines.push("- 발견된 작성 오류가 없습니다. (정상)\n");
    } else {
      state.results.clog.errors.forEach(e => {
        guideLines.push(`- [문서오류] ${e.message} -> 조치: ${e.fixGuide}`);
      });
      state.results.clog.rows.forEach(r => {
        if (!r.isValid && r.errors) {
          r.errors.forEach(err => {
            guideLines.push(`- [엑셀 ${r.rowIndex}행] ${err.message} -> 조치: ${err.fixGuide}`);
          });
        }
      });
      guideLines.push("");
    }
  }

  // Mentor Coaching Errors
  if (state.results.ment) {
    guideLines.push("## [2] 멘토코칭 리스트 오류 내역");
    if (state.results.ment.errors.length === 0 && state.results.ment.rowErrorMap.size === 0) {
      guideLines.push("- 발견된 작성 오류가 없습니다. (정상)\n");
    } else {
      state.results.ment.errors.forEach(e => {
        guideLines.push(`- [요건오류] ${e.message} -> 조치: ${e.fixGuide}`);
      });
      state.results.ment.rows.forEach(r => {
        if (!r.isValid && r.errors) {
          r.errors.forEach(err => {
            guideLines.push(`- [엑셀 ${r.rowIndex}행] ${err.message} -> 조치: ${err.fixGuide}`);
          });
        }
      });
      guideLines.push("");
    }
  }

  // 1:1 Coach-the-Coach Errors
  if (state.results.cctc) {
    guideLines.push("## [3] 1:1 코치더코치 리스트 오류 내역");
    if (state.results.cctc.errors.length === 0 && state.results.cctc.rowErrorMap.size === 0) {
      guideLines.push("- 발견된 작성 오류가 없습니다. (정상)\n");
    } else {
      state.results.cctc.errors.forEach(e => {
        guideLines.push(`- [요건오류] ${e.message} -> 조치: ${e.fixGuide}`);
      });
      state.results.cctc.rows.forEach(r => {
        if (!r.isValid && r.errors) {
          r.errors.forEach(err => {
            guideLines.push(`- [엑셀 ${r.rowIndex}행] ${err.message} -> 조치: ${err.fixGuide}`);
          });
        }
      });
      guideLines.push("");
    }
  }

  // Cross Conflicts
  if (state.results.cross && state.results.cross.length > 0) {
    guideLines.push("## [4] 통합 타임라인 중복 및 충돌");
    state.results.cross.forEach((c, idx) => {
      guideLines.push(`- [충돌 ${idx + 1}] ${c.title}: ${c.desc} -> 조치: ${c.fixGuide}`);
    });
    guideLines.push("");
  }

  const fullText = guideLines.join('\n');
  navigator.clipboard.writeText(fullText).then(() => {
    alert("수정 조치 가이드가 클립보드에 마크다운 형식으로 복사되었습니다!");
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
    alert("클립보드 복사에 실패했습니다.");
  });
}

function resetAll() {
  if (!confirm("모든 업로드 파일과 검증 결과를 초기화하시겠습니까?")) return;
  location.reload();
}

// Run Validation Engine
function runValidation() {
  const { parsedData, baseline } = state;

  if (parsedData.COACHING_LOG) {
    state.results.clog = CoachingLogValidator.validate(parsedData.COACHING_LOG, baseline);
  } else {
    state.results.clog = null;
  }

  if (parsedData.MENTOR_COACHING) {
    state.results.ment = MentorValidator.validate(parsedData.MENTOR_COACHING, baseline);
  } else {
    state.results.ment = null;
  }

  if (parsedData.COACH_THE_COACH) {
    state.results.cctc = CoachTheCoachValidator.validate(parsedData.COACH_THE_COACH, baseline);
  } else {
    state.results.cctc = null;
  }

  if (parsedData.COACHING_LOG || parsedData.MENTOR_COACHING || parsedData.COACH_THE_COACH) {
    state.results.cross = CrossTimelineChecker.check(
      state.results.clog,
      state.results.ment,
      state.results.cctc,
      baseline
    );
  } else {
    state.results.cross = [];
  }

  updateUI();
}

// Update Entire UI
function updateUI() {
  renderScoreboardBanner();
  renderMetricCards();
  renderTabBadges();
  renderTabContent();
}

// Render Top Banner
function renderScoreboardBanner() {
  const banner = document.getElementById('dashboard-banner');
  const bannerIcon = document.getElementById('banner-icon');
  const bannerStatus = document.getElementById('banner-status-text');
  const bannerDesc = document.getElementById('banner-desc');

  const { clog, ment, cctc, cross } = state.results;

  const hasFiles = clog || ment || cctc;
  if (!hasFiles) {
    banner.className = 'dashboard-banner idle';
    bannerIcon.innerHTML = getIcon('info');
    bannerStatus.textContent = '서류 파일을 업로드해 주세요';
    bannerDesc.textContent = '3종 엑셀 서류를 업로드하면 자동으로 정합성 및 심사 기준 검증을 시작합니다.';
    return;
  }

  // Determine overall pass or fail
  const failReasons = [];

  if (clog) {
    if (!clog.isValid) {
      clog.errors.forEach(e => failReasons.push(`코칭일지: ${e.message}`));
    }
  }
  if (ment) {
    if (!ment.isValid) {
      ment.errors.forEach(e => failReasons.push(`멘토코칭: ${e.message}`));
    }
  }
  if (cctc) {
    if (!cctc.isValid) {
      cctc.errors.forEach(e => failReasons.push(`1:1 코치더코치: ${e.message}`));
    }
  }
  if (cross && cross.length > 0) {
    failReasons.push(`서류 간 타임라인 중복 및 충돌 ${cross.length}건 적발`);
  }

  const isPassed = failReasons.length === 0;

  if (isPassed) {
    banner.className = 'dashboard-banner pass';
    bannerIcon.innerHTML = getIcon('checkCircle');
    bannerStatus.textContent = '사전 점검 결과: 통과 예상 (PASS)';
    bannerDesc.textContent = '모든 필수 서식 규정 및 최소 이수 요건을 충족합니다. (탈락 요인 미검출)';
  } else {
    banner.className = 'dashboard-banner fail';
    bannerIcon.innerHTML = getIcon('alertTriangle');
    bannerStatus.textContent = '사전 점검 결과: 서류 탈락 위험 (FAIL)';
    bannerDesc.textContent = failReasons[0] + (failReasons.length > 1 ? ` (외 ${failReasons.length - 1}건 요건 미달)` : '');
  }
}

// Render 4 Metric Cards
function renderMetricCards() {
  const { clog, ment, cctc } = state.results;

  // 1. Coaching Log Hours
  const clogTotalEl = document.getElementById('metric-clog-hours');
  const clogSubEl = document.getElementById('metric-clog-sub');
  const clogBarEl = document.getElementById('metric-clog-bar');

  if (clog) {
    const totalMin = clog.finalTotalMinutes;
    const paidMin = clog.totalPaidMinutes;
    clogTotalEl.textContent = formatMinutes(totalMin);
    clogSubEl.textContent = `유료 ${formatMinutes(paidMin)} (의무 40h) / 기준 200h`;
    const pct = Math.min(100, Math.round((totalMin / 12000) * 100));
    clogBarEl.style.width = `${pct}%`;
    clogBarEl.className = `progress-bar-fill ${totalMin >= 12000 && paidMin >= 2400 ? 'success' : 'danger'}`;
  } else {
    clogTotalEl.textContent = '-';
    clogSubEl.textContent = '파일 미등록 (200h / 유료 40h)';
    clogBarEl.style.width = '0%';
  }

  // 2. Coaching Log Error Count
  const errCountEl = document.getElementById('metric-err-count');
  const errSubEl = document.getElementById('metric-err-sub');
  const errBarEl = document.getElementById('metric-err-bar');

  if (clog) {
    const errCount = clog.errorCount;
    errCountEl.textContent = `${errCount}건`;
    errSubEl.textContent = errCount > 10 ? '허용 한도(10건) 초과 -> 탈락' : `안전 범위 (허용 최대 10건)`;
    const pct = Math.min(100, Math.round((errCount / 10) * 100));
    errBarEl.style.width = `${pct}%`;
    errBarEl.className = `progress-bar-fill ${errCount <= 10 ? 'success' : 'danger'}`;
  } else {
    errCountEl.textContent = '-';
    errSubEl.textContent = '파일 미등록 (최대 10건 허용)';
    errBarEl.style.width = '0%';
  }

  // 3. Mentor Coaching
  const mentHoursEl = document.getElementById('metric-ment-hours');
  const mentSubEl = document.getElementById('metric-ment-sub');
  const mentBarEl = document.getElementById('metric-ment-bar');

  if (ment) {
    const credMin = ment.creditedMinutesTotal;
    const reqMin = ment.requiredMinutes;
    const span = ment.spanDays;
    const reqSpan = ment.requiredSpanDays;
    mentHoursEl.textContent = formatMinutes(credMin);
    mentSubEl.textContent = `${ment.validSessionCount}회기 | 이수 기간: ${span}일 (${reqSpan}일 이상)`;
    const pct = Math.min(100, Math.round((credMin / reqMin) * 100));
    mentBarEl.style.width = `${pct}%`;
    mentBarEl.className = `progress-bar-fill ${ment.isValid ? 'success' : 'danger'}`;
  } else {
    mentHoursEl.textContent = '-';
    mentSubEl.textContent = '파일 미등록 (5h / 60일 이상)';
    mentBarEl.style.width = '0%';
  }

  // 4. 1:1 Coach-the-Coach
  const cctcHoursEl = document.getElementById('metric-cctc-hours');
  const cctcSubEl = document.getElementById('metric-cctc-sub');
  const cctcBarEl = document.getElementById('metric-cctc-bar');

  if (cctc) {
    const credMin = cctc.creditedMinutesTotal;
    const reqMin = cctc.requiredMinutes;
    cctcHoursEl.textContent = formatMinutes(credMin);
    cctcSubEl.textContent = `의무 ${formatMinutes(reqMin)} 충족 (KAC 취득 후)`;
    const pct = Math.min(100, Math.round((credMin / reqMin) * 100));
    cctcBarEl.style.width = `${pct}%`;
    cctcBarEl.className = `progress-bar-fill ${cctc.isValid ? 'success' : 'danger'}`;
  } else {
    cctcHoursEl.textContent = '-';
    cctcSubEl.textContent = '파일 미등록 (의무 5시간)';
    cctcBarEl.style.width = '0%';
  }
}

// Render Badges on Tab Headers
function renderTabBadges() {
  const { clog, ment, cctc, cross } = state.results;

  const clogBadge = document.getElementById('badge-tab-clog');
  if (clogBadge) {
    const count = clog ? clog.errorCount : 0;
    clogBadge.textContent = `${count}건`;
    clogBadge.className = `tab-badge ${count > 0 ? 'danger' : ''}`;
  }

  const mentBadge = document.getElementById('badge-tab-ment');
  if (mentBadge) {
    const count = ment ? ment.errors.length + ment.rowErrorMap.size : 0;
    mentBadge.textContent = `${count}건`;
    mentBadge.className = `tab-badge ${count > 0 ? 'danger' : ''}`;
  }

  const cctcBadge = document.getElementById('badge-tab-cctc');
  if (cctcBadge) {
    const count = cctc ? cctc.errors.length + cctc.rowErrorMap.size : 0;
    cctcBadge.textContent = `${count}건`;
    cctcBadge.className = `tab-badge ${count > 0 ? 'danger' : ''}`;
  }

  const crossBadge = document.getElementById('badge-tab-cross');
  if (crossBadge) {
    const count = cross ? cross.length : 0;
    crossBadge.textContent = `${count}건`;
    crossBadge.className = `tab-badge ${count > 0 ? 'danger' : ''}`;
  }
}

// Render Active Tab Table Content
function renderTabContent() {
  const container = document.getElementById('tab-content-container');
  const { activeTab, results, filterOnlyErrors } = state;

  if (activeTab === 'clog') {
    renderCoachingLogTable(container, results.clog, filterOnlyErrors);
  } else if (activeTab === 'ment') {
    renderMentorTable(container, results.ment, filterOnlyErrors);
  } else if (activeTab === 'cctc') {
    renderCoachTheCoachTable(container, results.cctc, filterOnlyErrors);
  } else if (activeTab === 'cross') {
    renderCrossTimelineTable(container, results.cross);
  }
}

function renderCoachingLogTable(container, clog, filterOnlyErrors) {
  if (!clog) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">코칭일지 파일이 등록되지 않았습니다.</div>`;
    return;
  }

  let displayRows = clog.rows;
  if (filterOnlyErrors) {
    displayRows = displayRows.filter(r => !r.isValid);
  }

  if (displayRows.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">표시할 세션 내역이 없습니다. (오류 행 0건)</div>`;
    return;
  }

  const rowsHtml = displayRows.map(r => {
    const isErr = !r.isValid;
    const rowClass = isErr ? 'row-error' : '';
    const errText = isErr ? r.errors.map(e => `• ${e.message}`).join('<br>') : '-';
    const fixText = isErr ? r.errors.map(e => `• ${e.fixGuide}`).join('<br>') : '-';

    return `
      <tr class="${rowClass}">
        <td><strong>${r.rowIndex}</strong></td>
        <td>${r.normDate || r.dateStr}</td>
        <td>${r.timeStr}</td>
        <td>${r.clientName}</td>
        <td>${r.paidVal || '-'}</td>
        <td>${r.freeVal || '-'}</td>
        <td>${r.ctcVal || '-'}</td>
        <td>${r.formatStr}</td>
        <td>
          <span class="status-chip ${isErr ? 'error' : 'ok'}">
            ${isErr ? '오류 (차감)' : '정상 인정'}
          </span>
        </td>
        <td style="font-size: 0.75rem; color: ${isErr ? 'var(--danger-text)' : 'inherit'};">${errText}</td>
        <td style="font-size: 0.75rem;">${fixText}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>행</th>
            <th>날짜</th>
            <th>시간</th>
            <th>고객명</th>
            <th>유료</th>
            <th>무료</th>
            <th>받은CTC</th>
            <th>코칭형태</th>
            <th>판정</th>
            <th>사유</th>
            <th>권장 조치 가이드</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function renderMentorTable(container, ment, filterOnlyErrors) {
  if (!ment) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">멘토코칭 리스트 파일이 등록되지 않았습니다.</div>`;
    return;
  }

  let displayRows = ment.rows;
  if (filterOnlyErrors) {
    displayRows = displayRows.filter(r => !r.isValid);
  }

  const rowsHtml = displayRows.map(r => {
    const isErr = !r.isValid;
    const rowClass = isErr ? 'row-error' : '';
    const errText = isErr ? r.errors.map(e => `• ${e.message}`).join('<br>') : '-';
    const fixText = isErr ? r.errors.map(e => `• ${e.fixGuide}`).join('<br>') : '-';

    return `
      <tr class="${rowClass}">
        <td><strong>${r.rowIndex}</strong></td>
        <td>${r.normDate || r.dateStr}</td>
        <td>${r.timeStr}</td>
        <td>${r.coachName}</td>
        <td><span class="status-chip ${r.certStatus === '유효' ? 'ok' : 'error'}">${r.certStatus}</span></td>
        <td>${r.creditedMinutes}분</td>
        <td>${r.formatStr}</td>
        <td>
          <span class="status-chip ${isErr ? 'error' : 'ok'}">
            ${isErr ? '미인정' : '인정'}
          </span>
        </td>
        <td style="font-size: 0.75rem; color: ${isErr ? 'var(--danger-text)' : 'inherit'};">${errText}</td>
        <td style="font-size: 0.75rem;">${fixText}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>행</th>
            <th>날짜</th>
            <th>시간</th>
            <th>멘토코치명</th>
            <th>자격상태</th>
            <th>인정시간</th>
            <th>코칭형태</th>
            <th>판정</th>
            <th>사유</th>
            <th>조치 가이드</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function renderCoachTheCoachTable(container, cctc, filterOnlyErrors) {
  if (!cctc) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">1:1 코치더코치 리스트 파일이 등록되지 않았습니다.</div>`;
    return;
  }

  let displayRows = cctc.rows;
  if (filterOnlyErrors) {
    displayRows = displayRows.filter(r => !r.isValid);
  }

  const rowsHtml = displayRows.map(r => {
    const isErr = !r.isValid;
    const rowClass = isErr ? 'row-error' : '';
    const errText = isErr ? r.errors.map(e => `• ${e.message}`).join('<br>') : '-';
    const fixText = isErr ? r.errors.map(e => `• ${e.fixGuide}`).join('<br>') : '-';

    return `
      <tr class="${rowClass}">
        <td><strong>${r.rowIndex}</strong></td>
        <td>${r.normDate || r.dateStr}</td>
        <td>${r.timeStr}</td>
        <td>${r.coachName}</td>
        <td><span class="status-chip ${r.certStatus === '유효' ? 'ok' : 'error'}">${r.certStatus}</span></td>
        <td>${r.creditedMinutes}분</td>
        <td>${r.formatStr}</td>
        <td>
          <span class="status-chip ${isErr ? 'error' : 'ok'}">
            ${isErr ? '미인정' : '인정'}
          </span>
        </td>
        <td style="font-size: 0.75rem; color: ${isErr ? 'var(--danger-text)' : 'inherit'};">${errText}</td>
        <td style="font-size: 0.75rem;">${fixText}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>행</th>
            <th>날짜</th>
            <th>시간</th>
            <th>코치명</th>
            <th>자격상태</th>
            <th>인정시간</th>
            <th>코칭형태</th>
            <th>판정</th>
            <th>사유</th>
            <th>조치 가이드</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function renderCrossTimelineTable(container, cross) {
  if (!cross || cross.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">적발된 서류 간 중복 기재 또는 동시 진행 충돌이 없습니다. (완벽)</div>`;
    return;
  }

  const rowsHtml = cross.map((c, idx) => `
    <tr class="row-error">
      <td><strong>${idx + 1}</strong></td>
      <td><span class="status-chip error">${c.title}</span></td>
      <td style="font-size: 0.82rem;">${c.desc}</td>
      <td style="font-size: 0.78rem; color: var(--danger-text);">${c.fixGuide}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>순번</th>
            <th>충돌 구분</th>
            <th>상세 내용</th>
            <th>권장 수정 조치</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

