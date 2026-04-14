# Implementation Plan: ai-cli-log

## Overview

Build a zero-dependency, single-page HTML application (`index.html`) with inline styles and scripts. Implementation proceeds bottom-up: pure logic functions first, then DOM rendering, then UI wiring, then AI integration.

## Tasks

- [x] 1. Scaffold `index.html` with base structure and CSS
  - Create `index.html` with `<!DOCTYPE html>`, `<head>`, and `<body>`
  - Add inline `<style>` block with terminal color palette, two-column grid layout, and responsive breakpoint at 640px
  - Add empty `<script>` block at bottom of body
  - Include all required DOM elements: CLI input field, Capture button, Raw_Paste_Panel textarea, Parse button, Stats_Bar counters, Terminal_Panel, Preset buttons (4), Clear Session button, AI key input, Analyze button, AI panel, health badge
  - _Requirements: 1.1, 4.1, 9.1, 9.2_

- [x] 2. Implement core pure functions (Log Parser + XSS guard)
  - [x] 2.1 Implement `escHtml(str)`
    - Replace `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`
    - Return input unchanged when no special characters present
    - _Requirements: 8.3_

  - [x] 2.2 Write property test for `escHtml` — Property 7
    - **Property 7: escHtml neutralizes injection characters**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 2.3 Write property test for `escHtml` — Property 8
    - **Property 8: escHtml is idempotent on safe strings**
    - **Validates: Requirements 8.3**

  - [x] 2.4 Implement `classify(text)`
    - Apply error → warn → ok → info patterns in strict priority order per the Severity Classification Rules table
    - All patterns case-insensitive except `ENOENT`, `ECONNREFUSED`, `ERESOLVE`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.5 Write property test for `classify` — Property 1
    - **Property 1: Classification is total and deterministic**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 2.6 Write property test for `classify` — Property 2
    - **Property 2: Error patterns take priority over warn patterns**
    - **Validates: Requirements 7.5**

  - [x] 2.7 Write property test for `classify` — Property 3
    - **Property 3: Warn patterns take priority over ok patterns**
    - **Validates: Requirements 7.5**

  - [x] 2.8 Write unit tests for `classify`
    - Test each error keyword individually (ERESOLVE, ENOENT, ECONNREFUSED, `\berror\b`, `\bfailed\b`, etc.)
    - Test each warn keyword, each ok keyword, and a plain info line
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 2.9 Implement `extractTimestamp(text)`
    - Try ISO 8601 with T, ISO 8601 with space, bracketed datetime, time-only — in that order
    - Return `HH:MM:SS` string on match, `null` otherwise
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.10 Write property test for `extractTimestamp` — Property 5
    - **Property 5: Timestamp extraction round-trip**
    - **Validates: Requirements 2.3, 2.5**

  - [x] 2.11 Write property test for `extractTimestamp` — Property 6
    - **Property 6: Missing timestamp fallback**
    - **Validates: Requirements 2.4**

  - [x] 2.12 Write unit tests for `extractTimestamp`
    - Test each of the four supported formats and a line with no timestamp
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.13 Implement `parseLine(rawText, ts = null)`
    - Use local clock (`HH:MM:SS`) when `ts` is null
    - Call `classify` for `lvl`, set `msg` to raw text
    - Return a `LogLine` object `{ ts, lvl, msg }`
    - _Requirements: 1.2, 1.3_

  - [x] 2.14 Implement `parseBlock(rawText)`
    - Split on newlines, filter blank/whitespace-only lines
    - Call `extractTimestamp` per line; fall back to `--:--:--`
    - Call `classify` per line for `lvl`
    - Return `LogLine[]`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.15 Write property test for `parseBlock` — Property 4
    - **Property 4: parseBlock strips blank lines**
    - **Validates: Requirements 2.2**

  - [x] 2.16 Write unit tests for `parseBlock`
    - Test with blank lines interspersed, multi-format timestamps, and plain text
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 3. Checkpoint — Ensure all pure-function tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Session State and Stats Bar
  - [x] 4.1 Implement session state and mutation helpers
    - Declare `let session = []` at module scope
    - Implement `appendLines(lines)` — push `LogLine[]` into session, then call render functions
    - Implement `clearSession()` — reset session to `[]`, clear Terminal_Panel, reset Stats_Bar, clear Raw_Paste_Panel textarea, reset AI panel to idle state
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.2 Implement `renderStats()`
    - Compute total, errors (`lvl === 'error'`), warnings (`lvl === 'warn'`), success (`lvl === 'ok'` or `lvl === 'info'`) from session
    - Update the four Stats_Bar DOM counters
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.3 Write property test for stats counters — Property 9
    - **Property 9: Stats counters are consistent with session**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6**

  - [x] 4.4 Write unit tests for `renderStats`
    - Test with a known session array; verify each counter value
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [x] 5. Implement Terminal Panel rendering
  - [x] 5.1 Implement `renderTerminal()`
    - Clear Terminal_Panel inner HTML
    - For each `LogLine` in session, create a `<div>` with severity CSS class and escaped content (`escHtml(msg)`)
    - Auto-scroll Terminal_Panel to bottom after render
    - _Requirements: 1.4, 8.1_

  - [x] 5.2 Write unit tests for `renderTerminal`
    - Verify that `<script>` tags in msg are escaped and not executed
    - Verify auto-scroll behavior
    - _Requirements: 1.4, 8.1_

