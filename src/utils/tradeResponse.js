import { CONSOLIDATION_PREMIUM } from './tradeCandidates.js';

// Concrete offers are rendered from verified objects, never from model prose.
const label = value => String(value || 'Unknown').replace(/[\r\n*_`<>[\]]/g, ' ').trim();
const asset = p => `${label(p.name || `${p.first_name || ''} ${p.last_name || ''}`)} (${p.position}, age ${p.age ?? 'unknown'}${p.ownershipStatus && p.ownershipStatus !== 'Active' ? `, ${p.ownershipStatus}` : ''}; value ${p.tradeValue.toLocaleString()})`;

export function formatTradeResponse({ mode, candidates, teamName, opponentName, valuesAvailable }) {
    const title = mode === 'sell-high' ? 'Sell-high Candidates' : 'Trade-up Ideas';
    if (!candidates.length) return `## ${title}\n\n${valuesAvailable
        ? 'No supported deals passed the market-value, ownership, and two-team lineup checks. No speculative packages are recommended.'
        : 'Trustworthy market values are unavailable. Precise trade recommendations are withheld until values can be verified.'}${mode === 'sell-high' ? '\n\nA current value snapshot cannot establish a historical selling peak.' : ''}`;
    const sections = candidates.map((offer, index) => `${index + 1}. **${label(teamName)} ↔ ${label(opponentName(offer.opponentRosterId))}**
- **You send:** ${offer.give.map(asset).join(' + ')} — total ${offer.giveValue.toLocaleString()}.
- **You receive:** ${offer.receive.map(asset).join(' + ')} — total ${offer.receiveValue.toLocaleString()}.
- **Roster fit:** Your market-weighted starting group improves by ${offer.myGain.toLocaleString()} value points; theirs improves by ${offer.theirGain.toLocaleString()}. Neither team loses a fillable starting slot. These are value points, not weekly scoring projections.
${offer.give.length > 1 ? `- **Consolidation premium:** ${((offer.giveValue / offer.receiveValue - 1) * 100).toFixed(1)}% (screening minimum ${CONSOLIDATION_PREMIUM * 100}%).\n` : ''}`).join('\n');
    return `## ${title}\n\n${sections}\nThese are screening heuristics, not acceptance probabilities.${mode === 'sell-high' ? ' A current value snapshot cannot establish a historical selling peak.' : ''}`;
}
