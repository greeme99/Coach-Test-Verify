# Excel Serial Dates & Calculation Guide

## The 1899-12-30 Base Date Bug

Microsoft Excel stores dates internally as serial numbers representing elapsed days:
- Day 1 = January 1, 1900.
- Day 44962 = February 5, 2023.

### Lotus 1-2-3 Leap Year Bug
Lotus 1-2-3 mistakenly treated the year 1900 as a leap year (February 29, 1900 does not exist in the Gregorian calendar).
To maintain backwards compatibility with Lotus 1-2-3 spreadsheets, Microsoft Excel replicated this bug intentionally.

### Calculation in Modern Environments
Because of the phantom day 1900-02-29, all serial dates after March 1, 1900 are offset by 1 day:
- Base date to use: **`1899-12-30`** (or `25569` offset from Unix epoch 1970-01-01).

```javascript
// JavaScript calculation
const ms = Math.round((excelSerial - 25569) * 86400 * 1000);
const date = new Date(ms);
const y = date.getUTCFullYear();
const m = String(date.getUTCMonth() + 1).padStart(2, '0');
const d = String(date.getUTCDate()).padStart(2, '0');
return `${y}-${m}-${d}`;
```

```python
# Python calculation
from datetime import datetime, timedelta
base = datetime(1899, 12, 30)
target = base + timedelta(days=excel_serial)
return target.strftime('%Y-%m-%d')
```
