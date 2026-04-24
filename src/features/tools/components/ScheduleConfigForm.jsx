import { useMemo } from 'react';
import { Button } from '../../../components/ui/Button';
import { Switch } from '../../../components/ui/Switch';
import { Calendar, Shield, Lock, Swords, Plus, Trash2 } from 'lucide-react';
import RivalryWeekEditor from './RivalryWeekEditor';
import DivisionSetup from './DivisionSetup';
import { validateConfig } from '../utils/scheduleValidation';

const SectionHeader = ({ icon: Icon, label, iconClass = 'text-signal' }) => (
  <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-2">
    <Icon className={`w-3.5 h-3.5 ${iconClass}`} aria-hidden="true" />
    {label}
  </h4>
);

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

  const getAvailableWeeks = (currentValue, excludeIndex, isRivalry) => {
    const used = new Set();
    if (rivalryWeekEnabled && rivalryWeek?.week && !isRivalry) {
      used.add(rivalryWeek.week);
    }
    lockedWeeks.forEach((lw, i) => {
      if (isRivalry || i !== excludeIndex) {
        used.add(lw.week);
      }
    });
    const available = [];
    for (let w = 1; w <= weeks; w++) {
      if (!used.has(w) || w === currentValue) {
        available.push(w);
      }
    }
    return available;
  };

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
    update({ lockedWeeks: lockedWeeks.map((lw, i) => i === idx ? { ...lw, ...patch } : lw) });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SectionHeader icon={Shield} label="League Info" />
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-2xs uppercase tracking-wider text-text-dim border border-line bg-bg-2 tnum">
            {teams.length} Teams
          </span>
          {teams.length % 2 !== 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-2xs uppercase tracking-wider text-warn border border-warn/30 bg-warn/10">
              Odd — bye weeks
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {teams.map(t => (
            <span key={t.id} className="text-xs text-text-dim bg-bg-2 px-2 py-0.5 rounded-sm border border-line">
              {t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Calendar} label="Season Settings" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-2xs uppercase tracking-wider text-text-mute block mb-1">Regular season weeks</label>
            <input
              type="number"
              min={1}
              max={18}
              value={weeks}
              onChange={(e) => update({ weeks: parseInt(e.target.value) || 1 })}
              className="w-full px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal tnum"
            />
          </div>
          <div>
            <label className="font-mono text-2xs uppercase tracking-wider text-text-mute block mb-1">Max repeat opponents</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxRepeat}
              onChange={(e) => update({ maxRepeat: parseInt(e.target.value) || 1 })}
              className="w-full px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal tnum"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Swords} label="Constraints" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text">No back-to-back matchups</p>
            <p className="text-xs text-text-dim">Teams won't face the same opponent in consecutive weeks</p>
          </div>
          <Switch checked={noBackToBack} onCheckedChange={(v) => update({ noBackToBack: v })} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Divisions</span>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Swords} label="Rivalry Week" iconClass="text-warn" />
          <Switch checked={rivalryWeekEnabled} onCheckedChange={(v) => update({ rivalryWeekEnabled: v })} />
        </div>
        {rivalryWeekEnabled && (
          <div className="space-y-3 pl-3 border-l-2 border-warn/30">
            <div>
              <label className="font-mono text-2xs uppercase tracking-wider text-text-mute block mb-1">Week number</label>
              <select
                value={rivalryWeek?.week || 1}
                onChange={(e) => update({
                  rivalryWeek: { ...rivalryWeek, enabled: true, week: parseInt(e.target.value) || 1 },
                })}
                className="w-28 px-2 py-1.5 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal tnum"
              >
                {getAvailableWeeks(rivalryWeek?.week || 1, -1, true).map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
            <RivalryWeekEditor
              teams={teams}
              matchups={rivalryWeek?.matchups || Array.from({ length: expectedPairs }, () => ({ teamA: null, teamB: null }))}
              onChange={(matchups) => update({ rivalryWeek: { ...rivalryWeek, enabled: true, matchups } })}
              weekLabel="Rivalry"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Lock} label="Locked Weeks" iconClass="text-signal" />
        {lockedWeeks.map((lw, idx) => (
          <div key={idx} className="space-y-3 pl-3 border-l-2 border-signal/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-mono text-2xs uppercase tracking-wider text-text-mute">Week</label>
                <select
                  value={lw.week}
                  onChange={(e) => updateLockedWeek(idx, { week: parseInt(e.target.value) || 1 })}
                  className="w-28 px-2 py-1 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal tnum"
                >
                  {getAvailableWeeks(lw.week, idx, false).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLockedWeek(idx)}
                className="text-bad hover:text-bad/80 hover:bg-bad/10 h-7 px-2"
                aria-label="Remove locked week"
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
        <Button variant="outline" size="sm" onClick={addLockedWeek} className="gap-1 border-line text-text hover:bg-bg-2">
          <Plus className="w-3 h-3" />
          Add Locked Week
        </Button>
      </div>

      {validation.errors.length > 0 && (
        <div className="rounded-md border border-bad/30 bg-bad/10 p-3 space-y-1">
          {validation.errors.map((err, i) => (
            <p key={i} className="text-xs text-bad">{err}</p>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-warn/30 bg-warn/10 p-3 space-y-1">
          {validation.warnings.map((warn, i) => (
            <p key={i} className="text-xs text-warn">{warn}</p>
          ))}
        </div>
      )}

      <Button
        onClick={onGenerate}
        disabled={!validation.valid}
        className="w-full min-h-[44px] bg-signal text-ink font-semibold hover:bg-signal/90 focus-visible:ring-signal disabled:opacity-50"
        size="lg"
      >
        Generate Schedule
      </Button>
    </div>
  );
};

export default ScheduleConfigForm;
