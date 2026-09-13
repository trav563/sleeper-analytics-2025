# Recorded probability history

The league data layer records all valid matchup pairs from the existing live score and game-clock query results. It reuses the same weekly projections query as Dashboard and Matchup (six-hour cache, no polling interval). Recording does not make HTTP requests or create another timer. It runs only for the current regular-season league, in a visible page, with successful score and clock updates no more than 150 seconds old.

Each observation contains an observation timestamp and probability. League, season, week, matchup ID and canonical roster pair scope the history. The storage version includes the 45% uncertainty model, so later model changes can start a new history rather than mixing definitions. Viewing from the other team's perspective inverts the stored probability.

Observations are retained locally, not written to an application server. All matchups from one update are persisted with one localStorage write. Writes and reads are bounded to 32 recent matchup histories, each with at most 1,440 observations; histories expire after 45 days when next accessed. Blocked/quota-exhausted storage falls back to session memory. No new dependencies, databases, scheduled jobs or paid services are required.

The chart uses elapsed time on its horizontal axis, splits gaps longer than 150 seconds, and displays when the retained history begins. Data from before recording started is not invented. Browser navigation and reloads preserve available local history; another browser or device starts independently. Completed matchups stop adding duplicate final probabilities, but changed final results can still be recorded.

## Load and rate-limit safeguards

- Recording makes zero per-observation upstream or application-server requests. More users add local work on their own devices, not central snapshot writes.
- Existing React Query keys deduplicate the recorder/page projection request in a tab. No additional polling interval is created; hidden pages skip recording.
- Live score cache-buster URLs use a shared 30-second time bucket; NFL state uses a 60-second bucket. This permits provider/CDN cache reuse instead of generating a unique URL for every viewer. Actual CDN behavior remains controlled by the provider.
- Sleeper and ESPN fetches respect HTTP 429 Retry-After, including long delays and HTTP dates. A cooldown is shared across requests to that provider origin in the current browser tab. React Query/direct-fetch retries during a cooldown fail without issuing another HTTP request. Missing Retry-After defaults to 60 seconds.
- These protections reduce request amplification; they do not guarantee that third-party quotas can never be reached. Existing live feed polling remains per client, and in-flight requests or separate tabs/devices are not globally coordinated. This is not a centralized, cross-device historical feed.

## Validation

Automated coverage checks line creation after multiple snapshots, real-time spacing, gap handling, reload persistence, perspective inversion, league/week isolation, unavailable data, completion, corrupt or blocked storage, retention limits, one write for 20 matchup pairs, query reuse, hidden-page recording, and provider cooldowns. A burst of 100 sequential requests during a provider cooldown results in no additional HTTP calls. No load tests are run against the public provider APIs.

Release checks: 377 tests pass; production build passes; lint reports zero errors and 18 existing warnings. Live browser verification observed the chart grow from one to multiple real observations, survive a reload, and retain separate histories when switching teams. The chart was checked at 375, 390, 430, 768, 1280 and 1440 pixels in light and dark themes without page overflow.
