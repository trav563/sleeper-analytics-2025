import { describe, it, expect } from 'vitest';
import { valuationSettings, ownedPlayerIds, tradeWindowOpen } from './valuation';
import { lastCompletedWeek, completedMatchups } from './seasonState';
import { completedStandings } from './completedStandings';
import { playerGameLogs, aggregateCompletedStats } from './playerParticipation';
import { assignLineup } from './lineupAssignment';
import { optimizeRoster } from './lineupOptimizer';
import { generateTradeCandidates, classifyTeams, futureFactor, trustworthyMarket, MARKET_MAX_AGE_MS } from './tradeCandidates';

const live = { season: '2026', season_type: 'regular', week: 1 };
const league = { season: '2026', settings: { type: 2, trade_deadline: 12 }, roster_positions: ['QB', 'RB', 'WR', 'BN'], scoring_settings: { rec: 1, pass_int: -2 } };
const player = (id, position, extra = {}) => ({ id, player_id: id, first_name: id, position, age: 25, team: id, ...extra });

describe('shared format and finality', () => {
    it.each([['QB'], ['QB', 'QB'], ['QB', 'SUPER_FLEX']])('uses actual QB slots %j', (...slots) => {
        expect(valuationSettings({ ...league, roster_positions: slots }, 10)).toEqual({ isDynasty: true, numQbs: slots.length >= 2 ? 2 : 1, numTeams: 10, ppr: 1 });
    });
    it('distinguishes redraft and preserves nonstandard reception scoring', () => {
        expect(valuationSettings({ settings: { type: 0 }, scoring_settings: { rec: 0.75 } }).isDynasty).toBe(false);
        expect(valuationSettings({ scoring_settings: { rec: 0.75 } }).ppr).toBe(0.75);
    });
    it('includes unique IR and taxi ownership', () => expect(ownedPlayerIds({ players: ['a'], reserve: ['a','b'], taxi: ['c'] })).toEqual(['a','b','c']));
    it.each([['pre',1,0], ['regular',1,0], ['regular',2,1], ['regular',18,17], ['post',1,18]])('bounds %s week %i to %i completed', (season_type, week, expected) => {
        expect(lastCompletedWeek(league, { ...live, season_type, week })).toBe(expected);
    });
    it('historical seasons are final; a completed fantasy league does not finalize live NFL games', () => {
        expect(lastCompletedWeek({ ...league, season: '2025' }, live)).toBe(18);
        expect(lastCompletedWeek({ ...league, status: 'complete' }, live)).toBe(0);
        expect(lastCompletedWeek({ ...league, status: 'complete' }, { ...live, week: 18 })).toBe(17);
        expect(lastCompletedWeek({ ...league, season: '2027' }, live)).toBe(0);
    });
    it('excludes live points from records but includes completed zero/negative scores and ties', () => {
        const teams = [{ roster_id: 1 }, { roster_id: 2 }];
        const weeks = { 1: [{ roster_id: 1, matchup_id: 1, points: -2 }, { roster_id: 2, matchup_id: 1, points: 0 }],
            2: [{ roster_id: 1, matchup_id: 1, points: 0 }, { roster_id: 2, matchup_id: 1, points: 0 }],
            3: [{ roster_id: 1, matchup_id: 1, points: 100 }, { roster_id: 2, matchup_id: 1, points: 50 }] };
        const stats = completedStandings(teams, completedMatchups(weeks, 2));
        expect(stats[0]).toMatchObject({ record: '0-1-1', totalPoints: -2, gamesPlayed: 2, ppg: -1, allPlayTies: 1, apWinPct: 0.25 });
        expect(stats[1].record).toBe('1-0-1');
        expect(completedStandings(teams, completedMatchups(weeks, 0))[0].record).toBe('0-0');
    });
    it('honors deadlines inclusively and historical seasons', () => {
        expect(tradeWindowOpen(league, { ...live, week: 12 })).toBe(true);
        expect(tradeWindowOpen(league, { ...live, week: 13 })).toBe(false);
        expect(tradeWindowOpen(league, { ...live, season_type: 'pre', week: 15 })).toBe(true);
        expect(tradeWindowOpen({ ...league, season: '2025' }, live)).toBe(false);
    });
    it('counts actual zero/negative participation, excluding byes and inactivity', () => {
        const weeks = { 1: { a: { gp: 1, rec: 0 }, b: { gp: 0, pts_ppr: 0 } }, 2: { a: { off_snp: 20, pass_int: 1 } }, 3: { a: {} } };
        expect(playerGameLogs(weeks, league.scoring_settings).a).toEqual([{ week: 1, points: 0 }, { week: 2, points: -2 }]);
        expect(playerGameLogs(weeks, league.scoring_settings).b).toBeUndefined();
        expect(aggregateCompletedStats(weeks, league.scoring_settings).a).toMatchObject({ gp: 2, leaguePoints: -2 });
    });
});

