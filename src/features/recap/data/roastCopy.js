// Roast copy templates — {placeholders} are replaced at render time
// Each category has 6-8 variations for variety across a 17-week season.
// Tone: playful trash talk, mix of savage/sarcastic/deadpan.

export const WEEKLY_COPY = {
    robbery: [
        { text: "Scored {score} points (would beat {percentile}% of the league) but lost to {opponent}. Call the cops.", sub: "Victim of circumstance" },
        { text: "Put up {score} and still caught an L from {opponent}. The fantasy gods chose violence.", sub: "Would've beaten {percentile}% of the league" },
        { text: "{score} points should win you a week. Unless you play {opponent}, apparently.", sub: "Better than {percentile}% of the field... still lost" },
        { text: "Dropped {score} points and has nothing to show for it. {opponent} said 'cool story bro.'", sub: "Pain. Just pain." },
        { text: "Imagine scoring {score} points and losing. Now imagine that's your actual life. Welcome to {opponent}'s world.", sub: "Would've won against {percentile}% of teams" },
        { text: "{score} points. A heroic effort. A valiant performance. A completely wasted week thanks to {opponent}.", sub: "The schedule is a cruel mistress" },
        { text: "The audacity of {opponent} to outscore {score} points. Some crimes go unpunished.", sub: "Would've beaten {percentile}% of the league" },
    ],
    worstManager: [
        { text: "Left {benchPoints} points on the bench courtesy of {benchPlayer}. That's called malpractice.", sub: "Optimal: {optimal} | Actual: {actual}" },
        { text: "{benchPlayer} went off for {benchPoints} on the bench while the starters sleepwalked. Incredible.", sub: "Lineup efficiency: yikes" },
        { text: "Benched {benchPlayer} ({benchPoints} pts). Sometimes the best player on your team is the one you forgot about.", sub: "Left {diff} points on the table" },
        { text: "{benchPlayer} sitting on the bench with {benchPoints} points like a caged animal. Free them.", sub: "Optimal: {optimal} | Actual: {actual}" },
        { text: "The disrespect to {benchPlayer}. {benchPoints} points from the bench. This manager simply does not check their lineup.", sub: "{diff} points left on the table" },
        { text: "Lineup management? Never heard of it. {benchPlayer} dropped {benchPoints} from the shadow realm (the bench).", sub: "Actual: {actual} | Could've had: {optimal}" },
        { text: "If {benchPlayer} could talk, they'd request a trade. {benchPoints} points wasted on the bench.", sub: "Coaching: F-" },
    ],
    topRookie: [
        { text: "{playerName} dropped {points} pts. The future is now.", sub: "Managed by {manager}" },
        { text: "{playerName} put up {points} as a rookie. Dynasty managers, take note.", sub: "Rostered by {manager}" },
        { text: "{points} points from a rook. {playerName} didn't get the memo that rookies are supposed to struggle.", sub: "{manager}'s investment paying off" },
        { text: "{playerName} out here scoring {points} like a 10-year vet. Rookies aren't supposed to do this.", sub: "Dynasty gold for {manager}" },
        { text: "Remember the name: {playerName}. {points} points in their rookie campaign.", sub: "{manager} looking like a genius right now" },
        { text: "{playerName} chose violence in their rookie year. {points} points. League on notice.", sub: "Owned by {manager}" },
    ],
    bagCarrier: [
        { text: "{playerName} accounted for {percentage}% of the total score. That's not a team, that's a one-man show.", sub: "Without them, this roster is a paper weight" },
        { text: "{playerName} put the entire team on their back. {percentage}% of the points. Everybody else took the week off.", sub: "Certified carry job" },
        { text: "Remove {playerName} and this team scores like a bye week. {percentage}% of the total. Disgusting carry.", sub: "The rest of the roster owes them dinner" },
        { text: "{playerName}: {percentage}% of the score. The other starters were essentially cheerleaders.", sub: "One-man army" },
        { text: "This just in: {playerName} is the entire franchise. {percentage}% of the points. Everyone else was decorative.", sub: "Carrying harder than Atlas" },
        { text: "{percentage}% from one player. {playerName} didn't just carry the team — they ARE the team.", sub: "The rest of the roster: moral support" },
    ],
    coinFlipFail: [
        { text: "Started {starter} ({starterPoints}) over {bench} ({benchPoints}). That one stings.", sub: "Trust issues loading..." },
        { text: "Chose {starter} ({starterPoints}) when {bench} ({benchPoints}) was RIGHT THERE on the bench.", sub: "Same position. Wrong call." },
        { text: "{bench} dropped {benchPoints} on the bench while {starter} put up {starterPoints} in the lineup. Manager intuition: broken.", sub: "Hindsight is 20/20, but still" },
        { text: "The age-old question: {starter} or {bench}? They chose... poorly. {starterPoints} vs {benchPoints}.", sub: "Start/sit regret level: maximum" },
        { text: "{starter} ({starterPoints}) started over {bench} ({benchPoints}). Somewhere, a projections model is crying.", sub: "A tale of two timelines" },
        { text: "Plot twist: {bench} ({benchPoints}) outscored {starter} ({starterPoints}) from the bench. The manager chose chaos.", sub: "Wrong coin flip" },
    ],
    cardioKing: [
        { text: "Had {count} starters score under 5 points. At that point just start your bench.", sub: "Total score: {score}" },
        { text: "{count} starters couldn't crack 5 points. Were they even playing football?", sub: "A true team effort in doing nothing" },
        { text: "Somehow assembled {count} starters who all scored under 5. That takes anti-talent.", sub: "Score: {score} | Dignity: 0" },
        { text: "{count} players under 5 points. This lineup was built by a random number generator.", sub: "Combined output: disappointment" },
        { text: "Starting {count} players who can't score 5 points is actually impressive in a sad way.", sub: "Total: {score}" },
        { text: "{count} starters with sub-5 performances. The bench was begging for a chance.", sub: "Lineup of the week (derogatory)" },
    ],
    tankCommander: [
        { text: "Put up {score} points total. Tanking or just bad? Either way, the league noticed.", sub: "Lowest score of the week" },
        { text: "{score} points. That's not a fantasy score, that's a golf score.", sub: "Leading the tank brigade" },
        { text: "Scored {score} total points. At this rate, a bye week roster might outscore them.", sub: "Commander of the tank" },
        { text: "{score} points. That's not competing, that's spectating with extra steps.", sub: "Rock bottom (for now)" },
        { text: "With {score} points, this team is officially donating wins to the league.", sub: "Worst score of the week" },
        { text: "{score} points. Even the kicker is disappointed.", sub: "Securing that draft position" },
    ],
    luckyCharm: [
        { text: "Won with just {score} points because {opponent} was somehow even worse ({opponentScore}).", sub: "A win is a win... technically" },
        { text: "Squeaked out a W with {score} pts. {opponent} ({opponentScore}) was the only team bad enough to lose to this.", sub: "Blessed by the schedule gods" },
        { text: "{score} points and still got the W. When you're lucky, you're lucky.", sub: "Opponent {opponent} scored {opponentScore}" },
        { text: "The football gods smiled upon {score} points this week. {opponent}'s {opponentScore} was the only thing uglier.", sub: "Luck > Skill" },
        { text: "Winning with {score} points should be illegal. {opponent} ({opponentScore}) made it possible.", sub: "The schedule giveth" },
        { text: "{score} points. In any other matchup, that's an L. But {opponent} ({opponentScore}) said 'hold my beer.'", sub: "Luckiest win of the week" },
    ],
    closeCall: [
        { text: "{winner} survived by {margin} points over {loser}. One garbage time catch changes everything.", sub: "{winnerScore} - {loserScore}" },
        { text: "A {margin}-point margin. {winner} is thanking every stat correction that went their way.", sub: "Nail-biter: {winnerScore} to {loserScore}" },
        { text: "{winner} won by {margin} points. {loser} is going to be refreshing stat corrections all week.", sub: "Heart rate: elevated" },
        { text: "{margin} points. That's the difference between celebrating and refreshing the score page at 2am. {winner} celebrates.", sub: "{winnerScore} to {loserScore}" },
        { text: "By {margin} points, {winner} escapes. {loser} will be haunted by every play they second-guessed.", sub: "Closest game of the week" },
        { text: "{winner} over {loser} by {margin}. A single knee, a single spike, a single anything could've flipped it.", sub: "{winnerScore} - {loserScore}" },
    ],
    ghost: [
        { text: "Started {count} player(s) who scored exactly 0 points. {ghostNames} were literal ghosts.", sub: "Check if they were even active" },
        { text: "{ghostNames} combined for a grand total of zero. Not one. Zero.", sub: "{count} ghost(s) in the starting lineup" },
        { text: "Had {count} starter(s) put up a donut. {ghostNames} gave new meaning to 'zero upside.'", sub: "Free roster spots, basically" },
        { text: "{count} goose egg(s) from {ghostNames}. That's not bad luck, that's not checking injury reports.", sub: "Ghosts in the machine" },
        { text: "Starting {ghostNames} and getting 0 points is a choice. A bad one, but a choice.", sub: "{count} ghost(s)" },
        { text: "{ghostNames}: 0.00 points combined. Even a defense on bye would've been more useful.", sub: "Invisible on the field and the scoreboard" },
    ],
    boomGame: [
        { text: "{playerName} erupted for {points} points. League-winner type performance.", sub: "Rostered by {manager}" },
        { text: "{points} points from {playerName}. That's not a stat line, that's a cheat code.", sub: "Owned by {manager}" },
        { text: "{playerName} went absolutely nuclear with {points} pts. Everyone else was playing for second.", sub: "Top scorer of the week" },
        { text: "{playerName}: {points} points. That's the kind of game you screenshot and send to the group chat.", sub: "Managed by {manager}" },
        { text: "Give {playerName} the game ball. {points} points. The rest of the league is jealous.", sub: "Rostered by {manager}" },
        { text: "{points} from {playerName}. This is why you drafted them. This is the ceiling. It's beautiful.", sub: "Owned by {manager}" },
    ],
    overachiever: [
        { text: "Averaged {avgPPG} PPG coming in but exploded for {score} this week. A {diff}-point overperformance.", sub: "Best week relative to expectations" },
        { text: "Season average: {avgPPG}. This week: {score}. That's {diff} points above the norm. Something clicked.", sub: "Exceeded expectations by the widest margin" },
        { text: "{score} points when everyone expected {avgPPG}. The overachievement award goes to this week's surprise package.", sub: "+{diff} above season average" },
        { text: "Coming in averaging {avgPPG} and dropping {score}? That's not a performance, that's a statement.", sub: "Outperformed themselves by {diff} points" },
        { text: "{diff} points above their season average. From {avgPPG} PPG to {score} this week. The definition of overachieving.", sub: "Best performance relative to baseline" },
        { text: "Their season average said {avgPPG}. This week said {score}. The math ain't mathing, but the W might be.", sub: "+{diff} above expectations" },
    ],
    underachiever: [
        { text: "Averaging {avgPPG} PPG but only managed {score} this week. A {diff}-point nosedive.", sub: "Worst week relative to expectations" },
        { text: "Season average: {avgPPG}. This week: {score}. Something went very, very wrong.", sub: "Underperformed by {diff} points" },
        { text: "{score} points from a team averaging {avgPPG}? This is what regression to the mean's evil twin looks like.", sub: "-{diff} below season average" },
        { text: "Expected {avgPPG}. Got {score}. That's a {diff}-point underperformance. The wheels fell off.", sub: "Below their own baseline" },
        { text: "From {avgPPG} PPG to {score} this week. That's not a dip, that's a cliff dive.", sub: "Fell {diff} points below average" },
        { text: "This roster averages {avgPPG} but showed up with {score}. Even their own standards are disappointed.", sub: "Biggest underperformance of the week" },
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

// Deterministic hash — same league + week + category always produces the same selection
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Seeded copy selection — all users in the same league see the same roast for a given week
export function getSeededCopy(bank, category, seed) {
    const options = bank[category];
    if (!options || options.length === 0) return { text: '', sub: '' };
    return options[simpleHash(`${seed}-${category}`) % options.length];
}

// Keep legacy random function for backward compatibility (not used in weekly roast anymore)
export function getRandomCopy(bank, category) {
    const options = bank[category];
    if (!options || options.length === 0) return { text: '', sub: '' };
    return options[Math.floor(Math.random() * options.length)];
}

export function fillTemplate(template, data) {
    return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? '');
}
