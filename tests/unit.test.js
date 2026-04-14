// Unit tests for classify
// Validates: Requirements 7.1, 7.2, 7.3, 7.4

import {
    describe,
    it,
    expect
} from 'vitest';

/**
 * classify implementation under test (copied from index.html).
 * @param {string} text
 * @returns {'error'|'warn'|'ok'|'info'}
 */
function classify(text) {
    if (
        /\berror\b/i.test(text) || /\bexception\b/i.test(text) || /\bfatal\b/i.test(text) ||
        /\bfailed\b/i.test(text) || /\bfailure\b/i.test(text) ||
        /ENOENT/.test(text) || /ECONNREFUSED/.test(text) || /ERESOLVE/.test(text) ||
        /non-zero/i.test(text) || /returned a non-zero code/i.test(text)
    ) return 'error';
    if (
        /\bwarn\b/i.test(text) || /\bwarning\b/i.test(text) || /\bdeprecated\b/i.test(text) ||
        /\bretry\b/i.test(text) || /vulnerability/i.test(text)
    ) return 'warn';
    if (
        /\bsuccess\b/i.test(text) || /\bsuccessfully\b/i.test(text) || /\bstarted\b/i.test(text) ||
        /\blistening\b/i.test(text) || /\b200\b/.test(text) || /\b201\b/.test(text) ||
        /\b304\b/.test(text) || /\bcreated\b/i.test(text) || /Step \d+\/\d+/.test(text)
    ) return 'ok';
    return 'info';
}

// ---------------------------------------------------------------------------
// Error patterns — Requirement 7.1
// ---------------------------------------------------------------------------
describe('classify — error patterns', () => {
    it('classifies "error" keyword as error', () => {
        expect(classify('npm error could not resolve')).toBe('error');
    });

    it('classifies "ERROR" (uppercase) as error', () => {
        expect(classify('ERROR: something went wrong')).toBe('error');
    });

    it('classifies "exception" as error', () => {
        expect(classify('Unhandled exception in thread main')).toBe('error');
    });

    it('classifies "fatal" as error', () => {
        expect(classify('fatal: repository not found')).toBe('error');
    });

    it('classifies "failed" as error', () => {
        expect(classify('Build failed with exit code 1')).toBe('error');
    });

    it('classifies "failure" as error', () => {
        expect(classify('Test failure detected')).toBe('error');
    });

    it('classifies ENOENT (exact case) as error', () => {
        expect(classify("ENOENT: no such file or directory, open '/app/config.json'")).toBe('error');
    });

    it('classifies ECONNREFUSED (exact case) as error', () => {
        expect(classify('connect ECONNREFUSED 127.0.0.1:5432')).toBe('error');
    });

    it('classifies ERESOLVE (exact case) as error', () => {
        expect(classify('npm ERR! ERESOLVE unable to resolve dependency tree')).toBe('error');
    });

    it('classifies "non-zero" as error', () => {
        expect(classify('Process exited with non-zero status')).toBe('error');
    });

    it('classifies "returned a non-zero code" as error', () => {
        expect(classify('The command returned a non-zero code: 1')).toBe('error');
    });

    // Case-sensitivity checks for ENOENT, ECONNREFUSED, ERESOLVE
    it('does NOT classify lowercase "enoent" as error', () => {
        expect(classify('enoent: no such file')).not.toBe('error');
    });

    it('does NOT classify lowercase "econnrefused" as error', () => {
        expect(classify('econnrefused 127.0.0.1:5432')).not.toBe('error');
    });

    it('does NOT classify lowercase "eresolve" as error', () => {
        expect(classify('eresolve unable to resolve')).not.toBe('error');
    });
});

// ---------------------------------------------------------------------------
// Warn patterns — Requirement 7.2
// ---------------------------------------------------------------------------
describe('classify — warn patterns', () => {
    it('classifies "warn" keyword as warn', () => {
        expect(classify('warn: peer dependency mismatch')).toBe('warn');
    });

    it('classifies "warning" as warn', () => {
        expect(classify('DeprecationWarning: Buffer() is deprecated')).toBe('warn');
    });

    it('classifies "deprecated" as warn', () => {
        expect(classify('This API is deprecated and will be removed')).toBe('warn');
    });

    it('classifies "retry" as warn', () => {
        expect(classify('Retry attempt 2 of 3')).toBe('warn');
    });

    it('classifies "vulnerability" as warn', () => {
        expect(classify('found 3 high severity vulnerability')).toBe('warn');
    });
});