describe('legal coordinated lineups', () => {
    const players = { a: player('a','RB'), b: player('b','WR'), c: player('c','RB'), d: player('d','QB'), e: player('e','TE') };
    const future = { statusName: 'STATUS_SCHEDULED', kickoff: '2099-09-13T18:00:00Z' };
    const games = Object.fromEntries(Object.keys(players).map(id => [id, future]));
    const roster = { players: ['a','b','c','d','e'], starters: ['a','b'] };
    const options = { roster, players, slots: ['RB','FLEX'], projections: { a: 10, b: 5, c: 20, d: 30, e: 2 }, games };
    it('includes the companion FLEX move when moving its starter into a fixed position', () => {
        const result = optimizeRoster({ ...options, roster: { ...roster, starters: ['b','a'] } });
        expect(result.rows.map(r => r.next.position)).toEqual(['RB','RB']);
        expect(result.optimalTotal).toBe(30);
        expect(new Set(result.rows.map(r => r.next.id)).size).toBe(2);
    });
    it('locks a completed starter and excludes started bench players', () => {
        const result = optimizeRoster({ ...options, games: { ...games, a: { statusName: 'STATUS_FINAL' }, c: { statusName: 'STATUS_IN_PROGRESS' } } });
        expect(result.rows[0]).toMatchObject({ locked: true, next: { id: 'a' } });
        expect(result.rows[1].next.id).toBe('b');
    });
    it('excludes reserve, taxi, and unavailable players', () => {
        const result = optimizeRoster({ ...options, roster: { ...roster, reserve: ['c'], taxi: ['e'] }, players: { ...players, d: { ...players.d, injury_status: 'Out' } } });
        expect(result.rows.map(r => r.next.id)).toEqual(['a','b']);
    });
    it('preserves unknown-status and missing-projection starters', () => {
        const result = optimizeRoster({ ...options, projections: { b: 5, c: 20 }, games: { ...games, b: undefined } });
        expect(result.rows.every(r => r.locked)).toBe(true);
        expect(result.unknown).toBe(true);
    });
    it('supports multiple FLEX types and never places a QB in a receiving FLEX', () => {
        const result = assignLineup(['SUPER_FLEX','REC_FLEX','WRRB_FLEX','RB'], Object.values(players), p => options.projections[p.id]);
        expect(result.assignments[0].id).toBe('d');
        expect(['WR','TE']).toContain(result.assignments[1].position);
        expect(result.total).toBe(65);
        expect(result.filled).toBe(4);
    });
    it('declines advice without game data or with unsupported slots', () => {
        expect(optimizeRoster({ ...options, games: {} }).unavailable).toBeTruthy();
        expect(optimizeRoster({ ...options, slots: ['DL'] }).unavailable).toBeTruthy();
    });
});

