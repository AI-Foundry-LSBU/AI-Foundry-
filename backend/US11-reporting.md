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

## Reporting endpoint

`GET /api/v1/benefits/report` uses the signed-in manager session. Anonymous requests
receive 401; staff and engineers receive 403. It is a read-only GET, so no CSRF
token or request body is needed. Responses use `Cache-Control: no-store`.

| Query | Rule |
| --- | --- |
| from, to | Inclusive YYYY-MM-DD dates; supply both or neither. Default: 1 January to today in UTC. Maximum 120 calendar months. |
| period | month (default), quarter or year; calendar periods, including empty buckets |
| projectId | Optional project UUID; applies to counts, totals, periods and breakdowns together |

Example: `/api/v1/benefits/report?from=2026-01-01&to=2026-03-31&period=month`.
Invalid dates, repeated/unknown filters and reversed or oversized ranges return
400. An unknown project returns 404; an existing unfinished project returns an
empty report. `asOf` is the server's current UTC date, not a client parameter.

All counts and values are read in one database snapshot. Only projects whose
current status is completed and whose known completion date is on/before both
the report end and today can contribute. Undated legacy completions are listed
in exclusions instead of being assigned an invented date or omitted silently.

### What the counts mean

- `completedProjectCount`: projects newly completed inside the selected window,
  including projects without recorded benefits.
- `completedProjectsToDate`: current completed projects with a known completion
  date up to the window end (capped at today), including earlier completions.
- `projects`: projects completed inside the window or with a recognised benefit
  occurrence inside it. An earlier completed project can contribute recurring
  benefits. Earlier projects without in-window occurrences affect the stock count
  but do not appear in this breakdown.
- `benefitCount`: distinct recognised benefit IDs. A recurring benefit is still
  one benefit, even when it has several occurrences.
- `occurrenceCount`: all scheduled recognitions in the window, including those
  with missing values. This includes individual Percent and Days measures.

The `series` array uses the same rules per month/quarter/year. Sum new-completion
counts across buckets; do not sum completed-project stock counts or distinct
benefit counts. Portfolio, period and project totals are alternative views of the
same occurrences: adding these views together would double count.

### Recognition and missing-value rules

1. `one_off` recognises the entered amount once, on its benefit date.
2. `monthly` recognises the same entered monthly amount on the original day each
   month through recursUntil. Short months clamp the day: 31 January, 28 February,
   31 March. The shortened month does not move the original anchor.
3. `yearly` recognises the same entered annual amount on its anniversary through
   recursUntil. A 29 February anniversary uses 28 February in non-leap years and
   returns to 29 February in leap years.
4. There is no prorating, annual-to-monthly allocation or recognition outside the
   inclusive benefit schedule and report window. Occurrences before completion
   are excluded. Recurring schedules keep their original anchor after completion;
   a one-off dated before completion is listed separately when inside the window.
5. `unspecified` is not recognised. Those records appear in
   exclusions.unclassifiedBenefits and make the report incomplete. A record with
   a first date before the window can still be flagged: its recurrence is unknown.
6. Future estimates may be shown for an already completed project. Future actual
   occurrences are withheld as null, even if the saved actual field is numeric.
   The response reports asOf and futureActualCount to make this visible.

For an additive recognition, source labels Hours/month, GBP/year and Cases/month
become **Hours, GBP and Cases**. For example, three explicitly scheduled monthly
10-hour recognitions are 30 Hours, not 30 Hours/month. Each unit has its own total;
there is no grand total across units. Percent and Days are returned individually,
with their descriptions and measurements, rather than added or averaged.

Each `totals` entry has exact four-place decimal strings or null, occurrence
counts, known/missing counts and estimatedComplete/actualComplete flags. Null
means no known value. `0.0000` means recorded values sum to zero. With both known
and unknown occurrences, the number is a **known-value subtotal**, not a complete
confirmed total. A unit with no occurrences has null values and false
completeness flags. Do not turn null into a chart zero or claim it as savings.
Top-level missing counts also include the individual Percent/Days measures.

