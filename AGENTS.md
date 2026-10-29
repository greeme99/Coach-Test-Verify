# Project Agent Rules — KPC 자격인증 서류 검증 시스템

이 파일은 Codex · Antigravity가 자동으로 읽는 프로젝트 규칙입니다. (Claude Code는 `CLAUDE.md`에서 이 파일을 import 합니다.)

## 개발 문서 작성 규칙 (전역 스킬 승계)

- 개발계획/개발문서(SRS, PRD/FS, IA, 와이어프레임, UI, 개발계획, 테스트계획) 작성·개정 시 **반드시 전역 스킬 `dev-plan-doc-creation`을 사용**한다.
  - 전역 설치 위치(단일 원본): `~/.agents/skills/dev-plan-doc-creation`
  - 연결(Junction): `~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/config/skills/`
- 문서 작성 전 결정 인터뷰(grill-me 방식)를 거쳐 결정 프론티어가 비고 사용자가 확인한 뒤에만 문서를 생성한다.
- 문서 패키지 위치: `docs/development/` (00~07 단계 파일)
- 작성 후 검증: `python ~/.agents/skills/dev-plan-doc-creation/scripts/validate_doc_pack.py docs/development`

## 프로젝트 기준 문서

- 승인 기준 계획: `Plan.md` (초안: `Dev.Plan.draft.md`)
- 협회 원본 서식/규정: `Ref.Doc/*.xlsx` — 규칙의 단일 진실 원천(Source of Truth). 서식에 없는 규칙을 임의로 만들지 않는다.

## 제약

- 단일 HTML 파일, 서버·외부 전송 없음(개인정보 로컬 처리).
- 샘플/테스트 데이터는 반드시 가상 데이터로 작성하고 실제 고객명·자격번호를 복사하지 않는다.

