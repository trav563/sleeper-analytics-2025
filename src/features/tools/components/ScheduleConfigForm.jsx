import { useMemo } from 'react';
import { Button } from '../../../components/ui/Button';
import { Switch } from '../../../components/ui/Switch';
import { Badge } from '../../../components/ui/Badge';
import { Calendar, Shield, Lock, Swords, Plus, Trash2 } from 'lucide-react';
import RivalryWeekEditor from './RivalryWeekEditor';
import DivisionSetup from './DivisionSetup';
import { validateConfig } from '../utils/scheduleValidation';

const ScheduleConfigForm = ({ teams, config, onChange, onGenerate }) => {
  const {
    weeks,
    maxRepeat,
    noBackToBack,
    divisionsEnabled,
    divisions,
    rivalryWeekEnabled,
    rivalryWeek,
    lockedWeeks,
  } = config;

  const expectedPairs = Math.floor(teams.length / 2);

  // Build validation config
  const validationConfig = useMemo(() => ({
    teams,
    weeks,
    maxRepeat,
    noBackToBack,
    divisions: divisionsEnabled ? divisions : null,
    rivalryWeek: rivalryWeekEnabled ? rivalryWeek : null,
    lockedWeeks: lockedWeeks || [],
  }), [teams, weeks, maxRepeat, noBackToBack, divisionsEnabled, divisions, rivalryWeekEnabled, rivalryWeek, lockedWeeks]);

  const validation = useMemo(() => validateConfig(validationConfig), [validationConfig]);

  const update = (patch) => onChange({ ...config, ...patch });

  const updateDivisions = (divPatch) => {
    update({ divisions: { ...divisions, ...divPatch, _targetWeeks: weeks } });
  };

  const addLockedWeek = () => {
    const usedWeeks = new Set([
      ...(rivalryWeekEnabled && rivalryWeek ? [rivalryWeek.week] : []),
      ...lockedWeeks.map(lw => lw.week),
    ]);
    let nextWeek = 1;
    while (usedWeeks.has(nextWeek) && nextWeek <= weeks) nextWeek++;

    update({
      lockedWeeks: [
        ...lockedWeeks,
        {
          week: nextWeek <= weeks ? nextWeek : 1,
          matchups: Array.from({ length: expectedPairs }, () => ({ teamA: null, teamB: null })),
        },
      ],
    });
  };

  const removeLockedWeek = (idx) => {
    update({ lockedWeeks: lockedWeeks.filter((_, i) => i !== idx) });
  };

  const updateLockedWeek = (idx, patch) => {
    update({
      lockedWeeks: lockedWeeks.map((lw, i) => i === idx ? { ...lw, ...patch } : lw),
    });
  };

  return (
    <div className="space-y-6">
      {/* Section A: League Info */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          League Info
        </h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{teams.length} Teams</Badge>
          {teams.length % 2 !== 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30">Odd — bye weeks</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {teams.map(t => (
            <span key={t.id} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {/* Section B: Season Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Season Settings
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Regular season weeks</label>
            <input
              type="number"
              min={1}
              max={18}
              value={weeks}
              onChange={(e) => update({ weeks: parseInt(e.target.value) || 1 })}
              className="w-full px-2 py-1.5 rounded-md border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max times two teams play</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxRepeat}
              onChange={(e) => update({ maxRepeat: parseInt(e.target.value) || 1 })}
              className="w-full px-2 py-1.5 rounded-md border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Section C: Matchup Constraints */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Swords className="w-4 h-4 text-primary" />
          Constraints
        </h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">No back-to-back matchups</p>
            <p className="text-xs text-muted-foreground">Teams won't face the same opponent in consecutive weeks</p>
          </div>
          <Switch checked={noBackToBack} onCheckedChange={(v) => update({ noBackToBack: v })} />
        </div>
      </div>

      {/* Section D: Divisions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Divisions</h4>
          <Switch checked={divisionsEnabled} onCheckedChange={(v) => update({ divisionsEnabled: v })} />
        </div>
        {divisionsEnabled && (
          <DivisionSetup
            teams={teams}
            divisions={{ ...divisions, _targetWeeks: weeks }}
            onChange={(d) => update({ divisions: d })}
          />
        )}
      </div>

      {/* Section E: Rivalry Week */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Swords className="w-4 h-4 text-amber-400" />
            Rivalry Week
          </h4>
          <Switch checked={rivalryWeekEnabled} onCheckedChange={(v) => update({ rivalryWeekEnabled: v })} />
        </div>
        {rivalryWeekEnabled && (
          <div className="space-y-3 pl-2 border-l-2 border-amber-500/30">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Week number</label>
              <input
                type="number"
                min={1}
                max={weeks}
                value={rivalryWeek?.week || 1}
                onChange={(e) => update({
                  rivalryWeek: {
                    ...rivalryWeek,
                    enabled: true,
                    week: parseInt(e.target.value) || 1,
                  },
                })}
                className="w-24 px-2 py-1.5 rounded-md border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <RivalryWeekEditor
              teams={teams}
              matchups={rivalryWeek?.matchups || Array.from({ length: expectedPairs }, () => ({ teamA: null, teamB: null }))}
              onChange={(matchups) => update({
                rivalryWeek: { ...rivalryWeek, enabled: true, matchups },
              })}
              weekLabel="Rivalry"
            />
          </div>
        )}
      </div>

      {/* Section F: Locked Weeks */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" />
          Locked Weeks
        </h4>
        {lockedWeeks.map((lw, idx) => (
          <div key={idx} className="space-y-3 pl-2 border-l-2 border-blue-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Week</label>
                <input
                  type="number"
                  min={1}
                  max={weeks}
                  value={lw.week}
                  onChange={(e) => updateLockedWeek(idx, { week: parseInt(e.target.value) || 1 })}
                  className="w-20 px-2 py-1 rounded-md border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLockedWeek(idx)}
                className="text-red-400 hover:text-red-300 h-7 px-2"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <RivalryWeekEditor
              teams={teams}
              matchups={lw.matchups || Array.from({ length: expectedPairs }, () => ({ teamA: null, teamB: null }))}
              onChange={(matchups) => updateLockedWeek(idx, { matchups })}
              weekLabel={`Locked Week ${lw.week}`}
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addLockedWeek} className="gap-1">
          <Plus className="w-3 h-3" />
          Add Locked Week
        </Button>
      </div>

      {/* Validation Messages */}
      {validation.errors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1">
          {validation.errors.map((err, i) => (
            <p key={i} className="text-xs text-red-400">{err}</p>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          {validation.warnings.map((warn, i) => (
            <p key={i} className="text-xs text-amber-400">{warn}</p>
          ))}
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={!validation.valid}
        className="w-full"
        size="lg"
      >
        Generate Schedule
      </Button>
    </div>
  );
};

export default ScheduleConfigForm;
