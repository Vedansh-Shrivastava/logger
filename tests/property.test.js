// Feature: logger, Property 1: Classification is total and deterministic
// Feature: logger, Property 2: Error patterns take priority over warn patterns
// Feature: logger, Property 3: Warn patterns take priority over ok patterns
// Feature: logger, Property 4: parseBlock strips blank lines
// Feature: logger, Property 5: Timestamp extraction round-trip
// Feature: logger, Property 6: Missing timestamp fallback
// Feature: logger, Property 7: escHtml neutralizes injection characters
// Feature: logger, Property 8: escHtml is idempotent on safe strings

import {
    describe,
    it
} from 'vitest';
import * as fc from 'fast-check';

/**
 * classify implementation under test (copied from index.html).
 * Classify severity using ordered regex heuristics.
 * Returns 'error' | 'warn' | 'ok' | 'info'
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

/**
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * Property 1: Classification is total and deterministic
 * For any non-empty string, classify(text) SHALL return exactly one of
 * "error", "warn", "ok", or "info", and calling it twice with the same
 * input SHALL return the same result.
 */
describe('Property 1: Classification is total and deterministic', () => {
    it('returns exactly one valid severity level for any string (totality)', () => {
        fc.assert(
            fc.property(fc.string({
                minLength: 1
            }), (s) => {
                const result = classify(s);
                return result === 'error' || result === 'warn' || result === 'ok' || result === 'info';
            }), {
                numRuns: 100
            }
        );
    });

    it('returns the same result when called twice with the same input (determinism)', () => {
        fc.assert(
            fc.property(fc.string({
                minLength: 1
            }), (s) => {
                return classify(s) === classify(s);
            }), {
                numRuns: 100
            }
        );
    });
});

/**
 * Validates: Requirements 7.5
 *
 * Property 2: Error patterns take priority over warn patterns
 * For any string that matches both an error pattern and a warn pattern,
 * classify(text) SHALL return "error".
 */
describe('Property 2: Error patterns take priority over warn patterns', () => {
    it('returns "error" for any string matching both an error and a warn pattern', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.constantFrom('error', 'exception', 'fatal', 'failed', 'failure', 'ENOENT', 'ECONNREFUSED', 'ERESOLVE', 'non-zero'),
                    fc.constantFrom('warn', 'warning', 'deprecated', 'retry', 'vulnerability')
                ).map(([e, w]) => `${e} ${w}`),
                (combined) => {
                    return classify(combined) === 'error';
                }
            ), {
                numRuns: 100
            }
        );
    });
});

/**
 * Validates: Requirements 7.5
 *
 * Property 3: Warn patterns take priority over ok patterns
 * For any string that matches both a warn pattern and an ok pattern,
 * classify(text) SHALL return "warn".
 */
describe('Property 3: Warn patterns take priority over ok patterns', () => {
    it('returns "warn" for any string matching both a warn and an ok pattern', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.constantFrom('warn', 'warning', 'deprecated', 'retry', 'vulnerability'),
                    fc.constantFrom('success', 'successfully', 'started', 'listening', 'created')
                ).map(([w, o]) => `${w} ${o}`),
                (combined) => {
                    return classify(combined) === 'warn';
                }
            ), {
                numRuns: 100
            }
        );
    });
});

/**
 * parseBlock implementation under test (copied from index.html).
 * Parse a block of raw text (newline-separated) into LogLine[].
 * Blank/whitespace-only lines are filtered out.
 * @param {string} rawText
 * @returns {Array<{ts: string, lvl: string, msg: string}>}
 */
function parseBlock(rawText) {
    return rawText
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            const ts = extractTimestamp(line);
            return {
                ts: ts !== null ? ts : '--:--:--',
                lvl: classify(line),
                msg: line,
            };
        });
}

/**
 * Validates: Requirements 2.2
 *
 * Property 4: parseBlock strips blank lines
 * For any block of text, parseBlock(text) SHALL return an array whose length
 * equals the number of non-empty (non-whitespace-only) lines in the input.
 */
