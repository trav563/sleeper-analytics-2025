import { projectMatchup } from './liveProjection.js';
import { computeWinProbability } from './winProbability.js';
import { projectedPointsOrNull } from '../utils/scoring.js';

/**
 * One league's win probabilities right now, as { [matchupId]: p }, where p is
 * the chance the LOWER roster id wins so every sample shares one orientation.
 * A pair is left out when either side can't be projected (a starter in
 * overtime or without a projection) rather than guessing.
 */
export function sampleLeagueProbabilities({ matchups, players, rawProjections, scoringSettings, games }) {
    const pairs = new Map();
    for (const matchup of matchups || []) {
        if (matchup.matchup_id == null) continue;
        const pair = pairs.get(matchup.matchup_id) || [];
        pair.push(matchup);
        pairs.set(matchup.matchup_id, pair);
    }

    // Score only this league's starters: the full projection file is thousands of players.
    const projections = {};
    for (const matchup of matchups || []) {
        for (const pid of matchup.starters || []) {
            if (pid in projections) continue;
            const points = projectedPointsOrNull(rawProjections?.[pid], scoringSettings);
            if (Number.isFinite(points)) projections[pid] = points;
        }
    }

    const sample = {};
    for (const [matchupId, pair] of pairs) {
        if (pair.length !== 2) continue;
        const [a, b] = [...pair].sort((x, y) => x.roster_id - y.roster_id);
        const pa = projectMatchup({ matchup: a, players, projections, games });
        const pb = projectMatchup({ matchup: b, players, projections, games });
        if (!pa.available || !pb.available) continue;
        const p = computeWinProbability({ myCurrent: a.points, oppCurrent: b.points, myProjRemaining: pa.remaining, oppProjRemaining: pb.remaining });
        sample[matchupId] = Math.round(p * 10000) / 10000;
    }
    return sample;
}