- [x] 6. Implement Preset data and wiring
  - [x] 6.1 Define the four preset arrays
    - `npm-install`: 9–10 `LogLine` entries including ERESOLVE, peer dependency mismatch, ENOENT
    - `docker-build`: 9–10 entries including missing module and non-zero exit code
    - `python-app`: 9–10 entries including SQLAlchemy OperationalError and database auth failure
    - `nginx-logs`: 9–10 entries including ECONNREFUSED, upstream disconnect, HTTP 403, HTTP 429
    - Each preset must cover a realistic mix of all four severity levels
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 6.2 Write property test for preset append — Property 10
    - **Property 10: Preset append does not clear existing session**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 6.3 Write unit tests for preset arrays
    - Verify each preset has 9–10 entries
    - Verify each preset contains the required error conditions per spec
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 7. Wire up all UI event handlers
  - [x] 7.1 Wire CLI input field
    - On Enter key or Capture button click: read input value, call `parseLine` for each non-empty line split on newline, call `appendLines`, clear input field
    - Enforce 10,000 character limit per submission
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 7.2 Wire Raw Paste Panel
    - On "Parse Raw Logs" button click: read textarea value, call `parseBlock`, call `appendLines`
    - Do NOT clear textarea after parse
    - _Requirements: 2.1, 2.6_

  - [x] 7.3 Wire Preset buttons
    - On each preset button click: call `appendLines` with the corresponding preset array
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.4 Wire Clear Session button
    - On click: call `clearSession()`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Checkpoint — Verify UI wiring end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement AI Pipeline and Analysis Renderer
  - [x] 9.1 Implement `analyzeSession(apiKey)`
    - Guard: if session is empty, throw or alert and return early — no API call
    - Serialize session lines as `[HH:MM:SS] [LEVEL] message`
    - Build prompt instructing model to return JSON with keys `summary`, `health`, `errors`, `fixes`, `insight` — no markdown, no code fences
    - POST to `https://integrate.api.nvidia.com/v1/chat/completions` with model `nvidia/llama-3.1-nemotron-ultra-253b-v1`, `max_tokens: 1000`, `Authorization: Bearer <apiKey>`
    - Extract `choices[0].message.content`, strip residual code fences, parse as JSON
    - Return `Promise<AnalysisResult>`
    - Throw descriptive errors on network failure, non-2xx status, or JSON parse failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 9.2 Implement `renderAnalysis(result)` and `renderAnalysisError(message)`
    - `renderAnalysis`: render summary, health badge (green/yellow/red), up to 3 errors, up to 3 fixes (with optional command), insight — all text through `escHtml`
    - Health values outside `{healthy, degraded, critical}` render with neutral/unknown styling
    - `renderAnalysisError`: render message with error styling, all text through `escHtml`
    - _Requirements: 5.5, 5.6, 8.2_

  - [x] 9.3 Wire "Analyze with AI" button
    - On click: show loading indicator, disable button
    - Call `analyzeSession(apiKey)`, on success call `renderAnalysis`, on error call `renderAnalysisError`
    - Re-enable button after completion (success or error)
    - _Requirements: 5.2, 5.7, 5.8, 5.9_

  - [x] 9.4 Write unit tests for AI Pipeline error handling
    - Test empty session guard (no API call made)
    - Test non-2xx response renders error in panel
    - Test invalid JSON response renders raw string with error styling
    - _Requirements: 5.2, 5.8, 5.9_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with minimum 100 iterations each
- Each property test file should include a comment: `// Feature: logger, Property N: <property_text>`
- All dynamic text (user input and AI output) must go through `escHtml` before any `innerHTML` insertion
- The entire app lives in a single `index.html` — no build step, no bundler, no external dependencies
