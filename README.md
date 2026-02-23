# 🏎️ The Undercut — Real-Time F1 Intelligence

Live Formula 1 platform powered by **OpenF1** + **Jolpica-F1** APIs. 11 teams, 22 drivers, real-time data.

## Features

- **Live Timing** — Positions, gaps, intervals, tire compounds (OpenF1 API)
- **Race Control** — Flag status, steward decisions, DRS messages (OpenF1 API)
- **Telemetry** — Lap time charts, weather data, stint tracking (OpenF1 API)
- **Standings** — Driver & constructor championships (Jolpica-F1 API)
- **Calendar** — Full 2026 race schedule with session times (Jolpica-F1 API)
- **Pit Stops** — Duration, tire changes, sorted by fastest (OpenF1 API)
- **Team Theming** — Pick any of the 11 constructors, entire UI adapts
- **Auto-refresh** — Live data refreshes every 30 seconds

## Tech Stack

- **React 18** + **Vite 5**
- **Recharts** for data visualization
- **OpenF1 API** — `api.openf1.org/v1/` (live telemetry, positions, weather)
- **Jolpica-F1 API** — `api.jolpi.ca/ergast/f1/` (standings, schedule, results)

## Quick Start (Local)

```bash
git clone https://github.com/YOUR_USERNAME/the-undercut.git
cd the-undercut
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Deploy to Vercel

### Option A: One-Click (Recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Vercel auto-detects Vite — just click **Deploy**
5. Done! Live in ~60 seconds

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## API Notes

| API | Rate Limit | Data | Delay |
|-----|-----------|------|-------|
| OpenF1 | 3 req/s | Live sessions | ~3s behind broadcast |
| Jolpica-F1 | Reasonable | Historical + schedule | Post-session updates |

- No API keys required for either service
- OpenF1 data is available during active F1 sessions
- Jolpica-F1 provides year-round schedule and standings data

## 2026 Teams

| Team | Engine | Drivers |
|------|--------|---------|
| McLaren | Mercedes | Norris, Piastri |
| Ferrari | Ferrari | Leclerc, Hamilton |
| Red Bull Racing | Ford/RBPT | Verstappen, Hadjar |
| Mercedes | Mercedes | Russell, Antonelli |
| Aston Martin | Honda | Alonso, Stroll |
| Alpine | Mercedes | Gasly, Colapinto |
| Williams | Mercedes | Sainz, Albon |
| Haas | Ferrari | Ocon, Bearman |
| Racing Bulls | Ford/RBPT | Tsunoda*, Lindblad |
| **Audi** (ex-Sauber) | Audi | Hülkenberg, Bortoleto |
| **Cadillac** (NEW) | Ferrari | Pérez, Bottas |

## License

Educational/non-commercial use. F1 data sourced from OpenF1 and Jolpica-F1 community APIs.
