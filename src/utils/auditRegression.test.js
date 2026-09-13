import { describe, it, expect } from 'vitest';
import { valuationSettings, ownedPlayerIds, tradeWindowOpen } from './valuation';
import { lastCompletedWeek, completedMatchups } from './seasonState';
import { completedStandings } from './completedStandings';
import { playerGameLogs, aggregateCompletedStats } from './playerParticipation';
import { assignLineup } from './lineupAssignment';
import { optimizeRoster } from './lineupOptimizer';
import { generateTradeCandidates, trustworthyMarket, MARKET_MAX_AGE_MS } from './tradeCandidates';

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

describe('conservative trade screening', () => {
    const players = { q: player('q','QB'), r: player('r','RB'), w: player('w','WR'), d1: player('d1','QB'), d2: player('d2','WR'), oq: player('oq','QB'), or: player('or','RB'), ow: player('ow','WR'), rb: player('rb','RB') };
    const values = { q: 120, r: 50, w: 120, d1: 60, d2: 55, oq: 20, or: 100, ow: 10, rb: 90 };
    const rosters = [{ roster_id: 1, players: ['q','r','w','d1','d2'] }, { roster_id: 2, players: ['oq','or','ow','rb'] }];
    const args = () => ({ league, rosters, players, rosterId: 1, state: live, snapshot: { values, source: 'Fixture', fetchedAt: Date.now(), trustworthy: true } });
    it.each([0, 2])('finds a useful consolidation with premium for format type %i', type => {
        const offers = generateTradeCandidates({ ...args(), league: { ...league, settings: { ...league.settings, type } } });
        expect(offers).toHaveLength(1);
        expect(offers[0].giveValue).toBe(115);
        expect(offers[0].receive[0].id).toBe('or');
        expect(offers[0].myGain).toBeGreaterThan(0); expect(offers[0].theirGain).toBeGreaterThan(0);
    });
    it('rejects a QB sale to an already strong one-QB room', () => {
        const argsStrong = args(); argsStrong.snapshot = { ...argsStrong.snapshot, values: { ...values, oq: 150 } };
        expect(generateTradeCandidates(argsStrong)).toEqual([]);
    });
    it.each([['QB','QB','RB','WR'], ['QB','SUPER_FLEX','RB','WR']])('does not call a needed second QB expendable in %j', (...slots) => {
        expect(generateTradeCandidates({ ...args(), league: { ...league, roster_positions: slots } })).toEqual([]);
    });
    it('requires premium and rejects unequal low-value depth', () => {
        expect(generateTradeCandidates({ ...args(), snapshot: { ...args().snapshot, values: { ...values, d2: 5 } } })).toEqual([]);
    });
    it('rejects missing, stale, future-dated, or unavailable values', () => {
        for (const patch of [{ trustworthy: false }, { fetchedAt: Date.now()-MARKET_MAX_AGE_MS-1 }, { values: { ...values, oq: undefined } }])
            expect(generateTradeCandidates({ ...args(), snapshot: { ...args().snapshot, ...patch } })).toEqual([]);
        expect(trustworthyMarket({ trustworthy: true, fetchedAt: Date.now()+10000 })).toBe(false);
    });
    it('verifies ownership and includes separately listed IR/taxi assets', () => {
        const withStashes = [{ ...rosters[0], players: ['q','r','w'], reserve: ['d1'], taxi: ['d2'] }, rosters[1]];
        expect(generateTradeCandidates({ ...args(), rosters: withStashes })[0].give.map(p => p.id).sort()).toEqual(['d1','d2']);
        expect(generateTradeCandidates({ ...args(), rosters: [rosters[0], { ...rosters[1], players: [...rosters[1].players,'d1'] }] })).toEqual([]);
    });
    it('returns none after the deadline', () => expect(generateTradeCandidates({ ...args(), state: { ...live, week: 13 } })).toEqual([]));
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