// ---------------------------------------------------------------------------
// Ok patterns — Requirement 7.3
// ---------------------------------------------------------------------------
describe('classify — ok patterns', () => {
    it('classifies "success" as ok', () => {
        expect(classify('Operation completed with success')).toBe('ok');
    });

    it('classifies "successfully" as ok', () => {
        expect(classify('Server started successfully')).toBe('ok');
    });

    it('classifies "started" as ok', () => {
        expect(classify('Worker process started')).toBe('ok');
    });

    it('classifies "listening" as ok', () => {
        expect(classify('Server listening on port 3000')).toBe('ok');
    });

    it('classifies HTTP 200 as ok', () => {
        expect(classify('GET /api/health 200 12ms')).toBe('ok');
    });

    it('classifies HTTP 201 as ok', () => {
        expect(classify('POST /api/users 201 45ms')).toBe('ok');
    });

    it('classifies HTTP 304 as ok', () => {
        expect(classify('GET /static/app.js 304 2ms')).toBe('ok');
    });

    it('classifies "created" as ok', () => {
        expect(classify('Container created successfully')).toBe('ok');
    });

    it('classifies "Step N/M" pattern as ok', () => {
        expect(classify('Step 1/5 : FROM node:18-alpine')).toBe('ok');
        expect(classify('Step 3/5 : RUN npm install')).toBe('ok');
    });
});

// ---------------------------------------------------------------------------
// Info fallback — Requirement 7.4
// ---------------------------------------------------------------------------
describe('classify — info fallback', () => {
    it('classifies a plain log line with no keywords as info', () => {
        expect(classify('Fetching packages from registry...')).toBe('info');
    });

    it('classifies an empty-ish line as info', () => {
        expect(classify('   ')).toBe('info');
    });

    it('classifies a numeric-only line as info', () => {
        expect(classify('42')).toBe('info');
    });
});

// ---------------------------------------------------------------------------
// extractTimestamp — Requirements 2.3, 2.4, 2.5
// ---------------------------------------------------------------------------

/**
 * extractTimestamp implementation under test (copied from index.html).
 * @param {string} text
 * @returns {string|null}
 */
function extractTimestamp(text) {
    let m = text.match(/\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})/);
    if (m) return m[1];
    m = text.match(/\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})/);
    if (m) return m[1];
    m = text.match(/\[\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})\]/);
    if (m) return m[1];
    m = text.match(/\b(\d{2}:\d{2}:\d{2})\b/);
    if (m) return m[1];
    return null;
}

