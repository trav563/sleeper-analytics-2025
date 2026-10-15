import { CONSOLIDATION_PREMIUM, STRATEGY_LABELS, describeFit } from './tradeCandidates.js';

// Concrete offers are rendered from verified objects, never from model prose.
const label = value => String(value || 'Unknown').replace(/[\r\n*_`<>[\]]/g, ' ').trim();
const asset = p => p.kind === 'pick'
    ? `${label(p.name)} (draft pick; value ${p.tradeValue.toLocaleString()})`
    : `${label(p.name || `${p.first_name || ''} ${p.last_name || ''}`)} (${p.position}, age ${p.age ?? 'unknown'}${p.ownershipStatus && p.ownershipStatus !== 'Active' ? `, ${p.ownershipStatus}` : ''}; value ${p.tradeValue.toLocaleString()})`;

export function formatTradeResponse({ mode, candidates, teamName, opponentName, valuesAvailable }) {
    const title = mode === 'sell-high' ? 'Sell-high Candidates' : 'Trade-up Ideas';
    if (!candidates.length) return `## ${title}\n\n${valuesAvailable
        ? 'No supported deals passed the market-value, ownership, and two-team strategy checks. No speculative packages are recommended.'
        : 'Trustworthy market values are unavailable. Precise trade recommendations are withheld until values can be verified.'}${mode === 'sell-high' ? '\n\nA current value snapshot cannot establish a historical selling peak.' : ''}`;
    const sections = candidates.map((offer, index) => {
        const youConsolidate = offer.give.length > offer.receive.length;
        const premium = youConsolidate ? offer.giveValue / offer.receiveValue - 1 : offer.receiveValue / offer.giveValue - 1;
        return `${index + 1}. **${label(teamName)} ↔ ${label(opponentName(offer.opponentRosterId))}**
- **You send:** ${offer.give.map(asset).join(' + ')} — total ${offer.giveValue.toLocaleString()}.
- **You receive:** ${offer.receive.map(asset).join(' + ')} — total ${offer.receiveValue.toLocaleString()}.
- **Roster fit:** You (${STRATEGY_LABELS[offer.me.strategy]}): ${describeFit(offer.me)}. ${label(opponentName(offer.opponentRosterId))} (${STRATEGY_LABELS[offer.them.strategy]}): ${describeFit(offer.them)}. Neither team loses a fillable starting slot. Changes are shares of market-valued roster strength, not weekly scoring projections.
${offer.give.length !== offer.receive.length ? `- **Consolidation premium:** ${(premium * 100).toFixed(1)}% paid by ${youConsolidate ? 'you' : 'them'} (screening minimum ${CONSOLIDATION_PREMIUM * 100}%).\n` : ''}`;
    }).join('\n');
    return `## ${title}\n\n${sections}\nThese are screening heuristics, not acceptance probabilities.${mode === 'sell-high' ? ' A current value snapshot cannot establish a historical selling peak.' : ''}`;
}
