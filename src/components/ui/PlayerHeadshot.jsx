import { playerHeadshotUrl, teamLogoUrl, isDSTStarterId } from '../../utils/nflData';

const FALLBACK = 'https://sleepercdn.com/images/v2/icons/player_default.webp';

const SIZES = {
    20: 'h-5 w-5',
    24: 'h-6 w-6',
    28: 'h-7 w-7',
    32: 'h-8 w-8',
    40: 'h-10 w-10',
    48: 'h-12 w-12',
};

/**
 * Player headshot with a graceful fallback.
 *
 * D/ST "players" are team abbreviations, not numeric ids, so their headshot
 * URL 404s — those render the team logo instead of a generic silhouette.
 */
export function PlayerHeadshot({ playerId, name = '', size = 28, ringTone = 'border-line', className = '' }) {
    const isDST = isDSTStarterId(String(playerId || ''));
    const src = isDST ? teamLogoUrl(playerId) : playerHeadshotUrl(playerId);
    const box = SIZES[size] || SIZES[28];

    return (
        <div className={`${box} rounded-full overflow-hidden bg-bg-3 border ${ringTone} shrink-0 ${className}`}>
            {src ? (
                <img
                    src={src}
                    alt={name}
                    loading="lazy"
                    className={`h-full w-full ${isDST ? 'object-contain p-0.5' : 'object-cover'}`}
                    onError={(e) => {
                        // Null the handler first so a failing fallback can't loop.
                        e.target.onerror = null;
                        e.target.src = FALLBACK;
                    }}
                />
            ) : (
                <div className="h-full w-full striped-placeholder" aria-hidden="true" />
            )}
        </div>
    );
}

export default PlayerHeadshot;
