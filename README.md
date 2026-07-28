## Workforce Pulse - Methodology

### 1. Data Assumptions

- **Timestamps:** Activity timestamps are parsed from ISO-style strings (`YYYY-MM-DDTHH:mm:ss` or `YYYY-MM-DD HH:mm:ss`) and slash-style dates (`DD/MM/YYYY` or `MM/DD/YYYY`). Because the dataset is Indian/IST-contextual, ambiguous slash dates are interpreted as `DD/MM/YYYY`. Valid timestamps are converted to JavaScript `Date` values using IST (`UTC+5:30`); unparseable timestamps are dropped instead of guessed.

- **Durations:** Blank, null, nonnumeric, zero, and negative `duration_minutes` values are dropped. Durations above `480` minutes are capped at `480`; the code treats 480 minutes as one 8-hour workday, so longer single activity records are likely data-entry errors rather than real sessions.

- **Repetitive flags:** `true`, `1`, and `yes` variants are normalized to `true`; `false`, `0`, and `no` variants are normalized to `false`. Blank, `NA`, `N/A`, null, undefined, or unfamiliar values are preserved as `null`, counted as unknown, and excluded from repetitive-share and recoverable-value calculations rather than silently treated as false.

- **Apps and categories:** App names and task categories are trimmed, internal whitespace is collapsed, and casing is canonicalized. A small synonym map handles obvious task-category variants such as CRM update spellings. Blank task categories are kept as `Uncategorized`; unmapped-but-included categories are flagged for review.

- **Compensation:** HRMS compensation is normalized to monthly INR. Explicit unit fields such as `unit`, `compensation_unit`, or `pay_type` override heuristics. LPA/lakh-labeled values are multiplied by `100,000` and divided by 12. Without an explicit unit, values under `5,000` are treated as hourly INR and multiplied by `160` work hours/month; values at or above `5,000` are treated as annual INR and divided by 12. Missing compensation stays `null` and is excluded from rupee calculations, not defaulted to zero or an average.

- **Working hours:** String schedules like `9-18` are split on `-` and normalized to `HH:MM`; whole hours receive `:00`. Object schedules like `{ start, end }` are normalized to the same shape. Null or missing schedules remain `null`; no default workday is invented.

### 2. Join Strategy

- HRMS schema differences are reconciled into one employee schema. `employee_id` and `EmployeeID` are both accepted and uppercased. `department` and `Dept` are both accepted. `role` and `tenure` are read from flat fields first, then from `meta` fields when flat values are absent.

- Duplicate employee IDs are resolved by completeness. For each duplicate set, the record with fewer null or missing fields wins; if completeness ties, the later record in the source array wins because it is treated as newer. In this dataset, `E007` appears twice and the later record was kept because the missing-field scores tied.

- Activity rows without HRMS metadata are kept in the joined dataset with `employee: null`. In the current dataset this includes `E013` and a malformed `?` ID. These rows still count toward time and hours-based calculations, but they are excluded from rupee calculations because no compensation can be traced.

- Employees present in HRMS with no activity are kept visible as metadata-only employees. In the current dataset, `E099` has no matching activity rows, so it appears in data-quality coverage and employee selection, but it does not contribute to time-sink charts or activity totals.

### 3. Headline Number Formulas

- **Hours/month recoverable:** The calculation filters to rows where `is_repetitive === true`; unknown repetitive flags are excluded. It sums repetitive minutes, multiplies by `AUTOMATION_RECOVERY_RATE = 0.6`, converts minutes to hours, then normalizes the observed data window to a monthly figure using `4.33` weeks/month (`52 / 12`). The 60% recovery rate is explicitly a planning assumption, not derived from the dataset.

- **INR/month recoverable:** For each repetitive row with compensation metadata, recoverable minutes are multiplied by the employee's per-minute rate. The per-minute rate is `monthlyCompensationINR / MINUTES_PER_WORKING_MONTH`, where `MINUTES_PER_WORKING_MONTH = round(21.67 working days * 8 hours/day * 60 minutes/hour) = 10,402`. Rows without metadata or compensation are excluded from rupee math but still remain valid for recoverable-hours math.

- **Automation priority ranking:** Each task category receives four normalized sub-scores: volume, repetitiveness, concentration, and rupee impact. Volume is category minutes divided by the maximum category minutes. Repetitiveness is true repetitive rows divided by true-or-false rows, excluding unknowns. Concentration is the share of distinct employees performing the task; higher is better because broad participation suggests a standardized workflow where one automation can help many people. Rupee impact is recoverable rupees divided by the maximum category rupee impact.

- **Ranking weights:** `priorityScore = 0.30 * volume + 0.25 * repetitiveness + 0.15 * concentration + 0.30 * rupeeImpact`. Volume and rupee impact are weighted highest because they represent direct, measurable business value. Repetitiveness is next because it indicates feasibility. Concentration is lowest because rollout ease matters, but does not determine whether automation is worthwhile.

### 4. Anomaly Detection Approach

- The anomaly detector groups activity by employee and computes average repetitive hours per week. Employees with fewer than two weeks of data are excluded from the z-score comparison because one-week averages are too brittle to call anomalous.

- It computes the mean and standard deviation across eligible employees, then flags employees more than `2` standard deviations above or below the group mean. Two standard deviations is used as the standard threshold for a notably unusual value without treating ordinary variation as an outlier.

- If no employee crosses the standard threshold, the same z-score method is applied at department level. If no employee or department crosses `2` standard deviations, the threshold relaxes to `1.5` and the explanation states that a relaxed threshold was used.

### 5. What Was Cut and Why

- Single weekly trend metric (`repetitive-share %`) instead of a multi-metric trend view, to keep the chart readable and scoped.

- No streaming for the AI assistant; it uses a single loading state and returns the full Gemini response.

- Z-score anomaly detection rather than a more sophisticated multivariate model, given the small employee sample and dashboard scope.

- PDF export uses a purpose-built executive summary layout rather than screenshotting every interactive dashboard widget.

- [ADD: another cut]

- [ADD: another cut]

### 6. What's Next (with two more days)

- Add regression tests around cleaning, HRMS reconciliation, joins, and metric calculations.

- Expand anomaly detection to cover multiple signals, such as after-hours work, unusually long sessions, and compensation-weighted outliers.

- Add a manual review step for compensation-unit assumptions before rupee metrics are finalized.

- Add month-over-month comparisons once multiple data windows are available.

- Add streaming responses and richer citation rendering to the AI assistant.

- Add authentication and tenant isolation if this becomes a multi-company product.


