import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
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

  // Build team list from rosters + users (filter orphaned rosters)
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

  // Default config from league settings
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
      divisions: {
        enabled: false,
        groups: [],
        intraGames: 2,
        interGames: 1,
      },
      rivalryWeekEnabled: false,
      rivalryWeek: {
        enabled: false,
        week: 1,
        matchups: [],
      },
      lockedWeeks: [],
    };
  }, [league, teams]);

  const [config, setConfig] = useState(defaultConfig);

  // Reset config when league changes
  useEffect(() => {
    setConfig(defaultConfig);
    setGeneratedResult(null);
  }, [defaultConfig]);

  // Check for saved state on mount
  useEffect(() => {
    if (!league?.league_id) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + league.league_id);
      if (saved) {
        setShowRestore(true);
      }
    } catch {
      // localStorage unavailable
    }
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
      divisions: config.divisionsEnabled
        ? { ...config.divisions, enabled: true }
        : null,
      rivalryWeek: config.rivalryWeekEnabled
        ? { ...config.rivalryWeek, enabled: true }
        : null,
      lockedWeeks: config.lockedWeeks || [],
    };

    const result = generateSchedule(algorithmConfig);
    const fairness = calculateFairness(result.schedule, teams, rosters);

    const fullResult = { ...result, fairness };
    setGeneratedResult(fullResult);

    // Save to localStorage
    try {
      localStorage.setItem(
        STORAGE_KEY_PREFIX + league.league_id,
        JSON.stringify({ config, result: fullResult, savedAt: new Date().toISOString() })
      );
    } catch {
      // localStorage full or unavailable
    }
  }, [teams, config, rosters, league?.league_id]);

  if (teams.length < 2) return null;

  return (
    <Card className="border border-slate-700">
      {/* Collapsible Header */}
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Schedule Generator</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create balanced fantasy football schedules with custom constraints
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {generatedResult && (
              <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Generated</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Restore prompt */}
          {showRestore && (
            <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300">You have a saved schedule. Restore it?</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRestore} className="text-xs">
                  Restore
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismissRestore} className="text-xs">
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Config Form */}
          <ScheduleConfigForm
            teams={teams}
            config={config}
            onChange={setConfig}
            onGenerate={handleGenerate}
          />

          {/* Generated Output */}
          {generatedResult && (
            <div className="pt-4 border-t border-border">
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
        </CardContent>
      )}
    </Card>
  );
};

export default ScheduleGenerator;
