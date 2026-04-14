# Requirements Document

## Introduction

`ai-cli-log` is a browser-based, single-page terminal session analyzer. It captures or accepts pasted command-line output, classifies each line by severity, computes session statistics, and sends the session to the NVIDIA API for AI-powered triage — returning a structured report with a summary, error diagnosis, suggested fixes, and a pro insight. The tool targets developers, DevOps engineers, and SREs who need to quickly understand noisy build, deployment, or server logs without a full observability platform.

---

## Glossary

- **App**: The single-page HTML application (`ai-cli-log`).
- **Session**: The in-memory ordered collection of all LogLine entries present during the current browser session. State is lost on page refresh.
- **LogLine**: A single parsed unit of terminal output with three fields: `ts` (timestamp string), `lvl` (severity level), and `msg` (message text).
- **Severity_Level**: A categorical classification applied to every LogLine. One of: `info`, `warn`, `error`, or `ok`.
- **Log_Parser**: The client-side module responsible for classifying raw text into LogLine entries and extracting timestamps.
- **Stats_Bar**: The persistent UI component that displays real-time aggregate counters for the current Session.
- **Terminal_Panel**: The scrollable UI component that renders the ordered list of LogLine entries.
- **Raw_Paste_Panel**: The UI component containing a textarea for bulk log input and a parse trigger button.
- **Preset**: One of four built-in curated log scenarios (`npm install`, `docker build`, `python app`, `nginx logs`) that can be loaded into the Session instantly.
- **AI_Pipeline**: The client-side module that constructs the prompt, calls the NVIDIA API, and processes the response into an AnalysisResult.
- **AnalysisResult**: The structured JSON object returned by the AI_Pipeline containing `summary`, `health`, `errors`, `fixes`, and `insight`.
- **Session_Health**: A high-level status assigned by the AI model: `healthy`, `degraded`, or `critical`.
- **escHtml**: The HTML-escaping function that sanitizes all dynamic text before DOM insertion.

---

## Requirements

### Requirement 1: Log Capture via CLI Input

**User Story:** As a developer, I want to type or paste individual command output into a terminal input field, so that I can build up a log session line by line without leaving the browser.

#### Acceptance Criteria

1. WHEN the user submits text via the CLI input field (by pressing Enter or clicking the Capture button), THE App SHALL split the input on newline characters and create one LogLine per non-empty line.
2. WHEN a LogLine is created from CLI input, THE Log_Parser SHALL assign a timestamp using the local clock formatted as `HH:MM:SS`.
3. WHEN a LogLine is created, THE Log_Parser SHALL classify it with a Severity_Level by applying the ordered regex heuristics defined in Requirement 7.
4. WHEN new LogLine entries are appended to the Session, THE Terminal_Panel SHALL auto-scroll to the most recently added entry.
5. THE App SHALL accept a maximum of 10,000 characters per single CLI input submission.

---

### Requirement 2: Raw Log Paste

**User Story:** As a developer, I want to paste a bulk block of log text into a textarea and parse it all at once, so that I can analyze existing log files without re-typing them.

#### Acceptance Criteria

1. WHEN the user clicks the "Parse Raw Logs" button, THE Log_Parser SHALL process the full content of the Raw_Paste_Panel textarea and append the resulting LogLine entries to the Session.
2. WHEN processing raw log text, THE Log_Parser SHALL strip blank lines and produce no LogLine for them.
3. WHEN processing a raw log line that contains a recognizable timestamp pattern, THE Log_Parser SHALL extract the time portion (`HH:MM:SS`) and assign it as the LogLine `ts` value.
4. WHEN processing a raw log line that contains no recognizable timestamp, THE Log_Parser SHALL assign `--:--:--` as the LogLine `ts` value.
5. THE Log_Parser SHALL recognize the following timestamp formats during raw paste extraction: ISO 8601 datetime (`2024-01-15T10:23:41`), ISO 8601 with space separator (`2024-01-15 10:23:41`), time-only (`10:23:41`), and bracketed datetime (`[2024-01-15 10:23:41]`).
6. WHEN raw log parsing completes, THE Raw_Paste_Panel SHALL retain the textarea content to allow the user to re-parse after edits.

