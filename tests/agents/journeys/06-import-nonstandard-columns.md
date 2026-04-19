# Journey 06 — Import: non-canonical column names

**Goal:** Verify the import wizard handles real-world Pikoh files whose column headers differ from the canonical export — a scenario the real manager reports frequently.

**Priority:** P0 (user-reported real-world blocker)

**Precondition:** `seed.sql` applied; dev:test running on :3001. Fixture `tests/agents/fixtures/pikoh-variant-cols.xlsx` exists.

**Persona:** `dina-manager.md` (matches the real user who hits this — non-tech, Hebrew-first, blames the UI before the data).

## Fixture details

`pikoh-variant-cols.xlsx` carries the same 10 rows as `pikoh-happy.xlsx`, but with 3 non-canonical header names that the current parser's alias table (`src/lib/excel-parser.ts`) is NOT expected to match:

| Canonical | In this fixture | Parser behavior |
|---|---|---|
| `מספר זהות` | `ת.ז.` | Should match (`.includes("ת.ז")`) |
| `שם משפחה` | `שם משפחה` | Matches |
| `שם פרטי` | `שם פרטי` | Matches |
| `סטטוס` | `מצב` | **NO match** — parser checks only `סטטוס` / `סטאטוס` |
| `הסמכה` | `הסמכה` | Matches |
| `תוקף תעודה` | `תאריך תוקף` | **NO match** — parser checks only `תוקף תעודה` |
| `מועד רענון הבא` | `רענון` | **NO match** — parser checks only `מועד רענון הבא` |

## Steps

1. Log in. Navigate to `/dashboard/import`.
2. Upload `pikoh-variant-cols.xlsx`.
3. On the review step, record what happens to each of the 7 columns:
   - Does the UI report that a column is missing / unrecognized?
   - Do the review-step rows show populated `status`, `issue date`, `next_refresh`?
   - Or do those fields show blank for all 10 rows?
4. Regardless of missing-column warnings (if any), attempt to commit.
5. After commit, navigate to `/dashboard/employees` and `/dashboard/certifications`. Verify:
   - How many of the 10 rows landed?
   - What is the status of each imported cert? If status is `לא ידוע` for all, that confirms the refresh/expiry columns were dropped.
   - What is the `status` field on each imported employee? If blank, same confirmation.

## Acceptance

- **The user should KNOW** that columns were unrecognized — either a blocking banner on the review step or inline warnings per affected field.
- Silent acceptance with blank values in the imported records is a **P0 bug** (matches the broader "silent-acceptance" class already seen in journey 04).
- If the UI offers a column-mapping step ("map your file's headers to our fields"), record how usable it is for a non-tech persona.

## Explore

- If the app has a column-mapping UI: try mapping `תאריך תוקף` → `issue_date` and see if the commit works correctly.
- Try uploading `pikoh-variant-cols.xlsx` and then `pikoh-happy.xlsx` without closing the wizard — does switching files retain/discard mapping state?

## Expected finding categories (to guide classification)

- **P0** if every row's status / dates is silently blanked and the user is given no warning.
- **P1** if the UI shows partial data but omits required warnings.
- **P2** if the review step flags the issue accurately but the resolution UX is poor (e.g. forces a re-upload instead of letting the user re-map columns).
- **noise** if the parser recognizes every variant gracefully and imports correctly (i.e. the parser's alias coverage is already fine and this journey finds nothing actionable).
