# Usage Examples (Code Snippets)

## 1. JavaScript / TypeScript

```javascript
const { normalizeDate, isStrictDateFormat } = require('./normalize_date');

// User input variations
const inputs = ['23-2-5', '23/2/5', '2023/2/5', '2/5/23', '02/05/23', '02/05/2023'];

inputs.forEach(val => {
  const normalized = normalizeDate(val);
  console.log(`${val} -> ${normalized}`); // All output: 2023-02-05
});
```

## 2. Python 3

```python
from normalize_date import normalize_date, is_strict_date_format

inputs = ['23-2-5', '23/2/5', '2023/2/5', '2/5/23', '02/05/23', '02/05/2023']

for val in inputs:
    normalized = normalize_date(val)
    print(f"{val} -> {normalized}") # All output: 2023-02-05
```

## 3. Command Line Interface (CLI)

```bash
# Normalize single string
node scripts/normalize_date.js "23-2-5"
# Output: 23-2-5 => 2023-02-05 (VALID)

python scripts/normalize_date.py "02/05/2023"
# Output: 02/05/2023 => 2023-02-05 (VALID)
```