---

### Requirement 3: Preset Log Samples

**User Story:** As a developer, I want to load a built-in realistic log scenario with one click, so that I can explore the tool's capabilities without needing real log data.

#### Acceptance Criteria

1. THE App SHALL provide exactly four Preset scenarios: `npm install`, `docker build`, `python app`, and `nginx logs`.
2. WHEN the user selects a Preset, THE App SHALL append the Preset's curated LogLine entries to the Session.
3. WHEN the user selects a Preset, THE App SHALL NOT clear any existing Session entries before appending.
4. EACH Preset SHALL contain between 9 and 10 LogLine entries covering a realistic mix of `info`, `warn`, `error`, and `ok` Severity_Levels.
5. THE `npm install` Preset SHALL include LogLine entries representing `ERESOLVE`, peer dependency mismatch, and `ENOENT` error conditions.
6. THE `docker build` Preset SHALL include LogLine entries representing a missing module in a build step and a non-zero exit code.
7. THE `python app` Preset SHALL include LogLine entries representing a SQLAlchemy `OperationalError` and a database authentication failure.
8. THE `nginx logs` Preset SHALL include LogLine entries representing `ECONNREFUSED`, upstream disconnect, HTTP 403, and HTTP 429 conditions.

---

### Requirement 4: Session Statistics

**User Story:** As a developer, I want to see real-time aggregate counts of my log session, so that I can quickly gauge the overall health of the output at a glance.

#### Acceptance Criteria

1. THE Stats_Bar SHALL display four counters: Total Lines, Errors, Warnings, and Success.
2. WHEN the Session changes (via CLI capture, raw paste, Preset load, or clear), THE Stats_Bar SHALL update all four counters before the next rendered frame.
3. THE Stats_Bar SHALL compute the Total Lines counter as the count of all LogLine entries in the Session.
4. THE Stats_Bar SHALL compute the Errors counter as the count of LogLine entries where `lvl === 'error'`.
5. THE Stats_Bar SHALL compute the Warnings counter as the count of LogLine entries where `lvl === 'warn'`.
6. THE Stats_Bar SHALL compute the Success counter as the count of LogLine entries where `lvl === 'info'` or `lvl === 'ok'`.

---

### Requirement 5: AI Analysis

**User Story:** As a developer, I want to send my current log session to an AI model and receive a structured triage report, so that I can understand root causes and get actionable fix suggestions without manually searching for each error.

#### Acceptance Criteria

1. WHEN the user clicks "Analyze with AI" and the Session contains at least one LogLine, THE AI_Pipeline SHALL send the Session to the NVIDIA API endpoint `POST https://integrate.api.nvidia.com/v1/chat/completions` using model `nvidia/llama-3.1-nemotron-ultra-253b-v1` with `max_tokens` set to `1000` and the `Authorization: Bearer <NVIDIA_API_KEY>` header.
2. IF the user clicks "Analyze with AI" and the Session contains zero LogLine entries, THEN THE App SHALL display an alert to the user and SHALL NOT make an API call.
3. WHEN the AI_Pipeline constructs the request prompt, THE AI_Pipeline SHALL serialize each LogLine in the format `[HH:MM:SS] [LEVEL] message` and instruct the model to return a JSON object with keys `summary`, `health`, `errors`, `fixes`, and `insight` without markdown formatting or code fences.
4. WHEN the NVIDIA API returns a successful response, THE AI_Pipeline SHALL extract the content from `choices[0].message.content`, strip any residual code fences, and parse the result as JSON.
5. WHEN the parsed AnalysisResult is available, THE App SHALL render the `summary` field as a natural language overview, up to three `errors` entries each with a title and root cause detail, up to three `fixes` entries each with a description and optional runnable command, and the `insight` field as a pro tip.
6. WHEN the parsed AnalysisResult contains a `health` value, THE App SHALL update the Session_Health badge to display `healthy` (green), `degraded` (yellow), or `critical` (red) accordingly.
7. WHILE the API call is in progress, THE App SHALL display a loading indicator and disable the "Analyze with AI" button.
8. IF the NVIDIA API call fails due to a network error or non-2xx HTTP status, THEN THE App SHALL display a descriptive error message in the AI analysis panel and re-enable the "Analyze with AI" button.
9. IF the API response cannot be parsed as valid JSON, THEN THE App SHALL display the raw error string in the AI analysis panel with error styling and re-enable the "Analyze with AI" button.

