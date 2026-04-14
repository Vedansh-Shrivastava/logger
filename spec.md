# ai-cli-log — Smart Terminal Log Analyzer

**Version:** 1.0.0
**Status:** Stable
**Author:** Developer Tools Team
**Last Updated:** April 14, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [User Interface Specification](#user-interface-specification)
6. [AI Analysis Pipeline](#ai-analysis-pipeline)
7. [Log Parsing Engine](#log-parsing-engine)
8. [Data Models](#data-models)
9. [API Reference](#api-reference)
10. [Error Handling](#error-handling)
11. [Performance Requirements](#performance-requirements)
12. [Security Considerations](#security-considerations)
13. [Accessibility](#accessibility)
14. [Future Roadmap](#future-roadmap)
15. [Glossary](#glossary)

---

## Overview

`ai-cli-log` is a browser-based intelligent terminal session analyzer that captures, parses, and interprets command-line output using large language models. It bridges the gap between raw, noisy terminal output and actionable developer insights — surfacing errors, diagnosing root causes, and suggesting concrete fixes in real time.

The tool is designed for developers, DevOps engineers, and SREs who routinely debug complex build pipelines, deployment workflows, and server logs. Rather than manually scanning hundreds of log lines, users paste or stream terminal output into the interface and receive an AI-generated triage report within seconds.

### Core Value Proposition

| Without ai-cli-log | With ai-cli-log |
|---|---|
| Manually grep for ERROR patterns | Automatic severity classification |
| Google each error message individually | Inline root cause explanation |
| Trial-and-error debugging | Suggested fix commands |
| No session-level overview | Structured AI summary |
| Raw text dumps | Visual log timeline with stats |

---

## Goals & Non-Goals

### Goals

- Provide a zero-installation, browser-native log analysis experience
- Support multiple log input methods: CLI capture, raw paste, and preset samples
- Classify log lines by severity (INFO, WARN, ERROR, OK) with high accuracy
- Deliver AI-powered analysis including summary, error diagnosis, fix suggestions, and pro insights
- Render a real-time session health status (healthy / degraded / critical)
- Display aggregate statistics: total lines, error count, warning count, success count
- Support the most common developer log formats out of the box

### Non-Goals

- This tool does not replace a full observability platform (e.g., Datadog, Grafana, Splunk)
- It does not stream live process output directly (no PTY integration in v1)
- It does not persist sessions server-side or sync across devices
- It does not support binary log formats (e.g., systemd journal binary files)
- It does not provide alerting, monitoring, or SLA tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Client                    │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Input Layer  │    │     Rendering Layer      │   │
│  │              │    │                          │   │
│  │ • CLI input  │    │ • Terminal panel (mono)  │   │
│  │ • Raw paste  │───▶│ • Stats bar              │   │
│  │ • Presets    │    │ • AI analysis panel      │   │
│  └──────┬───────┘    └──────────────────────────┘   │
│         │                                           │
│  ┌──────▼───────────────────────────────────────┐   │
│  │              Log Parsing Engine               │   │
│  │                                              │   │
│  │  classify(line) → {ts, lvl, msg}             │   │
│  │  parseRaw(text) → LogLine[]                  │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │                           │
│  ┌──────────────────────▼───────────────────────┐   │
│  │              AI Analysis Pipeline             │   │
│  │                                              │   │
│  │  buildPrompt(logs) → string                  │   │
│  │  callClaude(prompt) → AnalysisResult         │   │
│  │  renderResult(result) → HTML                 │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │                           │
└─────────────────────────┼───────────────────────────┘
                          │ HTTPS POST
                          ▼
              ┌───────────────────────┐
              │   Anthropic API       │
              │  /v1/messages         │
              │  claude-sonnet-4      │
              └───────────────────────┘
```

The application is a single-page, self-contained HTML artifact with no server-side component beyond the Anthropic API call. State is held entirely in-memory within the JavaScript runtime. There is no database, no authentication layer, and no persistent storage in v1.

---

## Core Features

### F-01 — Log Capture (CLI Input)

Users can type or paste individual commands and their output into the terminal input field. Pressing Enter or clicking the "Capture" button appends the input to the current session.

**Behavior:**
- Multi-line input is split on newlines; each line becomes a separate `LogLine` entry
- Each captured line is auto-classified by severity heuristic (see [Log Parsing Engine](#log-parsing-engine))
- Timestamp is automatically assigned using the local clock at capture time (`HH:MM:SS`)
- The terminal viewport auto-scrolls to the latest entry after each capture

**Input constraints:**
- Maximum single paste: 10,000 characters (browser paste buffer limit)
- No maximum on total session length in v1 (performance degrades beyond ~2,000 lines)

---

### F-02 — Raw Log Paste

A dedicated textarea accepts bulk log file content. Clicking "Parse Raw Logs →" processes the entire paste in one operation.

**Behavior:**
- Blank lines are stripped
- Timestamps are extracted via regex from common formats (see patterns below)
- If no timestamp is found in a line, the placeholder `--:--:--` is used
- All parsed lines are appended to the existing session (not replacing it)
- The textarea is not cleared after parsing, allowing re-parse after edits

**Supported timestamp formats:**

| Format | Example |
|---|---|
| ISO 8601 datetime | `2024-01-15T10:23:41` |
| ISO 8601 with space | `2024-01-15 10:23:41` |
| Time only (HH:MM:SS) | `10:23:41` |
| Bracketed | `[2024-01-15 10:23:41]` |

---

### F-03 — Preset Samples

Four built-in realistic log scenarios allow users to instantly explore the tool without needing real log data.

| Preset | Scenario | Key Errors |
|---|---|---|
| `npm install` | Dependency resolution failure | `ERESOLVE`, peer dep mismatch, `ENOENT` |
| `docker build` | Container build failure | Missing module in build step, non-zero exit |
| `python app` | Flask startup crash | SQLAlchemy `OperationalError`, DB auth failure |
| `nginx logs` | Web server mixed traffic | `ECONNREFUSED`, upstream disconnect, 403, 429 |

Each preset loads a curated set of 9–10 `LogLine` entries that cover a realistic mix of severity levels.

---

### F-04 — Session Statistics

A persistent stats bar at the top of the interface shows four real-time counters, updated after every log capture or parse operation.

| Stat | Color | Counts |
|---|---|---|
| Total Lines | Cyan | All `LogLine` entries in session |
| Errors | Red | Lines where `lvl === 'error'` |
| Warnings | Yellow | Lines where `lvl === 'warn'` |
| Success | Green | Lines where `lvl === 'info'` or `lvl === 'ok'` |

---

### F-05 — AI Analysis (Claude-Powered)

The primary value-delivery feature. Sends the full session log to the Anthropic API and renders a structured analysis result.

**Trigger:** User clicks "Analyze with Claude" button.

**Pre-condition:** At least one `LogLine` must exist in the session. If the session is empty, an alert is shown and the API call is not made.

**Output sections:**

| Section | Description |
|---|---|
| Summary | 2–3 sentence natural language overview of the session |
| Errors Detected | Up to 3 most impactful errors, each with a title and root cause explanation |
| Suggested Fixes | Up to 3 actionable fixes, each with a description and an optional runnable command |
| Pro Insight | One pattern or professional tip derived from the session |

**Session health badge:** After analysis, the status indicator in the AI panel header updates to reflect the overall health level returned by the model (`healthy`, `degraded`, or `critical`), color-coded green, yellow, and red respectively.

---

### F-06 — Clear Session

The "Clear Session" button resets all state: log lines, stats counters, raw paste textarea content, and the AI analysis panel. The interface returns to its initial empty state.

---

## User Interface Specification

### Layout

The interface uses a two-column layout for the input panels (terminal capture + raw paste), stacked above the analyze controls and AI output panel. On viewports narrower than 640px, the two-column layout collapses to single-column.

```
┌────────────────────────────────────────┐
│  Header: Logo + Badge                  │
├────────┬────────┬────────┬────────┐
│  Total │ Errors │  Warns │ Success│   ← Stats Row
├────────┴────────┴────────┴────────┤
│  Terminal Panel   │  Raw Paste Panel   │   ← Two-Column
│  (preset buttons) │  (textarea)        │
│  (CLI input)      │  (parse button)    │
├────────────────────────────────────────┤
│  [Analyze with Claude]  [Clear Session]│   ← Action Bar
├────────────────────────────────────────┤
│  AI Analysis Panel                     │   ← Output
│  Summary / Errors / Fixes / Insight    │
└────────────────────────────────────────┘
```

### Terminal Panel

- Background: dark surface (`#161b22`)
- Font: JetBrains Mono, 12px, line-height 1.7
- Log lines rendered as flex rows: `[timestamp] [level badge] [message]`
- Level badge colors: INFO=blue, WARN=yellow, ERROR=red, OK=green
- Error lines: message text tinted `#ffa8a8`
- Warning lines: message text tinted `#f5d08a`
- Panel scrolls independently; auto-scrolls to bottom on new entries
- Max visible height: 220px with overflow-y scroll

### Severity Badge Styles

| Level | Background | Text Color | Label |
|---|---|---|---|
| INFO | `rgba(88,166,255,0.15)` | `#58a6ff` | `INFO` |
| WARN | `rgba(227,179,65,0.15)` | `#e3b341` | `WARN` |
| ERROR | `rgba(248,81,73,0.18)` | `#f85149` | `ERROR` |
| OK | `rgba(57,211,83,0.12)` | `#39d353` | `OK` |

### AI Panel States

| State | Visual |
|---|---|
| Idle | Muted placeholder text |
| Loading | Spinner + "Claude is analyzing..." message |
| Success | Structured sections with fade-in animation |
| Error | Red error message with raw error string |

### Analyze Button States

| State | Appearance |
|---|---|
| Ready | Purple tinted background, enabled |
| Loading | Disabled, spinner + "Analyzing..." label |
| Post-analysis | Returns to ready state |

---

## AI Analysis Pipeline

### Prompt Construction

The log session is serialized into a plain-text block with the format:

```
[HH:MM:SS] [LEVEL] message text
```

The full prompt instructs the model to act as a DevOps expert and return structured JSON with exactly the following schema:

```json
{
  "summary": "string",
  "health": "healthy | degraded | critical",
  "errors": [
    { "title": "string", "detail": "string" }
  ],
  "fixes": [
    { "description": "string", "command": "string" }
  ],
  "insight": "string"
}
```

The prompt explicitly forbids markdown formatting or code fences in the response to ensure clean JSON parsing.

### Model Configuration

| Parameter | Value |
|---|---|
| Model | `claude-sonnet-4-20250514` |
| Max tokens | `1000` |
| Temperature | Default (not set) |
| System prompt | None (instructions inline in user message) |

### Response Processing

1. Extract all `text` blocks from `data.content` array
2. Concatenate into a single string
3. Strip any residual ` ```json ` or ` ``` ` fences using regex
4. Parse as JSON
5. Validate top-level keys (`summary`, `health`, `errors`, `fixes`, `insight`)
6. Render to DOM using the structured template

### Health Status Mapping

| Value | Color | Meaning |
|---|---|---|
| `healthy` | Green `#39d353` | Session completed without significant issues |
| `degraded` | Yellow `#e3b341` | Warnings or recoverable errors detected |
| `critical` | Red `#f85149` | Fatal errors, crashes, or unrecoverable failures |

---

## Log Parsing Engine

### Classification Heuristics

Lines are classified by matching against ordered regex patterns. The first match wins.

**Error** — matches any of:
```
\berror\b | \bexception\b | \bfatal\b | \bfailed\b | \bfailure\b
| ENOENT | ECONNREFUSED | ERESOLVE | non-zero | returned a non-zero code
```

**Warning** — matches any of:
```
\bwarn\b | \bwarning\b | \bdeprecated\b | \bretry\b | vulnerability
```

**OK/Success** — matches any of:
```
\bsuccess\b | \bsuccessfully\b | \bstarted\b | \blistening\b
| \b200\b | \b201\b | \b304\b | \bcreated\b | Step \d+\/\d+
```

**INFO** — default fallback when no other pattern matches.

### Timestamp Extraction (Raw Paste)

Timestamps are extracted using the following regex:

```
/\[?(\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/
```

If a full datetime is matched, only the last 8 characters (the time portion) are retained for display. If no match is found, the timestamp is set to `--:--:--`.

---

## Data Models

### LogLine

```typescript
interface LogLine {
  ts: string;    // HH:MM:SS or "--:--:--"
  lvl: 'info' | 'warn' | 'error' | 'ok';
  msg: string;   // Raw message text, HTML-escaped before render
}
```

### AnalysisResult

```typescript
interface AnalysisResult {
  summary: string;
  health: 'healthy' | 'degraded' | 'critical';
  errors: Array<{
    title: string;
    detail: string;
  }>;
  fixes: Array<{
    description: string;
    command: string;   // Empty string if no command applicable
  }>;
  insight: string;
}
```

### Session State (In-Memory)

```typescript
let logLines: LogLine[] = [];   // Mutable, module-level
```

No serialization, no localStorage. State is lost on page refresh.

---

## API Reference

### Anthropic Messages Endpoint

**Endpoint:** `POST https://api.anthropic.com/v1/messages`

**Request body:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1000,
  "messages": [
    {
      "role": "user",
      "content": "<prompt string>"
    }
  ]
}
```

**Headers:**
- `Content-Type: application/json`
- Authentication is handled by the host environment (no API key in client code)

**Response shape (relevant fields):**

```json
{
  "content": [
    { "type": "text", "text": "{ ... JSON string ... }" }
  ]
}
```

**Error cases handled:**

| HTTP Status | Handling |
|---|---|
| 200 with malformed JSON | Caught by `JSON.parse`, renders error in AI panel |
| Network failure | Caught by `fetch` rejection, renders error message |
| 4xx / 5xx | `data.content` undefined, caught by map, renders error |

---

## Error Handling

### Empty Session Guard

If `analyzeWithAI()` is called with `logLines.length === 0`, execution halts with a native browser `alert()`. No API call is made.

### JSON Parse Failure

If the model returns a response that cannot be parsed as JSON (e.g., due to a formatting error or unexpected content), the catch block renders the raw error string in the AI panel with red styling. The button returns to its active state.

### HTML Injection Prevention

All user-supplied and model-supplied text is passed through `escHtml()` before insertion into the DOM via `innerHTML`. This function escapes `&`, `<`, and `>`.

```javascript
function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

---

## Performance Requirements

| Metric | Target |
|---|---|
| Time to first render | < 100ms |
| Log line parse throughput | ≥ 1,000 lines/sec |
| UI re-render after capture | < 16ms (one frame) |
| API call round-trip (P50) | < 3 seconds |
| API call round-trip (P95) | < 8 seconds |
| Max session size (stable) | 2,000 log lines |
| Max session size (degraded) | 5,000 log lines (scroll lag expected) |

### Known Bottlenecks

- `renderTerminal()` calls `body.innerHTML = ...` for the full log on every update. For sessions exceeding 1,000 lines, this is a linear-time DOM replacement. A future optimization is incremental append for new lines only.
- The AI prompt grows proportionally with session size. Sessions exceeding ~500 lines may approach the `max_tokens` input limit of the prompt construction and should be truncated or summarized before sending.

---

## Security Considerations

### XSS Prevention

All dynamic content rendered via `innerHTML` passes through `escHtml()`. No user input is evaluated as code. No `eval()`, `Function()`, or dynamic script injection is used.

### Sensitive Log Data

Users should be advised not to paste logs containing secrets, tokens, credentials, or PII into this tool, as log content is transmitted to the Anthropic API for analysis. A data notice should be displayed prominently in the UI in future versions.

### API Key Handling

The Anthropic API key is never present in client-side JavaScript. It is injected by the host environment (Anthropic's artifact sandbox) at the proxy layer. Deployments outside this sandbox must implement their own secure key injection strategy — for example, a server-side proxy endpoint.

### Content Security Policy

External resources are loaded only from `cdnjs.cloudflare.com`. No third-party analytics, tracking, or telemetry scripts are included. No cookies are set. No localStorage or sessionStorage is used.

---

## Accessibility

| Requirement | Status |
|---|---|
| Keyboard navigation for all interactive elements | Supported |
| Enter key submits CLI input | Implemented |
| ARIA roles on dynamic panels | Partial (v1) |
| Screen reader-friendly level badges | Text labels used (not icon-only) |
| Color not the sole indicator of severity | Text label + color used together |
| Focus ring on all interactive elements | Browser default |
| Minimum font size | 10px (timestamp labels); 12px body |

**Known accessibility gaps (v1):**
- AI analysis panel updates are not announced via `aria-live` regions
- Preset buttons lack descriptive `aria-label` attributes
- The terminal body is a scroll container without `role="log"`

These will be addressed in v1.1.

---

## Future Roadmap

### v1.1 — File Upload & Export

- Drag-and-drop `.log` file upload with client-side parsing
- Export current session as `.log` or `.md` report
- Export AI analysis as a shareable markdown document

### v1.2 — Session History

- Persist up to 10 recent sessions in `localStorage`
- Session browser with timestamp and error count preview
- Diff view between two sessions

### v1.3 — Streaming Analysis

- Stream AI analysis token-by-token using the Anthropic streaming API
- Show partial results as they arrive rather than waiting for completion

### v1.4 — Live Process Integration (Electron / CLI)

- `ai-cli-log capture -- <command>` shell wrapper that runs a command and pipes output to the analyzer
- WebSocket-based live streaming from a local CLI shim to the browser UI
- Support for PTY (pseudoterminal) to capture interactive sessions

### v2.0 — Team Features

- Session sharing via permalink (encrypted, expiring)
- Shared workspace for team log triage
- Custom classification rules per organization

---

## Glossary

| Term | Definition |
|---|---|
| LogLine | A single parsed line of terminal output with an associated timestamp, severity level, and message |
| Severity Level | A categorical classification of a log line: INFO, WARN, ERROR, or OK |
| Session | The in-memory collection of all LogLine entries captured or pasted during the current browser session |
| AI Analysis | The structured output returned by the Claude API after analyzing the current session |
| Session Health | A high-level status (healthy / degraded / critical) assigned by the AI model based on overall log content |
| PTY | Pseudoterminal — a kernel-level interface that emulates a physical terminal, used to capture interactive shell sessions |
| Triage | The process of identifying, prioritizing, and addressing errors in a log stream |
| Preset | A pre-loaded set of realistic log lines representing a common developer scenario |
| DXA | Document Exchange Attribute — the unit system used in OOXML documents (1440 DXA = 1 inch) |

---

*This specification is versioned alongside the codebase. For proposed changes, open a discussion with the section reference and a description of the delta.*
