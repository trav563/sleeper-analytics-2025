import { pickKeyFromName } from './fantasyCalc';

// DynastyProcess publishes weekly dynasty values (GPL-3.0) as CSVs:
// https://github.com/dynastyprocess/data
// Used as a fallback value source when FantasyCalc is unreachable — same
// ~0-10,000 scale, same pick-name formats ("2026 Pick 1.01", "2027 1st").
const VALUES_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv';
const IDS_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv';

/** Minimal CSV parser handling quoted fields (values may contain commas). */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field); field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

/**
 * Fetch DynastyProcess values as a sleeperId -> value map (plus canonical
 * PICK_* keys), mirroring fetchMarketValues' output shape. Throws on failure —
 * the caller decides what the final fallback is.
 * @param {boolean} isSuperflex selects value_2qb vs value_1qb
 */
export async function fetchDynastyProcessValues(isSuperflex = true) {
    const [valuesRes, idsRes] = await Promise.all([fetch(VALUES_URL), fetch(IDS_URL)]);
    if (!valuesRes.ok || !idsRes.ok) throw new Error('DynastyProcess fetch failed');
    const [valuesText, idsText] = await Promise.all([valuesRes.text(), idsRes.text()]);

    // fantasypros_id -> sleeper_id crosswalk (only the two columns we need).
    const idRows = parseCsv(idsText);
    const idHeader = idRows[0];
    const fpCol = idHeader.indexOf('fantasypros_id');
    const sleeperCol = idHeader.indexOf('sleeper_id');
    if (fpCol === -1 || sleeperCol === -1) throw new Error('DynastyProcess id columns missing');
    const fpToSleeper = {};
    for (let i = 1; i < idRows.length; i++) {
        const fp = idRows[i][fpCol];
        const sleeper = idRows[i][sleeperCol];
        if (fp && fp !== 'NA' && sleeper && sleeper !== 'NA') fpToSleeper[fp] = sleeper;
    }

    const valueRows = parseCsv(valuesText);
    const header = valueRows[0];
    const col = (name) => header.indexOf(name);
    const nameCol = col('player');
    const posCol = col('pos');
    const fpIdCol = col('fp_id');
    const valueCol = col(isSuperflex ? 'value_2qb' : 'value_1qb');
    if (nameCol === -1 || valueCol === -1) throw new Error('DynastyProcess value columns missing');

    const valueMap = {};
    for (let i = 1; i < valueRows.length; i++) {
        const r = valueRows[i];
        const value = Number(r[valueCol]);
        if (!Number.isFinite(value)) continue;
        if (r[posCol] === 'PICK') {
            const key = pickKeyFromName(r[nameCol]);
            if (key) valueMap[key] = value;
        } else {
            const sleeperId = fpToSleeper[r[fpIdCol]];
            if (sleeperId) valueMap[sleeperId] = value;
        }
    }
    return valueMap;
}
