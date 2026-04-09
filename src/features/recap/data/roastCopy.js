// Roast copy templates — {placeholders} are replaced at render time
// Each category has 3-5 variations. Tone: playful trash talk.

export const WEEKLY_COPY = {
    robbery: [
        { text: "Scored {score} points (would beat {percentile}% of the league) but lost to {opponent}. Call the cops.", sub: "Victim of circumstance" },
        { text: "Put up {score} and still caught an L from {opponent}. The fantasy gods chose violence.", sub: "Would've beaten {percentile}% of the league" },
        { text: "{score} points should win you a week. Unless you play {opponent}, apparently.", sub: "Better than {percentile}% of the field... still lost" },
        { text: "Dropped {score} points and has nothing to show for it. {opponent} said 'cool story bro.'", sub: "Pain. Just pain." },
    ],
    worstManager: [
        { text: "Left {benchPoints} points on the bench courtesy of {benchPlayer}. That's called malpractice.", sub: "Optimal: {optimal} | Actual: {actual}" },
        { text: "{benchPlayer} went off for {benchPoints} on the bench while the starters sleepwalked. Incredible.", sub: "Lineup efficiency: yikes" },
        { text: "Benched {benchPlayer} ({benchPoints} pts). Sometimes the best player on your team is the one you forgot about.", sub: "Left {diff} points on the table" },
    ],
    topRookie: [
        { text: "{playerName} dropped {points} pts. The future is now.", sub: "Managed by {manager}" },
        { text: "{playerName} put up {points} as a rookie. Dynasty managers, take note.", sub: "Rostered by {manager}" },
        { text: "{points} points from a rook. {playerName} didn't get the memo that rookies are supposed to struggle.", sub: "{manager}'s investment paying off" },
    ],
    bagCarrier: [
        { text: "{playerName} accounted for {percentage}% of the total score. That's not a team, that's a one-man show.", sub: "Without them, this roster is a paper weight" },
        { text: "{playerName} put the entire team on their back. {percentage}% of the points. Everybody else took the week off.", sub: "Certified carry job" },
        { text: "Remove {playerName} and this team scores like a bye week. {percentage}% of the total. Disgusting carry.", sub: "The rest of the roster owes them dinner" },
    ],
    coinFlipFail: [
        { text: "Started {starter} ({starterPoints}) over {bench} ({benchPoints}). That one stings.", sub: "Trust issues loading..." },
        { text: "Chose {starter} ({starterPoints}) when {bench} ({benchPoints}) was RIGHT THERE on the bench.", sub: "Same position. Wrong call." },
        { text: "{bench} dropped {benchPoints} on the bench while {starter} put up {starterPoints} in the lineup. Manager intuition: broken.", sub: "Hindsight is 20/20, but still" },
    ],
    cardioKing: [
        { text: "Had {count} starters score under 5 points. At that point just start your bench.", sub: "Total score: {score}" },
        { text: "{count} starters couldn't crack 5 points. Were they even playing football?", sub: "A true team effort in doing nothing" },
        { text: "Somehow assembled {count} starters who all scored under 5. That takes anti-talent.", sub: "Score: {score} | Dignity: 0" },
    ],
    tankCommander: [
        { text: "Put up {score} points total. Tanking or just bad? Either way, the league noticed.", sub: "Lowest score of the week" },
        { text: "{score} points. That's not a fantasy score, that's a golf score.", sub: "Leading the tank brigade" },
        { text: "Scored {score} total points. At this rate, a bye week roster might outscore them.", sub: "Commander of the tank" },
    ],
    luckyCharm: [
        { text: "Won with just {score} points because {opponent} was somehow even worse ({opponentScore}).", sub: "A win is a win... technically" },
        { text: "Squeaked out a W with {score} pts. {opponent} ({opponentScore}) was the only team bad enough to lose to this.", sub: "Blessed by the schedule gods" },
        { text: "{score} points and still got the W. When you're lucky, you're lucky.", sub: "Opponent {opponent} scored {opponentScore}" },
    ],
    closeCall: [
        { text: "{winner} survived by {margin} points over {loser}. One garbage time catch changes everything.", sub: "{winnerScore} - {loserScore}" },
        { text: "A {margin}-point margin. {winner} is thanking every stat correction that went their way.", sub: "Nail-biter: {winnerScore} to {loserScore}" },
        { text: "{winner} won by {margin} points. {loser} is going to be refreshing stat corrections all week.", sub: "Heart rate: elevated" },
    ],
    ghost: [
        { text: "Started {count} player(s) who scored exactly 0 points. {ghostNames} were literal ghosts.", sub: "Check if they were even active" },
        { text: "{ghostNames} combined for a grand total of zero. Not one. Zero.", sub: "{count} ghost(s) in the starting lineup" },
        { text: "Had {count} starter(s) put up a donut. {ghostNames} gave new meaning to 'zero upside.'", sub: "Free roster spots, basically" },
    ],
    boomGame: [
        { text: "{playerName} erupted for {points} points. League-winner type performance.", sub: "Rostered by {manager}" },
        { text: "{points} points from {playerName}. That's not a stat line, that's a cheat code.", sub: "Owned by {manager}" },
        { text: "{playerName} went absolutely nuclear with {points} pts. Everyone else was playing for second.", sub: "Top scorer of the week" },
    ],
};

