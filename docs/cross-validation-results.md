# Cross-Validation: Excel Source Files vs CertiManager DB

**Date:** 2026-04-13
**Validated by:** Automated script (scripts/cross_validate_final.py)

---

## Data Sources

| Source | Description | File |
|--------|-------------|------|
| **Pikoh** | Source of truth for NTA placement approvals | `עותק של מאושרי_נתע_לשיבוץ_מעודכן.xlsx` |
| **KA** | Internal workforce + task management file | `כ״א +משימות.xlsx` |
| **DB** | CertiManager Supabase database | Live query (2026-04-13) |

---

## 1. Pikoh File Summary

Single sheet: `מאושרי נת״ע לשיבוץ`

| Metric | Count |
|--------|-------|
| Total employees | 71 |
| Unique IDs (ת.ז) | 71 |
| Verified IDs (מאומת) | 61 of 71 |

This file lists employees approved for NTA placement only. It is a subset of all NTA-certified employees.

---

## 2. KA File Summary

### Certification Type Sheets

| Sheet Name | Employees | Unique IDs |
|------------|-----------|------------|
| מאושרי נת״ע | 56 | 56 |
| מאושרי כביש 6 | 14 | 14 |
| מאושרי כביש 6 + נת״ע | 6 | 6 |
| PFI | 1 | 1 |
| פעיל - ללא הסמכה מוגדרת | 3 | 3 |
| חלת - מחלה | 1 | 1 |
| **Total unique across cert sheets** | **81** | **81** |

### Other Sheets (tasks, status tracking)

| Sheet Name | Employees | Unique IDs |
|------------|-----------|------------|
| משימות להמשך טיפול | 57 | 57 |
| ללא הסמכה - לבירור | 10 | 10 |
| ריכוז כל המשימות | 70 | 70 |
| משימות לפי אחראי | 70 | 70 |

**Total unique IDs across ALL KA sheets: 148**

---

## 3. Cross-File Overlap (Pikoh vs KA)

| Metric | Count |
|--------|-------|
| Pikoh unique IDs | 71 |
| KA unique IDs (all sheets) | 148 |
| Common (in both files) | 63 |
| Only in Pikoh | 8 |
| Only in KA | 85 |

### Pikoh vs specific KA cert sheets

| KA Sheet | KA Count | Overlap with Pikoh |
|----------|----------|--------------------|
| מאושרי נת״ע | 56 | 51 |
| מאושרי כביש 6 | 14 | 1 |
| מאושרי כביש 6 + נת״ע | 6 | 6 |
| PFI | 1 | 0 |
| פעיל - ללא הסמכה מוגדרת | 3 | 1 |
| חלת - מחלה | 1 | 0 |

**8 IDs in Pikoh not found in any KA sheet:**
`050462480`, `208192427`, `214699738`, `301330064`, `3223423320`, `322831835`, `327942280`, `59434142`

Note: IDs `3223423320` and `59434142` have unusual lengths (10 and 8 digits respectively), suggesting possible data entry errors in the Pikoh file.

---

## 4. DB vs Excel Comparison

### Certification Counts

| Cert Type | KA File (employees) | DB (certifications) | Delta | Analysis |
|-----------|--------------------:|--------------------:|------:|----------|
| נת״ע | 56 | 76 | +20 | See explanation below |
| כביש 6 | 14 | 20 | +6 | Exact match when combo type included |
| כביש 6 + נת״ע | 6 | 0 | -6 | Legacy type, split into separate certs in DB |
| PFI (חוצה צפון) | 1 | 1 | 0 | Match |
| חוצה ישראל | - | 0 | n/a | Empty type in DB, not in KA |
| נתיבי ישראל | - | 0 | n/a | Empty type in DB, not in KA |
| **Total certs** | **77** (sum) | **97** | **+20** | |

### Employee Totals

| Source | Unique Employees |
|--------|----------------:|
| Pikoh file (NTA placement only) | 71 |
| KA cert sheets (certified employees) | 81 |
| KA all sheets (full workforce) | 148 |
| DB employees with certifications | 90 |
| DB total employee records | 156 |

---

## 5. Key Findings

### Finding 1: כביש 6 counts reconcile perfectly
The DB has 20 כביש 6 certs = KA's 14 (pure כביש 6) + 6 (כביש 6 + נת״ע combo). The combo type was correctly split into individual certifications during import.

### Finding 2: נת״ע cert gap of +20 in DB
DB shows 76 נת״ע certs vs KA's 56 in the dedicated sheet.
- 6 are accounted for by the כביש 6 + נת״ע combo employees (56 + 6 = 62)
- Remaining 14 gap: likely employees from the Pikoh file or task sheets who were imported with נת״ע certs but are not in the KA "מאושרי נת״ע" sheet

### Finding 3: DB has 8 more employees than KA (156 vs 148)
These 8 employees were likely added directly to the system or came from the Pikoh import (8 IDs in Pikoh but not in KA).

### Finding 4: DB has 90 certified employees vs KA's 81 cert-sheet employees
The 9 additional certified employees in the DB likely came from:
- Employees in KA task/status sheets who were assigned certs during import
- Employees from Pikoh not present in KA cert sheets

### Finding 5: Pikoh file is a focused NTA subset
The Pikoh file (71 employees) is specifically for NTA placement approvals. 63 of 71 overlap with KA, 51 of 71 are in the KA "מאושרי נת״ע" sheet. The 8 Pikoh-only IDs (2 possibly malformed) need verification.

---

## 6. Recommended Actions

1. **Verify the 8 Pikoh-only IDs** -- especially `3223423320` (10 digits) and `59434142` (8 digits) which may be data entry errors
2. **Audit the 14 unaccounted נת״ע certs** -- identify which employees in the DB have נת״ע certs but are not in the KA "מאושרי נת״ע" sheet
3. **Reconcile the 8 extra DB employees** -- determine if they should be in the KA file or were correctly added separately
4. **Consider removing empty cert types** -- חוצה ישראל and נתיבי ישראל have 0 certs and could be cleaned up or kept as placeholders