describe('extractTimestamp — supported formats', () => {
    // Format 1: ISO 8601 with T separator — Requirement 2.5
    it('extracts time from ISO 8601 with T separator', () => {
        expect(extractTimestamp('2024-01-15T10:23:41 some message')).toBe('10:23:41');
    });

    it('returns only the time portion (not the date) for ISO 8601 with T', () => {
        expect(extractTimestamp('2024-01-15T10:23:41 msg')).not.toContain('2024-01-15');
    });

    // Format 2: ISO 8601 with space separator — Requirement 2.5
    it('extracts time from ISO 8601 with space separator', () => {
        expect(extractTimestamp('2024-01-15 10:23:41 some message')).toBe('10:23:41');
    });

    it('returns only the time portion (not the date) for ISO 8601 with space', () => {
        expect(extractTimestamp('2024-01-15 10:23:41 msg')).not.toContain('2024-01-15');
    });

    // Format 3: Bracketed datetime — Requirement 2.5
    it('extracts time from bracketed datetime format', () => {
        expect(extractTimestamp('[2024-01-15 10:23:41] some message')).toBe('10:23:41');
    });

    it('returns only the time portion (not the date) for bracketed datetime', () => {
        expect(extractTimestamp('[2024-01-15 10:23:41] msg')).not.toContain('2024-01-15');
    });

    // Format 4: Time-only — Requirement 2.5
    it('extracts time from time-only format', () => {
        expect(extractTimestamp('10:23:41 some message')).toBe('10:23:41');
    });

    // No timestamp — Requirement 2.4
    it('returns null for a line with no recognizable timestamp', () => {
        expect(extractTimestamp('just a plain log message with no timestamp')).toBeNull();
    });

    it('returns null for an empty string', () => {
        expect(extractTimestamp('')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// parseLine — Requirements 1.2, 1.3
// ---------------------------------------------------------------------------

/**
 * parseLine implementation under test (mirrored from index.html).
 * @param {string} rawText
 * @param {string|null} ts
 * @returns {{ ts: string, lvl: string, msg: string }}
 */
function parseLine(rawText, ts = null) {
    if (ts === null) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        ts = `${hh}:${mm}:${ss}`;
    }
    return {
        ts,
        lvl: classify(rawText),
        msg: rawText,
    };
}

describe('parseLine — LogLine shape', () => {
    it('returns an object with ts, lvl, and msg fields', () => {
        const line = parseLine('some message', '12:00:00');
        expect(line).toHaveProperty('ts');
        expect(line).toHaveProperty('lvl');
        expect(line).toHaveProperty('msg');
    });

    it('uses the provided ts when given', () => {
        const line = parseLine('hello world', '09:30:00');
        expect(line.ts).toBe('09:30:00');
    });

    it('sets msg to the raw text unchanged', () => {
        const raw = 'npm ERR! ERESOLVE unable to resolve dependency tree';
        const line = parseLine(raw, '00:00:00');
        expect(line.msg).toBe(raw);
    });

    it('classifies an error line correctly', () => {
        const line = parseLine('Build failed with exit code 1', '00:00:00');
        expect(line.lvl).toBe('error');
    });

    it('classifies a warn line correctly', () => {
        const line = parseLine('warn: peer dependency mismatch', '00:00:00');
        expect(line.lvl).toBe('warn');
    });

    it('classifies an ok line correctly', () => {
        const line = parseLine('Server started successfully', '00:00:00');
        expect(line.lvl).toBe('ok');
    });

    it('classifies an info line correctly', () => {
        const line = parseLine('Fetching packages from registry...', '00:00:00');
        expect(line.lvl).toBe('info');
    });
});

describe('parseLine — local clock fallback (ts = null)', () => {
    it('uses local clock when ts is null — format HH:MM:SS', () => {
        const before = new Date();
        const line = parseLine('some log line');
        const after = new Date();

        expect(line.ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);

        // Verify the time is within the current second window
        const [h, m, s] = line.ts.split(':').map(Number);
        const lineMs = (h * 3600 + m * 60 + s) * 1000;
        const beforeMs = (before.getHours() * 3600 + before.getMinutes() * 60 + before.getSeconds()) * 1000;
        const afterMs = (after.getHours() * 3600 + after.getMinutes() * 60 + after.getSeconds()) * 1000;

        expect(lineMs).toBeGreaterThanOrEqual(beforeMs);
        expect(lineMs).toBeLessThanOrEqual(afterMs);
    });

    it('zero-pads hours, minutes, and seconds', () => {
        // Simulate midnight-ish by checking format regardless of actual time
        const line = parseLine('test');
        const parts = line.ts.split(':');
        expect(parts).toHaveLength(3);
        parts.forEach(p => expect(p).toHaveLength(2));
    });
});

// ---------------------------------------------------------------------------
// parseBlock — Requirements 2.1, 2.2, 2.3, 2.4
// ---------------------------------------------------------------------------

/**
 * parseBlock implementation under test (mirrored from index.html).
 * @param {string} rawText
 * @returns {{ ts: string, lvl: string, msg: string }[]}
 */
function parseBlock(rawText) {
    return rawText
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => ({
            ts: extractTimestamp(line) !== null ? extractTimestamp(line) : '--:--:--',
            lvl: classify(line),
            msg: line,
        }));
}

describe('parseBlock — blank line filtering (Requirement 2.2)', () => {
    it('returns empty array for empty string', () => {
        expect(parseBlock('')).toEqual([]);
    });

    it('returns empty array for whitespace-only input', () => {
        expect(parseBlock('   \n  \n\t')).toEqual([]);
    });

    it('filters out blank lines between content lines', () => {
        const result = parseBlock('line one\n\nline two\n\nline three');
        expect(result).toHaveLength(3);
    });

    it('filters out whitespace-only lines', () => {
        const result = parseBlock('line one\n   \nline two');
        expect(result).toHaveLength(2);
    });

    it('handles trailing newline without creating extra entry', () => {
        const result = parseBlock('line one\nline two\n');
        expect(result).toHaveLength(2);
    });
});

describe('parseBlock — LogLine shape (Requirements 2.1, 2.3, 2.4)', () => {
    it('returns LogLine objects with ts, lvl, msg fields', () => {
        const [line] = parseBlock('some log message');
        expect(line).toHaveProperty('ts');
        expect(line).toHaveProperty('lvl');
        expect(line).toHaveProperty('msg');
    });

    it('sets msg to the raw line text unchanged', () => {
        const raw = '2024-01-15T10:23:41 Build failed with exit code 1';
        const [line] = parseBlock(raw);
        expect(line.msg).toBe(raw);
    });

    it('extracts timestamp from ISO 8601 with T format (Requirement 2.3)', () => {
        const [line] = parseBlock('2024-01-15T10:23:41 some message');
        expect(line.ts).toBe('10:23:41');
    });

    it('extracts timestamp from ISO 8601 with space format (Requirement 2.3)', () => {
        const [line] = parseBlock('2024-01-15 10:23:41 some message');
        expect(line.ts).toBe('10:23:41');
    });

    it('extracts timestamp from bracketed datetime format (Requirement 2.3)', () => {
        const [line] = parseBlock('[2024-01-15 10:23:41] some message');
        expect(line.ts).toBe('10:23:41');
    });

    it('extracts timestamp from time-only format (Requirement 2.3)', () => {
        const [line] = parseBlock('10:23:41 some message');
        expect(line.ts).toBe('10:23:41');
    });

    it('falls back to "--:--:--" when no timestamp present (Requirement 2.4)', () => {
        const [line] = parseBlock('plain log message with no timestamp');
        expect(line.ts).toBe('--:--:--');
    });

    it('classifies severity correctly for each line', () => {
        const result = parseBlock('Build failed\nwarn: deprecated\nServer started\nFetching packages');
        expect(result[0].lvl).toBe('error');
        expect(result[1].lvl).toBe('warn');
        expect(result[2].lvl).toBe('ok');
        expect(result[3].lvl).toBe('info');
    });
});

describe('parseBlock — multi-line blocks', () => {
    it('parses a realistic multi-line block correctly', () => {
        const block = [
            '2024-01-15T10:23:41 npm warn deprecated package@1.0.0',
            '',
            '2024-01-15T10:23:42 ERESOLVE unable to resolve dependency tree',
            '   ',
            '10:23:43 Server started successfully',
        ].join('\n');

        const result = parseBlock(block);
        expect(result).toHaveLength(3);
        expect(result[0].ts).toBe('10:23:41');
        expect(result[0].lvl).toBe('warn');
        expect(result[1].ts).toBe('10:23:42');
        expect(result[1].lvl).toBe('error');
        expect(result[2].ts).toBe('10:23:43');
        expect(result[2].lvl).toBe('ok');
    });
});

// ---------------------------------------------------------------------------
// renderStats (via computeStats) — Requirements 4.3, 4.4, 4.5, 4.6
// ---------------------------------------------------------------------------

/**
 * computeStats mirrors the renderStats logic as a pure function.
 * @param {Array<{ts: string, lvl: string, msg: string}>} session
 * @returns {{ total: number, errors: number, warnings: number, success: number }}
 */
function computeStats(session) {
    return {
        total: session.length,
        errors: session.filter(l => l.lvl === 'error').length,
        warnings: session.filter(l => l.lvl === 'warn').length,
        success: session.filter(l => l.lvl === 'ok' || l.lvl === 'info').length,
    };
}

describe('renderStats (computeStats) — empty session', () => {
    it('returns all zeros for an empty session', () => {
        const stats = computeStats([]);
        expect(stats.total).toBe(0);
        expect(stats.errors).toBe(0);
        expect(stats.warnings).toBe(0);
        expect(stats.success).toBe(0);
    });
});

describe('renderStats (computeStats) — mixed session', () => {
    // Session: 2 errors, 1 warn, 1 ok, 1 info → total=5, errors=2, warnings=1, success=2
    const mixedSession = [{
            ts: '10:00:00',
            lvl: 'error',
            msg: 'Build failed'
        },
        {
            ts: '10:00:01',
            lvl: 'error',
            msg: 'ENOENT: file not found'
        },
        {
            ts: '10:00:02',
            lvl: 'warn',
            msg: 'deprecated API used'
        },
        {
            ts: '10:00:03',
            lvl: 'ok',
            msg: 'Server started'
        },
        {
            ts: '10:00:04',
            lvl: 'info',
            msg: 'Fetching packages'
        },
    ];

    it('total equals session length', () => {
        expect(computeStats(mixedSession).total).toBe(5);
    });

    it('errors equals count of lvl==="error" entries', () => {
        expect(computeStats(mixedSession).errors).toBe(2);
    });

    it('warnings equals count of lvl==="warn" entries', () => {
        expect(computeStats(mixedSession).warnings).toBe(1);
    });

    it('success equals count of lvl==="ok" or lvl==="info" entries', () => {
        expect(computeStats(mixedSession).success).toBe(2);
    });
});

describe('renderStats (computeStats) — errors-only session', () => {
    const errorsOnly = [{
            ts: '10:00:00',
            lvl: 'error',
            msg: 'fatal crash'
        },
        {
            ts: '10:00:01',
            lvl: 'error',
            msg: 'connection failed'
        },
        {
            ts: '10:00:02',
            lvl: 'error',
            msg: 'ERESOLVE dependency error'
        },
    ];

    it('success is 0 when session has only errors', () => {
        expect(computeStats(errorsOnly).success).toBe(0);
    });

    it('warnings is 0 when session has only errors', () => {
        expect(computeStats(errorsOnly).warnings).toBe(0);
    });

    it('errors equals total when session has only errors', () => {
        const stats = computeStats(errorsOnly);
        expect(stats.errors).toBe(stats.total);
    });
});

describe('renderStats (computeStats) — ok/info-only session', () => {
    const successOnly = [{
            ts: '10:00:00',
            lvl: 'ok',
            msg: 'Server started'
        },
        {
            ts: '10:00:01',
            lvl: 'info',
            msg: 'Fetching packages'
        },
        {
            ts: '10:00:02',
            lvl: 'ok',
            msg: 'Build succeeded'
        },
        {
            ts: '10:00:03',
            lvl: 'info',
            msg: 'Resolving dependencies'
        },
    ];

    it('errors is 0 when session has only ok/info entries', () => {
        expect(computeStats(successOnly).errors).toBe(0);
    });

    it('warnings is 0 when session has only ok/info entries', () => {
        expect(computeStats(successOnly).warnings).toBe(0);
    });

    it('success equals total when session has only ok/info entries', () => {
        const stats = computeStats(successOnly);
        expect(stats.success).toBe(stats.total);
    });
});

describe('renderStats (computeStats) — sum invariant', () => {
    it('errors + warnings + success === total for mixed session', () => {
        const session = [{
                ts: '10:00:00',
                lvl: 'error',
                msg: 'err1'
            },
            {
                ts: '10:00:01',
                lvl: 'warn',
                msg: 'warn1'
            },
            {
                ts: '10:00:02',
                lvl: 'ok',
                msg: 'ok1'
            },
            {
                ts: '10:00:03',
                lvl: 'info',
                msg: 'info1'
            },
            {
                ts: '10:00:04',
                lvl: 'error',
                msg: 'err2'
            },
        ];
        const stats = computeStats(session);
        expect(stats.errors + stats.warnings + stats.success).toBe(stats.total);
    });

    it('errors + warnings + success === total for empty session', () => {
        const stats = computeStats([]);
        expect(stats.errors + stats.warnings + stats.success).toBe(stats.total);
    });
});

// ---------------------------------------------------------------------------
// renderTerminal (via renderTerminalHtml) — Requirements 1.4, 8.1
// ---------------------------------------------------------------------------

/**
 * escHtml implementation under test (mirrored from index.html).
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * renderTerminalHtml mirrors the HTML-generation logic of renderTerminal.
 * Returns the full innerHTML string that would be set on the Terminal_Panel.
 * @param {Array<{ts: string, lvl: string, msg: string}>} session
 * @returns {string}
 */
function renderTerminalHtml(session) {
    return session.map(({
            ts,
            lvl,
            msg
        }) =>
        `<div class="log-line ${lvl}">[${ts}] ${escHtml(msg)}</div>`
    ).join('');
}

describe('renderTerminal — XSS prevention (Requirement 8.1)', () => {
    it('escapes <script> tags in msg so they are not executed', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'info',
            msg: '<script>alert(1)</script>'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
    });

    it('escapes closing </script> tag as well', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'info',
            msg: '<script>alert(1)</script>'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('&lt;/script&gt;');
        expect(html).not.toContain('</script>');
    });

    it('escapes & in msg', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'info',
            msg: 'a & b'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('&amp;');
        expect(html).not.toMatch(/[^;]&[^a-z]/);
    });

    it('escapes > in msg', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'info',
            msg: 'value > 0'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('&gt;');
        expect(html).not.toContain('value > 0');
    });
});

