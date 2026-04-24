import { useMemo } from 'react';
import { Button } from '../../../components/ui/Button';
import { Shuffle, Trash2 } from 'lucide-react';

const RivalryWeekEditor = ({ teams, matchups, onChange, weekLabel = 'Week' }) => {
  const expectedPairs = Math.floor(teams.length / 2);

  const rows = useMemo(() => {
    const result = [...matchups];
    while (result.length < expectedPairs) {
      result.push({ teamA: null, teamB: null });
    }
    return result.slice(0, expectedPairs);
  }, [matchups, expectedPairs]);

  const getAvailableTeams = (rowIndex, slot) => {
    const usedIds = new Set();
    rows.forEach((m, i) => {
      if (i === rowIndex) {
        if (slot === 'A' && m.teamB) usedIds.add(m.teamB);
        if (slot === 'B' && m.teamA) usedIds.add(m.teamA);
      } else {
        if (m.teamA) usedIds.add(m.teamA);
        if (m.teamB) usedIds.add(m.teamB);
      }
    });
    return teams.filter(t => !usedIds.has(t.id));
  };

  const unassignedTeams = useMemo(() => {
    const used = new Set();
    rows.forEach(m => {
      if (m.teamA) used.add(m.teamA);
      if (m.teamB) used.add(m.teamB);
    });
    return teams.filter(t => !used.has(t.id));
  }, [teams, rows]);

  const handleTeamChange = (rowIndex, slot, teamId) => {
    const updated = rows.map((m, i) => {
      if (i !== rowIndex) return m;
      return slot === 'A' ? { ...m, teamA: teamId || null } : { ...m, teamB: teamId || null };
    });
    onChange(updated);
  };

  const handleClear = () => {
    onChange(Array.from({ length: expectedPairs }, () => ({ teamA: null, teamB: null })));
  };

  const handleAutoFill = () => {
    const used = new Set();
    const updated = [...rows];

    updated.forEach(m => {
      if (m.teamA) used.add(m.teamA);
      if (m.teamB) used.add(m.teamB);
    });

    const remaining = teams.filter(t => !used.has(t.id));
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);

    let shuffleIdx = 0;
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].teamA && shuffleIdx < shuffled.length) {
        updated[i] = { ...updated[i], teamA: shuffled[shuffleIdx++].id };
      }
      if (!updated[i].teamB && shuffleIdx < shuffled.length) {
        updated[i] = { ...updated[i], teamB: shuffled[shuffleIdx++].id };
      }
    }

    while (shuffleIdx < shuffled.length - 1 && updated.length < expectedPairs) {
      updated.push({ teamA: shuffled[shuffleIdx++].id, teamB: shuffled[shuffleIdx++].id });
    }

    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{weekLabel} Matchups</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleAutoFill} className="gap-1 text-xs text-text-dim hover:text-signal hover:bg-bg-2">
            <Shuffle className="w-3 h-3" />
            Auto-fill
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1 text-xs text-bad hover:text-bad/80 hover:bg-bad/10">
            <Trash2 className="w-3 h-3" />
            Clear
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((matchup, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="font-mono text-2xs text-text-mute w-6 text-right shrink-0 tnum">{idx + 1}.</span>
            <select
              value={matchup.teamA || ''}
              onChange={(e) => handleTeamChange(idx, 'A', e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal"
            >
              <option value="">Select team…</option>
              {getAvailableTeams(idx, 'A').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              {matchup.teamA && !getAvailableTeams(idx, 'A').find(t => t.id === matchup.teamA) && (
                <option value={matchup.teamA}>
                  {teams.find(t => t.id === matchup.teamA)?.name || matchup.teamA}
                </option>
              )}
            </select>

            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">vs</span>

            <select
              value={matchup.teamB || ''}
              onChange={(e) => handleTeamChange(idx, 'B', e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal"
            >
              <option value="">Select team…</option>
              {getAvailableTeams(idx, 'B').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              {matchup.teamB && !getAvailableTeams(idx, 'B').find(t => t.id === matchup.teamB) && (
                <option value={matchup.teamB}>
                  {teams.find(t => t.id === matchup.teamB)?.name || matchup.teamB}
                </option>
              )}
            </select>
          </div>
        ))}
      </div>

      {unassignedTeams.length > 0 && (
        <p className="text-xs text-warn">
          {unassignedTeams.length} team(s) unassigned: {unassignedTeams.map(t => t.name).join(', ')}
        </p>
      )}
    </div>
  );
};

export default RivalryWeekEditor;
