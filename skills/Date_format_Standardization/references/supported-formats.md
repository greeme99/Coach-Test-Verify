# Supported Date Formats & Priority Rules

## 1. Supported Input Formats

| Category | Input Format | Sample | Normalized Output | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Two-Digit Year (Asia/ISO)** | `YY-M-D`, `YY-MM-DD` | `23-2-5`, `23-02-05` | `2023-02-05` | `23 >= 13`, cannot be month |
| **Two-Digit Year (Slash)** | `YY/M/D`, `YY/MM/DD` | `23/2/5`, `23/02/05` | `2023-02-05` | `23 >= 13`, cannot be month |
| **Four-Digit Year (Slash)** | `YYYY/M/D`, `YYYY/MM/DD` | `2023/2/5`, `2023/02/05` | `2023-02-05` | Unambiguous year |
| **US Format (Two-Digit Year)** | `M/D/YY`, `MM/DD/YY` | `2/5/23`, `02/05/23` | `2023-02-05` | `23` is at the end |
| **US Format (Four-Digit Year)** | `M/D/YYYY`, `MM/DD/YYYY` | `2/5/2023`, `02/05/2023` | `2023-02-05` | Unambiguous year at end |
| **Dot Delimiter** | `YYYY.M.D`, `YY.M.D` | `2023.2.5`, `23.2.5` | `2023-02-05` | Common in Korean contracts |
| **Spaced Delimiter** | `YYYY - M - D`, `YYYY / M / D` | `2023 - 2 - 5` | `2023-02-05` | Whitespace trimmed |
| **Korean Text** | `YYYY년 M월 D일`, `YY년 M월 D일` | `2023년 2월 5일` | `2023-02-05` | Handles optional '일' |
| **Compact Numeric** | `YYYYMMDD`, `YYMMDD` | `20230205`, `230205` | `2023-02-05` | 8-digit or 6-digit |
| **Excel Serial Number** | Float / Integer | `44962` | `2023-02-05` | Lotus 1-2-3 leap year fix |

## 2. Disambiguation Heuristic
1. Check if part 1 or part 3 has 4 digits.
2. If both are 2 digits:
   - If `p1 >= 13`: Year must be in `p1` (Month cannot exceed 12).
   - If `p3 >= 13`: Year must be in `p3`.
3. If both `p1 <= 12` and `p3 <= 12`:
   - Hyphen (`-`) defaults to `YY-MM-DD`.
   - Slash (`/`) defaults to `MM/DD/YY`.