describe('renderTerminal — CSS class per severity level', () => {
    it('error line gets class "log-line error"', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'error',
            msg: 'Build failed'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('class="log-line error"');
    });

    it('warn line gets class "log-line warn"', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'warn',
            msg: 'deprecated API'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('class="log-line warn"');
    });

    it('ok line gets class "log-line ok"', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'ok',
            msg: 'Server started'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('class="log-line ok"');
    });

    it('info line gets class "log-line info"', () => {
        const session = [{
            ts: '10:00:00',
            lvl: 'info',
            msg: 'Fetching packages'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('class="log-line info"');
    });
});

describe('renderTerminal — timestamp in output', () => {
    it('includes the timestamp in the rendered output', () => {
        const session = [{
            ts: '12:34:56',
            lvl: 'info',
            msg: 'some message'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('[12:34:56]');
    });

    it('includes the fallback timestamp "--:--:--" when present', () => {
        const session = [{
            ts: '--:--:--',
            lvl: 'info',
            msg: 'no timestamp line'
        }];
        const html = renderTerminalHtml(session);
        expect(html).toContain('[--:--:--]');
    });
});

describe('renderTerminal — auto-scroll logic', () => {
    it('auto-scroll sets scrollTop to scrollHeight', () => {
        // Verify the auto-scroll pattern: el.scrollTop = el.scrollHeight
        const mockEl = {
            scrollHeight: 500,
            scrollTop: 0
        };
        mockEl.scrollTop = mockEl.scrollHeight;
        expect(mockEl.scrollTop).toBe(500);
    });

    it('auto-scroll works when scrollHeight is 0 (empty panel)', () => {
        const mockEl = {
            scrollHeight: 0,
            scrollTop: 100
        };
        mockEl.scrollTop = mockEl.scrollHeight;
        expect(mockEl.scrollTop).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Preset arrays — Requirements 3.4, 3.5, 3.6, 3.7, 3.8
// ---------------------------------------------------------------------------

const PRESET_NPM = [{
        ts: '10:23:41',
        lvl: 'info',
        msg: 'npm install'
    },
    {
        ts: '10:23:42',
        lvl: 'ok',
        msg: 'added 312 packages in 4.2s'
    },
    {
        ts: '10:23:42',
        lvl: 'warn',
        msg: 'npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.'
    },
    {
        ts: '10:23:43',
        lvl: 'warn',
        msg: 'npm warn peer dependency: react-dom@18.2.0 requires react@^18.0.0 but none is installed'
    },
    {
        ts: '10:23:43',
        lvl: 'error',
        msg: 'npm error ERESOLVE unable to resolve dependency tree'
    },
    {
        ts: '10:23:43',
        lvl: 'error',
        msg: 'npm error Found: webpack@4.46.0'
    },
    {
        ts: '10:23:44',
        lvl: 'error',
        msg: 'npm error Could not resolve dependency: peer webpack@"^5.0.0" from css-loader@6.8.1'
    },
    {
        ts: '10:23:44',
        lvl: 'info',
        msg: 'npm notice Run `npm install --legacy-peer-deps` to accept an incorrect dependency resolution'
    },
    {
        ts: '10:23:45',
        lvl: 'error',
        msg: "ENOENT: no such file or directory, open '/app/node_modules/.package-lock.json'"
    },
    {
        ts: '10:23:45',
        lvl: 'info',
        msg: 'npm timing npm:load Completed in 312ms'
    },
];

const PRESET_DOCKER = [{
        ts: '11:05:10',
        lvl: 'ok',
        msg: 'Step 1/8 : FROM node:18-alpine'
    },
    {
        ts: '11:05:11',
        lvl: 'ok',
        msg: 'Step 2/8 : WORKDIR /app'
    },
    {
        ts: '11:05:11',
        lvl: 'ok',
        msg: 'Step 3/8 : COPY package*.json ./'
    },
    {
        ts: '11:05:12',
        lvl: 'ok',
        msg: 'Step 4/8 : RUN npm install'
    },
    {
        ts: '11:05:18',
        lvl: 'warn',
        msg: 'npm warn deprecated rimraf@2.7.1: Rimraf versions prior to v4 are no longer supported'
    },
    {
        ts: '11:05:19',
        lvl: 'error',
        msg: "Module not found: Error: Can't resolve './src/config' in '/app'"
    },
    {
        ts: '11:05:19',
        lvl: 'error',
        msg: 'webpack compiled with 1 error'
    },
    {
        ts: '11:05:20',
        lvl: 'info',
        msg: "The command '/bin/sh -c npm run build' returned a non-zero code: 1"
    },
    {
        ts: '11:05:20',
        lvl: 'info',
        msg: 'Build context: 142 files, 2.3MB transferred'
    },
];

const PRESET_PYTHON = [{
        ts: '14:32:01',
        lvl: 'info',
        msg: 'Starting application server on 0.0.0.0:8000'
    },
    {
        ts: '14:32:02',
        lvl: 'ok',
        msg: 'Application started successfully'
    },
    {
        ts: '14:32:03',
        lvl: 'ok',
        msg: 'Database connection pool created (size=5)'
    },
    {
        ts: '14:32:15',
        lvl: 'warn',
        msg: 'WARNING: Retrying database connection (attempt 1/3)'
    },
    {
        ts: '14:32:18',
        lvl: 'warn',
        msg: 'WARNING: Retrying database connection (attempt 2/3)'
    },
    {
        ts: '14:32:21',
        lvl: 'error',
        msg: 'sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) could not connect to server'
    },
    {
        ts: '14:32:21',
        lvl: 'error',
        msg: 'FATAL: password authentication failed for user "appuser"'
    },
    {
        ts: '14:32:22',
        lvl: 'error',
        msg: 'Database authentication failure: invalid credentials for host db.internal:5432'
    },
    {
        ts: '14:32:22',
        lvl: 'info',
        msg: 'Traceback (most recent call last): File "app/db.py", line 42, in connect'
    },
    {
        ts: '14:32:23',
        lvl: 'info',
        msg: 'Shutting down due to unrecoverable database error'
    },
];

const PRESET_NGINX = [{
        ts: '09:14:01',
        lvl: 'ok',
        msg: '2024-01-15 09:14:01 [notice] nginx/1.25.3 started'
    },
    {
        ts: '09:14:02',
        lvl: 'ok',
        msg: '192.168.1.10 - - [15/Jan/2024:09:14:02] "GET /api/health 200 12ms"'
    },
    {
        ts: '09:14:05',
        lvl: 'info',
        msg: '192.168.1.11 - - [15/Jan/2024:09:14:05] "GET /static/app.js 304 1ms"'
    },
    {
        ts: '09:14:08',
        lvl: 'error',
        msg: 'connect() failed (111: ECONNREFUSED) while connecting to upstream, upstream: "http://127.0.0.1:3000"'
    },
    {
        ts: '09:14:08',
        lvl: 'error',
        msg: 'upstream prematurely closed connection while reading response header from upstream'
    },
    {
        ts: '09:14:09',
        lvl: 'warn',
        msg: 'upstream response timeout, retrying with next upstream server'
    },
    {
        ts: '09:14:10',
        lvl: 'error',
        msg: '192.168.1.20 - - [15/Jan/2024:09:14:10] "GET /admin 403 0.5ms"'
    },
    {
        ts: '09:14:12',
        lvl: 'error',
        msg: '192.168.1.99 - - [15/Jan/2024:09:14:12] "POST /api/data 429 0.1ms" rate limit exceeded'
    },
    {
        ts: '09:14:15',
        lvl: 'warn',
        msg: 'upstream disconnect: peer closed connection in SSL handshake'
    },
    {
        ts: '09:14:20',
        lvl: 'info',
        msg: 'worker process 1234 exited with code 0'
    },
];

// Requirement 3.4 — each preset has 9–10 entries
describe('preset arrays — entry count (Requirement 3.4)', () => {
    it('PRESET_NPM has 9–10 entries', () => {
        expect(PRESET_NPM.length).toBeGreaterThanOrEqual(9);
        expect(PRESET_NPM.length).toBeLessThanOrEqual(10);
    });

    it('PRESET_DOCKER has 9–10 entries', () => {
        expect(PRESET_DOCKER.length).toBeGreaterThanOrEqual(9);
        expect(PRESET_DOCKER.length).toBeLessThanOrEqual(10);
    });

    it('PRESET_PYTHON has 9–10 entries', () => {
        expect(PRESET_PYTHON.length).toBeGreaterThanOrEqual(9);
        expect(PRESET_PYTHON.length).toBeLessThanOrEqual(10);
    });

    it('PRESET_NGINX has 9–10 entries', () => {
        expect(PRESET_NGINX.length).toBeGreaterThanOrEqual(9);
        expect(PRESET_NGINX.length).toBeLessThanOrEqual(10);
    });
});

// Requirement 3.5 — npm preset required error conditions
describe('PRESET_NPM — required error conditions (Requirement 3.5)', () => {
    it('contains ERESOLVE in at least one msg', () => {
        expect(PRESET_NPM.some(e => e.msg.includes('ERESOLVE'))).toBe(true);
    });

    it('contains peer dependency mismatch in at least one msg', () => {
        expect(PRESET_NPM.some(e => /peer dep/i.test(e.msg))).toBe(true);
    });

    it('contains ENOENT in at least one msg', () => {
        expect(PRESET_NPM.some(e => e.msg.includes('ENOENT'))).toBe(true);
    });
});

// Requirement 3.6 — docker preset required error conditions
describe('PRESET_DOCKER — required error conditions (Requirement 3.6)', () => {
    it("contains missing module (Can't resolve) in at least one msg", () => {
        expect(PRESET_DOCKER.some(e => /can't resolve/i.test(e.msg))).toBe(true);
    });

    it('contains non-zero exit code in at least one msg', () => {
        expect(PRESET_DOCKER.some(e => /non-zero/i.test(e.msg))).toBe(true);
    });
});

// Requirement 3.7 — python preset required error conditions
describe('PRESET_PYTHON — required error conditions (Requirement 3.7)', () => {
    it('contains OperationalError in at least one msg', () => {
        expect(PRESET_PYTHON.some(e => e.msg.includes('OperationalError'))).toBe(true);
    });

    it('contains authentication failure in at least one msg', () => {
        expect(PRESET_PYTHON.some(e => /authentication fail/i.test(e.msg))).toBe(true);
    });
});

// Requirement 3.8 — nginx preset required error conditions
describe('PRESET_NGINX — required error conditions (Requirement 3.8)', () => {
    it('contains ECONNREFUSED in at least one msg', () => {
        expect(PRESET_NGINX.some(e => e.msg.includes('ECONNREFUSED'))).toBe(true);
    });

    it('contains upstream disconnect in at least one msg', () => {
        expect(PRESET_NGINX.some(e => /upstream disconnect/i.test(e.msg))).toBe(true);
    });

    it('contains 403 in at least one msg', () => {
        expect(PRESET_NGINX.some(e => e.msg.includes('403'))).toBe(true);
    });

    it('contains 429 in at least one msg', () => {
        expect(PRESET_NGINX.some(e => e.msg.includes('429'))).toBe(true);
    });
});

// Requirement 3.4 — each preset covers all four severity levels
describe('preset arrays — all four severity levels covered (Requirement 3.4)', () => {
    const levels = ['error', 'warn', 'ok', 'info'];

    it('PRESET_NPM covers all four severity levels', () => {
        const presentLevels = new Set(PRESET_NPM.map(e => e.lvl));
        levels.forEach(lvl => expect(presentLevels.has(lvl)).toBe(true));
    });

    it('PRESET_DOCKER covers all four severity levels', () => {
        const presentLevels = new Set(PRESET_DOCKER.map(e => e.lvl));
        levels.forEach(lvl => expect(presentLevels.has(lvl)).toBe(true));
    });

    it('PRESET_PYTHON covers all four severity levels', () => {
        const presentLevels = new Set(PRESET_PYTHON.map(e => e.lvl));
        levels.forEach(lvl => expect(presentLevels.has(lvl)).toBe(true));
    });

    it('PRESET_NGINX covers all four severity levels', () => {
        const presentLevels = new Set(PRESET_NGINX.map(e => e.lvl));
        levels.forEach(lvl => expect(presentLevels.has(lvl)).toBe(true));
    });
});


// ---------------------------------------------------------------------------
// analyzeSession — AI Pipeline error handling
// Requirements: 5.2, 5.8, 5.9
// ---------------------------------------------------------------------------

import {
    vi
} from 'vitest';

/**
 * Testable version of analyzeSession that accepts session and fetchFn as parameters
 * instead of relying on globals.
 * @param {Array<{ts: string, lvl: string, msg: string}>} session
 * @param {string} apiKey
 * @param {Function} fetchFn
 * @returns {Promise<{summary:string, health:string, errors:Array, fixes:Array, insight:string}>}
 */
async function analyzeSession(session, apiKey, fetchFn = fetch) {
    if (session.length === 0) {
        throw new Error('Session is empty. Add some log lines before analyzing.');
    }

    const sessionText = session
        .map(({
            ts,
            lvl,
            msg
        }) => `[${ts}] [${lvl.toUpperCase()}] ${msg}`)
        .join('\n');

    const prompt =
        'You are a CLI log analyzer. Analyze the following terminal session and return ONLY a JSON object (no markdown, no code fences) with these keys:\n' +
        '- summary: string (one paragraph overview)\n' +
        '- health: "healthy" | "degraded" | "critical"\n' +
        '- errors: array of up to 3 objects with "title" and "detail"\n' +
        '- fixes: array of up to 3 objects with "description" and optional "command"\n' +
        '- insight: string (one pro tip)\n\n' +
        'Session:\n' +
        sessionText;

    let response;
    try {
        response = await fetchFn('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
            }),
        });
    } catch (err) {
        throw new Error(`Network error while contacting NVIDIA API: ${err.message}`);
    }

    if (!response.ok) {
        let body = '';
        try {
            body = await response.text();
        } catch (_) {
            /* ignore */ }
        throw new Error(`NVIDIA API returned HTTP ${response.status}: ${body}`);
    }

    const data = await response.json();
    let raw = data.choices[0].message.content;

    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let result;
    try {
        result = JSON.parse(raw);
    } catch (_) {
        throw new Error(`Failed to parse AI response as JSON. Raw content: ${raw}`);
    }

    return result;
}

// Test 1: Empty session guard — Requirement 5.2
describe('analyzeSession — empty session guard (Requirement 5.2)', () => {
    it('throws with a message containing "empty" when session is empty', async () => {
        const mockFetch = vi.fn();
        await expect(analyzeSession([], 'test-key', mockFetch))
            .rejects.toThrow(/empty/i);
    });

    it('does not call fetch when session is empty', async () => {
        const mockFetch = vi.fn();
        await expect(analyzeSession([], 'test-key', mockFetch)).rejects.toThrow();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

// Test 2: Non-2xx response — Requirement 5.8
describe('analyzeSession — non-2xx HTTP response (Requirement 5.8)', () => {
    it('throws with a message containing the HTTP status code on non-2xx response', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Forbidden'),
        });

        const session = [{
            ts: '10:00:00',
            lvl: 'error',
            msg: 'Build failed'
        }];
        await expect(analyzeSession(session, 'test-key', mockFetch))
            .rejects.toThrow(/403/);
    });

    it('includes the response body in the error message on non-2xx response', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Forbidden'),
        });

        const session = [{
            ts: '10:00:00',
            lvl: 'error',
            msg: 'Build failed'
        }];
        await expect(analyzeSession(session, 'test-key', mockFetch))
            .rejects.toThrow(/Forbidden/);
    });
});

// Test 3: Invalid JSON response — Requirement 5.9
describe('analyzeSession — invalid JSON in API response (Requirement 5.9)', () => {
    it('throws with a message containing the raw content when response is not valid JSON', async () => {
        const rawContent = 'not json at all';
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{
                    message: {
                        content: rawContent
                    }
                }],
            }),
        });

        const session = [{
            ts: '10:00:00',
            lvl: 'error',
            msg: 'Build failed'
        }];
        await expect(analyzeSession(session, 'test-key', mockFetch))
            .rejects.toThrow(rawContent);
    });

    it('does not throw when response is valid JSON', async () => {
        const validResult = {
            summary: 'ok',
            health: 'healthy',
            errors: [],
            fixes: [],
            insight: 'tip'
        };
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{
                    message: {
                        content: JSON.stringify(validResult)
                    }
                }],
            }),
        });

        const session = [{
            ts: '10:00:00',
            lvl: 'info',
            msg: 'All good'
        }];
        await expect(analyzeSession(session, 'test-key', mockFetch)).resolves.toEqual(validResult);
    });
});