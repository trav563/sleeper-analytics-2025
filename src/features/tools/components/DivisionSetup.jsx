import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Plus, X } from 'lucide-react';

const DIVISION_COLORS = [
  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-purple-500/20 text-purple-300 border-purple-500/30',
];

const DivisionSetup = ({ teams, divisions, onChange }) => {
  const { groups } = divisions;
  const [editingName, setEditingName] = useState(null);

  const unassignedTeams = teams.filter(
    t => !groups.some(g => g.teamIds.includes(t.id))
  );

  const handleAddDivision = () => {
    const newGroup = {
      name: `Division ${groups.length + 1}`,
      teamIds: [],
    };
    onChange({ ...divisions, groups: [...groups, newGroup] });
  };

  const handleRemoveDivision = (idx) => {
    const updated = groups.filter((_, i) => i !== idx);
    onChange({ ...divisions, groups: updated });
  };

  const handleRenameDivision = (idx, name) => {
    const updated = groups.map((g, i) => i === idx ? { ...g, name } : g);
    onChange({ ...divisions, groups: updated });
    setEditingName(null);
  };

  const handleAssignTeam = (divIdx, teamId) => {
    if (!teamId) return;
    // Remove from any existing division first
    const updated = groups.map((g, i) => {
      const filtered = g.teamIds.filter(id => id !== teamId);
      if (i === divIdx) {
        return { ...g, teamIds: [...filtered, teamId] };
      }
      return { ...g, teamIds: filtered };
    });
    onChange({ ...divisions, groups: updated });
  };

  const handleRemoveTeam = (divIdx, teamId) => {
    const updated = groups.map((g, i) => {
      if (i !== divIdx) return g;
      return { ...g, teamIds: g.teamIds.filter(id => id !== teamId) };
    });
    onChange({ ...divisions, groups: updated });
  };

  const handleIntraChange = (val) => {
    onChange({ ...divisions, intraGames: parseInt(val) || 0 });
  };

  const handleInterChange = (val) => {
    onChange({ ...divisions, interGames: parseInt(val) || 0 });
  };

  // Live math validation
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
      {/* Division groups */}
      <div className="space-y-3">
        {groups.map((group, divIdx) => (
          <div
            key={divIdx}
            className={`rounded-lg border p-3 ${DIVISION_COLORS[divIdx % DIVISION_COLORS.length]}`}
          >
            <div className="flex items-center justify-between mb-2">
              {editingName === divIdx ? (
                <input
                  autoFocus
                  defaultValue={group.name}
                  onBlur={(e) => handleRenameDivision(divIdx, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameDivision(divIdx, e.target.value)}
                  className="px-2 py-0.5 rounded bg-background/50 text-foreground text-sm border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <button
                  onClick={() => setEditingName(divIdx)}
                  className="text-sm font-medium hover:underline"
                >
                  {group.name}
                </button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveDivision(divIdx)}
                className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {/* Assigned teams */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {group.teamIds.map(tid => {
                const team = teams.find(t => t.id === tid);
                return (
                  <Badge
                    key={tid}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => handleRemoveTeam(divIdx, tid)}
                  >
                    {team?.name || tid}
                    <X className="w-2.5 h-2.5" />
                  </Badge>
                );
              })}
            </div>

            {/* Add team dropdown */}
            {unassignedTeams.length > 0 && (
              <select
                value=""
                onChange={(e) => handleAssignTeam(divIdx, e.target.value)}
                className="w-full px-2 py-1 rounded-md border border-input bg-background/50 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Add team...</option>
                {unassignedTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {groups.length < 4 && (
        <Button variant="outline" size="sm" onClick={handleAddDivision} className="gap-1">
          <Plus className="w-3 h-3" />
          Add Division
        </Button>
      )}

      {unassignedTeams.length > 0 && (
        <p className="text-xs text-amber-400">
          {unassignedTeams.length} unassigned: {unassignedTeams.map(t => t.name).join(', ')}
        </p>
      )}

      {/* Game counts */}
      {groups.length >= 2 && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Intra-division games</label>
            <input
              type="number"
              min={1}
              max={10}
              value={divisions.intraGames || ''}
              onChange={(e) => handleIntraChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Inter-division games</label>
            <input
              type="number"
              min={1}
              max={10}
              value={divisions.interGames || ''}
              onChange={(e) => handleInterChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Math validation */}
      {mathCheck && mathCheck.length > 0 && (
        <div className="text-xs space-y-0.5">
          {mathCheck.map(({ name, total }) => (
            <p key={name} className={total === (divisions._targetWeeks || 0) ? 'text-emerald-400' : 'text-red-400'}>
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
