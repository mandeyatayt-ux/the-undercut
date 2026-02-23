import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ════════════════════════════════════════════════════════════════════════
// THE UNDERCUT — REAL-TIME F1 INTELLIGENCE
// Powered by OpenF1 API + Jolpica-F1 (Ergast successor)
// ════════════════════════════════════════════════════════════════════════

// ═══ API LAYER ═══════════════════════════════════════════════════════
const OPENF1 = "https://api.openf1.org/v1";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";

const fetchJSON = async (url, fallback = null) => {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn(`API fetch failed: ${url}`, e.message);
    return fallback;
  }
};

// OpenF1 endpoints
const api = {
  sessions: (params = "") => fetchJSON(`${OPENF1}/sessions?${params}`),
  positions: (sk) => fetchJSON(`${OPENF1}/position?session_key=${sk}`),
  laps: (sk, dn = "") => fetchJSON(`${OPENF1}/laps?session_key=${sk}${dn ? `&driver_number=${dn}` : ""}`),
  carData: (sk, dn, limit = 100) => fetchJSON(`${OPENF1}/car_data?session_key=${sk}&driver_number=${dn}&speed>=0`),
  intervals: (sk) => fetchJSON(`${OPENF1}/intervals?session_key=${sk}`),
  pit: (sk) => fetchJSON(`${OPENF1}/pit?session_key=${sk}`),
  raceControl: (sk) => fetchJSON(`${OPENF1}/race_control?session_key=${sk}`),
  weather: (sk) => fetchJSON(`${OPENF1}/weather?session_key=${sk}`),
  stints: (sk) => fetchJSON(`${OPENF1}/stints?session_key=${sk}`),
  drivers: (sk) => fetchJSON(`${OPENF1}/drivers?session_key=${sk}`),
  meetings: (year = 2026) => fetchJSON(`${OPENF1}/meetings?year=${year}`),
  latestSession: () => fetchJSON(`${OPENF1}/sessions?session_key=latest`),
  latestPositions: () => fetchJSON(`${OPENF1}/position?session_key=latest&position<=20`),
  latestWeather: () => fetchJSON(`${OPENF1}/weather?session_key=latest`),
  latestRaceControl: () => fetchJSON(`${OPENF1}/race_control?session_key=latest`),
  latestIntervals: () => fetchJSON(`${OPENF1}/intervals?session_key=latest`),
  latestStints: () => fetchJSON(`${OPENF1}/stints?session_key=latest`),
  latestPit: () => fetchJSON(`${OPENF1}/pit?session_key=latest`),
  latestDrivers: () => fetchJSON(`${OPENF1}/drivers?session_key=latest`),
  latestLaps: () => fetchJSON(`${OPENF1}/laps?session_key=latest`),
};

// Jolpica-F1 endpoints (Ergast successor)
const jolpica = {
  schedule: (y = 2026) => fetchJSON(`${JOLPICA}/${y}.json`),
  driverStandings: (y = 2025) => fetchJSON(`${JOLPICA}/${y}/driverStandings.json`),
  constructorStandings: (y = 2025) => fetchJSON(`${JOLPICA}/${y}/constructorStandings.json`),
  raceResult: (y, rd) => fetchJSON(`${JOLPICA}/${y}/${rd}/results.json`),
  qualiResult: (y, rd) => fetchJSON(`${JOLPICA}/${y}/${rd}/qualifying.json`),
  lastResult: () => fetchJSON(`${JOLPICA}/current/last/results.json`),
  drivers: (y = 2025) => fetchJSON(`${JOLPICA}/${y}/drivers.json`),
};

// ═══ TEAM DATA ═════════════════════════════════════════════════════
const TEAMS = {
  red_bull: { name: "Red Bull Racing", short: "RBR", primary: "#3671C6", secondary: "#CC1E4A", bg: "#080E1C", surface: "#0C1628", ids: ["red_bull"] },
  ferrari: { name: "Scuderia Ferrari", short: "FER", primary: "#E8002D", secondary: "#FFF200", bg: "#140407", surface: "#220810", ids: ["ferrari"] },
  mercedes: { name: "Mercedes-AMG", short: "MER", primary: "#27F4D2", secondary: "#000000", bg: "#06120F", surface: "#0A1E1A", ids: ["mercedes"] },
  mclaren: { name: "McLaren F1 Team", short: "MCL", primary: "#FF8000", secondary: "#47C7FC", bg: "#140D03", surface: "#221806", ids: ["mclaren"] },
  aston_martin: { name: "Aston Martin", short: "AMR", primary: "#229971", secondary: "#CEDC00", bg: "#061410", surface: "#0C221C", ids: ["aston_martin"] },
  alpine: { name: "Alpine F1 Team", short: "ALP", primary: "#0093CC", secondary: "#FF69B4", bg: "#060F18", surface: "#0C1A28", ids: ["alpine"] },
  williams: { name: "Williams Racing", short: "WIL", primary: "#64C4FF", secondary: "#005AFF", bg: "#060D14", surface: "#0C1822", ids: ["williams"] },
  haas: { name: "Haas F1 Team", short: "HAS", primary: "#B6BABD", secondary: "#E10600", bg: "#0E0E0F", surface: "#181818", ids: ["haas"] },
  rb: { name: "Racing Bulls", short: "RCB", primary: "#6692FF", secondary: "#FF4444", bg: "#080B18", surface: "#0E1428", ids: ["rb", "alphatauri"] },
  audi: { name: "Audi F1 Team", short: "AUD", primary: "#E10019", secondary: "#000000", bg: "#1A0408", surface: "#280810", ids: ["sauber", "alfa", "audi", "kick"] },
  cadillac: { name: "Cadillac F1 Team", short: "CAD", primary: "#C4A747", secondary: "#1A1A1A", bg: "#121008", surface: "#1E1A10", ids: ["cadillac", "andretti", "twg"] },
  neutral: { name: "The Undercut", short: "F1", primary: "#E10600", secondary: "#FFD700", bg: "#08080C", surface: "#101016", ids: [] },
};

