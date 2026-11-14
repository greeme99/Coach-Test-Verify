#!/usr/bin/env python3
"""
Date_format_Standardization - Python Engine
Normalizes various raw date strings to ISO 8601 'YYYY-MM-DD'.
Pure standard library, zero external dependencies.
"""

import sys
import re
from datetime import datetime, date, timedelta

def normalize_date(val, raw_val=None):
    if val is None or val == "":
        if raw_val is None or raw_val == "":
            return None

    # 1. Date / datetime object
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    if isinstance(raw_val, (datetime, date)):
        return raw_val.strftime("%Y-%m-%d")

    # 2. Excel Serial Number (e.g. 44962)
    def check_serial(num):
        if isinstance(num, (int, float)) and 30000 < num < 70000:
            # Excel base date is 1899-12-30 due to Lotus 1-2-3 leap year bug
            base = datetime(1899, 12, 30)
            d = base + timedelta(days=num)
            return d.strftime("%Y-%m-%d")
        return None

    s1 = check_serial(val) or check_serial(raw_val)
    if s1:
        return s1

    # 3. String cleanup
    target = val if (val is not None and val != "") else raw_val
    s = str(target).strip()
    s = re.sub(r"^예\)", "", s).strip()
    if not s:
        return None

    # 5-digit number string
    if re.match(r"^\d{5}(\.\d+)?$", s):
        try:
            s2 = check_serial(float(s))
            if s2:
                return s2
        except ValueError:
            pass

    # 4. Korean format: YYYY년 M월 D일 or YY년 M월 D일
    kor = re.match(r"^(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$", s)
    if kor:
        y = int(kor.group(1))
        if y < 100:
            y += 2000
        m = int(kor.group(2))
        d = int(kor.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"

    # 5. Compact 8-digit or 6-digit
    c8 = re.match(r"^(\d{4})(\d{2})(\d{2})$", s)
    if c8:
        y, m, d = int(c8.group(1)), int(c8.group(2)), int(c8.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"

    c6 = re.match(r"^(\d{2})(\d{2})(\d{2})$", s)
    if c6:
        y, m, d = 2000 + int(c6.group(1)), int(c6.group(2)), int(c6.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"

    # 6. Delimiter split: -, /, or .
    parts = [p.strip() for p in re.split(r"[-/.]", s) if p.strip()]
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        p1, p2, p3 = parts
        n1, n2, n3 = int(p1), int(p2), int(p3)
        year, month, day = None, None, None

        if len(p1) == 4 or n1 >= 1900:
            year, month, day = n1, n2, n3
        elif len(p3) == 4 or n3 >= 1900:
            year = n3
            if n1 > 12 and n2 <= 12:
                day, month = n1, n2
            else:
                month, day = n1, n2
        else:
            if n1 >= 13:
                year = 2000 + n1
                month, day = n2, n3
            elif n3 >= 13:
                year = 2000 + n3
                if n1 > 12 and n2 <= 12:
                    day, month = n1, n2
                else:
                    month, day = n1, n2
            else:
                if "-" in s:
                    year = 2000 + n1
                    month, day = n2, n3
                else:
                    year = 2000 + n3
                    month, day = n1, n2

        if year and 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    return s

def is_strict_date_format(s):
    if not s or not isinstance(s, str):
        return False
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}$", s))

def compare_dates(d1, d2):
    s1 = d1 or ""
    s2 = d2 or ""
    if s1 < s2:
        return -1
    elif s1 > s2:
        return 1
    return 0

def diff_days(d1_str, d2_str):
    if not d1_str or not d2_str:
        return 0
    t1 = datetime.strptime(d1_str, "%Y-%m-%d")
    t2 = datetime.strptime(d2_str, "%Y-%m-%d")
    return (t2 - t1).days

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python normalize_date.py <date-string>")
        print('Example: python normalize_date.py "23-2-5" -> 2023-02-05')
        sys.exit(0)
    for arg in sys.argv[1:]:
        res = normalize_date(arg)
        print(f"{arg} => {res} ('VALID' if is_strict_date_format(res) else 'INVALID')")
