import { useState, useMemo } from 'react';
import { Button } from '../../../components/ui/Button';
import { Check, AlertTriangle, Copy, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { avatarUrl } from '../../../utils/nflData';
import { cn } from '../../../lib/utils';

const ScheduleOutput = ({ schedule, constraintReport, fairness, teams, users, rosters, leagueName }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const teamLookup = useMemo(() => {
    const map = {};
    for (const t of teams) map[t.id] = t;
    return map;
  }, [teams]);

  const userLookup = useMemo(() => {
    const map = {};
    for (const u of (users || [])) map[u.user_id] = u;
    return map;
  }, [users]);

  const frequencyMatrix = useMemo(() => {
    const counts = {};
    for (const t of teams) {
      counts[t.id] = {};
      for (const t2 of teams) {
        if (t.id !== t2.id) counts[t.id][t2.id] = 0;
      }
    }
    for (const week of schedule) {
      for (const m of week.matchups) {
        if (counts[m.teamA]?.[m.teamB] != null) counts[m.teamA][m.teamB]++;
        if (counts[m.teamB]?.[m.teamA] != null) counts[m.teamB][m.teamA]++;
      }
    }
    return counts;
  }, [schedule, teams]);

  const getTeamDisplay = (teamId) => teamLookup[teamId]?.name || teamId;

  const getTeamAvatar = (teamId) => {
    const roster = rosters?.find(r => String(r.roster_id) === String(teamId));
    const user = roster ? userLookup[roster.owner_id] : null;
    return user?.avatar ? avatarUrl(user.avatar) : null;
  };

  const generateCSV = () => {
    const csvField = (val) => {
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const rows = ['League,' + csvField(leagueName || 'Fantasy League'), `Generated,${new Date().toLocaleDateString()}`, '', 'Week,Matchup,Team A,Team B'];
    for (const week of schedule) {
      week.matchups.forEach((m, idx) => {
        rows.push(`${week.week},${idx + 1},${csvField(getTeamDisplay(m.teamA))},${csvField(getTeamDisplay(m.teamB))}`);
      });
      if (week.byes?.length > 0) {
        rows.push(`${week.week},BYE,${csvField(week.byes.map(b => getTeamDisplay(b)).join('; '))},`);
      }
    }
    return rows.join('\n');
  };

  const generateClipboardText = () => {
    const lines = [`${leagueName || 'Fantasy League'} — Generated Schedule`, `Generated: ${new Date().toLocaleDateString()}`, ''];
    for (const week of schedule) {
      const label = week.isRivalry ? ' (Rivalry)' : week.isLocked ? ' (Locked)' : '';
      lines.push(`Week ${week.week}${label}`);
      lines.push('─'.repeat(30));
      for (const m of week.matchups) {
        lines.push(`  ${getTeamDisplay(m.teamA)}  vs  ${getTeamDisplay(m.teamB)}`);
      }
      if (week.byes?.length > 0) {
        lines.push(`  BYE: ${week.byes.map(b => getTeamDisplay(b)).join(', ')}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateClipboardText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_${leagueName?.replace(/\s+/g, '_') || 'fantasy'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fairnessTone = fairness.score >= 80
    ? 'bg-good/15 text-good border-good/30'
    : fairness.score >= 50
      ? 'bg-warn/15 text-warn border-warn/30'
      : 'bg-bad/15 text-bad border-bad/30';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className={`px-4 py-3 rounded-md border ${fairnessTone}`}>
            <div className="flex items-baseline gap-1.5">
              <p className="tnum font-display text-2xl font-bold">{fairness.score}</p>
              <p className="text-sm opacity-70 tnum">/ 100</p>
            </div>
            <p className="font-mono text-2xs uppercase tracking-wider mt-0.5">{fairness.label}</p>
          </div>
          <div className="text-xs text-text-dim max-w-[280px] space-y-1">
            <p>
              {fairness.mode === 'performance'
                ? 'Measures how evenly opponent strength is distributed across all teams based on actual performance data.'
                : 'Measures how evenly matchups are distributed. Higher means each team faces a similar spread of opponents.'}
            </p>
            {fairness.breakdown?.details && (
              <p className="font-mono text-2xs text-text-mute">
                Matchup variance: <span className="tnum">{fairness.breakdown.details.matchupVariance ?? '—'}</span>
                {fairness.breakdown.details.coefficientOfVariation != null && (
                  <> · SOS variance: <span className="tnum">{fairness.breakdown.details.coefficientOfVariation}</span></>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 border-line text-text hover:bg-bg-2">
            {copied ? <Check className="w-3 h-3 text-good" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1 border-line text-text hover:bg-bg-2">
            <Download className="w-3 h-3" />
            CSV
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'rounded-md border p-3',
          constraintReport.satisfied
            ? 'border-good/30 bg-good/10'
            : 'border-warn/30 bg-warn/10'
        )}
      >
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {constraintReport.satisfied ? (
              <Check className="w-4 h-4 text-good" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warn" />
            )}
            <span className="text-sm font-semibold text-text">
              {constraintReport.satisfied
                ? 'All constraints satisfied'
                : `${constraintReport.violations.length} constraint(s) relaxed`}
            </span>
          </div>
          {!constraintReport.satisfied && (
            showDetails ? <ChevronUp className="w-4 h-4 text-text-dim" /> : <ChevronDown className="w-4 h-4 text-text-dim" />
          )}
        </button>
        {showDetails && constraintReport.violations.length > 0 && (
          <div className="mt-2 space-y-1 pl-6">
            {constraintReport.violations.map((v, i) => (
              <p key={i} className="text-xs text-warn">{v.message}</p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schedule.map((week) => (
          <section
            key={week.week}
            className={cn(
              'rounded-md border bg-bg-1',
              week.isRivalry ? 'border-warn/40' : week.isLocked ? 'border-signal/40' : 'border-line'
            )}
          >
            <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
              <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Week <span className="tnum text-text-dim">{week.week}</span></span>
              {week.isRivalry && (
                <span className="font-mono text-2xs uppercase tracking-wider text-warn bg-warn/10 border border-warn/30 px-1.5 py-0.5 rounded-sm">Rivalry</span>
              )}
              {week.isLocked && (
                <span className="font-mono text-2xs uppercase tracking-wider text-signal bg-signal/10 border border-signal/30 px-1.5 py-0.5 rounded-sm">Locked</span>
              )}
            </header>
            <div className="px-3 pb-3 space-y-1">
              {week.matchups.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-bg-2/60">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getTeamAvatar(m.teamA) && (
                      <img src={getTeamAvatar(m.teamA)} alt="" className="w-5 h-5 rounded-full ring-1 ring-line shrink-0" />
                    )}
                    <span className="truncate text-text">{getTeamDisplay(m.teamA)}</span>
                  </div>
                  <span className="font-mono text-2xs text-text-mute mx-2 shrink-0">vs</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="truncate text-right text-text">{getTeamDisplay(m.teamB)}</span>
                    {getTeamAvatar(m.teamB) && (
                      <img src={getTeamAvatar(m.teamB)} alt="" className="w-5 h-5 rounded-full ring-1 ring-line shrink-0" />
                    )}
                  </div>
                </div>
              ))}
              {week.byes?.length > 0 && (
                <div className="font-mono text-2xs text-text-mute italic px-2 pt-1 uppercase tracking-wider">
                  Bye: {week.byes.map(b => getTeamDisplay(b)).join(', ')}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-bg-1">
        <header className="px-4 py-3 border-b border-line">
          <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute">Matchup Frequency</h4>
        </header>
        <div className="overflow-x-auto p-2">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left text-text-mute font-mono uppercase tracking-wider sticky left-0 bg-bg-1 z-10"></th>
                {teams.map(t => (
                  <th key={t.id} className="px-2 py-1.5 text-center text-text-mute font-mono font-normal uppercase tracking-wider min-w-[40px]" title={t.name}>
                    <span className="inline-block max-w-[80px] truncate">
                      {t.name.length > 8 ? t.name.slice(0, 8) + '…' : t.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id}>
                  <td className="px-2 py-1.5 text-text-dim whitespace-nowrap sticky left-0 bg-bg-1 z-10 font-semibold" title={t.name}>
                    {t.name.length > 12 ? t.name.slice(0, 12) + '…' : t.name}
                  </td>
                  {teams.map(t2 => {
                    if (t.id === t2.id) {
                      return <td key={t2.id} className="px-1 py-1 text-center text-text-mute">—</td>;
                    }
                    const count = frequencyMatrix[t.id]?.[t2.id] || 0;
                    const avgCount = schedule.length / (teams.length - 1);
                    const isOnTarget = Math.abs(count - avgCount) < 0.5;
                    return (
                      <td
                        key={t2.id}
                        className={cn(
                          'px-1 py-1 text-center font-mono tnum',
                          isOnTarget ? 'text-good' : 'text-warn'
                        )}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ScheduleOutput;