export const SEASON_COPY = {
    mostRobbed: [
        { text: "Lost {count} games where they would have beaten most of the league. The schedule is a scam.", sub: "High-scoring losses all season" },
        { text: "Robbed {count} times this season. At some point it's not bad luck, it's a curse.", sub: "Fantasy's unluckiest manager" },
    ],
    benchWarmer: [
        { text: "Left a total of {points} points on the bench this season. That's an entire roster's worth of production.", sub: "Most bench points all season" },
        { text: "{points} total bench points. Imagine if they actually set their lineup optimally.", sub: "King of bad lineup decisions" },
    ],
    backpackAllStar: [
        { text: "Had a single player carry them {count} times this season. Without that player, this team is in the gutter.", sub: "Most carry jobs all season" },
        { text: "Relied on one player for 35%+ of their score {count} different weeks. Depth? Never heard of it.", sub: "Season-long carry job" },
    ],
    seasonMVP: [
        { text: "{playerName} dropped {points} in Week {week}. The single best performance all season.", sub: "Managed by {manager}" },
        { text: "The best game anyone had all year: {playerName} with {points} pts in Week {week}.", sub: "Rostered by {manager}" },
    ],
    seasonTank: [
        { text: "{manager} scored {score} in Week {week}. The single worst performance of the entire season.", sub: "A record nobody wants" },
        { text: "Week {week}: {manager} put up {score} total points. That's the season low across the whole league.", sub: "Rock bottom" },
    ],
    ghostHunter: [
        { text: "Started {count} total players who scored 0 all season. Either bad luck or just not checking lineups.", sub: "Most ghosts in the league" },
        { text: "{count} goose eggs in the starting lineup across the season. That's commitment to chaos.", sub: "Lineup negligence award" },
    ],
    coinFlipChamp: [
        { text: "Left {points} total points on the table from bad start/sit decisions. That's not unlucky, that's a pattern.", sub: "Worst lineup instincts all season" },
        { text: "{points} points lost to wrong calls all season. Some people just have anti-instincts.", sub: "Trust the projections next time" },
    ],
    luckiestManager: [
        { text: "Won {count} games while scoring below the league median. Pure schedule luck.", sub: "Luckiest record in the league" },
        { text: "{count} wins with a below-average score. This manager doesn't need skill when they have matchups like these.", sub: "Fantasy's luckiest soul" },
    ],
};

export function getRandomCopy(bank, category) {
    const options = bank[category];
    if (!options || options.length === 0) return { text: '', sub: '' };
    return options[Math.floor(Math.random() * options.length)];
}

export function fillTemplate(template, data) {
    return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? '');
}