Example: a project completed on 1 January 2026 has a monthly benefit starting
31 January and ending 31 March, estimated 10 and actual 8 Hours/month. A Q1
report recognises 31 January, 28 February and 31 March: estimated 30.0000 Hours,
actual 24.0000 Hours, one benefit and three occurrences. If actual is not recorded,
actual is null with three missing occurrences. If actual is recorded as zero,
actual is 0.0000 and complete. This example assumes the report runs after March.

These rules apply the current saved amount to every scheduled occurrence. They
do not store a separate measured value for each month. Editing the amount, date
or recurrence recalculates earlier reports; this is current-record reporting,
not an immutable accounting ledger. Period-specific observations or frozen
historical reports would need a separate future requirement.

Every saved benefit ID is processed once, and only one-to-one database joins are
used. Distinct IDs with equal amounts both count. The system cannot determine
whether separately entered records describe the same real-world saving: record
independent outcomes and edit the existing record when correcting it.

### Empty states and exclusions

`message` explains when there are no matching completed projects, no dated
benefits, unknown completion dates or only unclassified records. A mixed dataset
can have a null message while still being incomplete: always inspect `incomplete`
and `exclusions`. Unknown completion dates cannot be allocated to a date-filtered
period, so their warning remains visible for the selected project scope.

## Frontend handoff

The backend tasks are complete; the US11 page is a separate task. The existing
benefits page does not become a dated report merely by applying this migration.
The frontend should:

- Add a manager report page with date, period and project filters, calling this
  endpoint again when filters change, after benefit edits and when opening it.
- Label new completions separately from completed projects to date. Show estimated
  and actual values side by side for each unit, with time-series and project views.
- Render null as Not recorded and mark partial subtotals as incomplete. Preserve
  nulls when editing; do not use Number(value) or value || 0 on unknown values.
- Show the supplied empty message and exclusion warnings. Display Percent and
  Days as individual measures, not a combined total or average.
- Extend the manager benefit form with recurrence and, for monthly/yearly,
  recursUntil. Existing records need an explicitly checked classification.
  Do not assign recurrence automatically from the unit.
- Hide the report from other roles and handle 401/403 responses. Backend checks
  already enforce manager-only access even if someone enters the URL directly.

Decimal strings preserve precision; never concatenate them as strings. Display
formatting may round, but the API remains the exact source. Use a suitable decimal
library if the frontend must perform further arithmetic. The API already supplies
all required totals, so the page need not recompute them.

For a manual read check, sign in as manager, open the browser Console on the
running site and paste this whole block:

```javascript
(async () => {
  const response = await fetch('/api/v1/benefits/report', {
    credentials: 'same-origin'
  });
  const report = await response.json();
  console.log('HTTP status:', response.status);
  console.log(report);
})().catch(console.error);
```

A Promise shown by the Console is normal. The HTTP status and report appear when
the request finishes. Change the URL to the dated example above when testing a
specific window. This does not create or edit data. Backend-only tests do not
require Gemini, an API key or any external AI call.

## Apply and run

Apply the two Git email patches, in order, on a clean feature/backend checkout.
Each patch creates one commit. Keep your existing .env and database. From backend/
run `npm run db:migrate` once, then restart the API. There are no new dependencies
or environment variables. Do not reset/reseed the database to make the report
look populated; review the returned exclusions and classify genuine records.

Migration 018 is recorded by the existing migration runner. Repeating the
migration command skips applied files. Completion dates without live historical
evidence remain null; they require an administrator-reviewed data correction,
not guessed dates or a normal project edit.

## Verification

The automated backend checks cover upgrading existing data, preserving amounts
and unknown dates, automatic completion timestamps, null/zero validation,
manager-only sessions, filter errors, dates and project scope, empty periods,
month-end/leap-year recurrence, future actuals, exact decimal arithmetic,
independent equal-value records, duplicate-ID protection and current-record edits.
The frontend report, recurrence controls and browser acceptance journey remain
outside these two backend commits.
