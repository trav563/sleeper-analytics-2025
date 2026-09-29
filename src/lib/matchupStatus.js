import { gamePhase } from './liveProjection';

/** Status is independent of projections and scores: points alone never prove finality. */
export function matchupStatus({ matchups = [], players = {}, games = {}, week, completedWeek = 0 }) {
    if (!matchups.length || matchups.some(m => !Array.isArray(m?.starters))) return 'Unavailable';
    if (week > 0 && week <= completedWeek) return 'Final';
    const phases = matchups.flatMap(m => m.starters.filter(id => id && id !== '0').map(id => {
        const player = players[id];
        return gamePhase(games[player?.team || (player?.position === 'DEF' ? id : '')]);
    }));
    if (phases.includes('LIVE')) return 'Live';
    if (!phases.length || phases.includes('UNKNOWN')) return 'Unavailable';
    if (phases.every(p => p === 'DONE')) return 'Final';
    return phases.some(p => p === 'DONE') ? 'In progress' : 'Upcoming';
}

export function remainingStarters(matchup, players = {}, games = {}, isFinal = false) {
    if (isFinal) return 0;
    if (!Array.isArray(matchup?.starters)) return null;
    const phases = matchup.starters.filter(id => id && id !== '0').map(id => {
        const player = players[id];
        return gamePhase(games[player?.team || (player?.position === 'DEF' ? id : '')]);
    });
    return phases.includes('UNKNOWN') ? null : phases.filter(p => p !== 'DONE').length;
}
