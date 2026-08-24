/**
 * Dynasty player valuation fallback, shared by the trade tools.
 *
 * Only used when FantasyCalc has no market value for a player — real market
 * values already price age in, which is the whole point of a dynasty value.
 * This formula approximates that with an explicit age curve so a 31-year-old
 * and a 24-year-old with the same production don't come out equal.
 */
export const calculateFallbackValue = (ppg, age, position, isSuperflex = true, searchRank = 9999) => {
    // If no PPG data, estimate value from search_rank (lower rank = higher value)
    if (!ppg || ppg <= 0) {
        if (searchRank >= 9999 || !searchRank) return 0;
        // Exponential decay: top players get high value, drops off fast
        // Rank 1 → ~9000, Rank 25 → ~5500, Rank 75 → ~3000, Rank 150 → ~1500, Rank 300 → ~600
        let value = 9000 * Math.exp(-0.018 * searchRank);

        const safeAge = age || 25;
        if (safeAge < 24) value *= 1.3;
        else if (safeAge > 28) value *= 0.8;

        if (isSuperflex && position === 'QB') value *= 1.3;

        return Math.round(Math.max(0, value));
    }

    // 1. Base Score
    let value = ppg * 150;

    // 2. Age Multipliers (Dynasty Context)
    const safeAge = age || 25;

    if (safeAge < 24) value *= 1.5;        // Youth Premium
    else if (safeAge <= 27) value *= 1.2;  // Prime
    else if (safeAge <= 30) value *= 0.9;  // Post-Apex
    else value *= 0.6;                     // Cliff

    // 3. Superflex Bonus
    if (isSuperflex && position === 'QB') {
        value += 1500;
    }

    return Math.round(value);
};

export default calculateFallbackValue;
