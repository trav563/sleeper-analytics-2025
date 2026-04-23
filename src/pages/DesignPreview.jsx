import { useState } from "react";
import { Pip } from "../components/ui/Pip";
import { LiveDot } from "../components/ui/LiveDot";
import { StatCell } from "../components/ui/StatCell";
import { Trend } from "../components/ui/Trend";
import { SectionCard } from "../components/ui/SectionCard";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { TabBar } from "../components/ui/TabBar";
import { TeamRow } from "../components/ui/TeamRow";

const sampleTeams = [
  { rank: 1, seed: "alpha", name: "Pop Smoke Pioneers", record: "6-1", streak: 3, pf: 932.4, pa: 814.2, power: 2 },
  { rank: 2, seed: "beta",  name: "Burrow's Bunker",     record: "5-2", streak: 1, pf: 901.1, pa: 832.5, power: -1 },
  { rank: 3, seed: "gamma", name: "Mahomes Sweet Home",  record: "5-2", streak: -1, pf: 880.2, pa: 850.0, power: 0, current: true },
  { rank: 4, seed: "delta", name: "Allenpalooza",        record: "4-3", streak: 2, pf: 855.6, pa: 845.9, power: 1 },
  { rank: 11, seed: "tail", name: "Mr. Irrelevant",      record: "1-6", streak: -4, pf: 720.1, pa: 920.3, power: -3 },
];

export default function DesignPreview() {
  const [tab, setTab] = useState("overview");
  const [bottomTab, setBottomTab] = useState("home");

  return (
    <div className="bg-bg min-h-screen text-text font-sans px-4 md:px-8 py-6 pb-32">
      <header className="mb-6">
        <div className="text-2xs font-bold tracking-wider uppercase text-text-mute">
          Broadcast Scoreboard · Atom Library
        </div>
        <h1 className="font-display text-2xl font-bold tracking-snug mt-1">
          Design Preview
        </h1>
        <p className="text-text-dim text-sm mt-1">
          Smoke test for tokens, fonts, and atoms. Visit at <code className="font-mono text-signal">/_design</code>.
        </p>
      </header>

      <div className="grid gap-5 max-w-5xl mx-auto">
        {/* Color tokens */}
        <SectionCard title="Color tokens" eyebrow="Tokens">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              ["bg",        "#07080A"],
              ["bg-1",      "#0F1115"],
              ["bg-2",      "#161920"],
              ["bg-3",      "#1E222B"],
              ["text",      "#F5F6F8"],
              ["text-dim",  "#9097A3"],
              ["text-mute", "#5A6170"],
              ["signal",    "#F5B301"],
              ["signal-2",  "#FF5A36"],
              ["good",      "#4ADE80"],
              ["bad",       "#F87171"],
              ["warn",      "#FBBF24"],
              ["live",      "#22E07A"],
            ].map(([name, hex]) => (
              <div key={name} className="rounded-md overflow-hidden border border-line">
                <div className="h-12 w-full" style={{ background: hex }} />
                <div className="px-2 py-1.5 bg-bg-2">
                  <div className="text-2xs font-bold tracking-wider uppercase text-text-dim">{name}</div>
                  <div className="font-mono text-2xs text-text-mute">{hex}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Type */}
        <SectionCard title="Typography" eyebrow="Type">
          <div className="space-y-2">
            <div className="font-display text-[44px] tracking-tight font-extrabold tnum">138.4</div>
            <div className="font-display text-2xl tracking-snug font-bold">Hero heading</div>
            <div className="text-md font-semibold">Card title (text-md)</div>
            <div className="text-sm text-text-dim">Body text — neutral dim color</div>
            <div className="font-mono text-2xs text-text-mute uppercase tracking-wider">BAL · QB · 29YO</div>
          </div>
        </SectionCard>

        {/* Pips */}
        <SectionCard title="Pips" eyebrow="Atom · team avatar">
          <div className="flex items-center gap-3 flex-wrap">
            <Pip seed="alpha" name="Pop Smoke Pioneers" size={28} />
            <Pip seed="beta" name="Burrow's Bunker" size={36} />
            <Pip seed="gamma" name="Mahomes Sweet Home" size={48} ring />
            <Pip seed="delta" name="Allenpalooza" size={56} />
            <Pip seed="" name="?" size={28} />
          </div>
        </SectionCard>

        {/* StatCells */}
        <SectionCard title="StatCells" eyebrow="Atom · hero metric">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCell label="Live" value="138.4" tone="default" />
            <StatCell label="Proj" value="142.1" tone="signal" />
            <StatCell label="Win Prob" value="71%" tone="default" />
            <StatCell label="In play" value="3" tone="live" />
          </div>
        </SectionCard>

        {/* LiveDot + Trend */}
        <SectionCard title="LiveDot · Trend" eyebrow="Atom · in-play / delta">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-dim">
              <LiveDot /> Live · Q3 9:42
            </span>
            <span className="inline-flex items-center gap-2">
              Power <Trend v={3} />
            </span>
            <span className="inline-flex items-center gap-2">
              Power <Trend v={-2} />
            </span>
            <span className="inline-flex items-center gap-2">
              Power <Trend v={0} />
            </span>
          </div>
        </SectionCard>

        {/* Segmented tabs */}
        <SectionCard title="SegmentedTabs" eyebrow="Atom · pill control">
          <SegmentedTabs
            tabs={["overview", "lineup", "matchup"]}
            value={tab}
            onChange={setTab}
            className="max-w-md"
          />
          <div className="text-xs text-text-mute mt-2 font-mono">active: {tab}</div>
        </SectionCard>

        {/* TeamRow */}
        <SectionCard title="TeamRow" eyebrow="Molecule · standings list">
          <ul className="divide-y divide-line">
            {sampleTeams.map((t) => (
              <li key={t.rank}>
                <TeamRow {...t} />
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* AI badge */}
        <SectionCard title="Misc" eyebrow="Inline marks">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-2xs font-extrabold tracking-wider px-1.5 py-0.5 rounded-sm text-ink uppercase"
              style={{ background: "linear-gradient(90deg, var(--signal), var(--signal-2))" }}
            >
              AI
            </span>
            <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">
              eyebrow label
            </span>
            <kbd className="font-mono text-2xs text-text-dim border border-line bg-bg-2 px-1.5 py-0.5 rounded-sm">
              shift + ?
            </kbd>
          </div>
        </SectionCard>
      </div>

      {/* Floating bottom nav (mobile pattern, but visible always for the demo) */}
      <TabBar
        items={[
          { value: "home",  label: "Home" },
          { value: "lineup", label: "Lineup" },
          { value: "matchup", label: "Matchup" },
          { value: "stats", label: "Stats" },
          { value: "more",  label: "More" },
        ]}
        value={bottomTab}
        onChange={setBottomTab}
      />
    </div>
  );
}
