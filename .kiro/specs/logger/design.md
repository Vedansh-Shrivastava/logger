# Design Document: ai-cli-log

## Overview

`ai-cli-log` is a zero-dependency, single-page HTML application that runs entirely in the browser. There is no build step, no framework, and no server-side component. All logic lives in a single `index.html` file with inline `<style>` and `<script>` tags.

The application accepts terminal output via a CLI input field or a bulk paste textarea, classifies each line by severity using a regex-based engine, displays the classified lines in a scrollable terminal panel, and optionally sends the session to the NVIDIA API for AI-powered triage.

State is held entirely in memory as a JavaScript array. Refreshing the page resets everything.

---

## Architecture

The app is structured as a set of cooperating in-memory modules, all living in a single `<script>` block. There are no imports, no modules, and no bundler.

```mermaid
graph TD
    UI[User Interface] --> |raw text| LP[Log Parser]
    UI --> |click| AP[AI Pipeline]
    LP --> |LogLine[]| SS[Session State]
    SS --> |read| SB[Stats Bar]
    SS --> |read| TP[Terminal Panel]
    AP --> |AnalysisResult| AR[Analysis Renderer]
    NVIDIA[NVIDIA API] --> |JSON response| AP
```

### Data Flow

1. User submits text (CLI input, raw paste, or preset click)
2. Log Parser classifies each line → produces `LogLine[]`
3. New entries are appended to the in-memory `session` array
4. Stats Bar and Terminal Panel re-render from the updated session
5. On "Analyze with AI", AI Pipeline serializes the session, calls NVIDIA API, parses the response, and renders the `AnalysisResult`

---

## Components and Interfaces

### Session State

A module-level array `let session = []` holds all `LogLine` objects for the current browser session. All reads and writes go through two helper functions:

```js
function appendLines(lines)  // push LogLine[] into session, then re-render
function clearSession()      // reset session to [], clear UI panels
```

### Log Parser

Pure functions — no side effects, no DOM access.

```js
/**
 * Classify a single raw text line into a LogLine.
 * Uses local clock for ts when called from CLI input.
 */
function parseLine(rawText, ts = null) -> LogLine

/**
 * Parse a block of raw text (newline-separated).
 * Extracts timestamps from the text itself; falls back to '--:--:--'.
 */
function parseBlock(rawText) -> LogLine[]

/**
 * Classify severity using ordered regex heuristics.
 * Returns 'error' | 'warn' | 'ok' | 'info'
 */
function classify(text) -> Severity_Level

/**
 * Extract HH:MM:SS from a raw line, or return null.
 * Handles ISO 8601, space-separated, time-only, and bracketed formats.
 */
function extractTimestamp(text) -> string | null
```

### Stats Bar

```js
/**
 * Recompute all four counters from session and update the DOM.
 * Called after every session mutation.
 */
function renderStats()
```

### Terminal Panel

```js
/**
 * Re-render the full terminal panel from session[].
 * Appends a <div> per LogLine with severity class and escaped content.
 * Auto-scrolls to bottom after render.
 */
function renderTerminal()
```

### AI Pipeline

```js
/**
 * Serialize session to prompt text, call NVIDIA API, parse response.
 * Returns a Promise<AnalysisResult>.
 * Throws on network error, non-2xx status, or JSON parse failure.
 */
async function analyzeSession(apiKey) -> Promise<AnalysisResult>
```

### Analysis Renderer

```js
/**
 * Render an AnalysisResult into the AI panel DOM.
 * All text passed through escHtml before innerHTML insertion.
 */
function renderAnalysis(result)

/**
 * Render an error string into the AI panel with error styling.
 */
function renderAnalysisError(message)
```

### XSS Guard

```js
/**
 * Escape &, <, > in a string before DOM insertion.
 */
function escHtml(str) -> string
```

---

## Data Models

### LogLine

```js
{
  ts:  string,          // "HH:MM:SS" or "--:--:--"
  lvl: "error" | "warn" | "ok" | "info",
  msg: string           // raw message text (unescaped)
}
```

### AnalysisResult

