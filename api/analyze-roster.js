import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { league, roster } = req.body;

    if (!league || !roster) {
        return res.status(400).json({ error: 'Missing league or roster data' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server Configuration Error: Missing API Key' });
    }

    try {
        // --- 1. FETCH MARKET VALUES (FantasyCalc) ---
        // We still fetch this server-side to ensure freshness and because the specific
        // "analyzed" values might differ from a generic cache.
        const isSuperflex = league.roster_positions?.includes('SUPER_FLEX');
        const numTeams = league.total_rosters || 12;

        const myPlayers = [];
        let totalValue = 0;

        try {
            const fcRes = await fetch(`https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${isSuperflex ? 2 : 1}&numTeams=${numTeams}&ppr=0.5`);
            if (!fcRes.ok) throw new Error("FantasyCalc API Error");

            const fcData = await fcRes.json();

            // Map for O(1) Lookup
            const valueMap = new Map();
            if (Array.isArray(fcData)) {
                fcData.forEach(p => {
                    const pid = p.sleeperId || p.player?.sleeperId;
                    if (pid) valueMap.set(pid, p);
                });
            }

            // --- 2. MATCH ROSTER TO VALUES ---
            if (roster.players) {
                roster.players.forEach(pid => {
                    const pData = valueMap.get(pid);
                    if (pData) {
                        const name = pData.player?.name || pData.name || "Unknown Player";
                        const position = pData.player?.position || pData.position;
                        const value = pData.value || 0;

                        totalValue += value;
                        myPlayers.push({ name, position, value });
                    }
                });
            }

            // Sort by value (Highest first) for the AI context
            myPlayers.sort((a, b) => b.value - a.value);

        } catch (e) {
            console.error("Failed to fetch FantasyCalc values", e);
            return res.status(500).json({ error: 'Failed to fetch market values' });
        }

        // --- 3. GEMINI PROMPT ---
        const systemPrompt = `
You are an expert Dynasty Fantasy Football Analyst.
Review the following team and provide an "Executive Summary".

**League Settings**:
- ${numTeams} Teams
- Format: ${isSuperflex ? 'Superflex (2QB relevant)' : '1QB'}
- Scoring: 0.5 PPR (Assumed)

**Team Roster** (Sorted by Value):
${myPlayers.map(p => `- ${p.name} (${p.position}): Val ${p.value}`).join('\n')}

**Total Team Value**: ${totalValue}

**Instructions**:
Return ONLY valid JSON. No markdown formatting.
Structure:
{
  "team_grade": "Letter Grade (e.g. B+)",
  "team_grade_explanation": "1 short sentence explaining the grade.",
  "direction": "Contender, Pretender, or Rebuilder",
  "direction_explanation": "1 short sentence explaining the direction.",
  "summary": "2-3 sentences summarizing the team's core strengths and weaknesses.",
  "top_strengths": ["Strength 1", "Strength 2"],
  "top_weaknesses": ["Weakness 1", "Weakness 2"],
  "action_items": [
    {
      "type": "Trade" or "Waiver" or "Strategy",
      "title": "Short Title",
      "description": "Specific advice. Suggest 1 player to buy/sell if applicable."
    },
    { "type": "...", "title": "...", "description": "..." },
    { "type": "...", "title": "...", "description": "..." }
  ]
}
`;

        // --- 4. CALL GEMINI ---
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();

        const jsonResponse = JSON.parse(text);

        return res.status(200).json(jsonResponse);

    } catch (error) {
        console.error("Analyze Team Error:", error);
        return res.status(500).json({ error: 'Failed to analyze team', details: error.message });
    }
}
