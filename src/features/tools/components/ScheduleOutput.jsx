import { useState, useMemo } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Check, AlertTriangle, Copy, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { avatarUrl, displayTeamName } from '../../../utils/nflData';
import { cn } from '../../../lib/utils';

const ScheduleOutput = ({ schedule, constraintReport, fairness, teams, users, rosters, leagueName }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);
  const [copied, setCopied] = useState(false);

  const teamLookup = useMemo(() => {
    const map = {};
    for (const t of teams) {
      map[t.id] = t;
    }
    return map;
  }, [teams]);

  const userLookup = useMemo(() => {
    const map = {};
    for (const u of (users || [])) {
      map[u.user_id] = u;
    }
    return map;
  }, [users]);

  // Build matchup frequency matrix
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

  const getTeamDisplay = (teamId) => {
    const team = teamLookup[teamId];
    return team?.name || teamId;
  };

  const getTeamAvatar = (teamId) => {
    // Find roster -> owner -> user avatar
    const roster = rosters?.find(r => String(r.roster_id) === String(teamId));
    const user = roster ? userLookup[roster.owner_id] : null;
    return user?.avatar ? avatarUrl(user.avatar) : null;
  };

  // Export formats
  const generateCSV = () => {
    const rows = [`League,${leagueName || 'Fantasy League'}`, `Generated,${new Date().toLocaleDateString()}`, '', 'Week,Matchup,Team A,Team B'];
    for (const week of schedule) {
      week.matchups.forEach((m, idx) => {
        rows.push(`${week.week},${idx + 1},${getTeamDisplay(m.teamA)},${getTeamDisplay(m.teamB)}`);
      });
      if (week.byes?.length > 0) {
        rows.push(`${week.week},BYE,${week.byes.map(b => getTeamDisplay(b)).join('; ')},`);
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
    const text = generateClipboardText();
    await navigator.clipboard.writeText(text);
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

  // Fairness badge color
  const fairnessColor = fairness.score >= 80
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : fairness.score >= 50
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-red-500/20 text-red-300 border-red-500/30';

  return (
    <div className="space-y-6">
      {/* Header: Fairness + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-2 rounded-lg border ${fairnessColor}`}>
            <p className="text-2xl font-bold">{fairness.score}</p>
            <p className="text-xs">{fairness.label}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
            <Download className="w-3 h-3" />
            CSV
          </Button>
        </div>
      </div>

      {/* Constraint Report */}
      <div
        className={cn(
          'rounded-lg border p-3',
          constraintReport.satisfied
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        )}
      >
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {constraintReport.satisfied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-sm font-medium">
              {constraintReport.satisfied
                ? 'All constraints satisfied'
                : `${constraintReport.violations.length} constraint(s) relaxed`}
            </span>
          </div>
          {!constraintReport.satisfied && (
            showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {showDetails && constraintReport.violations.length > 0 && (
          <div className="mt-2 space-y-1 pl-6">
            {constraintReport.violations.map((v, i) => (
              <p key={i} className="text-xs text-amber-300">{v.message}</p>
            ))}
          </div>
        )}
      </div>

      {/* Week-by-Week Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedule.map((week) => (
          <Card
            key={week.week}
            className={cn(
              'border',
              week.isRivalry ? 'border-amber-500/50' : week.isLocked ? 'border-blue-500/50' : 'border-slate-700'
            )}
          >
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Week {week.week}</CardTitle>
                {week.isRivalry && <Badge className="bg-amber-500/20 text-amber-300 text-xs">Rivalry</Badge>}
                {week.isLocked && <Badge className="bg-blue-500/20 text-blue-300 text-xs">Locked</Badge>}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5">
                {week.matchups.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-slate-800/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getTeamAvatar(m.teamA) && (
                        <img src={getTeamAvatar(m.teamA)} alt="" className="w-5 h-5 rounded-full shrink-0" />
                      )}
                      <span className="truncate">{getTeamDisplay(m.teamA)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground mx-2 shrink-0">vs</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="truncate text-right">{getTeamDisplay(m.teamB)}</span>
                      {getTeamAvatar(m.teamB) && (
                        <img src={getTeamAvatar(m.teamB)} alt="" className="w-5 h-5 rounded-full shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
                {week.byes?.length > 0 && (
                  <div className="text-xs text-muted-foreground italic px-2 pt-1">
                    BYE: {week.byes.map(b => getTeamDisplay(b)).join(', ')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Matchup Frequency Matrix */}
      <Card className="border border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Matchup Frequency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left text-muted-foreground"></th>
                  {teams.map(t => (
                    <th key={t.id} className="px-1 py-1 text-center text-muted-foreground font-normal" title={t.name}>
                      {t.name.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id}>
                    <td className="px-1 py-1 text-muted-foreground whitespace-nowrap" title={t.name}>
                      {t.name.slice(0, 6)}
                    </td>
                    {teams.map(t2 => {
                      if (t.id === t2.id) {
                        return <td key={t2.id} className="px-1 py-1 text-center text-slate-600">—</td>;
                      }
                      const count = frequencyMatrix[t.id]?.[t2.id] || 0;
                      const avgCount = schedule.length / (teams.length - 1);
                      const isOnTarget = Math.abs(count - avgCount) < 0.5;
                      return (
                        <td
                          key={t2.id}
                          className={cn(
                            'px-1 py-1 text-center font-mono',
                            isOnTarget ? 'text-emerald-400' : 'text-amber-400'
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleOutput;
