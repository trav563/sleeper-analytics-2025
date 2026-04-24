/**
 * Simple win-probability model for a fantasy football matchup.
 *
 * Each side's final score is modeled as:
 *   final = current + projectedRemaining + Normal(0, σ)
 * with σ = projectedRemaining * varianceFactor.
 *
 * P(myFinal > oppFinal) is then a normal CDF over the difference.
 *
 * Returns 0..1. Caller can multiply by 100 for display.
 */

// Abramowitz & Stegun 7.1.26 — error function approximation, max error ~1.5e-7.
function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * ax);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return sign * y;
}

/** Normal CDF — P(Z <= z) for standard normal. */
function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * @param {object} args
 * @param {number} args.myCurrent           Current points scored by my side.
 * @param {number} args.oppCurrent          Current points scored by opponent.
 * @param {number} args.myProjRemaining     Projected points still to come for my side (sum of starters who haven't finished).
 * @param {number} args.oppProjRemaining    Projected points still to come for opponent.
 * @param {number} [args.varianceFactor=0.18]  σ = projRemaining * factor. 0.18 ≈ ESPN-style.
 * @returns {number} Probability my side wins, in [0, 1].
 */
export function computeWinProbability({
    myCurrent = 0,
    oppCurrent = 0,
    myProjRemaining = 0,
    oppProjRemaining = 0,
    varianceFactor = 0.18,
}) {
    const myFinalMean = myCurrent + myProjRemaining;
    const oppFinalMean = oppCurrent + oppProjRemaining;
    const myVar = (myProjRemaining * varianceFactor) ** 2;
    const oppVar = (oppProjRemaining * varianceFactor) ** 2;

    const diffMean = myFinalMean - oppFinalMean;
    const diffStd = Math.sqrt(myVar + oppVar);

    // Both sides are done — no uncertainty. Return 0/0.5/1 deterministically.
    if (diffStd === 0) {
        if (diffMean > 0) return 1;
        if (diffMean < 0) return 0;
        return 0.5;
    }

    return normalCdf(diffMean / diffStd);
}

/** Convenience: returns the same as a percent string, e.g. "62%". */
export function formatWinProbabilityPercent(p) {
    return `${Math.round(p * 100)}%`;
}