```js
{
  summary: string,
  health:  "healthy" | "degraded" | "critical",
  errors:  Array<{ title: string, detail: string }>,   // up to 3
  fixes:   Array<{ description: string, command?: string }>, // up to 3
  insight: string
}
```

### Severity Classification Rules

Applied in strict priority order (first match wins):

| Priority | Level  | Patterns (case-insensitive unless noted) |
|----------|--------|------------------------------------------|
| 1        | error  | `\berror\b`, `\bexception\b`, `\bfatal\b`, `\bfailed\b`, `\bfailure\b`, `ENOENT`, `ECONNREFUSED`, `ERESOLVE`, `non-zero`, `returned a non-zero code` |
| 2        | warn   | `\bwarn\b`, `\bwarning\b`, `\bdeprecated\b`, `\bretry\b`, `vulnerability` |
| 3        | ok     | `\bsuccess\b`, `\bsuccessfully\b`, `\bstarted\b`, `\blistening\b`, `\b200\b`, `\b201\b`, `\b304\b`, `\bcreated\b`, `Step \d+\/\d+` |
| 4        | info   | (default — no pattern matched) |

### Timestamp Extraction Patterns

Tried in order; the first match's time portion (`HH:MM:SS`) is used:

| Format | Example |
|--------|---------|
| ISO 8601 with T | `2024-01-15T10:23:41` |
| ISO 8601 with space | `2024-01-15 10:23:41` |
| Bracketed datetime | `[2024-01-15 10:23:41]` |
| Time-only | `10:23:41` |

### Preset Definitions

Each preset is a static array of `LogLine` objects embedded in the script. The four presets are:

- `npm-install`: 9–10 lines including `ERESOLVE`, peer dependency mismatch, `ENOENT`
- `docker-build`: 9–10 lines including missing module in build step, non-zero exit code
- `python-app`: 9–10 lines including SQLAlchemy `OperationalError`, database auth failure
- `nginx-logs`: 9–10 lines including `ECONNREFUSED`, upstream disconnect, HTTP 403, HTTP 429

### NVIDIA API Request Shape

```js
{
  model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  max_tokens: 1000,
  messages: [
    { role: "user", content: "<prompt>" }
  ]
}
```

Headers: `Content-Type: application/json`, `Authorization: Bearer <key>`

Prompt template (sent as the user message):