describe('Property 4: parseBlock strips blank lines', () => {
    it('returns an array whose length equals the number of non-empty lines', () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(fc.string({
                    minLength: 1
                }), fc.constant(''), fc.constant('   ')))
                .map(lines => lines.join('\n')),
                (text) => {
                    const lines = text.split('\n');
                    const nonEmptyCount = lines.filter(l => l.trim() !== '').length;
                    return parseBlock(text).length === nonEmptyCount;
                }
            ), {
                numRuns: 100
            }
        );
    });
});

/**
 * extractTimestamp implementation under test (copied from index.html).
 * Extract HH:MM:SS from a raw line, or return null.
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

/**
 * Validates: Requirements 2.3, 2.5
 *
 * Property 5: Timestamp extraction round-trip
 * For any raw log line containing a recognizable timestamp,
 * extractTimestamp(line) SHALL return a string matching HH:MM:SS,
 * and that string SHALL equal the time portion present in the original line.
 */
// Feature: logger, Property 5: Timestamp extraction round-trip
describe('Property 5: Timestamp extraction round-trip', () => {
    // Generator for valid HH:MM:SS time strings
    const timeArb = fc.tuple(
        fc.integer({
            min: 0,
            max: 23
        }),
        fc.integer({
            min: 0,
            max: 59
        }),
        fc.integer({
            min: 0,
            max: 59
        })
    ).map(([h, m, s]) => {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    });

    it('round-trips timestamps in ISO 8601 with T format', () => {
        fc.assert(
            fc.property(timeArb, (time) => {
                const line = `2024-01-15T${time} some log message`;
                return extractTimestamp(line) === time;
            }), {
                numRuns: 100
            }
        );
    });

    it('round-trips timestamps in ISO 8601 with space format', () => {
        fc.assert(
            fc.property(timeArb, (time) => {
                const line = `2024-01-15 ${time} some log message`;
                return extractTimestamp(line) === time;
            }), {
                numRuns: 100
            }
        );
    });

    it('round-trips timestamps in bracketed datetime format', () => {
        fc.assert(
            fc.property(timeArb, (time) => {
                const line = `[2024-01-15 ${time}] some log message`;
                return extractTimestamp(line) === time;
            }), {
                numRuns: 100
            }
        );
    });

    it('round-trips timestamps in time-only format', () => {
        fc.assert(
            fc.property(timeArb, (time) => {
                const line = `${time} some log message`;
                return extractTimestamp(line) === time;
            }), {
                numRuns: 100
            }
        );
    });
});

/**
 * Validates: Requirements 2.4
 *
 * Property 6: Missing timestamp fallback
 * For any raw log line containing no recognizable timestamp pattern,
 * extractTimestamp(line) SHALL return null.
 */
// Feature: logger, Property 6: Missing timestamp fallback
describe('Property 6: Missing timestamp fallback', () => {
    it('returns null for any string with no recognizable timestamp pattern', () => {
        fc.assert(
            fc.property(
                // Filter out strings that contain any HH:MM:SS-like pattern,
                // which is the minimal pattern needed for extractTimestamp to match.
                fc.string().filter(s => !/\d{2}:\d{2}:\d{2}/.test(s)),
                (s) => {
                    return extractTimestamp(s) === null;
                }
            ), {
                numRuns: 100
            }
        );
    });
});

/**
 * escHtml implementation under test (copied from index.html).
 * Escape &, <, > in a string before DOM insertion.
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
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * Property 7: escHtml neutralizes injection characters
 * For any string, after escHtml, the result contains no raw `&`, `<`, or `>`.
 */

describe('Property 7: escHtml neutralizes injection characters', () => {
    it('result contains no raw &, <, or > for any input string', () => {
        fc.assert(
            fc.property(fc.string(), (str) => {
                const result = escHtml(str);
                return (
                        !result.includes('&') ||
                        // Allow &amp; &lt; &gt; — these are the escaped forms, not raw chars.
                        // More precisely: after escaping, the only '&' that can appear are
                        // those that are part of &amp;, &lt;, or &gt;.
                        // We verify by checking that no raw unescaped injection chars remain:
                        // i.e., every '&' in result is followed by 'amp;', 'lt;', or 'gt;'
                        [...result.matchAll(/&/g)].every((m) => {
                            const after = result.slice(m.index);
                            return (
                                after.startsWith('&amp;') ||
                                after.startsWith('&lt;') ||
                                after.startsWith('&gt;')
                            );
                        })
                    ) &&
                    !result.includes('<') &&
                    !result.includes('>');
            }), {
                numRuns: 100
            }
        );
    });
});

