/**
 * Main Application Logic & UI Controller
 */

// Global App State
const state = {
  baseline: {
    applicantName: '',
    examType: 'STANDARD', // 'STANDARD' | 'PORTFOLIO'
    kacCertDate: '',
    coachingBasicEduDate: '', // 코칭 기초(Basic) 교육완료일
    coachingEduStartDate: '', // 하위 호환
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
  loadSavedBaseline();
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

// Baseline Storage Key
const BASELINE_STORAGE_KEY = 'kpc_verifier_baseline';

// Load Saved Baseline from localStorage
function loadSavedBaseline() {
  try {
    const raw = localStorage.getItem(BASELINE_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;

    if (saved.applicantName) state.baseline.applicantName = saved.applicantName;
    if (saved.examType) state.baseline.examType = saved.examType;
    if (saved.kacCertDate) state.baseline.kacCertDate = saved.kacCertDate;
    
    const eduDate = saved.coachingBasicEduDate || saved.coachingEduStartDate || '';
    state.baseline.coachingBasicEduDate = eduDate;
    state.baseline.coachingEduStartDate = eduDate;

    if (Array.isArray(saved.educationSchedules)) {
      state.baseline.educationSchedules = saved.educationSchedules;
    }

    // Populate inputs
    const nameInput = document.getElementById('applicant-name');
    if (nameInput) nameInput.value = state.baseline.applicantName;

    const radio = document.querySelector(`input[name="exam-type"][value="${state.baseline.examType}"]`);
    if (radio) radio.checked = true;

    const kacDateInput = document.getElementById('kac-cert-date');
    if (kacDateInput) kacDateInput.value = state.baseline.kacCertDate;

    const eduBasicInput = document.getElementById('edu-basic-date') || document.getElementById('edu-start-date');
    if (eduBasicInput) eduBasicInput.value = eduDate;

    renderEduScheduleList();
    showSavedPill('✓ 저장된 기준정보 로드됨');
  } catch (err) {
    console.warn('Failed to load baseline from localStorage:', err);
  }
}

// Save Baseline to localStorage
function saveBaseline(showFeedback = true) {
  // Sync current form input values to state.baseline
  const nameInput = document.getElementById('applicant-name');
  if (nameInput) state.baseline.applicantName = nameInput.value.trim();

  const checkedRadio = document.querySelector('input[name="exam-type"]:checked');
  if (checkedRadio) state.baseline.examType = checkedRadio.value;

  const kacDateInput = document.getElementById('kac-cert-date');
  if (kacDateInput) state.baseline.kacCertDate = kacDateInput.value;

  const eduBasicInput = document.getElementById('edu-basic-date') || document.getElementById('edu-start-date');
  if (eduBasicInput) {
    state.baseline.coachingBasicEduDate = eduBasicInput.value;
    state.baseline.coachingEduStartDate = eduBasicInput.value;
  }

  try {
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(state.baseline));
    showSavedPill('✓ 기준정보 저장 완료');
    if (showFeedback) {
      alert('응시 기준정보가 브라우저에 안전하게 저장되었습니다.\n(다음 접속 시에도 자동으로 유지됩니다.)');
    }
  } catch (err) {
    console.error('Failed to save baseline:', err);
    alert('기준정보 저장 중 오류가 발생했습니다.');
  }
}

// Reset Baseline
function resetBaseline() {
  if (!confirm('입력된 응시 기준정보(성명, 트랙, KAC 취득일, 교육완료일 등)를 모두 초기화하시겠습니까?\n브라우저에 저장된 기준정보도 함께 삭제됩니다.')) {
    return;
  }

  try {
    localStorage.removeItem(BASELINE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove baseline from localStorage:', err);
  }

  // Reset state
  state.baseline.applicantName = '';
  state.baseline.examType = 'STANDARD';
  state.baseline.kacCertDate = '';
  state.baseline.coachingBasicEduDate = '';
  state.baseline.coachingEduStartDate = '';
  state.baseline.educationSchedules = [];

  // Reset form elements
  const nameInput = document.getElementById('applicant-name');
  if (nameInput) nameInput.value = '';

  const standardRadio = document.querySelector('input[name="exam-type"][value="STANDARD"]');
  if (standardRadio) standardRadio.checked = true;

  const kacDateInput = document.getElementById('kac-cert-date');
  if (kacDateInput) kacDateInput.value = '';

  const eduBasicInput = document.getElementById('edu-basic-date') || document.getElementById('edu-start-date');
  if (eduBasicInput) eduBasicInput.value = '';

  renderEduScheduleList();
  hideSavedPill();
  runValidation();
  alert('기준정보가 초기화되었습니다.');
}

function showSavedPill(text = '✓ 저장됨') {
  const pill = document.getElementById('baseline-saved-pill');
  if (!pill) return;
  pill.textContent = text;
  pill.style.display = 'inline-flex';
}

function hideSavedPill() {
  const pill = document.getElementById('baseline-saved-pill');
  if (pill) pill.style.display = 'none';
}

// Form Events
function bindFormEvents() {
  const nameInput = document.getElementById('applicant-name');
  const typeRadios = document.querySelectorAll('input[name="exam-type"]');
  const kacDateInput = document.getElementById('kac-cert-date');
  const eduBasicDateInput = document.getElementById('edu-basic-date') || document.getElementById('edu-start-date');

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

  if (eduBasicDateInput) {
    eduBasicDateInput.addEventListener('change', (e) => {
      state.baseline.coachingBasicEduDate = e.target.value;
      state.baseline.coachingEduStartDate = e.target.value;
      runValidation();
    });
  }

  // Baseline Save & Reset Buttons
  const saveBaselineBtn = document.getElementById('btn-save-baseline');
  if (saveBaselineBtn) {
    saveBaselineBtn.addEventListener('click', () => saveBaseline(true));
  }

  const resetBaselineBtn = document.getElementById('btn-reset-baseline');
  if (resetBaselineBtn) {
    resetBaselineBtn.addEventListener('click', resetBaseline);
  }

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

  const btnToggle = document.getElementById('btn-toggle-checklist');
  const checklistBody = document.getElementById('checklist-body');
  const toggleIcon = document.getElementById('btn-toggle-icon');
  const toggleText = document.getElementById('btn-toggle-text');

  if (btnToggle && checklistBody) {
    btnToggle.addEventListener('click', () => {
      const isCollapsed = checklistBody.classList.toggle('collapsed');
      if (isCollapsed) {
        if (toggleText) toggleText.innerText = '체크리스트 펼치기';
        if (toggleIcon) toggleIcon.innerHTML = getIcon('chevronDown');
      } else {
        if (toggleText) toggleText.innerText = '체크리스트 접기';
        if (toggleIcon) toggleIcon.innerHTML = getIcon('chevronUp');
      }
    });
  }

  const btnRunCheck = document.getElementById('btn-run-check');
  if (btnRunCheck) {
    btnRunCheck.addEventListener('click', () => {
      const hasAny = state.files.COACHING_LOG || state.files.MENTOR_COACHING || state.files.COACH_THE_COACH;
      if (!hasAny) {
        alert('먼저 엑셀 서류 파일(코칭일지, 멘토코칭, 1:1 코치더코치)을 업로드해 주세요.');
        const slotClog = document.getElementById('slot-clog');
        if (slotClog) slotClog.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      runValidation();
      const checklistSec = document.getElementById('checklist-section');
      if (checklistSec) checklistSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
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
  renderChecklist();
  renderScoreboardBanner();
  renderMetricCards();
  renderTabBadges();
  renderTabContent();
}

// Render Comprehensive KPC Verification Checklist
function renderChecklist() {
  const tbody = document.getElementById('checklist-tbody');
  const summaryBadge = document.getElementById('checklist-summary-badge');
  if (!tbody || !summaryBadge) return;

  const { clog, ment, cctc, cross } = state.results;
  const { baseline, files } = state;
  const isPortfolio = baseline.examType === 'PORTFOLIO';
  const hasFiles = !!(clog || ment || cctc || files.COACHING_LOG || files.MENTOR_COACHING || files.COACH_THE_COACH);

  const categories = [
    {
      name: '1. 코칭일지 (총 200h, 유료 40h 필수)',
      items: [
        {
          name: '총 코칭시간 200시간 이상',
          rule: '총 유효 실습 시간 200.0시간 이상 기재 필수 (오류 제외 후 실 인정 시간 기준)',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const h = (clog.finalTotalMinutes || 0) / 60;
            if (clog.finalTotalMinutes >= 12000) {
              return { status: 'PASS', value: `총 ${h.toFixed(1)}h 인정 (기준 충족)`, detail: `기준 200h 대비 +${(h - 200).toFixed(1)}h 초과 달성` };
            } else {
              return { status: 'FAIL', value: `총 ${h.toFixed(1)}h (부족)`, detail: `기준 200시간까지 ${(200 - h).toFixed(1)}시간 부족 (서류 탈락 사유)` };
            }
          }
        },
        {
          name: '유료 코칭시간 40시간 이상',
          rule: '유료 코칭 실습 시간 40.0시간(2,400분) 이상 필수 (미달 시 탈락)',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const ph = (clog.totalPaidMinutes || 0) / 60;
            if (clog.totalPaidMinutes >= 2400) {
              return { status: 'PASS', value: `유료 ${ph.toFixed(1)}h 인정 (기준 충족)`, detail: `기준 40h 대비 +${(ph - 40).toFixed(1)}h 충족` };
            } else {
              return { status: 'FAIL', value: `유료 ${ph.toFixed(1)}h (부족)`, detail: `기준 40시간까지 ${(40 - ph).toFixed(1)}시간 부족 (서류 탈락 사유)` };
            }
          }
        },
        {
          name: '코칭일지 작성 오류 10개 이하',
          rule: '코칭일지 작성오류 10개 초과 시 탈락 (오류 건수는 전체 코칭시간에서 제외)',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const ec = clog.errorCount || 0;
            if (ec === 0) {
              return { status: 'PASS', value: '작성 오류 0건 (완전 무결)', detail: '오류 10건 허용 기준 이내 준수' };
            } else if (ec <= 10) {
              return { status: 'WARN', value: `작성 오류 ${ec}건 발견 (시간 차감)`, detail: '10건 허용 기준 이내이나 오류 행 시간은 전액 차감됨' };
            } else {
              return { status: 'FAIL', value: `작성 오류 ${ec}건 (탈락 위험)`, detail: '허용치(최대 10개) 초과로 서류 심사 불합격 기준' };
            }
          }
        },
        {
          name: '코칭 기초 교육완료일 이후 실습',
          rule: '코칭 교육을 받으면서 시작한 실습만 인정 (기초 교육완료일 이전 실습은 오류 처리)',
          eval: () => {
            const eduDate = baseline.coachingBasicEduDate || baseline.coachingEduStartDate;
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            if (!eduDate) return { status: 'WAITING', value: '기준일 미입력', detail: '상단에 코칭 기초 교육완료일을 입력해 주세요.' };
            const beforeEdu = clog.rows.filter(r => r.errors && r.errors.some(e => e.code === 'CL-03-EDU'));
            if (beforeEdu.length === 0) {
              return { status: 'PASS', value: '교육완료일 이후 실습 정상', detail: `기초 교육완료일(${eduDate}) 이후 실습 준수` };
            } else {
              return { status: 'FAIL', value: `교육 이전 실습 ${beforeEdu.length}건 적발`, detail: `교육완료일(${eduDate}) 이전 실습은 오류 및 시간 제외` };
            }
          }
        },
        {
          name: '날짜 및 시간순서 오름차순 정렬',
          rule: '코칭일지 기재 날짜와 시작시간 오름차순 정렬 필수 (미정렬 시 작성 오류)',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const orderErr = clog.rows.filter(r => r.errors && r.errors.some(e => e.code === 'CL-03-ORDER'));
            if (orderErr.length === 0) {
              return { status: 'PASS', value: '일자·시간 정렬 정상', detail: '전체 행이 날짜 및 시간순으로 바르게 정렬됨' };
            } else {
              return { status: 'FAIL', value: `정렬 역전 ${orderErr.length}건 발견`, detail: '날짜 또는 시작 시간 역전 행 발생 (수정 필요)' };
            }
          }
        },
        {
          name: '코칭형태 인원수 기재 필수',
          rule: "'1:1대면', '1:1비대면' 또는 그룹 인원수(예: 1:3대면) 명시 필수 (미기재 시 오류)",
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const fmtErr = clog.rows.filter(r => r.errors && r.errors.some(e => e.code && e.code.startsWith('CL-07')));
            if (fmtErr.length === 0) {
              return { status: 'PASS', value: '코칭형태 인원수 규격 준수', detail: '모든 행에 1:1/다자간 및 대면/비대면 인원수 정상 기재' };
            } else {
              return { status: 'FAIL', value: `인원수 미기재 ${fmtErr.length}건`, detail: '인원수 누락 또는 인정되지 않는 코칭형태 기재' };
            }
          }
        },
        {
          name: '세션 인정 한도 및 1일 120분 한도',
          rule: '회기당 30분~120분만 인정(미만/초과 시 오류), 동일 고객 하루 최대 120분 제한',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const limitErr = clog.rows.filter(r => r.errors && r.errors.some(e => ['CL-04-DURATION', 'CL-05-DAILY', 'CL-09-COUNT', 'CL-09-HOURS'].includes(e.code)));
            if (limitErr.length === 0) {
              return { status: 'PASS', value: '세션 및 일일 한도 준수', detail: '회기당 30~120분 및 동일 고객 1일 120분 한도 전건 충족' };
            } else {
              return { status: 'WARN', value: `한도 초과/미달 ${limitErr.length}건`, detail: '30분 미만, 120분 초과 또는 일일 합산 초과 (0분 처리)' };
            }
          }
        },
        {
          name: '받은 코치더코치 복합 산정 기준',
          rule: '2배 가산값 기재, KAC 이전 KAC 코치 인정/이후 KPC·KSC 필수, 최대 80h 및 유료 25h 한도',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const ctcErr = clog.rows.filter(r => r.errors && r.errors.some(e => e.code.includes('CTC')));
            const ctcTotalH = ((clog.creditedCtcTotal || 0) / 60).toFixed(1);
            if (ctcErr.length === 0) {
              return { status: 'PASS', value: `인정 ${ctcTotalH}h (규정 준수)`, detail: '코치 자격 표기 및 시간 한도(최대 80h/25h) 규정 준수' };
            } else {
              return { status: 'WARN', value: `CTC 오류 ${ctcErr.length}건 발견`, detail: '상위코치 자격 표기 또는 시간 한도 초과 절사 적용' };
            }
          }
        },
        {
          name: '고객 다변화 (5명 이상) 및 응시자명 기재',
          rule: '최소 5명 이상의 다양한 고객 대상 코칭 필수, 상단 A4/B4 셀 응시자 성명 기재 필수',
          eval: () => {
            if (!clog) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const clientCount = clog.clientCount || 0;
            const hasName = !clog.errors.some(e => e.code === 'CL-01');
            if (clientCount >= 5 && hasName) {
              return { status: 'PASS', value: `고객 ${clientCount}명 확보 / 성명 기재 정상`, detail: '고객 다변화 기준(5명 이상) 및 응시자 성명 기재 완료' };
            } else if (clientCount < 5) {
              return { status: 'FAIL', value: `고객 ${clientCount}명 (최소 5명 미달)`, detail: '최소 5명 이상의 다양한 고객에게 코칭을 진행해야 합니다.' };
            } else {
              return { status: 'FAIL', value: '상단 응시자 성명 누락', detail: '엑셀 상단 A4/B4 셀에 응시자 성명을 반드시 기재하십시오.' };
            }
          }
        }
      ]
    },
    {
      name: '2. 멘토코칭 리스트 (기간 및 의무시간 필수)',
      items: [
        {
          name: '멘토코칭 진행 기간 준수',
          rule: `시작일~종료일 기준 ${isPortfolio ? '포트폴리오 90일' : '일반 60일'} 이상 (부족 시 탈락)`,
          eval: () => {
            if (!ment) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const reqDays = ment.requiredSpanDays || (isPortfolio ? 90 : 60);
            const days = ment.spanDays || 0;
            if (days >= reqDays) {
              return { status: 'PASS', value: `${days}일 진행 (기준 충족)`, detail: `의무 기간(${reqDays}일 이상) 대비 +${days - reqDays}일 충족` };
            } else {
              return { status: 'FAIL', value: `${days}일 진행 (기간 부족)`, detail: `의무 기간(${reqDays}일) 미달로 서류 심사 탈락 기준` };
            }
          }
        },
        {
          name: '멘토코칭 의무 시간 및 회기 준수',
          rule: `${isPortfolio ? '포트폴리오 10시간 이상' : '일반 5시간 5회기 이상'} (의무 미달 시 탈락)`,
          eval: () => {
            if (!ment) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const reqMin = ment.requiredMinutes || (isPortfolio ? 600 : 300);
            const credMin = ment.creditedMinutesTotal || 0;
            const h = (credMin / 60).toFixed(1);
            const reqH = (reqMin / 60).toFixed(0);
            const count = ment.validSessionCount || 0;
            const hasHours = credMin >= reqMin;
            const hasCount = isPortfolio ? true : count >= 5;
            if (hasHours && hasCount) {
              return { status: 'PASS', value: `총 ${h}h (${count}회기) 충족`, detail: `의무 시간(${reqH}h) 및 회기 기준 충족 완료` };
            } else {
              return { status: 'FAIL', value: `총 ${h}h (${count}회기)`, detail: `의무 요건(${reqH}시간${!isPortfolio ? ', 5회기' : ''}) 미달로 탈락 위험` };
            }
          }
        },
        {
          name: '단일 세션 60분 초과분 절사 한도',
          rule: '회기당 최대 60분까지만 인정 (60분 초과 세션은 60분으로 절사)',
          eval: () => {
            if (!ment) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const truncWarnings = ment.warnings.filter(w => w.code === 'MC-06-TRUNC');
            if (truncWarnings.length === 0) {
              return { status: 'PASS', value: '단일 세션 60분 이내 준수', detail: '초과 절사 대상 세션 없이 전건 규격 내 인정' };
            } else {
              return { status: 'WARN', value: `${truncWarnings.length}건 60분 상한 절사`, detail: '60분을 초과한 세션의 초과 시간이 60분으로 절사 적용됨' };
            }
          }
        },
        {
          name: '멘토코치 자격 유효성 확인',
          rule: '코칭 당시 멘토코치 KPC/KSC 자격 보유 및 유효 상태 확인 (만료/정지 시 탈락)',
          eval: () => {
            if (!ment) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const qualErr = ment.rows.filter(r => r.errors && r.errors.some(e => ['MC-07', 'MC-08'].includes(e.code)));
            if (qualErr.length === 0) {
              return { status: 'PASS', value: '멘토코치 자격 유효 확인', detail: '멘토코치 자격 등급(KPC/KSC) 및 유효 상태 정상' };
            } else {
              return { status: 'FAIL', value: `자격 이상 ${qualErr.length}건`, detail: '멘토코치 자격 만료/정지 또는 부적격자 적발 (탈락 위험)' };
            }
          }
        },
        {
          name: 'KAC 자격 취득일 이후 이수 여부',
          rule: 'KAC 자격 취득일 이후에 받은 멘토코칭만 유효 인정',
          eval: () => {
            if (!ment) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            if (!baseline.kacCertDate) return { status: 'WAITING', value: '취득일 미입력', detail: '상단에 KAC 자격 취득일을 입력해 주세요.' };
            const beforeKac = ment.rows.filter(r => r.errors && r.errors.some(e => e.code === 'MC-03-KAC'));
            if (beforeKac.length === 0) {
              return { status: 'PASS', value: 'KAC 취득 후 이수 준수', detail: `KAC 취득일(${baseline.kacCertDate}) 이후 세션 정상 이수` };
            } else {
              return { status: 'FAIL', value: `KAC 취득 전 이수 ${beforeKac.length}건`, detail: 'KAC 취득일 이전 멘토코칭은 시간 불인정 처리' };
            }
          }
        }
      ]
    },
    {
      name: '3. 1:1 코치더코치 리스트 (의무시간 및 규격 세션)',
      items: [
        {
          name: '1:1 코치더코치 의무 이수 시간',
          rule: `${isPortfolio ? '포트폴리오 8시간 이상' : '일반 5시간 이상'} 필수 이수 (미달 시 탈락)`,
          eval: () => {
            if (!cctc) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const reqMin = cctc.requiredMinutes || (isPortfolio ? 480 : 300);
            const credMin = cctc.creditedMinutesTotal || 0;
            const h = (credMin / 60).toFixed(1);
            const reqH = (reqMin / 60).toFixed(0);
            if (credMin >= reqMin) {
              return { status: 'PASS', value: `총 ${h}h 충족 (기준 충족)`, detail: `의무 시간(${reqH}h) 충족 완료` };
            } else {
              return { status: 'FAIL', value: `총 ${h}h (부족)`, detail: `의무 시간(${reqH}h)까지 ${((reqMin - credMin) / 60).toFixed(1)}시간 부족 (탈락 사유)` };
            }
          }
        },
        {
          name: '1:1 형태 및 세션 규격 (30~60분)',
          rule: '반드시 1:1 형태 및 세션당 30분 이상 60분 이하 규격 준수 (미달/초과 시 미인정)',
          eval: () => {
            if (!cctc) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const fmtErr = cctc.rows.filter(r => r.errors && r.errors.some(e => ['CC-04', 'CC-06'].includes(e.code)));
            if (fmtErr.length === 0) {
              return { status: 'PASS', value: '1:1 및 30~60분 규격 준수', detail: '모든 세션이 1:1 형태 및 세션당 30~60분 규격 준수' };
            } else {
              return { status: 'FAIL', value: `규격 미달 ${fmtErr.length}건`, detail: '30분 미만, 60분 초과 또는 다자간 세션 발생' };
            }
          }
        },
        {
          name: '상위코치 자격 유효성 확인',
          rule: '코칭 당시 상위코치 KPC/KSC 자격 보유 및 유효 상태 확인 (만료/정지 시 미인정)',
          eval: () => {
            if (!cctc) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const qualErr = cctc.rows.filter(r => r.errors && r.errors.some(e => ['CC-07', 'CC-08'].includes(e.code)));
            if (qualErr.length === 0) {
              return { status: 'PASS', value: '상위코치 자격 유효 확인', detail: '코치 자격(KPC/KSC) 및 유효 상태 정상' };
            } else {
              return { status: 'FAIL', value: `자격 이상 ${qualErr.length}건`, detail: '상위코치 자격 만료/정지 건 적발' };
            }
          }
        },
        {
          name: 'KAC 자격 취득일 이후 이수 여부',
          rule: 'KAC 자격 취득일 이후에 받은 1:1 코치더코치 세션만 인정',
          eval: () => {
            if (!cctc) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            if (!baseline.kacCertDate) return { status: 'WAITING', value: '취득일 미입력', detail: '상단에 KAC 자격 취득일을 입력해 주세요.' };
            const beforeKac = cctc.rows.filter(r => r.errors && r.errors.some(e => e.code === 'CC-03-KAC'));
            if (beforeKac.length === 0) {
              return { status: 'PASS', value: 'KAC 취득 후 이수 준수', detail: `KAC 취득일(${baseline.kacCertDate}) 이후 세션 정상 이수` };
            } else {
              return { status: 'FAIL', value: `KAC 취득 전 이수 ${beforeKac.length}건`, detail: 'KAC 취득일 이전 1:1 CTC는 인정되지 않습니다.' };
            }
          }
        }
      ]
    },
    {
      name: '4. 통합 교차 검증 (Cross-Timeline Check)',
      items: [
        {
          name: '서류 간 상호 이중 기재(중복) 배제',
          rule: '코칭일지, 멘토코칭리스트, 1:1 코치더코치리스트 간 동일 세션 중복 기재 금지',
          eval: () => {
            if (!hasFiles) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const crossDups = (cross || []).filter(c => c.type === 'CROSS_DUPLICATION');
            if (crossDups.length === 0) {
              return { status: 'PASS', value: '이중 기재 없음 (정상)', detail: '3종 서류 간 상호 중복 기재된 세션이 없습니다.' };
            } else {
              return { status: 'FAIL', value: `중복 기재 ${crossDups.length}건`, detail: '동일 세션이 둘 이상의 서류에 이중으로 등록되었습니다.' };
            }
          }
        },
        {
          name: '동시 진행 불가 충돌 배제',
          rule: '동일 날짜·시간대에 둘 이상의 세션 동시 수행 불가 (코칭 중 피코칭 충돌 등)',
          eval: () => {
            if (!hasFiles) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const simuls = (cross || []).filter(c => c.type === 'SIMULTANEOUS_EVENT');
            if (simuls.length === 0) {
              return { status: 'PASS', value: '시간대 겹침 없음 (정상)', detail: '동일 시간대 진행 불가능한 충돌 일정이 없습니다.' };
            } else {
              return { status: 'FAIL', value: `동시 충돌 ${simuls.length}건`, detail: '동일 일시 시간대에 두 세션이 겹쳐서 진행되었습니다.' };
            }
          }
        },
        {
          name: '코칭 교육 시간 중 실습 배제',
          rule: '등록된 코칭 교육 시간 중에 실시한 코칭 실습(피코칭 포함) 배제',
          eval: () => {
            if (!baseline.educationSchedules || baseline.educationSchedules.length === 0) {
              return { status: 'NA', value: '해당 없음 (일정 미등록)', detail: '등록된 코칭 교육 일정이 없습니다. (선택 사항)' };
            }
            if (!hasFiles) return { status: 'WAITING', value: '-', detail: '서류 업로드 대기중' };
            const eduConflicts = (cross || []).filter(c => c.type === 'EDUCATION_CONFLICT');
            if (eduConflicts.length === 0) {
              return { status: 'PASS', value: '교육 시간 충돌 없음', detail: '등록된 코칭 교육 일정과 겹치는 실습 세션이 없습니다.' };
            } else {
              return { status: 'FAIL', value: `교육 중 실습 ${eduConflicts.length}건`, detail: '코칭 교육 시간 중에 진행한 실습이 발견되었습니다.' };
            }
          }
        }
      ]
    }
  ];

  let tbodyHtml = '';
  let totalCount = 0;
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  categories.forEach((cat) => {
    tbodyHtml += `
      <tr class="checklist-cat-header">
        <td colspan="5">${cat.name}</td>
      </tr>
    `;

    cat.items.forEach((item) => {
      totalCount++;
      const res = item.eval();

      let badgeHtml = '';
      let rowClass = '';

      if (res.status === 'PASS') {
        passCount++;
        badgeHtml = `<span class="chk-badge pass">${getIcon('checkCircle')} 적합</span>`;
      } else if (res.status === 'WARN') {
        warnCount++;
        rowClass = 'chk-row-warn';
        badgeHtml = `<span class="chk-badge warn">${getIcon('alertTriangle')} 주의</span>`;
      } else if (res.status === 'FAIL') {
        failCount++;
        rowClass = 'chk-row-fail';
        badgeHtml = `<span class="chk-badge fail">${getIcon('xCircle')} 부적합</span>`;
      } else if (res.status === 'NA') {
        badgeHtml = `<span class="chk-badge na">- 해당없음</span>`;
      } else {
        badgeHtml = `<span class="chk-badge waiting">대기</span>`;
      }

      tbodyHtml += `
        <tr class="${rowClass}">
          <td style="color: var(--text-muted); font-size: 0.78rem;">${cat.name.split(' ')[0]}</td>
          <td style="font-weight: 600; color: var(--text-main);">${item.name}</td>
          <td class="checklist-rule-desc">${item.rule}</td>
          <td>
            <div class="checklist-val-text">${res.value}</div>
            <div class="checklist-val-detail">${res.detail}</div>
          </td>
          <td style="text-align: center;">${badgeHtml}</td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = tbodyHtml;

  // Update Summary Badge
  if (!hasFiles) {
    summaryBadge.className = 'checklist-badge waiting';
    summaryBadge.innerText = '서류 업로드 대기중';
  } else if (failCount > 0) {
    summaryBadge.className = 'checklist-badge fail';
    summaryBadge.innerText = `❌ 부적합/탈락위험 (${failCount}건) 발견`;
  } else if (warnCount > 0) {
    summaryBadge.className = 'checklist-badge warn';
    summaryBadge.innerText = `⚠️ 주의/절사 항목 (${warnCount}건)`;
  } else {
    summaryBadge.className = 'checklist-badge pass';
    summaryBadge.innerText = `✓ 전체 점검 통과 (${passCount}/${totalCount})`;
  }
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