describe('trade screening guards', () => {
    const players = { q: player('q','QB'), r: player('r','RB'), w: player('w','WR'), d1: player('d1','QB'), d2: player('d2','WR'), oq: player('oq','QB'), or: player('or','RB'), ow: player('ow','WR'), rb: player('rb','RB') };
    const values = { q: 120, r: 50, w: 120, d1: 60, d2: 55, oq: 20, or: 100, ow: 10, rb: 90 };
    const rosters = [{ roster_id: 1, players: ['q','r','w','d1','d2'] }, { roster_id: 2, players: ['oq','or','ow','rb'] }];
    const args = () => ({ league, rosters, players, rosterId: 1, state: live, snapshot: { values, source: 'Fixture', fetchedAt: Date.now(), trustworthy: true } });
    const ids = offers => offers.flatMap(o => [...o.give, ...o.receive]).map(a => a.id);
    it.each([0, 2])('finds a useful consolidation with premium for format type %i', type => {
        const offers = generateTradeCandidates({ ...args(), league: { ...league, settings: { ...league.settings, type } } });
        expect(offers).toHaveLength(1);
        expect(offers[0].giveValue).toBe(115);
        expect(offers[0].receive[0].id).toBe('or');
        expect(offers[0].me.gain).toBeGreaterThan(0); expect(offers[0].them.gain).toBeGreaterThan(0);
    });
    it('never leaves a required second QB slot empty', () => {
        const offers = generateTradeCandidates({ ...args(), league: { ...league, roster_positions: ['QB','QB','RB','WR'] } });
        expect(offers.length).toBeGreaterThan(0);
        expect(ids(offers)).not.toContain('d1');
    });
    it('requires the consolidation premium and rejects low-value throw-ins', () => {
        const offers = generateTradeCandidates({ ...args(), snapshot: { ...args().snapshot, values: { ...values, d2: 5 } } });
        expect(ids(offers)).not.toContain('d2');
        for (const o of offers) {
            expect(o.giveValue).toBeGreaterThanOrEqual(o.receiveValue * 1.1 - 1e-9);
            expect(o.giveValue).toBeLessThanOrEqual(o.receiveValue * 1.25 + 1e-9);
        }
    });
    it('rejects stale, future-dated, or untrusted markets', () => {
        for (const patch of [{ trustworthy: false }, { fetchedAt: Date.now()-MARKET_MAX_AGE_MS-1 }])
            expect(generateTradeCandidates({ ...args(), snapshot: { ...args().snapshot, ...patch } })).toEqual([]);
        expect(trustworthyMarket({ trustworthy: true, fetchedAt: Date.now()+10000 })).toBe(false);
    });
    it('keeps screening a team with an unvalued player but never offers that player', () => {
        const offers = generateTradeCandidates({ ...args(), snapshot: { ...args().snapshot, values: { ...values, oq: undefined } } });
        expect(offers.length).toBeGreaterThan(0);
        expect(ids(offers)).not.toContain('oq');
    });
    it('verifies ownership and includes separately listed IR/taxi assets', () => {
        const withStashes = [{ ...rosters[0], players: ['q','r','w'], reserve: ['d1'], taxi: ['d2'] }, rosters[1]];
        expect(generateTradeCandidates({ ...args(), rosters: withStashes })[0].give.map(p => p.id).sort()).toEqual(['d1','d2']);
        expect(ids(generateTradeCandidates({ ...args(), rosters: [rosters[0], { ...rosters[1], players: [...rosters[1].players,'d1'] }] }))).not.toContain('d1');
    });
    it('does not count the two-for-one premium as future value for the team receiving two', () => {
        // d1 + d2 = 110 for or (100) only reaches the premium; net of it, the rebuilder gains nothing.
        const offers = generateTradeCandidates({ ...args(), snapshot: { ...args().snapshot, values: { ...values, d2: 50 } } });
        expect(offers.map(o => o.receive[0].id)).toEqual(['rb']);
        expect(offers[0].them.futureDelta).toBeCloseTo(110 / 1.1 - 90);
        expect(offers[0].me.nowDelta).toBe(40);
    });
    it('returns none after the deadline', () => expect(generateTradeCandidates({ ...args(), state: { ...live, week: 13 } })).toEqual([]));
});