/**
 * Validates: Requirements 8.3
 *
 * Property 8: escHtml is idempotent on safe strings
 * For any string containing no `&`, `<`, or `>`, escHtml(str) SHALL return the original string unchanged.
 */
describe('Property 8: escHtml is idempotent on safe strings', () => {
    it('returns the original string unchanged when input contains no &, <, or >', () => {
        fc.assert(
            fc.property(
                fc.string({
                    unit: fc.char().filter(c => c !== '&' && c !== '<' && c !== '>')
                }),
                (str) => {
                    return escHtml(str) === str;
                }
            ), {
                numRuns: 100
            }
        );
    });
});

// Feature: logger, Property 9: Stats counters are consistent with session

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

/**
 * Validates: Requirements 4.3, 4.4, 4.5, 4.6
 *
 * Property 9: Stats counters are consistent with session
 * For any session array, the sum of errors + warnings + success counters SHALL
 * equal the total counter, and each individual counter SHALL equal the count of
 * LogLine entries with the corresponding lvl value.
 */
describe('Property 9: Stats counters are consistent with session', () => {
    const logLineArb = fc.record({
        ts: fc.constant('00:00:00'),
        lvl: fc.constantFrom('error', 'warn', 'ok', 'info'),
        msg: fc.string(),
    });

    it('errors + warnings + success equals total for any session', () => {
        fc.assert(
            fc.property(fc.array(logLineArb), (session) => {
                const stats = computeStats(session);
                return stats.errors + stats.warnings + stats.success === stats.total;
            }), {
                numRuns: 100
            }
        );
    });

    it('errors counter equals count of lvl==="error" entries', () => {
        fc.assert(
            fc.property(fc.array(logLineArb), (session) => {
                const stats = computeStats(session);
                return stats.errors === session.filter(l => l.lvl === 'error').length;
            }), {
                numRuns: 100
            }
        );
    });

    it('warnings counter equals count of lvl==="warn" entries', () => {
        fc.assert(
            fc.property(fc.array(logLineArb), (session) => {
                const stats = computeStats(session);
                return stats.warnings === session.filter(l => l.lvl === 'warn').length;
            }), {
                numRuns: 100
            }
        );
    });

    it('success counter equals count of lvl==="ok" or lvl==="info" entries', () => {
        fc.assert(
            fc.property(fc.array(logLineArb), (session) => {
                const stats = computeStats(session);
                return stats.success === session.filter(l => l.lvl === 'ok' || l.lvl === 'info').length;
            }), {
                numRuns: 100
            }
        );
    });
});

// Feature: logger, Property 10: Preset append does not clear existing session

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
        msg: "npm error Could not resolve dependency: peer webpack@\"^5.0.0\" from css-loader@6.8.1"
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

const PRESETS = {
    'npm-install': PRESET_NPM,
    'docker-build': PRESET_DOCKER,
    'python-app': PRESET_PYTHON,
    'nginx-logs': PRESET_NGINX,
};

/**
 * Pure appendLines helper — returns a new array (session + lines).
 * @param {Array} session
 * @param {Array} lines
 * @returns {Array}
 */
function appendLines(session, lines) {
    return [...session, ...lines];
}

/**
 * Validates: Requirements 3.2, 3.3
 *
 * Property 10: Preset append does not clear existing session
 * For any non-empty session and any preset, loading the preset SHALL result in
 * a session whose length equals the original session length plus the preset's
 * line count.
 */
describe('Property 10: Preset append does not clear existing session', () => {
    const logLineArb = fc.record({
        ts: fc.constant('00:00:00'),
        lvl: fc.constantFrom('error', 'warn', 'ok', 'info'),
        msg: fc.string(),
    });

    it('appended session length equals original length plus preset line count', () => {
        fc.assert(
            fc.property(
                fc.array(logLineArb, {
                    minLength: 1
                }),
                fc.constantFrom('npm-install', 'docker-build', 'python-app', 'nginx-logs'),
                (session, presetKey) => {
                    const preset = PRESETS[presetKey];
                    const result = appendLines(session, preset);
                    return result.length === session.length + preset.length;
                }
            ), {
                numRuns: 100
            }
        );
    });
});