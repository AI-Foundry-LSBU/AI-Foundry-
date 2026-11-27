# US11: benefits reporting over time

This work covers the dated-benefit model and the reporting API. The report page,
filters and recurrence controls still need frontend integration. Existing pages
are not the new US11 report. Full first-time setup remains in [README.md](README.md).

## Data-model review

The existing benefit record already has a business date (`date` / recorded_on),
amounts, unit and linked project. However, it cannot say whether a value repeats,
and both amounts were previously required numbers. Projects have updated_at,
which can change after completion and is not a reliable completion date.

Migration `018_dated_benefit_reporting.sql` therefore adds only:

| Field/change | Reason |
| --- | --- |
| project_benefits.recurrence | `unspecified`, `one_off`, `monthly` or `yearly`; never guess from the unit |
| project_benefits.recurs_until | Inclusive end date for an explicitly recurring benefit |
| Nullable estimated and actual | `null` is not recorded; zero is a recorded zero |
| projects.completed_at | Actual completion event, independent of subsequent edits |

The existing benefit date is reused as the first recognition date. Monthly
recurrence is supported for Hours/month and Cases/month, yearly for GBP/year.
Percent and Days remain individual measures and can be one-off; they are not
summed or averaged. Monthly/yearly schedules require an end date on or after
the first date. One-off and unspecified entries have a null end date.

Existing amounts, dates, IDs and links are preserved. Legacy recurrence defaults
to unspecified, so nothing starts repeating automatically. A manager must assign
a checked rule before a row contributes to US11 recognition totals. Existing
clients can still save records with unspecified recurrence.

Completion dates are recovered from live recorded delivery completion history only;
reconstructed backfill entries are not treated as evidence of the completion date.
No updated_at, planned target date or migration date is used as a substitute.
Undated legacy completions remain unknown and must be identified in reports.
New completion transitions are timestamped automatically by a database trigger;
subsequent edits preserve the timestamp. completedAt is read-only in project
API responses; it is not a new client-editable project field.

## Benefit API changes

Existing manager-only POST/PUT /api/v1/benefits routes accept the optional fields
`recurrence` and `recursUntil`. Existing fields are unchanged, except estimated
and actual now also accept explicit null. Both keys must still be supplied.
Example additional fields:

```json
{
  "estimated": 10,
  "actual": null,
  "date": "2026-01-31",
  "recurrence": "monthly",
  "recursUntil": "2026-12-31"
}
```

This is part of the normal full benefit body, not a new PATCH endpoint. On PUT,
omitting the two schedule fields preserves their existing values so an older
client cannot silently erase a manager's recurrence choice. Explicitly changing
recurrence to one_off/unspecified also requires recursUntil=null.

The existing US07 /benefits/summary keeps its known-value decimal subtotals and
all-project scope. If values are missing, its `missingValues` list identifies
them; its subtotal is not a complete measured outcome. Non-additive null values
remain null. Use the new US11 endpoint for completed-only dated reporting.
The frontend must display null as Not recorded, preserve it during editing and
show incomplete subtotals honestly. The old completed-summary screen currently
coerces missing numbers to zero and must not be presented as the US11 report.