const TIRE_COLORS = { SOFT: "#FF3333", MEDIUM: "#FFC300", HARD: "#EEEEEE", INTERMEDIATE: "#39B54A", WET: "#0072CE", UNKNOWN: "#888888" };
const TIRE_LABELS = { SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W", UNKNOWN: "?" };

const mapConstructorToTeamKey = (id) => {
  if (!id) return "neutral";
  const low = id.toLowerCase().replace(/[^a-z_]/g, "");
  for (const [key, team] of Object.entries(TEAMS)) {
    if (team.ids.some(tid => low.includes(tid))) return key;
  }
  if (low.includes("bull") || low.includes("verstappen")) return "red_bull";
  if (low.includes("ferrar")) return "ferrari";
  if (low.includes("merced")) return "mercedes";
  if (low.includes("laren")) return "mclaren";
  if (low.includes("aston")) return "aston_martin";
  if (low.includes("alpin")) return "alpine";
  if (low.includes("williams")) return "williams";
  if (low.includes("haas") || low.includes("tgr")) return "haas";
  if (low.includes("racing_bull") || low.includes("racingbull") || low.includes("tauri")) return "rb";
  if (low.includes("audi") || low.includes("sauber") || low.includes("stake") || low.includes("alfa") || low.includes("kick")) return "audi";
  if (low.includes("cadillac") || low.includes("andretti") || low.includes("twg")) return "cadillac";
  return "neutral";
};

// ═══ COMPONENTS ═══════════════════════════════════════════════════
const Dot = ({ color, size = 6 }) => <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, marginRight: 5, boxShadow: `0 0 6px ${color}88`, animation: "pulse 1.5s ease infinite" }} />;