```
You are a CLI log analyzer. Analyze the following terminal session and return ONLY a JSON object (no markdown, no code fences) with these keys:
- summary: string (one paragraph overview)
- health: "healthy" | "degraded" | "critical"
- errors: array of up to 3 objects with "title" and "detail"
- fixes: array of up to 3 objects with "description" and optional "command"
- insight: string (one pro tip)

Session:
[HH:MM:SS] [LEVEL] message
...
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Classification is total and deterministic

*For any* non-empty string, `classify(text)` SHALL return exactly one of `"error"`, `"warn"`, `"ok"`, or `"info"`, and calling it twice with the same input SHALL return the same result.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 2: Error patterns take priority over warn patterns

*For any* string that matches both an `error` pattern and a `warn` pattern, `classify(text)` SHALL return `"error"`.

**Validates: Requirements 7.5**

### Property 3: Warn patterns take priority over ok patterns

*For any* string that matches both a `warn` pattern and an `ok` pattern, `classify(text)` SHALL return `"warn"`.

**Validates: Requirements 7.5**

### Property 4: parseBlock strips blank lines

*For any* block of text, `parseBlock(text)` SHALL return an array whose length equals the number of non-empty (non-whitespace-only) lines in the input.

**Validates: Requirements 2.2**

### Property 5: Timestamp extraction round-trip

*For any* raw log line containing a recognizable timestamp, `extractTimestamp(line)` SHALL return a string matching `HH:MM:SS`, and that string SHALL equal the time portion present in the original line.

**Validates: Requirements 2.3, 2.5**

### Property 6: Missing timestamp fallback

*For any* raw log line containing no recognizable timestamp pattern, `extractTimestamp(line)` SHALL return `null`, and `parseLine` SHALL assign `"--:--:--"` as the `ts` value.

**Validates: Requirements 2.4**

### Property 7: escHtml neutralizes injection characters

*For any* string containing `&`, `<`, or `>`, `escHtml(str)` SHALL replace every `&` with `&amp;`, every `<` with `&lt;`, and every `>` with `&gt;`, and the result SHALL contain none of the original unescaped characters.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 8: escHtml is idempotent on safe strings

*For any* string containing no `&`, `<`, or `>`, `escHtml(str)` SHALL return the original string unchanged.

**Validates: Requirements 8.3**

### Property 9: Stats counters are consistent with session

*For any* session array, the sum of `errors + warnings + success` counters SHALL equal the `total` counter, and each individual counter SHALL equal the count of LogLine entries with the corresponding `lvl` value.

**Validates: Requirements 4.3, 4.4, 4.5, 4.6**

### Property 10: Preset append does not clear existing session

*For any* non-empty session and any preset, loading the preset SHALL result in a session whose length equals the original session length plus the preset's line count.

**Validates: Requirements 3.2, 3.3**

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| CLI input exceeds 10,000 characters | Silently truncate or alert; no LogLine created beyond limit |
| "Analyze with AI" with empty session | Alert user; no API call made |
| NVIDIA API network error | Display descriptive message in AI panel; re-enable button |
| NVIDIA API non-2xx response | Display HTTP status + body in AI panel; re-enable button |
| API response not valid JSON | Display raw string in AI panel with error styling; re-enable button |
| `health` value outside known set | Default badge to neutral/unknown styling |
| `errors` or `fixes` arrays longer than 3 | Render only the first 3 entries |

All error messages displayed in the UI are passed through `escHtml` before DOM insertion.

---

## Testing Strategy

### Unit Tests (example-based)

Focus on concrete scenarios and edge cases:

- `classify()` with each error keyword (ERESOLVE, ENOENT, ECONNREFUSED, etc.)
- `classify()` with each warn keyword
- `classify()` with each ok keyword
- `classify()` with a plain info line
- `extractTimestamp()` with each of the four supported formats
- `extractTimestamp()` with a line containing no timestamp
- `parseBlock()` with blank lines interspersed
- `escHtml()` with `<script>alert(1)</script>`
- `escHtml()` with a string containing no special characters
- Stats counter computation with a known session array
- Preset arrays contain between 9 and 10 entries each
- Preset arrays contain the required error conditions per spec

### Property-Based Tests

Using [fast-check](https://github.com/dubzzz/fast-check) (JavaScript), minimum 100 iterations per property:

Each test is tagged with a comment in the format:
`// Feature: logger, Property N: <property_text>`

| Property | Generator | Assertion |
|----------|-----------|-----------|
| P1: Classification totality | `fc.string()` | result ∈ `{error, warn, ok, info}` |
| P1: Classification determinism | `fc.string()` | `classify(s) === classify(s)` |
| P2: Error > warn priority | strings matching both error and warn patterns | result === `"error"` |
| P3: Warn > ok priority | strings matching both warn and ok patterns | result === `"warn"` |
| P4: parseBlock line count | `fc.string()` with embedded newlines | `result.length === nonEmptyLineCount` |
| P5: Timestamp extraction | lines with generated timestamps in each format | extracted time matches source |
| P6: Missing timestamp fallback | strings with no timestamp pattern | `extractTimestamp` returns null |
| P7: escHtml neutralizes `&<>` | `fc.string()` | no raw `&`, `<`, `>` in output |
| P8: escHtml identity on safe strings | strings without `&<>` | output === input |
| P9: Stats consistency | `fc.array(fc.constantFrom(...levels))` | sum invariant holds |
| P10: Preset append | arbitrary session + preset index | length invariant holds |

### Integration / Smoke Tests (manual or Playwright)

- Page loads and renders in under 100ms (Lighthouse / DevTools)
- CLI input field accepts text and renders a LogLine on Enter
- Raw paste parses a multi-line block correctly
- Each preset loads and appends the correct number of lines
- "Clear Session" resets all panels
- "Analyze with AI" with empty session shows alert, no network request
- "Analyze with AI" with a valid API key returns and renders an AnalysisResult
- Layout collapses to single column at 639px viewport width