describe('strategy-aware trade fit', () => {
    const dynasty = { season: '2026', settings: { type: 2, trade_deadline: 12 }, roster_positions: ['QB', 'RB', 'WR', 'BN', 'BN', 'BN'] };
    const people = {
        aq: player('aq','QB',{ age: 26 }), ar: player('ar','RB',{ age: 24 }), aw: player('aw','WR',{ age: 25 }), ao: player('ao','WR',{ age: 32 }),
        bq: player('bq','QB'), br: player('br','RB'), bw: player('bw','WR'),
        cq: player('cq','QB',{ age: 30 }), cr: player('cr','RB',{ age: 29 }), cb: player('cb','RB',{ age: 23 }), cw: player('cw','WR',{ age: 24 }),
    };
    // Market prices fairness; this-season values make the 29-year-old RB a contender's upgrade.
    const market = { aq: 300, ar: 150, aw: 300, ao: 115, bq: 150, br: 150, bw: 150, cq: 50, cr: 110, cb: 30, cw: 40 };
    const thisSeason = { aq: 300, ar: 100, aw: 300, ao: 5, bq: 150, br: 150, bw: 150, cq: 50, cr: 250, cb: 15, cw: 20 };
    const snap = values => ({ values, source: 'Fixture', fetchedAt: Date.now(), trustworthy: true });
    const record = (wins, losses, fpts) => ({ wins, losses, ties: 0, fpts });
    const pick = (id, tradeValue) => ({ id, year: 2027, round: 1, original_owner_id: 1, roster_id: 1, tradeValue, description: `2027 pick ${id}` });
    const contender = { roster_id: 1, players: ['aq','ar','aw','ao'], settings: record(4, 0, 500) };
    const middle = { roster_id: 3, players: ['bq','br','bw'], settings: record(2, 2, 400) };
    const rebuilder = { roster_id: 2, players: ['cq','cr','cb','cw'], settings: record(0, 4, 300) };
    const args = (extra = {}) => ({ league: dynasty, rosters: [contender, rebuilder], players: people, snapshot: snap(market), winNowSnapshot: snap(thisSeason),
        picks: [pick('p1', 115)], rosterId: 1, mode: 'swap', state: live, ...extra });

    it('classifies contenders, balanced teams, and rebuilders', () => {
        expect(classifyTeams({ ...args(), rosters: [contender, middle, rebuilder] })).toEqual({ 1: 'contender', 3: 'balanced', 2: 'rebuilder' });
        expect(classifyTeams({ ...args(), rosters: [contender, middle, rebuilder], league: { ...dynasty, settings: { ...dynasty.settings, type: 0 } } }))
            .toEqual({ 1: 'contender', 3: 'contender', 2: 'contender' });
        // Before two games, only this season's lineup strength counts.
        const early = [{ ...contender, settings: record(0, 1, 90) }, { ...rebuilder, settings: record(1, 0, 120) }];
        expect(classifyTeams({ ...args(), rosters: early })).toEqual({ 1: 'contender', 2: 'rebuilder' });
    });
    it('lets a contender buy a productive veteran from a rebuilder with a pick', () => {
        const offers = generateTradeCandidates(args());
        expect(offers).toHaveLength(1);
        expect(offers[0].give.map(a => a.id)).toEqual(['p1']);
        expect(offers[0].give[0]).toMatchObject({ kind: 'pick', position: 'PICK', name: '2027 pick p1' });
        expect(offers[0].receive.map(a => a.id)).toEqual(['cr']);
        expect(offers[0].me).toMatchObject({ strategy: 'contender' });
        expect(offers[0].me.nowChange).toBeGreaterThan(0.2);
        expect(offers[0].them).toMatchObject({ strategy: 'rebuilder' });
        expect(offers[0].them.futureChange).toBeGreaterThan(0);
    });
    it('never sends a rebuilder a player past the age cliff at equal market value', () => {
        expect(futureFactor({ position: 'WR', age: 32 })).toBe(0.35);
        expect(futureFactor({ position: 'RB', age: 24 })).toBe(1);
        expect(futureFactor({ kind: 'pick', position: 'PICK' })).toBe(1);
        const offered = generateTradeCandidates(args()).flatMap(o => o.give.map(a => a.id));
        expect(offered).not.toContain('ao');
    });
    it('sells a rebuilder\'s veteran for two younger pieces', () => {
        const offers = generateTradeCandidates(args({ rosterId: 2, mode: 'trade-down', picks: [pick('p2a', 60), pick('p2b', 65)] }));
        expect(offers).toHaveLength(1);
        expect(offers[0].give.map(a => a.id)).toEqual(['cr']);
        expect(offers[0].receive.map(a => a.id).sort()).toEqual(['p2a', 'p2b']);
        expect(offers[0].me.strategy).toBe('rebuilder');
        expect(offers[0].them.strategy).toBe('contender');
    });
    it('honors a strategy override for your own team', () => {
        expect(generateTradeCandidates(args({ strategyOverride: 'rebuilder' }))).toEqual([]);
    });
    it('falls back to market values when this-season values are unavailable', () => {
        for (const winNowSnapshot of [undefined, { ...snap(thisSeason), fetchedAt: Date.now() - MARKET_MAX_AGE_MS - 1 }])
            expect(generateTradeCandidates(args({ winNowSnapshot }))).toEqual([]);
    });
});

describe('incomplete and canceled context', () => {
    it('never promotes players in postponed/canceled/unknown games', () => {
        const players = { a:player('a','RB'),b:player('b','RB') };
        for (const statusName of ['STATUS_POSTPONED','STATUS_CANCELED','STATUS_UNKNOWN']) {
            const result = optimizeRoster({ roster:{players:['a','b'],starters:['a']}, players,slots:['RB'], projections:{a:5,b:25},
                games:{a:{statusName:'STATUS_SCHEDULED',kickoff:'2099-09-13T18:00:00Z'},b:{statusName,kickoff:'2099-09-13T18:00:00Z'}} });
            expect(result.rows[0].next.id).toBe('a');
        }
    });
    it('does not count unscheduled fantasy byes as completed scored games', () => {
        const stats = completedStandings([{roster_id:1},{roster_id:2}],{1:[{roster_id:1,matchup_id:null,points:0},{roster_id:2,matchup_id:null,points:0}]});
        expect(stats.every(t=>t.gamesPlayed===0 && t.record==='0-0')).toBe(true);
    });
});