const TireChip = ({ compound, age }) => {
  const c = compound?.toUpperCase() || "UNKNOWN";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${TIRE_COLORS[c] || "#888"}`, background: "#0004", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: TIRE_COLORS[c] || "#888", fontFamily: "var(--mono)" }}>{TIRE_LABELS[c] || "?"}</div>
      {age != null && <span style={{ fontSize: 9, color: age > 15 ? "#FF5252" : "#666", fontFamily: "var(--mono)" }}>L{age}</span>}
    </div>
  );
};

const Card = ({ children, glow, style = {}, ...p }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: `1px solid ${glow ? "var(--primary)33" : "#ffffff08"}`, overflow: "hidden", ...style }} {...p}>{children}</div>
);

const CardHead = ({ children, right }) => (
  <div style={{ padding: "12px 16px", borderBottom: "1px solid #ffffff06", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <h3 style={{ margin: 0, fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--primary)", letterSpacing: 2.5 }}>{children}</h3>
    {right}
  </div>
);

const Badge = ({ children, color = "var(--primary)", s }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: s ? "2px 8px" : "3px 10px", borderRadius: 20, background: `${color}15`, border: `1px solid ${color}40`, fontSize: s ? 8 : 9, fontWeight: 700, fontFamily: "var(--mono)", color, letterSpacing: 1, whiteSpace: "nowrap" }}>{children}</span>
);

const Loader = ({ label = "Loading..." }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
    <div style={{ width: 28, height: 28, border: "3px solid #ffffff10", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <span style={{ fontSize: 10, color: "#555", fontFamily: "var(--mono)", letterSpacing: 2 }}>{label}</span>
  </div>
);

const FlagDot = ({ flag }) => {
  const m = { GREEN: "#00C853", YELLOW: "#FFD600", RED: "#FF1744", DOUBLE_YELLOW: "#FF9100", BLUE: "#42A5F5", BLACK: "#FFF", CHEQUERED: "#FFF" };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: m[flag?.toUpperCase()] || "#888", boxShadow: `0 0 4px ${m[flag?.toUpperCase()] || "#888"}66` }} />;
};

// ════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════
export default function TheUndercut() {
  const [teamKey, setTeamKey] = useState(null);
  const [onboarding, setOnboarding] = useState(true);
  const [tab, setTab] = useState("command");

  // API Data State
  const [loading, setLoading] = useState({});
  const [schedule, setSchedule] = useState(null);
  const [driverStandings, setDriverStandings] = useState(null);
  const [constructorStandings, setConstructorStandings] = useState(null);
  const [latestSession, setLatestSession] = useState(null);
  const [positions, setPositions] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [raceControlMsgs, setRaceControlMsgs] = useState(null);
  const [intervals, setIntervals] = useState(null);
  const [stints, setStints] = useState(null);
  const [pitStops, setPitStops] = useState(null);
  const [openf1Drivers, setOpenf1Drivers] = useState(null);
  const [laps, setLaps] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [meetings, setMeetings] = useState(null);
  const refreshTimer = useRef(null);

  const T = TEAMS[teamKey] || TEAMS.neutral;

  // Fetch Jolpica data on mount
  useEffect(() => {
    if (onboarding) return;
    const load = async () => {
      setLoading(p => ({ ...p, schedule: true, standings: true }));

      const [sched, ds, cs, lr] = await Promise.all([
        jolpica.schedule(2026),
        jolpica.driverStandings(2025),
        jolpica.constructorStandings(2025),
        jolpica.lastResult(),
      ]);

      if (sched?.MRData?.RaceTable?.Races) setSchedule(sched.MRData.RaceTable.Races);
      if (ds?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings) setDriverStandings(ds.MRData.StandingsTable.StandingsLists[0].DriverStandings);
      if (cs?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings) setConstructorStandings(cs.MRData.StandingsTable.StandingsLists[0].ConstructorStandings);
      if (lr?.MRData?.RaceTable?.Races?.[0]) setLastResult(lr.MRData.RaceTable.Races[0]);

      setLoading(p => ({ ...p, schedule: false, standings: false }));
    };
    load();
  }, [onboarding]);

  // Fetch OpenF1 data on mount
  useEffect(() => {
    if (onboarding) return;
    const load = async () => {
      setLoading(p => ({ ...p, live: true }));

      const [sess, pos, wthr, rc, intv, st, pit, drv, lp, mtg] = await Promise.all([
        api.latestSession(),
        api.latestPositions(),
        api.latestWeather(),
        api.latestRaceControl(),
        api.latestIntervals(),
        api.latestStints(),
        api.latestPit(),
        api.latestDrivers(),
        api.latestLaps(),
        api.meetings(2026),
      ]);

      if (Array.isArray(sess) && sess.length) setLatestSession(sess[sess.length - 1]);
      if (Array.isArray(pos)) setPositions(pos);
      if (Array.isArray(wthr) && wthr.length) setWeatherData(wthr[wthr.length - 1]);
      if (Array.isArray(rc)) setRaceControlMsgs(rc);
      if (Array.isArray(intv)) setIntervals(intv);
      if (Array.isArray(st)) setStints(st);
      if (Array.isArray(pit)) setPitStops(pit);
      if (Array.isArray(drv)) setOpenf1Drivers(drv);
      if (Array.isArray(lp)) setLaps(lp);
      if (Array.isArray(mtg)) setMeetings(mtg);

      setLoading(p => ({ ...p, live: false }));
    };
    load();
  }, [onboarding]);

  // Auto-refresh live data every 30s
  useEffect(() => {
    if (onboarding) return;
    refreshTimer.current = setInterval(async () => {
      const [pos, wthr, rc, intv] = await Promise.all([
        api.latestPositions(), api.latestWeather(), api.latestRaceControl(), api.latestIntervals()
      ]);
      if (Array.isArray(pos)) setPositions(pos);
      if (Array.isArray(wthr) && wthr.length) setWeatherData(wthr[wthr.length - 1]);
      if (Array.isArray(rc)) setRaceControlMsgs(rc);
      if (Array.isArray(intv)) setIntervals(intv);
    }, 30000);
    return () => clearInterval(refreshTimer.current);
  }, [onboarding]);

  // ═══ DATA PROCESSORS ═══
  const processedPositions = (() => {
    if (!positions || !positions.length) return null;
    const driverMap = {};
    if (openf1Drivers) openf1Drivers.forEach(d => { driverMap[d.driver_number] = d; });
    const latest = {};
    positions.forEach(p => {
      if (!latest[p.driver_number] || new Date(p.date) > new Date(latest[p.driver_number].date)) latest[p.driver_number] = p;
    });
    const intervalMap = {};
    if (intervals) {
      intervals.forEach(iv => {
        if (!intervalMap[iv.driver_number] || new Date(iv.date) > new Date(intervalMap[iv.driver_number].date)) intervalMap[iv.driver_number] = iv;
      });
    }
    const stintMap = {};
    if (stints) {
      stints.forEach(s => {
        if (!stintMap[s.driver_number] || s.stint_number > (stintMap[s.driver_number].stint_number || 0)) stintMap[s.driver_number] = s;
      });
    }
    const lapMap = {};
    if (laps) {
      laps.forEach(l => {
        if (!lapMap[l.driver_number] || l.lap_number > (lapMap[l.driver_number].lap_number || 0)) lapMap[l.driver_number] = l;
      });
    }
    return Object.values(latest)
      .sort((a, b) => a.position - b.position)
      .map(p => {
        const d = driverMap[p.driver_number] || {};
        const iv = intervalMap[p.driver_number];
        const st = stintMap[p.driver_number];
        const lp = lapMap[p.driver_number];
        return {
          pos: p.position,
          num: p.driver_number,
          code: d.name_acronym || `#${p.driver_number}`,
          name: d.full_name || d.name_acronym || `Driver ${p.driver_number}`,
          teamKey: mapConstructorToTeamKey(d.team_name),
          teamName: d.team_name || "Unknown",
          teamColor: d.team_colour ? `#${d.team_colour}` : "#888",
          gap: iv?.gap_to_leader != null ? `+${Number(iv.gap_to_leader).toFixed(3)}` : (p.position === 1 ? "LEADER" : "—"),
          interval: iv?.interval != null ? `+${Number(iv.interval).toFixed(3)}` : "—",
          lastLap: lp?.lap_duration != null ? formatLapTime(lp.lap_duration) : "—",
          tire: st?.compound || "UNKNOWN",
          tireAge: st?.tyre_age_at_pit != null ? st.tyre_age_at_pit : (st?.lap_end && st?.lap_start ? st.lap_end - st.lap_start : null),
          pits: st?.stint_number ? st.stint_number - 1 : 0,
        };
      })
      .filter(d => d.pos && d.pos <= 20);
  })();

  const processedRaceControl = (() => {
    if (!raceControlMsgs) return null;
    return raceControlMsgs.slice(-30).reverse().map(m => ({
      time: m.date ? new Date(m.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—",
      flag: m.flag,
      msg: m.message,
      cat: m.category,
      driver: m.driver_number,
    }));
  })();

  const processedPitStops = (() => {
    if (!pitStops || !pitStops.length) return null;
    const driverMap = {};
    if (openf1Drivers) openf1Drivers.forEach(d => { driverMap[d.driver_number] = d; });
    return pitStops.map(p => ({
      num: p.driver_number,
      code: driverMap[p.driver_number]?.name_acronym || `#${p.driver_number}`,
      teamColor: driverMap[p.driver_number]?.team_colour ? `#${driverMap[p.driver_number].team_colour}` : "#888",
      lap: p.lap_number,
      duration: p.pit_duration != null ? Number(p.pit_duration).toFixed(1) : "—",
      time: p.date ? new Date(p.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
    })).sort((a, b) => (a.duration === "—" ? 999 : Number(a.duration)) - (b.duration === "—" ? 999 : Number(b.duration)));
  })();

  const processedSchedule = (() => {
    if (!schedule) return null;
    const now = new Date();
    return schedule.map((r, i) => {
      const rDate = new Date(r.date);
      const isPast = rDate < now;
      const diffDays = Math.ceil((rDate - now) / 86400000);
      const isNext = !isPast && diffDays <= 14 && diffDays >= -2;
      return {
        round: r.round, name: r.raceName, circuit: r.Circuit?.circuitName, loc: r.Circuit?.Location?.locality,
        country: r.Circuit?.Location?.country, date: r.date, time: r.time,
        fp1: r.FirstPractice, fp2: r.SecondPractice, fp3: r.ThirdPractice,
        quali: r.Qualifying, sprint: r.Sprint,
        status: isNext ? "next" : isPast ? "done" : "upcoming",
      };
    });
  })();

  const processedDriverStandings = (() => {
    if (!driverStandings) return null;
    return driverStandings.map((ds, i) => ({
      pos: i + 1, code: ds.Driver?.code || "???", name: `${ds.Driver?.givenName} ${ds.Driver?.familyName}`,
      nationality: ds.Driver?.nationality, pts: Number(ds.points), wins: Number(ds.wins),
      teamKey: mapConstructorToTeamKey(ds.Constructors?.[0]?.constructorId),
      teamName: ds.Constructors?.[0]?.name || "Unknown",
    }));
  })();

  const processedConstructorStandings = (() => {
    if (!constructorStandings) return null;
    return constructorStandings.map((cs, i) => ({
      pos: i + 1, name: cs.Constructor?.name, id: cs.Constructor?.constructorId,
      teamKey: mapConstructorToTeamKey(cs.Constructor?.constructorId),
      pts: Number(cs.points), wins: Number(cs.wins),
    }));
  })();

  const processedWeather = (() => {
    if (!weatherData) return null;
    return {
      airTemp: weatherData.air_temperature, trackTemp: weatherData.track_temperature,
      humidity: weatherData.humidity, wind: weatherData.wind_speed,
      windDir: weatherData.wind_direction, rain: weatherData.rainfall,
      pressure: weatherData.pressure,
    };
  })();

  const processedLapTimes = (() => {
    if (!laps || !laps.length) return null;
    const byDriver = {};
    laps.forEach(l => {
      if (!l.lap_duration || l.lap_duration > 200) return;
      if (!byDriver[l.driver_number]) byDriver[l.driver_number] = [];
      byDriver[l.driver_number].push({ lap: l.lap_number, time: l.lap_duration });
    });
    const topDrivers = Object.keys(byDriver).slice(0, 4);
    if (!topDrivers.length) return null;
    const maxLap = Math.max(...Object.values(byDriver).flat().map(l => l.lap));
    const data = [];
    for (let i = 1; i <= Math.min(maxLap, 60); i++) {
      const row = { lap: i };
      topDrivers.forEach(dn => {
        const lapData = byDriver[dn]?.find(l => l.lap === i);
        row[`d${dn}`] = lapData?.time || null;
      });
      data.push(row);
    }
    return { data, drivers: topDrivers };
  })();

  function formatLapTime(seconds) {
    if (!seconds || seconds > 300) return "—";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(3);
    return m > 0 ? `${m}:${s.padStart(6, "0")}` : `${Number(s).toFixed(3)}`;
  }

  const nextRace = processedSchedule?.find(r => r.status === "next");
  const lastRace = processedSchedule ? [...processedSchedule].reverse().find(r => r.status === "done") : null;
  const sessionName = latestSession ? `${latestSession.session_name || latestSession.session_type || "Session"} — ${latestSession.meeting_key ? latestSession.location || "" : ""}` : null;

  // ═══ ONBOARDING ═══
  if (onboarding) {
    return (
      <div style={{ minHeight: "100vh", background: "#06060A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', system-ui" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700;800&family=Barlow:wght@300;400;500;600;700;800;900&display=swap');
          :root { --mono: 'Bebas Neue', cursive; --sans: 'Barlow', sans-serif; --cond: 'Barlow Condensed', sans-serif; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin { to{transform:rotate(360deg)} }
          @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          @keyframes glow { 0%,100%{box-shadow:0 0 4px var(--primary)44} 50%{box-shadow:0 0 18px var(--primary)55} }
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
          * { box-sizing:border-box; scrollbar-width:thin; scrollbar-color:#22222244 transparent }
          *::-webkit-scrollbar{width:4px;height:4px} *::-webkit-scrollbar-track{background:transparent} *::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
          body{margin:0}
        `}</style>
        <div style={{ textAlign: "center", marginBottom: 44, animation: "fadeUp 0.7s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E1060012", border: "1px solid #E1060030", borderRadius: 100, padding: "5px 18px", marginBottom: 20 }}>
            <Dot color="#E10600" /><span style={{ fontSize: 11, fontFamily: "'Barlow Condensed'", fontWeight: 600, color: "#E10600", letterSpacing: 3 }}>2026 SEASON · LIVE DATA · 11 TEAMS</span>
          </div>
          <h1 style={{ fontSize: "clamp(56px, 10vw, 110px)", fontFamily: "'Bebas Neue'", fontWeight: 400, margin: 0, lineHeight: 0.9, letterSpacing: 4, background: "linear-gradient(135deg, #E10600 0%, #FFD700 40%, #E10600 80%)", backgroundSize: "200% auto", animation: "shimmer 3s linear infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>THE UNDERCUT</h1>
          <p style={{ color: "#555", fontSize: 13, fontFamily: "'Barlow Condensed'", letterSpacing: 5, fontWeight: 500, marginTop: 6 }}>REAL-TIME F1 INTELLIGENCE</p>
          <div style={{ width: 60, height: 2, background: "linear-gradient(90deg, transparent, #E10600, transparent)", margin: "20px auto" }} />
          <p style={{ color: "#666", fontSize: 14, fontFamily: "var(--sans)", maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
            11 teams. 22 drivers. Powered by <strong style={{ color: "#888" }}>OpenF1</strong> + <strong style={{ color: "#888" }}>Jolpica-F1</strong> APIs. Choose your constructor — everything adapts.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, maxWidth: 780, width: "100%" }}>
          {Object.entries(TEAMS).map(([key, t], idx) => (
            <button key={key} onClick={() => { setTeamKey(key); setTimeout(() => setOnboarding(false), 200); }} style={{
              background: "#0A0A10", border: "1px solid #18181F", borderRadius: 12, padding: "14px 8px",
              cursor: "pointer", transition: "all 0.25s", animation: `fadeUp ${0.25 + idx * 0.04}s ease backwards`,
              textAlign: "center", position: "relative", overflow: "hidden",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${t.primary}18`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#18181F"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${t.primary}, ${t.secondary})` }} />
              <div style={{ fontSize: 22, fontWeight: 400, fontFamily: "'Bebas Neue'", color: t.primary, letterSpacing: 2 }}>{t.short}</div>
              <div style={{ fontSize: 9, color: "#777", fontFamily: "'Barlow Condensed'", fontWeight: 600, letterSpacing: 0.5 }}>{t.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "command", label: "COMMAND CENTER", ic: "⚡" },
    { id: "timing", label: "LIVE TIMING", ic: "📋" },
    { id: "telemetry", label: "DATA & WEATHER", ic: "📊" },
    { id: "standings", label: "STANDINGS", ic: "🏆" },
    { id: "calendar", label: "CALENDAR", ic: "📅" },
    { id: "racecontrol", label: "RACE CONTROL", ic: "🚦" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: "#E0E0E4", fontFamily: "var(--sans)", "--primary": T.primary, "--secondary": T.secondary, "--surface": T.surface, "--bg": T.bg, "--mono": "'Bebas Neue', cursive", "--cond": "'Barlow Condensed', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700;800&family=Barlow:wght@300;400;500;600;700;800;900&display=swap');
        :root{--mono:'Bebas Neue',cursive;--sans:'Barlow',sans-serif;--cond:'Barlow Condensed',sans-serif}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}} @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes glow{0%,100%{box-shadow:0 0 4px var(--primary)44}50%{box-shadow:0 0 16px var(--primary)55}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${T.primary}22 transparent}
        *::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:${T.primary}33;border-radius:2px}
        body{margin:0}
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header style={{ background: T.surface, borderBottom: "1px solid #ffffff06", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ padding: "0 16px", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontSize: 24, fontFamily: "var(--mono)", fontWeight: 400, margin: 0, letterSpacing: 3, color: "#FFF" }}>THE <span style={{ color: T.primary }}>UNDERCUT</span></h1>
              {latestSession && (
                <Badge color={T.primary} s>
                  {latestSession.session_name} · {latestSession.location || latestSession.country_name || ""}
                </Badge>
              )}
              {loading.live && <div style={{ width: 14, height: 14, border: "2px solid #ffffff10", borderTopColor: T.primary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 8, color: "#444", fontFamily: "var(--cond)", letterSpacing: 1 }}>OPENF1 + JOLPICA</span>
              <div onClick={() => setOnboarding(true)} style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, ${T.primary}, ${T.secondary})`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--mono)", color: "#FFF" }}>{T.short[0]}</div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 1, overflow: "auto" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? `${T.primary}12` : "transparent", border: "none",
                borderBottom: tab === t.id ? `2px solid ${T.primary}` : "2px solid transparent",
                color: tab === t.id ? T.primary : "#555", padding: "8px 12px", cursor: "pointer",
                fontSize: 10, fontFamily: "var(--cond)", fontWeight: 700, letterSpacing: 1.5, whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
              }}>{t.ic} {t.label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ padding: "14px 16px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ═══ COMMAND CENTER ═══ */}
        {tab === "command" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {/* Hero — Next Race */}
            <Card glow style={{ padding: 24, marginBottom: 14, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 85% 40%, ${T.primary}10 0%, transparent 55%)` }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                {nextRace ? (
                  <>
                    <Badge color={T.primary} s>ROUND {nextRace.round}{nextRace.sprint ? " · SPRINT WEEKEND" : ""}</Badge>
                    <h2 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontFamily: "var(--mono)", fontWeight: 400, margin: "6px 0 0", letterSpacing: 3, color: "#FFF" }}>{nextRace.name}</h2>
                    <p style={{ color: "#666", fontSize: 13, fontFamily: "var(--cond)", margin: "2px 0 0", fontWeight: 500 }}>
                      {nextRace.circuit} · {nextRace.loc}, {nextRace.country} · {nextRace.date}
                    </p>
                    {nextRace.quali && <p style={{ color: "#555", fontSize: 11, fontFamily: "var(--cond)", margin: "4px 0 0" }}>Qualifying: {nextRace.quali.date} {nextRace.quali.time?.replace("Z", " UTC")}</p>}
                  </>
                ) : schedule ? (
                  <p style={{ color: "#888", fontSize: 14, fontFamily: "var(--cond)" }}>No upcoming race found in schedule.</p>
                ) : loading.schedule ? <Loader label="FETCHING SCHEDULE" /> : (
                  <p style={{ color: "#666", fontSize: 13 }}>Schedule unavailable — Jolpica API may be down.</p>
                )}

                {/* Weather from OpenF1 */}
                {processedWeather && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    {[
                      { l: "AIR", v: `${processedWeather.airTemp?.toFixed(1)}°C`, ic: "🌡️" },
                      { l: "TRACK", v: `${processedWeather.trackTemp?.toFixed(1)}°C`, ic: "🛣️" },
                      { l: "HUMIDITY", v: `${processedWeather.humidity}%`, ic: "💧" },
                      { l: "WIND", v: `${processedWeather.wind?.toFixed(1)} m/s`, ic: "💨" },
                      { l: "RAIN", v: processedWeather.rain ? "YES 🌧️" : "NO ☀️", ic: "" },
                      { l: "PRESSURE", v: `${processedWeather.pressure?.toFixed(0)} hPa`, ic: "📊" },
                    ].filter(w => w.v && !w.v.includes("undefined")).map(w => (
                      <div key={w.l} style={{ background: "#ffffff05", border: "1px solid #ffffff06", borderRadius: 9, padding: "8px 14px", minWidth: 80, textAlign: "center" }}>
                        <div style={{ fontSize: 8, color: "#555", fontFamily: "var(--cond)", fontWeight: 600, letterSpacing: 1 }}>{w.ic} {w.l}</div>
                        <div style={{ fontSize: 15, fontWeight: 400, fontFamily: "var(--mono)", color: T.primary, marginTop: 2, letterSpacing: 1 }}>{w.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
              {/* Mini Standings */}
              <Card>
                <CardHead right={<span style={{ fontSize: 9, color: "#444", cursor: "pointer" }} onClick={() => setTab("standings")}>VIEW ALL →</span>}>DRIVER STANDINGS (JOLPICA)</CardHead>
                {loading.standings ? <Loader label="FETCHING STANDINGS" /> : processedDriverStandings ? (
                  <div style={{ padding: "2px 0" }}>
                    {processedDriverStandings.slice(0, 8).map((d, i) => (
                      <div key={d.code} style={{ display: "flex", alignItems: "center", padding: "7px 16px", borderBottom: "1px solid #ffffff04", background: d.teamKey === teamKey ? `${T.primary}06` : "transparent" }}>
                        <span style={{ width: 20, fontSize: 16, fontFamily: "var(--mono)", color: i < 3 ? T.primary : "#444", letterSpacing: 1 }}>{d.pos}</span>
                        <div style={{ width: 3, height: 14, background: TEAMS[d.teamKey]?.primary || "#888", borderRadius: 2, margin: "0 8px" }} />
                        <span style={{ fontSize: 10, fontFamily: "var(--cond)", fontWeight: 700, color: TEAMS[d.teamKey]?.primary || "#888", width: 32 }}>{d.code}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{d.name}</span>
                        <span style={{ fontSize: 16, fontFamily: "var(--mono)", color: T.primary, letterSpacing: 1 }}>{d.pts}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>Standings unavailable</div>}
              </Card>

              {/* Race Control Mini */}
              <Card>
                <CardHead right={<span style={{ fontSize: 9, color: "#444", cursor: "pointer" }} onClick={() => setTab("racecontrol")}>FULL LOG →</span>}>🚦 RACE CONTROL (OPENF1)</CardHead>
                {processedRaceControl ? (
                  <div style={{ padding: "4px 0", maxHeight: 260, overflow: "auto" }}>
                    {processedRaceControl.slice(0, 10).map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, padding: "6px 16px", borderBottom: "1px solid #ffffff03", fontSize: 11 }}>
                        <span style={{ fontFamily: "var(--cond)", fontSize: 10, color: "#444", minWidth: 55, fontWeight: 600 }}>{m.time}</span>
                        {m.flag && <FlagDot flag={m.flag} />}
                        <span style={{ color: m.cat === "Flag" ? "#FFD600" : m.cat === "SafetyCar" ? "#FFC107" : "#999", fontWeight: 500, lineHeight: 1.3, fontSize: 11 }}>{m.msg}</span>
                      </div>
                    ))}
                  </div>
                ) : loading.live ? <Loader label="FETCHING RACE CONTROL" /> : <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>No race control data</div>}
              </Card>

              {/* Last Race Result */}
              <Card>
                <CardHead>🏁 LAST RACE RESULT (JOLPICA)</CardHead>
                {lastResult ? (
                  <div style={{ padding: "6px 0" }}>
                    <div style={{ padding: "8px 16px", borderBottom: "1px solid #ffffff06", fontSize: 12, color: "#888", fontFamily: "var(--cond)", fontWeight: 600 }}>
                      {lastResult.raceName} — {lastResult.Circuit?.circuitName} — {lastResult.date}
                    </div>
                    {lastResult.Results?.slice(0, 6).map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 16px", borderBottom: "1px solid #ffffff03" }}>
                        <span style={{ width: 20, fontSize: 16, fontFamily: "var(--mono)", color: i < 3 ? T.primary : "#444" }}>{r.position}</span>
                        <div style={{ width: 3, height: 14, background: TEAMS[mapConstructorToTeamKey(r.Constructor?.constructorId)]?.primary || "#888", borderRadius: 2, margin: "0 8px" }} />
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{r.Driver?.givenName} {r.Driver?.familyName}</span>
                        <span style={{ fontSize: 11, color: "#888", fontFamily: "var(--cond)", marginRight: 10 }}>{r.status === "Finished" ? r.Time?.time || "" : r.status}</span>
                        <Badge s color={T.primary}>+{r.points}pts</Badge>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>No recent result available</div>}
              </Card>
            </div>
          </div>
        )}

        {/* ═══ LIVE TIMING ═══ */}
        {tab === "timing" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {sessionName && <div style={{ marginBottom: 10 }}><Badge color={T.primary}>{sessionName}</Badge></div>}
            <Card glow>
              <CardHead right={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 8, color: "#444", fontFamily: "var(--cond)", letterSpacing: 1 }}>AUTO-REFRESH 30s</span>
                  <Dot color="#00C853" size={5} />
                </div>
              }>📋 LIVE TIMING (OPENF1 API)</CardHead>
              {loading.live && !processedPositions ? <Loader label="FETCHING POSITIONS" /> : processedPositions && processedPositions.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "#ffffff03" }}>
                        {["P", "", "DRIVER", "TEAM", "GAP", "INTERVAL", "LAST LAP", "TIRE", "PITS"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "var(--cond)", fontWeight: 700, color: "#444", fontSize: 9, letterSpacing: 1.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processedPositions.map((d, i) => (
                        <tr key={d.num} style={{ borderBottom: "1px solid #ffffff03", background: d.teamKey === teamKey ? `${T.primary}06` : "transparent", transition: "background 0.3s" }}>
                          <td style={{ padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 16, color: i < 3 ? T.primary : "#444", letterSpacing: 1 }}>{d.pos}</td>
                          <td style={{ padding: "7px 4px" }}><div style={{ width: 3, height: 14, background: d.teamColor, borderRadius: 2 }} /></td>
                          <td style={{ padding: "7px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                            <span style={{ fontFamily: "var(--cond)", fontWeight: 800, fontSize: 11, color: d.teamColor, marginRight: 5 }}>{d.code}</span>
                            <span style={{ fontSize: 11, fontWeight: 500, color: "#BBB" }}>{d.name}</span>
                          </td>
                          <td style={{ padding: "7px 10px", fontSize: 10, color: "#666", fontFamily: "var(--cond)" }}>{d.teamName}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "var(--cond)", fontSize: 11, fontWeight: 700, color: d.gap === "LEADER" ? "#00C853" : "#CCC" }}>{d.gap}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "var(--cond)", fontSize: 11, color: "#888" }}>{d.interval}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "var(--cond)", fontSize: 11, fontWeight: 600, color: "#DDD" }}>{d.lastLap}</td>
                          <td style={{ padding: "7px 10px" }}><TireChip compound={d.tire} age={d.tireAge} /></td>
                          <td style={{ padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 14, color: "#666" }}>{d.pits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div style={{ padding: 30, textAlign: "center", color: "#555", fontSize: 12, fontFamily: "var(--cond)" }}>
                  No live position data available. Positions appear during active sessions.
                  <br /><span style={{ fontSize: 10, color: "#444" }}>Source: api.openf1.org/v1/position</span>
                </div>}
            </Card>

            {/* Pit Stops */}
            {processedPitStops && processedPitStops.length > 0 && (
              <Card style={{ marginTop: 12 }}>
                <CardHead>🔧 PIT STOPS (OPENF1 API)</CardHead>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr style={{ background: "#ffffff03" }}>
                      {["", "DRIVER", "LAP", "DURATION", "TIME"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "var(--cond)", fontWeight: 700, color: "#444", fontSize: 9, letterSpacing: 1.5 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {processedPitStops.slice(0, 15).map((p, i) => (
                        <tr key={`${p.num}-${p.lap}-${i}`} style={{ borderBottom: "1px solid #ffffff03" }}>
                          <td style={{ padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 14, color: i < 3 ? "#00C853" : "#444" }}>{i + 1}</td>
                          <td style={{ padding: "6px 10px" }}><span style={{ fontFamily: "var(--cond)", fontWeight: 800, color: p.teamColor }}>{p.code}</span></td>
                          <td style={{ padding: "6px 10px", fontFamily: "var(--cond)", fontSize: 11, color: "#888" }}>Lap {p.lap}</td>
                          <td style={{ padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 16, letterSpacing: 1, color: Number(p.duration) < 3 ? "#00C853" : Number(p.duration) < 4 ? T.primary : "#FF9800" }}>{p.duration}s</td>
                          <td style={{ padding: "6px 10px", fontSize: 10, color: "#555" }}>{p.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══ DATA & WEATHER ═══ */}
        {tab === "telemetry" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12, marginBottom: 12 }}>
              {/* Lap Time Chart */}
              <Card>
                <CardHead>⏱️ LAP TIMES (OPENF1 API)</CardHead>
                <div style={{ padding: 16 }}>
                  {processedLapTimes ? (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={processedLapTimes.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                          <XAxis dataKey="lap" stroke="#333" tick={{ fontSize: 9, fill: "#555" }} />
                          <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke="#333" tick={{ fontSize: 9, fill: "#555" }} />
                          <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.primary}33`, borderRadius: 8, fontSize: 10 }} formatter={(v) => v ? `${Number(v).toFixed(3)}s` : "—"} />
                          {processedLapTimes.drivers.map((dn, i) => {
                            const d = openf1Drivers?.find(dr => dr.driver_number === Number(dn));
                            const color = d?.team_colour ? `#${d.team_colour}` : ["#3671C6", "#FF8000", "#E8002D", "#27F4D2"][i] || "#888";
                            return <Line key={dn} type="monotone" dataKey={`d${dn}`} stroke={color} strokeWidth={1.5} dot={false} connectNulls name={d?.name_acronym || `#${dn}`} />;
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
                        {processedLapTimes.drivers.map(dn => {
                          const d = openf1Drivers?.find(dr => dr.driver_number === Number(dn));
                          return (
                            <div key={dn} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 10, height: 3, background: d?.team_colour ? `#${d.team_colour}` : "#888", borderRadius: 2 }} />
                              <span style={{ fontSize: 9, color: "#888", fontFamily: "var(--cond)", fontWeight: 600 }}>{d?.name_acronym || `#${dn}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : loading.live ? <Loader label="LOADING LAP DATA" /> : (
                    <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>No lap time data available</div>
                  )}
                </div>
              </Card>

              {/* Weather History */}
              <Card>
                <CardHead>🌤️ LATEST WEATHER (OPENF1 API)</CardHead>
                <div style={{ padding: 16 }}>
                  {processedWeather ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[
                        { ic: "🌡️", l: "AIR TEMP", v: `${processedWeather.airTemp?.toFixed(1)}°C` },
                        { ic: "🛣️", l: "TRACK TEMP", v: `${processedWeather.trackTemp?.toFixed(1)}°C` },
                        { ic: "💧", l: "HUMIDITY", v: `${processedWeather.humidity}%` },
                        { ic: "💨", l: "WIND SPEED", v: `${processedWeather.wind?.toFixed(1)} m/s` },
                        { ic: "🧭", l: "WIND DIR", v: `${processedWeather.windDir}°` },
                        { ic: "🌧️", l: "RAINFALL", v: processedWeather.rain ? "YES" : "NO" },
                        { ic: "📊", l: "PRESSURE", v: `${processedWeather.pressure?.toFixed(0)} hPa` },
                      ].filter(w => w.v && !w.v.includes("undefined") && !w.v.includes("null")).map(w => (
                        <div key={w.l} style={{ background: "#ffffff04", borderRadius: 10, padding: 14, textAlign: "center" }}>
                          <div style={{ fontSize: 22, marginBottom: 2 }}>{w.ic}</div>
                          <div style={{ fontSize: 8, color: "#555", fontFamily: "var(--cond)", fontWeight: 600, letterSpacing: 1 }}>{w.l}</div>
                          <div style={{ fontSize: 18, fontFamily: "var(--mono)", color: T.primary, marginTop: 3, letterSpacing: 1 }}>{w.v}</div>
                        </div>
                      ))}
                    </div>
                  ) : loading.live ? <Loader label="FETCHING WEATHER" /> : (
                    <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>No weather data available<br /><span style={{ fontSize: 10, color: "#444" }}>Source: api.openf1.org/v1/weather</span></div>
                  )}
                </div>
              </Card>
            </div>

            {/* Stint Data */}
            {stints && stints.length > 0 && (
              <Card>
                <CardHead>🛞 TIRE STINTS (OPENF1 API)</CardHead>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr style={{ background: "#ffffff03" }}>
                      {["DRIVER", "STINT", "COMPOUND", "START LAP", "END LAP", "LAPS", "AGE AT PIT"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "var(--cond)", fontWeight: 700, color: "#444", fontSize: 9, letterSpacing: 1.5 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {stints.slice(-30).reverse().map((s, i) => {
                        const d = openf1Drivers?.find(dr => dr.driver_number === s.driver_number);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #ffffff03" }}>
                            <td style={{ padding: "6px 10px" }}><span style={{ fontFamily: "var(--cond)", fontWeight: 800, color: d?.team_colour ? `#${d.team_colour}` : "#888" }}>{d?.name_acronym || `#${s.driver_number}`}</span></td>
                            <td style={{ padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 14, color: "#666" }}>{s.stint_number}</td>
                            <td style={{ padding: "6px 10px" }}><TireChip compound={s.compound} /></td>
                            <td style={{ padding: "6px 10px", fontFamily: "var(--cond)", fontSize: 11, color: "#888" }}>{s.lap_start}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "var(--cond)", fontSize: 11, color: "#888" }}>{s.lap_end || "—"}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 14, color: T.primary }}>{s.lap_end && s.lap_start ? s.lap_end - s.lap_start : "—"}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "var(--cond)", fontSize: 11, color: s.tyre_age_at_pit > 20 ? "#FF5252" : "#888" }}>{s.tyre_age_at_pit ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══ STANDINGS ═══ */}
        {tab === "standings" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <p style={{ fontSize: 10, color: "#444", fontFamily: "var(--cond)", margin: "0 0 12px", letterSpacing: 1 }}>Source: api.jolpi.ca/ergast/f1 (Ergast successor)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", gap: 12 }}>
              {/* Drivers */}
              <Card glow>
                <CardHead>🏆 2025 DRIVER CHAMPIONSHIP</CardHead>
                {loading.standings ? <Loader label="FETCHING STANDINGS" /> : processedDriverStandings ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ background: "#ffffff03" }}>
                        {["P", "", "DRIVER", "TEAM", "WINS", "PTS"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "var(--cond)", fontWeight: 700, color: "#444", fontSize: 9, letterSpacing: 1.5 }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {processedDriverStandings.map((d, i) => (
                          <tr key={d.code} style={{ borderBottom: "1px solid #ffffff03", background: d.teamKey === teamKey ? `${T.primary}06` : "transparent" }}>
                            <td style={{ padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 16, color: i < 3 ? T.primary : "#444" }}>{d.pos}</td>
                            <td style={{ padding: "7px 4px" }}><div style={{ width: 3, height: 14, background: TEAMS[d.teamKey]?.primary || "#888", borderRadius: 2 }} /></td>
                            <td style={{ padding: "7px 10px", fontWeight: 700 }}><span style={{ fontFamily: "var(--cond)", fontWeight: 800, color: TEAMS[d.teamKey]?.primary || "#888", marginRight: 5, fontSize: 11 }}>{d.code}</span>{d.name}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10, color: "#666", fontFamily: "var(--cond)" }}>{d.teamName}</td>
                            <td style={{ padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 14, color: "#888" }}>{d.wins}</td>
                            <td style={{ padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 18, color: T.primary, letterSpacing: 1 }}>{d.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>Driver standings unavailable</div>}
              </Card>

              {/* Constructors */}
              <Card glow>
                <CardHead>🏗️ 2025 CONSTRUCTOR CHAMPIONSHIP</CardHead>
                {loading.standings ? <Loader label="FETCHING" /> : processedConstructorStandings ? (
                  <div>
                    <div style={{ padding: 16 }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={processedConstructorStandings} layout="vertical" margin={{ left: 0 }}>
                          <XAxis type="number" stroke="#333" tick={{ fontSize: 9, fill: "#555" }} />
                          <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fontSize: 9, fill: "#777" }} width={80} />
                          <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.primary}33`, borderRadius: 8, fontSize: 10 }} />
                          <Bar dataKey="pts" radius={[0, 6, 6, 0]} barSize={14}>
                            {processedConstructorStandings.map(c => <Cell key={c.id} fill={TEAMS[c.teamKey]?.primary || "#888"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ padding: "0 16px 12px" }}>
                      {processedConstructorStandings.map((c, i) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #ffffff03" }}>
                          <span style={{ width: 20, fontFamily: "var(--mono)", fontSize: 16, color: i < 3 ? T.primary : "#444" }}>{c.pos}</span>
                          <div style={{ width: 3, height: 12, background: TEAMS[c.teamKey]?.primary || "#888", borderRadius: 2, margin: "0 8px" }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 16, color: T.primary, letterSpacing: 1 }}>{c.pts}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>Constructor standings unavailable</div>}
              </Card>
            </div>
          </div>
        )}

        {/* ═══ CALENDAR ═══ */}
        {tab === "calendar" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 11, fontFamily: "var(--mono)", color: T.primary, letterSpacing: 3 }}>2026 RACE CALENDAR</h3>
              <span style={{ fontSize: 9, color: "#444", fontFamily: "var(--cond)", letterSpacing: 1 }}>Source: Jolpica-F1 API</span>
            </div>
            {loading.schedule ? <Loader label="FETCHING SCHEDULE" /> : processedSchedule ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                {processedSchedule.map(r => (
                  <Card key={r.round} glow={r.status === "next"} style={{ opacity: r.status === "done" ? 0.55 : 1, cursor: "default", border: r.status === "next" ? `2px solid ${T.primary}` : undefined }}>
                    <div style={{ padding: 14, position: "relative" }}>
                      {r.status === "next" && <Badge color={T.primary} s>NEXT RACE ▸</Badge>}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: r.status === "next" ? 6 : 0 }}>
                        <div>
                          <div style={{ fontSize: 8, color: "#555", fontFamily: "var(--cond)", fontWeight: 600, letterSpacing: 1 }}>ROUND {r.round}{r.sprint ? " · SPRINT" : ""}</div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 18, color: r.status === "next" ? T.primary : "#FFF", letterSpacing: 2 }}>{r.name}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#666", fontFamily: "var(--cond)", marginTop: 2 }}>{r.circuit}</div>
                      <div style={{ fontSize: 11, color: "#888", fontFamily: "var(--cond)", fontWeight: 600 }}>{r.loc}, {r.country} · {r.date}</div>
                      {r.sprint && <Badge s color="#FFC107" style={{ marginTop: 4 }}>SPRINT WEEKEND</Badge>}
                      {r.quali && <div style={{ fontSize: 9, color: "#444", marginTop: 4, fontFamily: "var(--cond)" }}>Quali: {r.quali.date} · {r.quali.time?.replace("Z", " UTC")}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            ) : <div style={{ padding: 30, textAlign: "center", color: "#555", fontSize: 12 }}>Schedule unavailable</div>}
          </div>
        )}

        {/* ═══ RACE CONTROL FULL LOG ═══ */}
        {tab === "racecontrol" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <Card glow>
              <CardHead right={<span style={{ fontSize: 8, color: "#444", fontFamily: "var(--cond)" }}>api.openf1.org/v1/race_control · auto-refresh 30s</span>}>🚦 RACE CONTROL — FULL LOG</CardHead>
              {processedRaceControl && processedRaceControl.length ? (
                <div style={{ maxHeight: "60vh", overflow: "auto" }}>
                  {processedRaceControl.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 16px", borderBottom: "1px solid #ffffff03", fontSize: 12, alignItems: "flex-start" }}>
                      <span style={{ fontFamily: "var(--cond)", fontSize: 11, color: "#444", minWidth: 62, fontWeight: 600, flexShrink: 0 }}>{m.time}</span>
                      <div style={{ flexShrink: 0, marginTop: 3 }}>{m.flag && <FlagDot flag={m.flag} />}</div>
                      <div>
                        <span style={{ fontWeight: 600, color: m.cat === "Flag" ? "#FFD600" : m.cat === "SafetyCar" ? "#FFC107" : m.cat === "Drs" ? "#00E676" : "#CCC" }}>{m.msg}</span>
                        {m.driver && <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>Car #{m.driver}</span>}
                        <span style={{ fontSize: 9, color: "#333", marginLeft: 6 }}>{m.cat}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : loading.live ? <Loader label="FETCHING RACE CONTROL" /> : (
                <div style={{ padding: 30, textAlign: "center", color: "#555", fontSize: 12 }}>
                  No race control messages available for the latest session.
                  <br /><span style={{ fontSize: 10, color: "#444" }}>Messages appear during active race weekends.</span>
                </div>
              )}
            </Card>

            {/* Meetings List */}
            {meetings && meetings.length > 0 && (
              <Card style={{ marginTop: 12 }}>
                <CardHead>📋 2026 MEETINGS (OPENF1 API)</CardHead>
                <div style={{ padding: "4px 0", maxHeight: 300, overflow: "auto" }}>
                  {meetings.map((m, i) => (
                    <div key={m.meeting_key || i} style={{ display: "flex", alignItems: "center", padding: "6px 16px", borderBottom: "1px solid #ffffff03", fontSize: 11 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: T.primary, width: 24, letterSpacing: 1 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{m.meeting_name}</span>
                      <span style={{ fontSize: 10, color: "#888", fontFamily: "var(--cond)" }}>{m.location}, {m.country_name}</span>
                      <span style={{ fontSize: 9, color: "#555", marginLeft: 10 }}>{m.date_start?.split("T")[0]}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </main>

      <footer style={{ padding: "20px 16px", textAlign: "center", borderTop: "1px solid #ffffff04", marginTop: 24 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 18, letterSpacing: 3, color: "#FFF" }}>THE <span style={{ color: T.primary }}>UNDERCUT</span></span>
        <p style={{ color: "#333", fontSize: 10, margin: "4px 0 0", fontFamily: "var(--cond)", letterSpacing: 1 }}>
          Real-time data: OpenF1 API · Historical data: Jolpica-F1 (Ergast successor) · Educational use
        </p>
      </footer>
    </div>
  );
}
