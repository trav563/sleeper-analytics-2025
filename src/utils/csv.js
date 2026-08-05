/**
 * CSV building and download.
 *
 * Extracted from the inline implementation in ScheduleOutput.jsx so the escaping
 * rules are testable in one place. That component is deliberately NOT migrated
 * onto these helpers: doing so would change its output (BOM, quoting of the
 * locale date, filename for a blank league name), and it works today.
 */

/**
 * Escape one cell. Quotes only when required, matching the original behavior.
 * Nullish becomes an empty cell rather than the string "null".
 */
export function csvField(value) {
    if (value == null) return '';
    const str = String(value);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Neutralize spreadsheet formula injection for USER-AUTHORED TEXT only.
 *
 * Sleeper team, league, and manager names are user-editable, and Excel/Sheets
 * still execute a value beginning with = + - @ (or a leading tab/CR) even when
 * it is correctly quoted. Prefixing an apostrophe forces text.
 *
 * Deliberately NOT applied to numeric or structural fields — a genuine negative
 * number or point margin must stay numeric. Trims first so leading whitespace
 * cannot smuggle a formula past the check.
 */
export function csvText(value) {
    if (value == null) return '';
    const str = String(value).trim();
    if (!str) return '';
    return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

/**
 * Join a grid of cells into a CSV document. An empty inner array yields a blank
 * spacer line, which is how the preamble is separated from the data rows.
 *
 * @param {Array<Array<string|number|null|undefined>>} rows
 */
export function toCSV(rows) {
    return (rows || []).map((row) => (row || []).map(csvField).join(',')).join('\n');
}

/** Filename-safe segment. A blank or whitespace-only value falls back. */
export function csvSlug(value, fallback = 'fantasy') {
    const cleaned = String(value ?? '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[/\\:*?"<>|]/g, '');
    return cleaned || fallback;
}

/**
 * `prefix_League_Name_YYYY-MM-DD.csv`, stamped with the LOCAL date — a UTC stamp
 * would label an evening export with tomorrow's date.
 */
export function csvFilename(prefix, leagueName, date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return `${csvSlug(prefix, 'export')}_${csvSlug(leagueName)}_${stamp}.csv`;
}

/**
 * Trigger a download. Side effect only — not unit tested, since the test env has
 * no document.
 *
 * The BOM matters: this league has team names with curly apostrophes and accents
 * (`Epstein's Protégée`), which Excel on Windows mangles without it. The anchor
 * is attached before clicking because Firefox ignores click() on a detached node,
 * and revocation is deferred because revoking synchronously can race the download.
 */
export function downloadCSV(csv, filename) {
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