---

### Requirement 6: Clear Session

**User Story:** As a developer, I want to reset the tool to its initial empty state, so that I can start a new analysis without refreshing the page.

#### Acceptance Criteria

1. WHEN the user clicks "Clear Session", THE App SHALL remove all LogLine entries from the Session.
2. WHEN the user clicks "Clear Session", THE Stats_Bar SHALL reset all four counters to zero.
3. WHEN the user clicks "Clear Session", THE Raw_Paste_Panel textarea SHALL be cleared.
4. WHEN the user clicks "Clear Session", THE App SHALL reset the AI analysis panel to its idle placeholder state.
5. WHEN the user clicks "Clear Session", THE App SHALL NOT make any API calls.

---

### Requirement 7: Log Classification Engine

**User Story:** As a developer, I want each log line to be automatically classified by severity, so that I can visually distinguish errors, warnings, and successes without reading every line.

#### Acceptance Criteria

1. THE Log_Parser SHALL classify a line as `error` when it matches any of the following patterns (case-insensitive): `\berror\b`, `\bexception\b`, `\bfatal\b`, `\bfailed\b`, `\bfailure\b`, `ENOENT`, `ECONNREFUSED`, `ERESOLVE`, `non-zero`, or `returned a non-zero code`.
2. THE Log_Parser SHALL classify a line as `warn` when it does not match the `error` patterns and matches any of: `\bwarn\b`, `\bwarning\b`, `\bdeprecated\b`, `\bretry\b`, or `vulnerability`.
3. THE Log_Parser SHALL classify a line as `ok` when it does not match `error` or `warn` patterns and matches any of: `\bsuccess\b`, `\bsuccessfully\b`, `\bstarted\b`, `\blistening\b`, `\b200\b`, `\b201\b`, `\b304\b`, `\bcreated\b`, or `Step \d+\/\d+`.
4. THE Log_Parser SHALL classify a line as `info` when it matches none of the `error`, `warn`, or `ok` patterns.
5. THE Log_Parser SHALL apply classification patterns in the order: `error` → `warn` → `ok` → `info`, stopping at the first match.

---

### Requirement 8: XSS Prevention

**User Story:** As a developer, I want all user-supplied and AI-supplied text to be safely rendered in the browser, so that malicious content in log lines cannot execute arbitrary scripts.

#### Acceptance Criteria

1. THE App SHALL pass all user-supplied text through `escHtml` before inserting it into the DOM via `innerHTML`.
2. THE App SHALL pass all model-supplied text from the AnalysisResult through `escHtml` before inserting it into the DOM via `innerHTML`.
3. THE escHtml function SHALL replace `&` with `&amp;`, `<` with `&lt;`, and `>` with `&gt;`.
4. THE App SHALL NOT use `eval()`, `Function()`, or any dynamic script injection at any point.

---

### Requirement 9: Responsive Layout

**User Story:** As a developer, I want the interface to be usable on both wide and narrow screens, so that I can analyze logs on any device.

#### Acceptance Criteria

1. THE App SHALL render the Terminal_Panel and Raw_Paste_Panel in a two-column side-by-side layout on viewports 640px wide or wider.
2. WHEN the viewport width is less than 640px, THE App SHALL collapse the two-column layout to a single-column stacked layout.

---

### Requirement 10: Performance Baselines

**User Story:** As a developer, I want the tool to remain responsive during normal use, so that log capture and rendering do not block my workflow.

#### Acceptance Criteria

1. THE App SHALL render the initial page in under 100ms on a modern browser.
2. THE Log_Parser SHALL parse log lines at a throughput of at least 1,000 lines per second.
3. WHEN a LogLine is captured or parsed, THE Terminal_Panel SHALL re-render within 16ms (one frame at 60fps).
4. THE App SHALL remain stable and fully functional for Sessions containing up to 2,000 LogLine entries.
