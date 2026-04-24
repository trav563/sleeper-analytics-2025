import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Plus, X } from 'lucide-react';

// Division tints repointed to broadcast tokens
const DIVISION_TINTS = [
  'bg-signal/15 text-signal border-signal/30',
  'bg-good/15 text-good border-good/30',
  'bg-warn/15 text-warn border-warn/30',
  'bg-signal-2/15 text-signal-2 border-signal-2/30',
];

const DivisionSetup = ({ teams, divisions, onChange }) => {
  const { groups } = divisions;
  const [editingName, setEditingName] = useState(null);

  const unassignedTeams = teams.filter(
    t => !groups.some(g => g.teamIds.includes(t.id))
  );

  const handleAddDivision = () => {
    const newGroup = { name: `Division ${groups.length + 1}`, teamIds: [] };
    onChange({ ...divisions, groups: [...groups, newGroup] });
  };

  const handleRemoveDivision = (idx) => {
    onChange({ ...divisions, groups: groups.filter((_, i) => i !== idx) });
  };

  const handleRenameDivision = (idx, name) => {
    onChange({ ...divisions, groups: groups.map((g, i) => i === idx ? { ...g, name } : g) });
    setEditingName(null);
  };

  const handleAssignTeam = (divIdx, teamId) => {
    if (!teamId) return;
    const updated = groups.map((g, i) => {
      const filtered = g.teamIds.filter(id => id !== teamId);
      if (i === divIdx) return { ...g, teamIds: [...filtered, teamId] };
      return { ...g, teamIds: filtered };
    });
    onChange({ ...divisions, groups: updated });
  };

  const handleRemoveTeam = (divIdx, teamId) => {
    onChange({
      ...divisions,
      groups: groups.map((g, i) => i !== divIdx ? g : { ...g, teamIds: g.teamIds.filter(id => id !== teamId) }),
    });
  };

  const handleIntraChange = (val) => onChange({ ...divisions, intraGames: parseInt(val) || 0 });
  const handleInterChange = (val) => onChange({ ...divisions, interGames: parseInt(val) || 0 });

  const mathCheck = (() => {
    if (groups.length < 2) return null;
    const { intraGames, interGames } = divisions;
    if (intraGames == null || interGames == null) return null;

    const results = [];
    for (const group of groups) {
      if (group.teamIds.length === 0) continue;
      const divSize = group.teamIds.length;
      const intraPairs = divSize - 1;
      const interPairs = teams.length - divSize;
      const total = intraGames * intraPairs + interGames * interPairs;
      results.push({ name: group.name, total, divSize });
    }
    return results;
  })();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {groups.map((group, divIdx) => (
          <div
            key={divIdx}
            className={`rounded-md border p-3 ${DIVISION_TINTS[divIdx % DIVISION_TINTS.length]}`}
          >
            <div className="flex items-center justify-between mb-2">
              {editingName === divIdx ? (
                <input
                  autoFocus
                  defaultValue={group.name}
                  onBlur={(e) => handleRenameDivision(divIdx, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameDivision(divIdx, e.target.value)}
                  className="px-2 py-0.5 rounded bg-bg-2 text-text text-sm border border-line focus:outline-none focus:ring-1 focus:ring-signal"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(divIdx)}
                  className="text-sm font-semibold hover:underline"
                >
                  {group.name}
                </button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveDivision(divIdx)}
                className="h-6 w-6 p-0 text-bad hover:text-bad/80 hover:bg-bad/10"
                aria-label="Remove division"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {group.teamIds.map(tid => {
                const team = teams.find(t => t.id === tid);
                return (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => handleRemoveTeam(divIdx, tid)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-2xs font-mono uppercase tracking-wider bg-bg-2 text-text border border-line hover:border-bad/40 hover:text-bad transition-colors duration-fast"
                  >
                    {team?.name || tid}
                    <X className="w-2.5 h-2.5" />
                  </button>
                );
              })}
            </div>

            {unassignedTeams.length > 0 && (
              <select
                value=""
                onChange={(e) => handleAssignTeam(divIdx, e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-xs focus:outline-none focus:ring-1 focus:ring-signal"
              >
                <option value="">Add team…</option>
                {unassignedTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {groups.length < 4 && (
        <Button variant="outline" size="sm" onClick={handleAddDivision} className="gap-1 border-line text-text hover:bg-bg-2">
          <Plus className="w-3 h-3" />
          Add Division
        </Button>
      )}

      {unassignedTeams.length > 0 && (
        <p className="text-xs text-warn">
          {unassignedTeams.length} unassigned: {unassignedTeams.map(t => t.name).join(', ')}
        </p>
      )}

      {groups.length >= 2 && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
          <div>
            <label className="font-mono text-2xs uppercase tracking-wider text-text-mute block mb-1">Intra-division games</label>
            <input
              type="number"
              min={1}
              max={10}
              value={divisions.intraGames || ''}
              onChange={(e) => handleIntraChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
          <div>
            <label className="font-mono text-2xs uppercase tracking-wider text-text-mute block mb-1">Inter-division games</label>
            <input
              type="number"
              min={1}
              max={10}
              value={divisions.interGames || ''}
              onChange={(e) => handleInterChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
        </div>
      )}

      {mathCheck && mathCheck.length > 0 && (
        <div className="text-xs space-y-0.5">
          {mathCheck.map(({ name, total }) => (
            <p key={name} className={total === (divisions._targetWeeks || 0) ? 'text-good tnum' : 'text-bad tnum'}>
              {name}: {total} total games
              {total !== (divisions._targetWeeks || 0) && ` (need ${divisions._targetWeeks})`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default DivisionSetup;
