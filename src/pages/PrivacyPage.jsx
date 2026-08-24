import { Link } from 'react-router-dom';
import { Shield, Database, Sparkles, HardDrive, BarChart3, Trash2 } from 'lucide-react';

const Section = ({ icon: Icon, title, children }) => (
    <section className="bg-bg-1 rounded-xl border border-line shadow-card">
        <header className="px-4 pt-3 pb-2 border-b border-line flex items-center gap-2">
            <Icon className="w-4 h-4 text-signal" aria-hidden="true" />
            <h2 className="font-display text-md font-semibold text-text">{title}</h2>
        </header>
        <div className="px-4 py-3 space-y-3 text-sm text-text-dim leading-relaxed">{children}</div>
    </section>
);

const PrivacyPage = () => (
    <div className="max-w-3xl mx-auto space-y-4">
        <header className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-text">Privacy</h1>
            <p className="text-sm text-text-dim leading-relaxed">
                Plain language, no legalese. This app reads Sleeper's public API and runs almost
                entirely in your browser. There is no account, no password, and no database of users.
            </p>
        </header>

        <Section icon={Database} title="Where the data comes from">
            <p>
                Everything about your league — rosters, matchups, standings, transactions, draft
                picks — is read from{' '}
                <a href="https://docs.sleeper.com" target="_blank" rel="noreferrer" className="text-signal hover:underline">
                    Sleeper's public API
                </a>
                . Anyone with your league ID can read the same data directly from Sleeper. We add
                dynasty player values from FantasyCalc and DynastyProcess, game context from ESPN,
                and headlines from an FFToday feed.
            </p>
            <p>
                We do not store your league on a server. Nothing is written to a database, and no
                league data is retained after your request finishes.
            </p>
        </Section>

        <Section icon={Sparkles} title="AI analysis — read this one">
            <p className="text-text">
                When you press the button to generate an AI analysis of a team, that request is sent
                to a language model provider. What gets sent includes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
                <li>The league's name and scoring settings</li>
                <li>
                    <span className="text-text">Every manager's display name and win-loss record</span>{' '}
                    — not just yours
                </li>
                <li>The full roster of the team being analyzed</li>
                <li>Opponents' starting lineups for the relevant week</li>
                <li>That team's game log for the season</li>
                <li>Recent league transactions (adds, drops, trades)</li>
            </ul>
            <p>
                It goes to <span className="text-text">Google</span> (model:{' '}
                <code className="font-mono text-2xs">gemini-3-flash</code>), falling back to{' '}
                <span className="text-text">Anthropic</span> (
                <code className="font-mono text-2xs">claude-haiku-4.5</code>) if Google is
                unavailable, routed through the Vercel AI Gateway. Their handling is governed by
                their own policies, not ours.
            </p>
            <p>
                This is the only feature that sends league data anywhere other than your own
                browser, and it only runs when you explicitly ask for it. Because it includes your
                league-mates' names and records, it shares a little about people who never opened
                this app — so if that matters in your league, don't use it.
            </p>
        </Section>

        <Section icon={HardDrive} title="What's stored in your browser">
            <p>All of it is <span className="text-text">localStorage</span> on your own device:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Your Sleeper profile (username, user ID, avatar) so you don't re-enter it</li>
                <li>Cached AI analyses — automatically deleted after 7 days</li>
                <li>Cached playoff-odds simulations</li>
                <li>Anything you've saved in the schedule generator</li>
                <li>Your light/dark theme choice</li>
            </ul>
            <p>
                No cookies, no session storage, no fingerprinting, no third-party trackers or ad
                scripts.
            </p>
        </Section>

        <Section icon={Shield} title="What's stored on the server">
            <p>
                One thing: a counter that limits how many AI analyses can be requested per hour and
                per day. It is keyed on IP address, expires within 24 hours, and is not linked to
                your Sleeper account or any league.
            </p>
        </Section>

        <Section icon={BarChart3} title="Analytics">
            <p>
                Page views are counted with Vercel Web Analytics so we can see which features get
                used. League, team, and player IDs are stripped out of the URL before anything is
                sent — a visit shows up as{' '}
                <code className="font-mono text-2xs">/league/[leagueId]/tools</code>, never the real
                ID. No cross-site tracking, and no profile is built about you.
            </p>
        </Section>

        <Section icon={Trash2} title="Removing your data">
            <p>
                Use <span className="text-text">Sign out</span> in the menu. It clears your stored
                Sleeper profile, cached AI analyses, cached odds, and saved schedules from this
                browser. Clearing site data for this domain does the same thing.
            </p>
            <p>
                To change what's in your league, change it in Sleeper — this app only reads.
            </p>
        </Section>

        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
            Last updated 2026-08-24 ·{' '}
            <Link to="/" className="text-signal hover:underline">
                Back to app
            </Link>
        </p>
    </div>
);

export default PrivacyPage;
