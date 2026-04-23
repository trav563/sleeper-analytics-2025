import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { ChevronDown, ChevronUp, CalendarDays, RotateCcw } from 'lucide-react';
import { displayTeamName } from '../../../utils/nflData';
import ScheduleConfigForm from './ScheduleConfigForm';
import ScheduleOutput from './ScheduleOutput';
import { generateSchedule } from '../utils/scheduleAlgorithm';
import { calculateFairness } from '../utils/scheduleFairness';

const STORAGE_KEY_PREFIX = 'schedule_generator_';

const ScheduleGenerator = ({ league, rosters, users }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [showRestore, setShowRestore] = useState(false);

  const teams = useMemo(() => {
    if (!rosters || !users) return [];
    return rosters
      .filter(r => r.owner_id && users.find(u => u.user_id === r.owner_id))
      .map(r => {
        const user = users.find(u => u.user_id === r.owner_id);
        return {
          id: String(r.roster_id),
          name: displayTeamName(user),
          rosterId: r.roster_id,
          ownerId: r.owner_id,
        };
      })
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }, [rosters, users]);

  const defaultConfig = useMemo(() => {
    const playoffStart = league?.settings?.playoff_week_start || 15;
    const startWeek = league?.settings?.start_week || 1;
    const weeks = playoffStart - startWeek;
    const teamCount = teams.length || 12;
    const maxRepeat = Math.ceil(weeks / Math.max(1, teamCount - 1)) + 1;

    return {
      weeks,
      maxRepeat,
      noBackToBack: true,
      divisionsEnabled: false,
      divisions: { enabled: false, groups: [], intraGames: 2, interGames: 1 },
      rivalryWeekEnabled: false,
      rivalryWeek: { enabled: false, week: 1, matchups: [] },
      lockedWeeks: [],
    };
  }, [league, teams]);

  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    setConfig(defaultConfig);
    setGeneratedResult(null);
  }, [defaultConfig]);

  useEffect(() => {
    if (!league?.league_id) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + league.league_id);
      if (saved) setShowRestore(true);
    } catch {}
  }, [league?.league_id]);

  const handleRestore = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + league.league_id);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.result) setGeneratedResult(parsed.result);
        setIsExpanded(true);
      }
    } catch (e) {
      console.error('Failed to restore schedule:', e);
    }
    setShowRestore(false);
  }, [league?.league_id]);

  const handleDismissRestore = () => setShowRestore(false);

  const handleGenerate = useCallback(() => {
    const algorithmConfig = {
      teams,
      weeks: config.weeks,
      maxRepeat: config.maxRepeat,
      noBackToBack: config.noBackToBack,
      divisions: config.divisionsEnabled ? { ...config.divisions, enabled: true } : null,
      rivalryWeek: config.rivalryWeekEnabled ? { ...config.rivalryWeek, enabled: true } : null,
      lockedWeeks: config.lockedWeeks || [],
    };

    const result = generateSchedule(algorithmConfig);
    const fairness = calculateFairness(result.schedule, teams, rosters);

    const fullResult = { ...result, fairness };
    setGeneratedResult(fullResult);

    try {
      localStorage.setItem(
        STORAGE_KEY_PREFIX + league.league_id,
        JSON.stringify({ config, result: fullResult, savedAt: new Date().toISOString() })
      );
    } catch {}
  }, [teams, config, rosters, league?.league_id]);

  if (teams.length < 2) return null;

  return (
    <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
      <button
        type="button"
        className="w-full text-left p-4 hover:bg-bg-2/40 transition-colors duration-fast"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <CalendarDays className="w-5 h-5 text-signal shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                Tool · Schedule
              </div>
              <h3 className="font-display text-lg font-semibold text-text">Schedule Generator</h3>
              <p className="text-xs text-text-dim mt-0.5">
                Create balanced fantasy football schedules with custom constraints
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {generatedResult && (
              <span className="font-mono text-2xs uppercase tracking-wider text-good bg-good/10 border border-good/30 px-1.5 py-0.5 rounded-sm">
                Generated
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-text-dim" />
            ) : (
              <ChevronDown className="w-5 h-5 text-text-dim" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-line pt-4">
          {showRestore && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-signal/30 bg-signal/10 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <RotateCcw className="w-4 h-4 text-signal shrink-0" aria-hidden="true" />
                <span className="text-sm text-text">You have a saved schedule. Restore it?</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handleRestore} className="text-xs border-line text-text hover:bg-bg-2">
                  Restore
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismissRestore} className="text-xs text-text-dim hover:text-text">
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          <ScheduleConfigForm
            teams={teams}
            config={config}
            onChange={setConfig}
            onGenerate={handleGenerate}
          />

          {generatedResult && (
            <div className="pt-4 border-t border-line">
              <ScheduleOutput
                schedule={generatedResult.schedule}
                constraintReport={generatedResult.constraintReport}
                fairness={generatedResult.fairness}
                teams={teams}
                users={users}
                rosters={rosters}
                leagueName={league?.name}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ScheduleGenerator;
