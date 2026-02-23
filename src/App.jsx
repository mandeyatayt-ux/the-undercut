import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ════════════════════════════════════════════════════════════════════════
// THE UNDERCUT — REAL-TIME F1 INTELLIGENCE
// ════════════════════════════════════════════════════════════════════════

const OPENF1 = "https://api.openf1.org/v1";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const fetchJ = async (url) => { try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return await r.json(); } catch (e) { console.warn("API fail:", url, e.message); return null; } };

const apiO = {
  latestSession: () => fetchJ(`${OPENF1}/sessions?session_key=latest`),
  latestPositions: () => fetchJ(`${OPENF1}/position?session_key=latest&position<=20`),
  latestWeather: () => fetchJ(`${OPENF1}/weather?session_key=latest`),
  latestRaceControl: () => fetchJ(`${OPENF1}/race_control?session_key=latest`),
  latestIntervals: () => fetchJ(`${OPENF1}/intervals?session_key=latest`),
  latestStints: () => fetchJ(`${OPENF1}/stints?session_key=latest`),
  latestPit: () => fetchJ(`${OPENF1}/pit?session_key=latest`),
  latestDrivers: () => fetchJ(`${OPENF1}/drivers?session_key=latest`),
  latestLaps: () => fetchJ(`${OPENF1}/laps?session_key=latest`),
  carData: (dn) => fetchJ(`${OPENF1}/car_data?session_key=latest&driver_number=${dn}`),
  carDataTwo: (dn1,dn2) => Promise.all([fetchJ(`${OPENF1}/car_data?session_key=latest&driver_number=${dn1}`),fetchJ(`${OPENF1}/car_data?session_key=latest&driver_number=${dn2}`)]),
};
const apiJ = {
  schedule: (y = 2026) => fetchJ(`${JOLPICA}/${y}.json`),
  driverStandings: (y = 2025) => fetchJ(`${JOLPICA}/${y}/driverStandings.json`),
  constructorStandings: (y = 2025) => fetchJ(`${JOLPICA}/${y}/constructorStandings.json`),
  lastResult: () => fetchJ(`${JOLPICA}/current/last/results.json`),
};

// ═══ TEAMS (2026 GRID — 11 TEAMS) ═══
const TEAMS = {
  red_bull:     { name:"Red Bull Racing",  short:"RBR", primary:"#1E3A6E", secondary:"#CC1E4A", bg:"#FFF", surface:"#F4F5F9", ids:["red_bull"] },
  ferrari:      { name:"Scuderia Ferrari", short:"FER", primary:"#DC0000", secondary:"#A80000", bg:"#FFF", surface:"#FFF5F5", ids:["ferrari"] },
  mercedes:     { name:"Mercedes-AMG",     short:"MER", primary:"#00A388", secondary:"#006B58", bg:"#FFF", surface:"#F2FAF8", ids:["mercedes"] },
  mclaren:      { name:"McLaren F1 Team",  short:"MCL", primary:"#E67300", secondary:"#2BA0D0", bg:"#FFF", surface:"#FFF8F0", ids:["mclaren"] },
  aston_martin: { name:"Aston Martin",     short:"AMR", primary:"#1A7A60", secondary:"#9BA800", bg:"#FFF", surface:"#F2F9F6", ids:["aston_martin"] },
  alpine:       { name:"Alpine F1 Team",   short:"ALP", primary:"#0077AA", secondary:"#E050A0", bg:"#FFF", surface:"#F0F7FB", ids:["alpine"] },
  williams:     { name:"Williams Racing",  short:"WIL", primary:"#0050C8", secondary:"#003C9E", bg:"#FFF", surface:"#F0F4FF", ids:["williams"] },
  haas:         { name:"Haas F1 Team",     short:"HAS", primary:"#6E6E6E", secondary:"#D40000", bg:"#FFF", surface:"#F5F5F6", ids:["haas"] },
  rb:           { name:"Racing Bulls",     short:"RCB", primary:"#3355AA", secondary:"#CC2222", bg:"#FFF", surface:"#F2F4FB", ids:["rb","alphatauri"] },
  audi:         { name:"Audi F1 Team",     short:"AUD", primary:"#CC0018", secondary:"#222",    bg:"#FFF", surface:"#FFF4F5", ids:["sauber","alfa","audi","kick"] },
  cadillac:     { name:"Cadillac F1 Team", short:"CAD", primary:"#8A7020", secondary:"#333",    bg:"#FFF", surface:"#FAF8F0", ids:["cadillac","andretti","twg"] },
  neutral:      { name:"The Undercut",     short:"F1",  primary:"#E10600", secondary:"#B07800", bg:"#FFF", surface:"#F5F5F7", ids:[] },
};

const DRIVERS_22 = [
  {num:1,code:"NOR",name:"Lando Norris",team:"mclaren"},{num:81,code:"PIA",name:"Oscar Piastri",team:"mclaren"},
  {num:16,code:"LEC",name:"Charles Leclerc",team:"ferrari"},{num:44,code:"HAM",name:"Lewis Hamilton",team:"ferrari"},
  {num:3,code:"VER",name:"Max Verstappen",team:"red_bull"},{num:6,code:"HAD",name:"Isack Hadjar",team:"red_bull"},
  {num:63,code:"RUS",name:"George Russell",team:"mercedes"},{num:12,code:"ANT",name:"Kimi Antonelli",team:"mercedes"},
  {num:14,code:"ALO",name:"Fernando Alonso",team:"aston_martin"},{num:18,code:"STR",name:"Lance Stroll",team:"aston_martin"},
  {num:10,code:"GAS",name:"Pierre Gasly",team:"alpine"},{num:43,code:"COL",name:"Franco Colapinto",team:"alpine"},
  {num:55,code:"SAI",name:"Carlos Sainz",team:"williams"},{num:23,code:"ALB",name:"Alexander Albon",team:"williams"},
  {num:31,code:"OCO",name:"Esteban Ocon",team:"haas"},{num:87,code:"BEA",name:"Oliver Bearman",team:"haas"},
  {num:22,code:"TSU",name:"Yuki Tsunoda",team:"rb"},{num:41,code:"LIN",name:"Arvid Lindblad",team:"rb"},
  {num:27,code:"HUL",name:"Nico Hülkenberg",team:"audi"},{num:5,code:"BOR",name:"Gabriel Bortoleto",team:"audi"},
  {num:11,code:"PER",name:"Sergio Pérez",team:"cadillac"},{num:77,code:"BOT",name:"Valtteri Bottas",team:"cadillac"},
];

const TIRE_C = {SOFT:"#FF3333",MEDIUM:"#FFC300",HARD:"#CCC",INTERMEDIATE:"#39B54A",WET:"#0072CE",UNKNOWN:"#888"};
const TIRE_L = {SOFT:"S",MEDIUM:"M",HARD:"H",INTERMEDIATE:"I",WET:"W",UNKNOWN:"?"};
const SEC_C = {purple:"#A855F7",green:"#22C55E",yellow:"#EAB308"};

const mapTeamKey = (id) => {
  if(!id) return "neutral"; const l=id.toLowerCase();
  for(const [k,t] of Object.entries(TEAMS)) if(t.ids.some(i=>l.includes(i))) return k;
  if(l.includes("bull"))return"red_bull"; if(l.includes("ferrar"))return"ferrari";
  if(l.includes("merced"))return"mercedes"; if(l.includes("laren"))return"mclaren";
  if(l.includes("aston"))return"aston_martin"; if(l.includes("alpin"))return"alpine";
  if(l.includes("williams"))return"williams"; if(l.includes("haas"))return"haas";
  if(l.includes("tauri")||l.includes("racing_bull"))return"rb";
  if(l.includes("audi")||l.includes("sauber")||l.includes("kick"))return"audi";
  if(l.includes("cadillac")||l.includes("andretti"))return"cadillac";
  return "neutral";
};

// ═══ GENERATORS ═══
const genPos = (lap) => {
  const a = [...DRIVERS_22];
  if(lap>0) for(let i=a.length-1;i>0;i--) if(Math.random()<0.06){const j=Math.max(0,i-1);[a[i],a[j]]=[a[j],a[i]];}
  return a.map((d,i)=>({...d,pos:i+1,
    gap:i===0?"LEADER":`+${(i*1.1+Math.random()*2).toFixed(3)}`,
    interval:i===0?"—":`+${(0.3+Math.random()*1.5).toFixed(3)}`,
    lastLap:`1:${(18+Math.random()*3).toFixed(3)}`,bestLap:`1:${(17.8+Math.random()*1.5).toFixed(3)}`,
    tire:["SOFT","MEDIUM","HARD"][Math.floor(Math.random()*3)],
    tireAge:Math.floor(Math.random()*22)+1,pits:Math.floor(lap/22),
    drs:Math.random()>0.65,status:Math.random()>0.96?"PIT":Math.random()>0.99?"OUT":"RUN",
  }));
};

const genSectors = () => DRIVERS_22.map(d=>{
  const s1=24.5+Math.random()*2.5,s2=31.5+Math.random()*3,s3=27.5+Math.random()*2.5;
  return {...d,s1:s1.toFixed(3),s2:s2.toFixed(3),s3:s3.toFixed(3),total:(s1+s2+s3).toFixed(3),
    s1c:["purple","green","yellow"][Math.floor(Math.random()*3)],s2c:["purple","green","yellow"][Math.floor(Math.random()*3)],s3c:["purple","green","yellow"][Math.floor(Math.random()*3)],
    i1:(285+Math.random()*20).toFixed(1),i2:(310+Math.random()*25).toFixed(1),st:(325+Math.random()*15).toFixed(1),
  };
}).sort((a,b)=>a.total-b.total);

const genTelemetry = () => Array.from({length:100},(_,i)=>{const s=i/100;return{d:i,
  speed1:180+Math.sin(s*Math.PI*6)*80+Math.random()*12,speed2:175+Math.sin(s*Math.PI*6+0.3)*82+Math.random()*12,
  throttle:Math.max(0,Math.min(100,60+Math.sin(s*Math.PI*6)*40)),brake:Math.max(0,Math.min(100,30-Math.sin(s*Math.PI*6)*30)),
  gear:Math.max(1,Math.min(8,Math.round(4+Math.sin(s*Math.PI*6)*3.5))),drs:Math.sin(s*Math.PI*4)>0.7?1:0,
};});
const genTireDeg = () => Array.from({length:50},(_,i)=>({lap:i+1,soft:Math.max(38,98-i*4.2+Math.random()*3),medium:Math.max(42,90-i*2.4+Math.random()*2),hard:Math.max(48,80-i*1.2+Math.random()*1.5)}));
const genLongRun = () => Array.from({length:15},(_,i)=>{const o={lap:i+1};["VER","NOR","LEC","PIA"].forEach(d=>{o[d]=78+Math.random()*2.5+(i>8?(i-8)*0.15:0);});return o;});

const RC_MSGS = [
  {time:"14:02:12",flag:"GREEN",msg:"GREEN LIGHT — PIT EXIT OPEN",cat:"Flag"},
  {time:"14:05:33",flag:"",msg:"DRS ENABLED",cat:"Drs"},
  {time:"14:12:47",flag:"YELLOW",msg:"YELLOW FLAG SECTOR 2 — DEBRIS",cat:"Flag"},
  {time:"14:18:22",flag:"",msg:"TRACK LIMITS — CAR 1 (NOR) LAP DELETED",cat:"Steward"},
  {time:"14:24:55",flag:"",msg:"PIT STOP — CAR 3 (VER) — HARD→MEDIUM — 2.4s",cat:"Pit"},
  {time:"14:35:44",flag:"YELLOW",msg:"SAFETY CAR DEPLOYED — INCIDENT T4",cat:"SafetyCar"},
  {time:"14:42:05",flag:"GREEN",msg:"GREEN FLAG — RACING RESUMES",cat:"Flag"},
  {time:"14:55:18",flag:"",msg:"FASTEST LAP — CAR 1 (NOR) — 1:18.432",cat:"Race"},
  {time:"15:02:00",flag:"",msg:"5s PENALTY — CAR 31 (OCO) — CAUSING COLLISION",cat:"Steward"},
];

// ═══ TRACK MAP — SVG circuit ═══
const TRACK_PTS = (()=>{const pts=[];const cx=250,cy=200;
  for(let i=0;i<100;i++){const a=(i/100)*Math.PI*2-Math.PI/2;
    const rx=160+Math.sin(a*3)*30+Math.cos(a*5)*15;const ry=120+Math.cos(a*2)*25+Math.sin(a*4)*20;
    pts.push({x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry});}return pts;})();
const TRACK_D = "M"+TRACK_PTS.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")+" Z";

const TrackMap = ({positions, teamKey, lap}) => {
  const cars = (positions||[]).slice(0,22).map((d,i)=>{
    const progressOffset = (lap||0) * 1.3;
    const idx = Math.floor(((100 - i*4.2 + progressOffset + (d.num||0)*3.7) % 100 + 100) % 100);
    const pt = TRACK_PTS[idx];
    return {...d,x:pt.x,y:pt.y,color:TEAMS[d.team]?.primary||"#888"};
  });
  return (
    <svg viewBox="0 0 500 400" style={{width:"100%",height:"auto",maxHeight:360}}>
      <defs>
        <filter id="cg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="drsG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#00C85300"/><stop offset="50%" stopColor="#00C85366"/><stop offset="100%" stopColor="#00C85300"/></linearGradient>
      </defs>
      {/* Track surface */}
      <path d={TRACK_D} fill="none" stroke="#D0D0D8" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={TRACK_D} fill="none" stroke="#E8E8EC" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={TRACK_D} fill="none" stroke="#F0F0F3" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
      {/* DRS zones */}
      {[18,55].map(z=>{const p1=TRACK_PTS[z],p2=TRACK_PTS[(z+10)%100];return <line key={z} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="url(#drsG)" strokeWidth="24" strokeLinecap="round"/>;})}
      {/* Sector markers */}
      {[0,33,66].map((s,i)=>{const p=TRACK_PTS[s];return <g key={s}><circle cx={p.x} cy={p.y} r="4" fill={["#FF3333","#3388FF","#FFD700"][i]}/><text x={p.x+8} y={p.y+3} fill="#AAA" fontSize="8" fontFamily="'Barlow Condensed'" fontWeight="600">S{i+1}</text></g>;})}
      {/* Start/Finish */}
      {(()=>{const p=TRACK_PTS[0];return <g><rect x={p.x-15} y={p.y-3} width="30" height="6" rx="2" fill="#1A1A2E"/><text x={p.x} y={p.y+16} fill="#AAA" fontSize="7" fontFamily="'Barlow Condensed'" fontWeight="700" textAnchor="middle">START / FINISH</text></g>;})()}
      {/* Cars */}
      {cars.map((c,i)=>(
        <g key={c.num||i} filter="url(#cg)">
          <circle cx={c.x} cy={c.y} r={i<3?9:6} fill={c.color} stroke="#FFF" strokeWidth="2" opacity={i<10?1:0.5}/>
          <text x={c.x} y={c.y+3} fill="#FFF" fontSize={i<3?"7":"5"} fontFamily="'Barlow Condensed'" fontWeight="800" textAnchor="middle">{i<10?(i+1):""}</text>
          {i<5 && <text x={c.x+(i<3?12:9)} y={c.y+3} fill="#666" fontSize="8" fontFamily="'Barlow Condensed'" fontWeight="700">{c.code}</text>}
        </g>
      ))}
      {/* Legend */}
      <text x="14" y="18" fill="#BBB" fontSize="8" fontFamily="'Barlow Condensed'" fontWeight="600" letterSpacing="1">TRACK MAP</text>
      <text x="14" y="30" fill="#DDD" fontSize="7" fontFamily="'Barlow Condensed'">● DRS ZONES  ● SECTOR MARKERS</text>
    </svg>
  );
};

// ═══ COMPONENTS ═══
const Dot = ({color,size=6})=><span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:color,marginRight:5,boxShadow:`0 0 6px ${color}66`,animation:"pulse 1.5s ease infinite"}}/>;
const TireChip = ({compound,age})=>{const c=compound?.toUpperCase()||"UNKNOWN";return(<div style={{display:"inline-flex",alignItems:"center",gap:3}}><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${TIRE_C[c]||"#888"}`,background:"#F8F8F8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:TIRE_C[c],fontFamily:"var(--mono)"}}>{TIRE_L[c]}</div>{age!=null&&<span style={{fontSize:9,color:age>15?"#DC0000":"#999",fontFamily:"var(--mono)"}}>L{age}</span>}</div>);};
const Card = ({children,glow,style={}})=><div style={{background:"var(--surface)",borderRadius:14,border:`1px solid ${glow?"var(--primary)44":"#E4E4E8"}`,overflow:"hidden",...style}}>{children}</div>;
const CardH = ({children,right})=><div style={{padding:"12px 16px",borderBottom:"1px solid #ECECF0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{margin:0,fontSize:10,fontFamily:"var(--mono)",fontWeight:700,color:"var(--primary)",letterSpacing:2.5}}>{children}</h3>{right}</div>;
const Badge = ({children,color="var(--primary)",s})=><span style={{display:"inline-flex",alignItems:"center",gap:4,padding:s?"2px 8px":"3px 10px",borderRadius:20,background:`${color}10`,border:`1px solid ${color}30`,fontSize:s?8:9,fontWeight:700,fontFamily:"var(--mono)",color,letterSpacing:1,whiteSpace:"nowrap"}}>{children}</span>;
const Loader = ({label="Loading..."})=><div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:40,gap:10}}><div style={{width:24,height:24,border:"3px solid #E0E0E4",borderTopColor:"var(--primary)",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/><span style={{fontSize:10,color:"#999",fontFamily:"var(--mono)",letterSpacing:2}}>{label}</span></div>;
const FlagDot = ({flag})=>{const m={GREEN:"#00C853",YELLOW:"#FFD600",RED:"#FF1744",DOUBLE_YELLOW:"#FF9100",BLUE:"#42A5F5"};return <span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:m[flag?.toUpperCase()]||"#CCC"}}/>;};
const TH = ({children})=><th style={{padding:"8px 10px",textAlign:"left",fontFamily:"var(--cond)",fontWeight:700,color:"#AAA",fontSize:9,letterSpacing:1.5}}>{children}</th>;
const TT_S = {background:"#FFF",border:"1px solid #E4E4E8",borderRadius:8,fontSize:10,boxShadow:"0 4px 16px #00000010"};

// ════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════
export default function TheUndercut(){
  const [teamKey,setTeamKey]=useState(null);
  const [onboarding,setOnboarding]=useState(true);
  const [tab,setTab]=useState("command");
  // Weekend
  const [mode,setMode]=useState("gp");
  const [lap,setLap]=useState(0);
  const totalLaps = mode==="sprint"?24:57;
  const [live,setLive]=useState(false);
  const [positions,setPositions]=useState(()=>genPos(0));
  const [sectors]=useState(genSectors);
  const [flag,setFlag]=useState("GREEN");
  const [qualiSess,setQualiSess]=useState("Q3");
  const [fpSess,setFpSess]=useState("FP1");
  const [rcMsgs,setRcMsgs]=useState(RC_MSGS);
  const [rcFilter,setRcFilter]=useState("all");
  // Telemetry
  const [simTelem]=useState(genTelemetry);
  const [tireDeg]=useState(genTireDeg);
  const [longRun]=useState(genLongRun);
  const [compareTeam,setCompareTeam]=useState("ferrari");
  const [telemDriver1,setTelemDriver1]=useState(1); // NOR
  const [telemDriver2,setTelemDriver2]=useState(16); // LEC
  const [liveCarData,setLiveCarData]=useState(null);
  const [telemLoading,setTelemLoading]=useState(false);
  const [telemSource,setTelemSource]=useState("sim"); // "live" or "sim"
  const [apiDriversData,setApiDriversData]=useState(null); // for headshots
  // API
  const [schedule,setSchedule]=useState(null);
  const [driverStandings,setDriverStandings]=useState(null);
  const [constructorStandings,setConstructorStandings]=useState(null);
  const [latestSession,setLatestSession]=useState(null);
  const [weatherData,setWeatherData]=useState(null);
  const [apiRaceControl,setApiRaceControl]=useState(null);
  const [lastResult,setLastResult]=useState(null);
  const [standingsTab,setStandingsTab]=useState("drivers");

  const T = TEAMS[teamKey]||TEAMS.neutral;

  // Load APIs
  useEffect(()=>{if(onboarding)return;(async()=>{
    const [sch,ds,cs,lr]=await Promise.all([apiJ.schedule(2026),apiJ.driverStandings(2025),apiJ.constructorStandings(2025),apiJ.lastResult()]);
    if(sch?.MRData?.RaceTable?.Races) setSchedule(sch.MRData.RaceTable.Races);
    if(ds?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings) setDriverStandings(ds.MRData.StandingsTable.StandingsLists[0].DriverStandings);
    if(cs?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings) setConstructorStandings(cs.MRData.StandingsTable.StandingsLists[0].ConstructorStandings);
    if(lr?.MRData?.RaceTable?.Races?.[0]) setLastResult(lr.MRData.RaceTable.Races[0]);
    const [sess,wthr,rc]=await Promise.all([apiO.latestSession(),apiO.latestWeather(),apiO.latestRaceControl()]);
    if(Array.isArray(sess)&&sess.length) setLatestSession(sess[sess.length-1]);
    if(Array.isArray(wthr)&&wthr.length) setWeatherData(wthr[wthr.length-1]);
    if(Array.isArray(rc)) setApiRaceControl(rc);
    // Fetch driver info (headshots)
    const drv = await apiO.latestDrivers();
    if(Array.isArray(drv)) setApiDriversData(drv);
  })();},[onboarding]);

  // Fetch car telemetry when drivers change
  const processCarData = (raw, driverNum) => {
    if(!raw || !Array.isArray(raw) || raw.length < 10) return null;
    // Downsample to ~100 points for chart
    const step = Math.max(1, Math.floor(raw.length / 100));
    return raw.filter((_,i) => i % step === 0).slice(0, 100).map((d, i) => ({
      d: i, speed: d.speed || 0, throttle: d.throttle || 0, brake: d.brake || 0,
      gear: d.n_gear || 0, drs: d.drs >= 10 ? 1 : 0, rpm: d.rpm || 0,
      driver: driverNum, time: d.date,
    }));
  };

  const fetchTelemetry = async () => {
    setTelemLoading(true);
    const [raw1, raw2] = await apiO.carDataTwo(telemDriver1, telemDriver2);
    const d1 = processCarData(raw1, telemDriver1);
    const d2 = processCarData(raw2, telemDriver2);
    if (d1 && d1.length > 5) {
      // Merge both drivers into single chart data
      const merged = d1.map((p, i) => ({
        d: i, speed1: p.speed, throttle1: p.throttle, brake1: p.brake, gear1: p.gear, drs1: p.drs, rpm1: p.rpm,
        speed2: d2?.[i]?.speed || 0, throttle2: d2?.[i]?.throttle || 0, brake2: d2?.[i]?.brake || 0, gear2: d2?.[i]?.gear || 0, drs2: d2?.[i]?.drs || 0, rpm2: d2?.[i]?.rpm || 0,
      }));
      setLiveCarData(merged);
      setTelemSource("live");
    } else {
      setLiveCarData(null);
      setTelemSource("sim");
    }
    setTelemLoading(false);
  };

  useEffect(() => {
    if (onboarding || tab !== "telemetry") return;
    fetchTelemetry();
  }, [telemDriver1, telemDriver2, tab, onboarding]);

  // Auto-refresh
  useEffect(()=>{if(onboarding)return;const iv=setInterval(async()=>{
    const [wthr,rc]=await Promise.all([apiO.latestWeather(),apiO.latestRaceControl()]);
    if(Array.isArray(wthr)&&wthr.length) setWeatherData(wthr[wthr.length-1]);
    if(Array.isArray(rc)) setApiRaceControl(rc);
  },30000);return()=>clearInterval(iv);},[onboarding]);

  // Race sim
  useEffect(()=>{if(!live)return;const iv=setInterval(()=>{setLap(p=>{
    if(p>=totalLaps){setLive(false);return totalLaps;}const n=p+1;setPositions(genPos(n));
    if(Math.random()>0.9){const nf=["GREEN","YELLOW","YELLOW"][Math.floor(Math.random()*3)];setFlag(nf);setRcMsgs(prev=>[{time:new Date().toLocaleTimeString("en-GB"),flag:nf,msg:nf==="GREEN"?"GREEN FLAG":"YELLOW FLAG SECTOR "+Math.ceil(Math.random()*3),cat:"Flag"},...prev].slice(0,25));}
    if(Math.random()>0.85){const d=DRIVERS_22[Math.floor(Math.random()*11)];setRcMsgs(prev=>[{time:new Date().toLocaleTimeString("en-GB"),flag:"",msg:`PIT #${d.num} (${d.code}) — ${(2.0+Math.random()*1.2).toFixed(1)}s`,cat:"Pit"},...prev].slice(0,25));}
    return n;});},2200);return()=>clearInterval(iv);},[live,totalLaps]);

  const w = weatherData?{air:weatherData.air_temperature,track:weatherData.track_temperature,hum:weatherData.humidity,wind:weatherData.wind_speed,rain:weatherData.rainfall}:null;
  const nextRace = schedule?.find(r=>new Date(r.date)>new Date());
  const startSim = ()=>{setLive(true);setLap(0);setFlag("GREEN");setPositions(genPos(0));};

  // Driver info helper — merges OpenF1 headshots with local data
  const getDriverInfo = (num) => {
    const local = DRIVERS_22.find(d => d.num === num) || {};
    const api = apiDriversData?.find(d => d.driver_number === num);
    return {
      num, code: api?.name_acronym || local.code || "???",
      name: api?.full_name || local.name || `Driver #${num}`,
      team: local.team || mapTeamKey(api?.team_name || ""),
      headshot: api?.headshot_url || null,
      country: api?.country_code || null,
      teamColor: api?.team_colour ? `#${api.team_colour}` : TEAMS[local.team]?.primary || "#888",
    };
  };
  const d1Info = getDriverInfo(telemDriver1);
  const d2Info = getDriverInfo(telemDriver2);
  const telemData = telemSource === "live" && liveCarData ? liveCarData : simTelem.map((p,i)=>({...p,speed1:p.speed1,speed2:p.speed2,throttle1:p.throttle,brake1:p.brake,gear1:p.gear,drs1:p.drs,throttle2:Math.max(0,Math.min(100,65+Math.sin(i/100*Math.PI*6+0.5)*38)),brake2:Math.max(0,Math.min(100,28-Math.sin(i/100*Math.PI*6+0.5)*28)),gear2:Math.max(1,Math.min(8,Math.round(4+Math.sin(i/100*Math.PI*6+0.5)*3.5))),drs2:Math.sin(i/100*Math.PI*4+0.5)>0.7?1:0,rpm1:7000+Math.sin(i/100*Math.PI*6)*4000,rpm2:7100+Math.sin(i/100*Math.PI*6+0.3)*3900}));

  // ═══ ONBOARDING ═══
  if(onboarding) return (
    <div style={{minHeight:"100vh",background:"#FFF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700;800&family=Barlow:wght@300;400;500;600;700;800;900&display=swap');
        :root{--mono:'Bebas Neue',cursive;--sans:'Barlow',sans-serif;--cond:'Barlow Condensed',sans-serif}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}} @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#CCC4 transparent} *::-webkit-scrollbar{width:4px;height:4px} *::-webkit-scrollbar-thumb{background:#CCC;border-radius:2px} body{margin:0;background:#FFF}
      `}</style>
      <div style={{textAlign:"center",marginBottom:44,animation:"fadeUp 0.7s ease"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#E1060010",border:"1px solid #E1060025",borderRadius:100,padding:"5px 18px",marginBottom:20}}>
          <Dot color="#E10600"/><span style={{fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:600,color:"#E10600",letterSpacing:3}}>2026 SEASON · 11 TEAMS · 22 DRIVERS</span>
        </div>
        <h1 style={{fontSize:"clamp(56px,10vw,110px)",fontFamily:"'Bebas Neue'",fontWeight:400,margin:0,lineHeight:0.9,letterSpacing:4,background:"linear-gradient(135deg,#E10600 0%,#CC8800 40%,#E10600 80%)",backgroundSize:"200% auto",animation:"shimmer 3s linear infinite",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>THE UNDERCUT</h1>
        <p style={{color:"#999",fontSize:13,fontFamily:"'Barlow Condensed'",letterSpacing:5,fontWeight:500,marginTop:6}}>REAL-TIME F1 INTELLIGENCE</p>
        <div style={{width:60,height:2,background:"linear-gradient(90deg,transparent,#E10600,transparent)",margin:"20px auto"}}/>
        <p style={{color:"#AAA",fontSize:14,fontFamily:"var(--sans)",maxWidth:400,margin:"0 auto",lineHeight:1.5}}>Powered by <strong style={{color:"#777"}}>OpenF1</strong> + <strong style={{color:"#777"}}>Jolpica-F1</strong> APIs. Pick your constructor.</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,maxWidth:780,width:"100%"}}>
        {Object.entries(TEAMS).map(([k,t],i)=>(
          <button key={k} onClick={()=>{setTeamKey(k);setTimeout(()=>setOnboarding(false),200);}} style={{background:"#FAFAFA",border:"1px solid #E0E0E0",borderRadius:12,padding:"14px 8px",cursor:"pointer",transition:"all 0.25s",animation:`fadeUp ${0.25+i*0.04}s ease backwards`,textAlign:"center",position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=t.primary;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${t.primary}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#E0E0E0";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${t.primary},${t.secondary})`}}/>
            <div style={{fontSize:22,fontFamily:"'Bebas Neue'",color:t.primary,letterSpacing:2}}>{t.short}</div>
            <div style={{fontSize:9,color:"#888",fontFamily:"'Barlow Condensed'",fontWeight:600}}>{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const TABS = [{id:"command",label:"COMMAND",ic:"⚡"},{id:"weekend",label:"RACE WEEKEND",ic:"🏎️"},{id:"telemetry",label:"TELEMETRY",ic:"📊"},{id:"standings",label:"STANDINGS",ic:"🏆"},{id:"calendar",label:"CALENDAR",ic:"📅"}];

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:"#1A1A2E",fontFamily:"var(--sans)","--primary":T.primary,"--secondary":T.secondary,"--surface":T.surface,"--bg":T.bg,"--mono":"'Bebas Neue',cursive","--cond":"'Barlow Condensed',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700;800&family=Barlow:wght@300;400;500;600;700;800;900&display=swap');
        :root{--mono:'Bebas Neue',cursive;--sans:'Barlow',sans-serif;--cond:'Barlow Condensed',sans-serif}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}} @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}} @keyframes glow{0%,100%{box-shadow:0 0 4px var(--primary)33}50%{box-shadow:0 0 14px var(--primary)44}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${T.primary}22 transparent} *::-webkit-scrollbar{width:4px} *::-webkit-scrollbar-thumb{background:${T.primary}33;border-radius:2px} body{margin:0;background:#FFF}
      `}</style>

      {/* HEADER */}
      <header style={{background:"#FFF",borderBottom:"1px solid #E8E8EC",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px #00000008"}}>
        <div style={{padding:"0 16px",maxWidth:1440,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <h1 style={{fontSize:24,fontFamily:"var(--mono)",margin:0,letterSpacing:3,color:"#1A1A2E"}}>THE <span style={{color:T.primary}}>UNDERCUT</span></h1>
              {latestSession&&<Badge color={T.primary} s>{latestSession.session_name} · {latestSession.location||""}</Badge>}
              {live&&<Badge color="#DC0000"><Dot color="#DC0000" size={5}/> LAP {lap}/{totalLaps}</Badge>}
            </div>
            <div onClick={()=>setOnboarding(true)} style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${T.primary},${T.secondary})`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"var(--mono)",color:"#FFF"}}>{T.short[0]}</div>
          </div>
          <nav style={{display:"flex",gap:1,overflow:"auto"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?`${T.primary}08`:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${T.primary}`:"2px solid transparent",color:tab===t.id?T.primary:"#999",padding:"8px 14px",cursor:"pointer",fontSize:10,fontFamily:"var(--cond)",fontWeight:700,letterSpacing:1.5,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,transition:"all 0.15s"}}>{t.ic} {t.label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{padding:"14px 16px",maxWidth:1440,margin:"0 auto"}}>

        {/* ════ COMMAND CENTER ════ */}
        {tab==="command"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <Card glow style={{padding:24,marginBottom:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 85% 40%,${T.primary}08 0%,transparent 55%)`}}/>
              <div style={{position:"relative"}}>
                {nextRace?(<>
                  <Badge color={T.primary} s>ROUND {nextRace.round}</Badge>
                  <h2 style={{fontSize:"clamp(22px,4vw,36px)",fontFamily:"var(--mono)",margin:"6px 0 0",letterSpacing:3,color:"#1A1A2E"}}>{nextRace.raceName}</h2>
                  <p style={{color:"#888",fontSize:13,fontFamily:"var(--cond)",margin:"2px 0 0"}}>{nextRace.Circuit?.circuitName} · {nextRace.Circuit?.Location?.locality}, {nextRace.Circuit?.Location?.country} · {nextRace.date}</p>
                </>):<Loader label="FETCHING SCHEDULE"/>}
                {w&&<div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
                  {[{l:"AIR",v:`${w.air?.toFixed(1)}°C`,ic:"🌡️"},{l:"TRACK",v:`${w.track?.toFixed(1)}°C`,ic:"🛣️"},{l:"HUMIDITY",v:`${w.hum}%`,ic:"💧"},{l:"WIND",v:`${w.wind?.toFixed(1)} m/s`,ic:"💨"},{l:"RAIN",v:w.rain?"YES 🌧️":"NO ☀️"}].filter(x=>x.v&&!x.v.includes("undefined")).map(x=>(<div key={x.l} style={{background:"#F8F8FA",border:"1px solid #ECECF0",borderRadius:9,padding:"8px 14px",minWidth:80,textAlign:"center"}}><div style={{fontSize:8,color:"#999",fontFamily:"var(--cond)",fontWeight:600,letterSpacing:1}}>{x.ic} {x.l}</div><div style={{fontSize:15,fontFamily:"var(--mono)",color:T.primary,marginTop:2,letterSpacing:1}}>{x.v}</div></div>))}
                </div>}
                <button onClick={()=>setTab("weekend")} style={{marginTop:16,background:T.primary,border:"none",borderRadius:10,padding:"10px 22px",color:"#FFF",fontFamily:"var(--mono)",fontSize:12,cursor:"pointer",letterSpacing:2}}>ENTER RACE WEEKEND →</button>
              </div>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
              <Card glow><CardH>🗺️ TRACK MAP — CAR POSITIONS</CardH><div style={{padding:6}}><TrackMap positions={positions} teamKey={teamKey} lap={lap}/></div></Card>
              <Card><CardH>🚦 RACE CONTROL</CardH><div style={{maxHeight:280,overflow:"auto",padding:"4px 0"}}>
                {(apiRaceControl||rcMsgs).slice(-15).reverse().map((m,i)=>(<div key={i} style={{display:"flex",gap:8,padding:"6px 16px",borderBottom:"1px solid #F0F0F4",fontSize:11}}><span style={{fontFamily:"var(--cond)",fontSize:10,color:"#999",minWidth:55,fontWeight:600}}>{m.time||(m.date?new Date(m.date).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—")}</span>{m.flag&&<FlagDot flag={m.flag}/>}<span style={{color:"#444",fontWeight:500,lineHeight:1.3}}>{m.msg||m.message}</span></div>))}
              </div></Card>
              <Card><CardH right={<span style={{fontSize:9,color:"#999",cursor:"pointer"}} onClick={()=>setTab("standings")}>VIEW ALL →</span>}>🏆 STANDINGS</CardH>
                {driverStandings?<div style={{padding:"2px 0"}}>{driverStandings.slice(0,6).map((ds,i)=>(<div key={i} style={{display:"flex",alignItems:"center",padding:"7px 16px",borderBottom:"1px solid #F0F0F4"}}><span style={{width:20,fontSize:16,fontFamily:"var(--mono)",color:i<3?T.primary:"#CCC"}}>{i+1}</span><div style={{width:3,height:14,background:TEAMS[mapTeamKey(ds.Constructors?.[0]?.constructorId)]?.primary||"#888",borderRadius:2,margin:"0 8px"}}/><span style={{flex:1,fontSize:12,fontWeight:600}}>{ds.Driver?.givenName} {ds.Driver?.familyName}</span><span style={{fontSize:16,fontFamily:"var(--mono)",color:T.primary}}>{ds.points}</span></div>))}</div>:<Loader label="FETCHING"/>}
              </Card>
            </div>
          </div>
        )}

        {/* ════ RACE WEEKEND ════ */}
        {tab==="weekend"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            {/* Mode selector */}
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
              {[{id:"practice",ic:"🔧",lb:"PRACTICE",sub:"Long runs & setup"},{id:"quali",ic:"⏱️",lb:"QUALIFYING",sub:"Grid shootout"},{id:"sprint",ic:"💨",lb:"SPRINT",sub:"24 laps"},{id:"gp",ic:"🏁",lb:"GRAND PRIX",sub:"57 laps"},{id:"podium",ic:"🏆",lb:"PODIUM",sub:"Results"}].map(m=>(
                <button key={m.id} onClick={()=>{setMode(m.id);if(m.id!=="gp"&&m.id!=="sprint")setLive(false);}} style={{flex:"1 1 90px",background:mode===m.id?`${T.primary}08`:"#FAFAFA",border:`2px solid ${mode===m.id?T.primary:"#E4E4E8"}`,borderRadius:12,padding:"12px 10px",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                  <div style={{fontSize:18}}>{m.ic}</div>
                  <div style={{fontSize:10,fontFamily:"var(--mono)",color:mode===m.id?T.primary:"#999",letterSpacing:1,marginTop:2}}>{m.lb}</div>
                  <div style={{fontSize:9,color:"#BBB"}}>{m.sub}</div>
                </button>
              ))}
            </div>

            {/* GRAND PRIX / SPRINT */}
            {(mode==="gp"||mode==="sprint")&&(<>
              {/* Control bar */}
              <Card glow style={{padding:14,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <button onClick={live?()=>setLive(false):startSim} style={{background:live?"#DC0000":T.primary,border:"none",borderRadius:8,padding:"9px 22px",color:"#FFF",fontFamily:"var(--mono)",fontSize:12,cursor:"pointer",letterSpacing:2}}>{live?"⏸ PAUSE":"▶ SIMULATE"}</button>
                    <FlagDot flag={flag}/><span style={{fontSize:10,fontFamily:"var(--mono)",color:flag==="GREEN"?"#00C853":"#FFD600"}}>{flag}</span>
                    <Badge s color={T.primary}>{mode==="sprint"?"SPRINT · 24 LAPS":"GRAND PRIX · 57 LAPS"}</Badge>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    <div><div style={{fontSize:9,color:"#999",fontFamily:"var(--cond)",fontWeight:600}}>LAP</div><div style={{fontSize:24,fontFamily:"var(--mono)",color:T.primary}}>{lap}<span style={{fontSize:14,color:"#CCC"}}>/{totalLaps}</span></div></div>
                    <div style={{width:160,height:5,background:"#ECECF0",borderRadius:3}}><div style={{width:`${(lap/totalLaps)*100}%`,height:"100%",background:`linear-gradient(90deg,${T.primary},${T.secondary})`,borderRadius:3,transition:"width 0.4s"}}/></div>
                  </div>
                </div>
              </Card>
              {/* Track + Timing */}
              <div style={{display:"grid",gridTemplateColumns:"minmax(260px,340px) 1fr",gap:12,marginBottom:14}}>
                <Card glow><CardH>🗺️ TRACK MAP</CardH><div style={{padding:4}}><TrackMap positions={positions} teamKey={teamKey} lap={lap}/></div></Card>
                <Card glow>
                  <CardH right={live?<Badge color="#DC0000"><Dot color="#DC0000" size={5}/> LIVE</Badge>:null}>📋 LIVE TIMING — {mode==="sprint"?"SPRINT":"GRAND PRIX"}</CardH>
                  <div style={{overflowX:"auto",maxHeight:440,overflow:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{background:"#F8F8FA"}}>{["P","","DRIVER","GAP","INT","LAST","TIRE","PIT","DRS",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                      <tbody>{positions.map((d,i)=>(
                        <tr key={d.num} style={{borderBottom:"1px solid #F0F0F4",background:d.team===teamKey?`${T.primary}06`:"transparent",transition:"all 0.3s"}}>
                          <td style={{padding:"6px 10px",fontFamily:"var(--mono)",fontSize:16,color:i<3?T.primary:"#CCC"}}>{d.pos}</td>
                          <td><div style={{width:3,height:14,background:TEAMS[d.team]?.primary,borderRadius:2}}/></td>
                          <td style={{padding:"6px 10px",fontWeight:700}}><span style={{fontFamily:"var(--cond)",fontWeight:800,color:TEAMS[d.team]?.primary,marginRight:4,fontSize:11}}>{d.code}</span><span style={{color:"#444"}}>{d.name}</span></td>
                          <td style={{padding:"6px 10px",fontFamily:"var(--cond)",fontSize:11,fontWeight:700,color:d.gap==="LEADER"?"#00C853":"#444"}}>{d.gap}</td>
                          <td style={{padding:"6px 10px",fontFamily:"var(--cond)",fontSize:11,color:"#888"}}>{d.interval}</td>
                          <td style={{padding:"6px 10px",fontFamily:"var(--cond)",fontSize:11,color:"#555"}}>{d.lastLap}</td>
                          <td style={{padding:"6px 10px"}}><TireChip compound={d.tire} age={d.tireAge}/></td>
                          <td style={{padding:"6px 10px",fontFamily:"var(--mono)",fontSize:14,color:"#CCC"}}>{d.pits}</td>
                          <td style={{padding:"6px 10px"}}>{d.drs&&<span style={{color:"#00C853",fontSize:9,fontFamily:"var(--mono)"}}>DRS</span>}</td>
                          <td style={{padding:"6px 10px"}}><span style={{fontSize:8,fontFamily:"var(--mono)",color:d.status==="RUN"?"#00C853":d.status==="PIT"?"#FFC107":"#DC0000",...(d.status==="PIT"?{animation:"blink 0.7s infinite"}:{})}}>{d.status}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Card>
              </div>
              {/* Race Control Feed */}
              <Card><CardH right={<div style={{display:"flex",gap:3}}>{["all","Flag","Pit","Steward"].map(f=><button key={f} onClick={()=>setRcFilter(f)} style={{background:rcFilter===f?`${T.primary}10`:"transparent",border:`1px solid ${rcFilter===f?T.primary+"30":"#E4E4E8"}`,borderRadius:4,padding:"2px 8px",fontSize:8,color:rcFilter===f?T.primary:"#999",cursor:"pointer",fontFamily:"var(--cond)",fontWeight:700,letterSpacing:1}}>{f.toUpperCase()}</button>)}</div>}>🚦 RACE CONTROL FEED</CardH>
                <div style={{maxHeight:200,overflow:"auto",padding:"4px 0"}}>{rcMsgs.filter(m=>rcFilter==="all"||m.cat===rcFilter).map((m,i)=>(<div key={i} style={{display:"flex",gap:8,padding:"6px 16px",borderBottom:"1px solid #F0F0F4",fontSize:11}}><span style={{fontFamily:"var(--cond)",fontSize:10,color:"#999",minWidth:55,fontWeight:600}}>{m.time}</span>{m.flag&&<FlagDot flag={m.flag}/>}<span style={{color:"#444",fontWeight:500}}>{m.msg}</span></div>))}</div>
              </Card>
            </>)}

            {/* PRACTICE */}
            {mode==="practice"&&(<>
              <div style={{display:"flex",gap:4,marginBottom:12}}>{["FP1","FP2","FP3"].map(s=><button key={s} onClick={()=>setFpSess(s)} style={{background:fpSess===s?`${T.primary}10`:"#FAFAFA",border:`1px solid ${fpSess===s?T.primary+"40":"#E4E4E8"}`,borderRadius:6,padding:"4px 16px",fontSize:10,color:fpSess===s?T.primary:"#999",cursor:"pointer",fontFamily:"var(--mono)"}}>{s}</button>)}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))",gap:12,marginBottom:14}}>
                <Card><CardH>📋 {fpSess} — SESSION TIMES</CardH>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{background:"#F8F8FA"}}>{["P","","DRIVER","BEST","LAPS","GAP","TIRE"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                    <tbody>{positions.map((d,i)=>(
                      <tr key={d.num} style={{borderBottom:"1px solid #F0F0F4",background:d.team===teamKey?`${T.primary}06`:"transparent"}}>
                        <td style={{padding:"6px 10px",fontFamily:"var(--mono)",fontSize:16,color:i<3?T.primary:"#CCC"}}>{i+1}</td>
                        <td><div style={{width:3,height:14,background:TEAMS[d.team]?.primary,borderRadius:2}}/></td>
                        <td style={{padding:"6px 10px",fontWeight:700}}><span style={{color:TEAMS[d.team]?.primary,fontFamily:"var(--cond)",fontWeight:800,fontSize:11,marginRight:4}}>{d.code}</span>{d.name}</td>
                        <td style={{padding:"6px 10px",fontFamily:"var(--cond)",fontWeight:700,color:"#333"}}>{d.bestLap}</td>
                        <td style={{padding:"6px 10px",fontFamily:"var(--mono)",fontSize:14,color:"#CCC"}}>{Math.floor(8+Math.random()*18)}</td>
                        <td style={{padding:"6px 10px",fontFamily:"var(--cond)",color:"#888"}}>{d.gap}</td>
                        <td style={{padding:"6px 10px"}}><TireChip compound={d.tire}/></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </Card>
                <Card><CardH>📈 LONG RUN PACE</CardH><div style={{padding:16}}>
                  <ResponsiveContainer width="100%" height={220}><LineChart data={longRun}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="lap" stroke="#DDD" tick={{fontSize:9,fill:"#999"}}/><YAxis domain={["dataMin-0.5","dataMax+0.5"]} stroke="#DDD" tick={{fontSize:9,fill:"#999"}}/><Tooltip contentStyle={TT_S}/>
                    <Line type="monotone" dataKey="VER" stroke={TEAMS.red_bull.primary} strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="NOR" stroke={TEAMS.mclaren.primary} strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="LEC" stroke={TEAMS.ferrari.primary} strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="PIA" stroke={TEAMS.mclaren.secondary} strokeWidth={2} dot={false}/>
                  </LineChart></ResponsiveContainer>
                  <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:6}}>{[{c:"VER",t:"red_bull"},{c:"NOR",t:"mclaren"},{c:"LEC",t:"ferrari"},{c:"PIA",t:"mclaren"}].map(x=>(<div key={x.c} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:3,background:TEAMS[x.t].primary,borderRadius:2}}/><span style={{fontSize:9,color:"#999",fontFamily:"var(--cond)"}}>{x.c}</span></div>))}</div>
                </div></Card>
              </div>
              <Card><CardH>🏗️ TRACK EVOLUTION</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={180}><AreaChart data={Array.from({length:30},(_,i)=>({min:i*3,grip:78+i*0.6+Math.random()*1,rubber:Math.min(100,10+i*3+Math.random()*5)}))}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="min" stroke="#DDD" tick={{fontSize:9,fill:"#999"}}/><YAxis stroke="#DDD" tick={{fontSize:9,fill:"#999"}}/><Tooltip contentStyle={TT_S}/>
                  <Area type="monotone" dataKey="grip" stroke={T.primary} fill={T.primary} fillOpacity={0.08} strokeWidth={2} name="Grip %"/>
                  <Area type="monotone" dataKey="rubber" stroke={T.secondary} fill={T.secondary} fillOpacity={0.06} strokeWidth={2} name="Rubber %"/>
                </AreaChart></ResponsiveContainer>
              </div></Card>
            </>)}

            {/* QUALIFYING */}
            {mode==="quali"&&(
              <Card glow>
                <CardH right={<div style={{display:"flex",gap:4}}>{["Q1","Q2","Q3"].map(q=><button key={q} onClick={()=>setQualiSess(q)} style={{padding:"4px 16px",borderRadius:20,background:qualiSess===q?`${T.primary}10`:"transparent",border:`1px solid ${qualiSess===q?T.primary:"#E4E4E8"}`,fontSize:10,fontFamily:"var(--mono)",color:qualiSess===q?T.primary:"#999",cursor:"pointer"}}>{q}</button>)}</div>}>⏱️ QUALIFYING — {qualiSess} {qualiSess==="Q1"?"(20 → 15)":qualiSess==="Q2"?"(15 → 10)":"(TOP 10)"}</CardH>
                <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#F8F8FA"}}>{["P","","DRIVER","S1","S2","S3","I1 km/h","I2 km/h","ST km/h","LAP","GAP"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                  <tbody>{sectors.slice(0,qualiSess==="Q1"?20:qualiSess==="Q2"?15:10).map((d,i)=>{const best=sectors[0].total;return(
                    <tr key={d.code} style={{borderBottom:"1px solid #F0F0F4",background:d.team===teamKey?`${T.primary}06`:"transparent"}}>
                      <td style={{padding:"8px 10px",fontFamily:"var(--mono)",fontSize:16,color:i===0?"#A855F7":i<3?T.primary:"#CCC"}}>{i+1}</td>
                      <td><div style={{width:3,height:16,background:TEAMS[d.team]?.primary,borderRadius:2}}/></td>
                      <td style={{padding:"8px 10px",fontWeight:700}}><span style={{color:TEAMS[d.team]?.primary,fontFamily:"var(--cond)",fontWeight:800,fontSize:11,marginRight:5}}>{d.code}</span>{d.name}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:11,fontWeight:600,color:SEC_C[d.s1c]}}>{d.s1}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:11,fontWeight:600,color:SEC_C[d.s2c]}}>{d.s2}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:11,fontWeight:600,color:SEC_C[d.s3c]}}>{d.s3}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:10,color:"#888"}}>{d.i1}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:10,color:"#888"}}>{d.i2}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:10,color:"#888"}}>{d.st}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:12,fontWeight:800,color:i===0?"#A855F7":"#333"}}>1:{d.total}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--cond)",fontSize:11,color:"#999"}}>{i===0?"—":`+${(parseFloat(d.total)-parseFloat(best)).toFixed(3)}`}</td>
                    </tr>);})}</tbody>
                </table></div>
                <div style={{display:"flex",gap:16,padding:"10px 16px",justifyContent:"center",borderTop:"1px solid #ECECF0"}}>{[{l:"PURPLE",c:"#A855F7",d:"Best overall"},{l:"GREEN",c:"#22C55E",d:"Personal best"},{l:"YELLOW",c:"#EAB308",d:"No improve"}].map(x=>(<div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:x.c}}/><span style={{fontSize:9,color:"#999",fontFamily:"var(--cond)"}}>{x.l}</span></div>))}</div>
              </Card>
            )}

            {/* PODIUM */}
            {mode==="podium"&&(
              <div style={{textAlign:"center",padding:"24px 20px"}}>
                <h2 style={{fontFamily:"var(--mono)",fontSize:"clamp(22px,5vw,36px)",margin:"0 0 24px",background:"linear-gradient(135deg,#FFD700,#FFA500)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>🏆 RACE RESULT</h2>
                <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:14,marginBottom:24}}>
                  {[{p:2,d:"L. Norris",t:"mclaren",h:100,col:"#C0C0C0"},{p:1,d:"M. Verstappen",t:"red_bull",h:140,col:"#FFD700"},{p:3,d:"C. Leclerc",t:"ferrari",h:80,col:"#CD7F32"}].map(p=>(
                    <div key={p.p}><div style={{fontSize:p.p===1?36:26,marginBottom:6}}>{p.p===1?"👑":p.p===2?"🥈":"🥉"}</div>
                      <div style={{background:`linear-gradient(180deg,${p.col},${p.col}88)`,width:p.p===1?120:100,height:p.h,borderRadius:"12px 12px 0 0",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontFamily:"var(--mono)",fontSize:p.p===1?36:26,color:"#FFF"}}>{p.p}</span></div>
                      <div style={{background:"#FAFAFA",padding:10,borderRadius:"0 0 12px 12px",border:"1px solid #E4E4E8"}}><div style={{fontWeight:800,fontSize:13}}>{p.d}</div><div style={{fontSize:10,color:TEAMS[p.t].primary,fontWeight:600}}>{TEAMS[p.t].name}</div></div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,maxWidth:560,margin:"0 auto"}}>{[{l:"Fastest Lap",v:"1:18.432"},{l:"Overtakes",v:"47"},{l:"Safety Cars",v:"1 SC / 2 VSC"},{l:"DNFs",v:"2"},{l:"Avg Speed",v:"215.3 km/h"},{l:"Duration",v:"1:32:14"}].map(s=>(<div key={s.l} style={{background:"#F8F8FA",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:8,color:"#999",fontFamily:"var(--cond)",fontWeight:600,letterSpacing:1}}>{s.l}</div><div style={{fontSize:14,fontFamily:"var(--mono)",color:T.primary,marginTop:3}}>{s.v}</div></div>))}</div>
              </div>
            )}
          </div>
        )}

        {/* ════ TELEMETRY ════ */}
        {tab==="telemetry"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            {/* Driver Picker Bar */}
            <Card glow style={{padding:16,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:14,flex:1}}>
                  {/* Driver 1 */}
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:200}}>
                    {d1Info.headshot&&<img src={d1Info.headshot} alt={d1Info.code} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",border:`2px solid ${d1Info.teamColor}`,background:"#F5F5F5"}} onError={e=>{e.target.style.display="none"}}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:8,color:"#999",fontFamily:"var(--cond)",fontWeight:600,letterSpacing:1}}>DRIVER 1</div>
                      <select value={telemDriver1} onChange={e=>{setTelemDriver1(Number(e.target.value))}} style={{width:"100%",background:"#F5F5F7",border:`2px solid ${d1Info.teamColor}33`,borderRadius:8,padding:"6px 10px",color:"#333",fontSize:12,fontFamily:"var(--cond)",fontWeight:700,cursor:"pointer"}}>
                        {DRIVERS_22.map(d=><option key={d.num} value={d.num}>#{d.num} {d.code} — {d.name}</option>)}
                      </select>
                    </div>
                    {d1Info.country&&<img src={`https://flagcdn.com/24x18/${d1Info.country.toLowerCase()}.png`} alt="" style={{borderRadius:2}} onError={e=>{e.target.style.display="none"}}/>}
                  </div>
                  <div style={{fontSize:14,color:"#DDD",fontFamily:"var(--mono)"}}>VS</div>
                  {/* Driver 2 */}
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:200}}>
                    {d2Info.headshot&&<img src={d2Info.headshot} alt={d2Info.code} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",border:`2px solid ${d2Info.teamColor}`,background:"#F5F5F5"}} onError={e=>{e.target.style.display="none"}}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:8,color:"#999",fontFamily:"var(--cond)",fontWeight:600,letterSpacing:1}}>DRIVER 2</div>
                      <select value={telemDriver2} onChange={e=>{setTelemDriver2(Number(e.target.value))}} style={{width:"100%",background:"#F5F5F7",border:`2px solid ${d2Info.teamColor}33`,borderRadius:8,padding:"6px 10px",color:"#333",fontSize:12,fontFamily:"var(--cond)",fontWeight:700,cursor:"pointer"}}>
                        {DRIVERS_22.map(d=><option key={d.num} value={d.num}>#{d.num} {d.code} — {d.name}</option>)}
                      </select>
                    </div>
                    {d2Info.country&&<img src={`https://flagcdn.com/24x18/${d2Info.country.toLowerCase()}.png`} alt="" style={{borderRadius:2}} onError={e=>{e.target.style.display="none"}}/>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={fetchTelemetry} disabled={telemLoading} style={{background:T.primary,border:"none",borderRadius:8,padding:"8px 18px",color:"#FFF",fontFamily:"var(--mono)",fontSize:11,cursor:"pointer",letterSpacing:2,opacity:telemLoading?0.5:1}}>
                    {telemLoading?"⏳ LOADING...":"🔄 REFRESH"}
                  </button>
                  <Badge s color={telemSource==="live"?"#00C853":"#FF9800"}>{telemSource==="live"?"● LIVE DATA":"◐ SIMULATED"}</Badge>
                </div>
              </div>
            </Card>

            {telemLoading ? <Loader label="FETCHING CAR TELEMETRY FROM OPENF1..." /> : <>
            {/* Charts Legend */}
            <div style={{display:"flex",gap:12,marginBottom:10,justifyContent:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:16,height:3,background:d1Info.teamColor,borderRadius:2}}/><span style={{fontSize:10,color:"#777",fontFamily:"var(--cond)",fontWeight:600}}>{d1Info.code} ({d1Info.name})</span></div>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:16,height:3,background:d2Info.teamColor,borderRadius:2,opacity:0.7}}/><span style={{fontSize:10,color:"#777",fontFamily:"var(--cond)",fontWeight:600}}>{d2Info.code} ({d2Info.name})</span></div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(440px,1fr))",gap:12,marginBottom:12}}>
              {/* Speed Trace */}
              <Card><CardH right={<Badge s color={T.primary}>OPENF1 /car_data</Badge>}>🏎️ SPEED TRACE (km/h)</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={200}><AreaChart data={telemData}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="d" stroke="#DDD" tick={{fontSize:8,fill:"#999"}} label={{value:"Sample",position:"insideBottomRight",offset:-5,fontSize:9,fill:"#BBB"}}/><YAxis stroke="#DDD" tick={{fontSize:8,fill:"#999"}}/><Tooltip contentStyle={TT_S}/>
                  <Area type="monotone" dataKey="speed1" stroke={d1Info.teamColor} fill={d1Info.teamColor} fillOpacity={0.06} strokeWidth={2} name={d1Info.code}/>
                  <Area type="monotone" dataKey="speed2" stroke={d2Info.teamColor} fill={d2Info.teamColor} fillOpacity={0.04} strokeWidth={1.5} name={d2Info.code}/>
                </AreaChart></ResponsiveContainer>
              </div></Card>
              {/* Throttle & Brake */}
              <Card><CardH>🦶 THROTTLE & BRAKE — {d1Info.code}</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={200}><AreaChart data={telemData}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="d" stroke="#DDD" tick={{fontSize:8,fill:"#999"}}/><YAxis stroke="#DDD" tick={{fontSize:8,fill:"#999"}} domain={[0,100]}/><Tooltip contentStyle={TT_S}/>
                  <Area type="monotone" dataKey="throttle1" stroke="#00C853" fill="#00C853" fillOpacity={0.08} strokeWidth={2} name={`Throttle (${d1Info.code})`}/>
                  <Area type="monotone" dataKey="brake1" stroke="#DC0000" fill="#DC0000" fillOpacity={0.08} strokeWidth={2} name={`Brake (${d1Info.code})`}/>
                </AreaChart></ResponsiveContainer>
              </div></Card>
              {/* Gear & DRS */}
              <Card><CardH>⚙️ GEAR & DRS — {d1Info.code} vs {d2Info.code}</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={200}><AreaChart data={telemData}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="d" stroke="#DDD" tick={{fontSize:8,fill:"#999"}}/><YAxis domain={[0,9]} stroke="#DDD" tick={{fontSize:8,fill:"#999"}} ticks={[1,2,3,4,5,6,7,8]}/><Tooltip contentStyle={TT_S}/>
                  <Area type="stepAfter" dataKey="gear1" stroke={d1Info.teamColor} fill={d1Info.teamColor} fillOpacity={0.1} strokeWidth={2} name={`Gear (${d1Info.code})`}/>
                  <Area type="stepAfter" dataKey="gear2" stroke={d2Info.teamColor} fill={d2Info.teamColor} fillOpacity={0.06} strokeWidth={1.5} name={`Gear (${d2Info.code})`}/>
                </AreaChart></ResponsiveContainer>
              </div></Card>
              {/* RPM */}
              <Card><CardH>🔧 ENGINE RPM — {d1Info.code} vs {d2Info.code}</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={200}><AreaChart data={telemData}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="d" stroke="#DDD" tick={{fontSize:8,fill:"#999"}}/><YAxis stroke="#DDD" tick={{fontSize:8,fill:"#999"}}/><Tooltip contentStyle={TT_S}/>
                  <Area type="monotone" dataKey="rpm1" stroke={d1Info.teamColor} fill={d1Info.teamColor} fillOpacity={0.06} strokeWidth={2} name={`RPM (${d1Info.code})`}/>
                  <Area type="monotone" dataKey="rpm2" stroke={d2Info.teamColor} fill={d2Info.teamColor} fillOpacity={0.04} strokeWidth={1.5} name={`RPM (${d2Info.code})`}/>
                </AreaChart></ResponsiveContainer>
              </div></Card>
              {/* Tire Deg */}
              <Card><CardH>🛞 TIRE DEGRADATION MODEL</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={200}><LineChart data={tireDeg}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="lap" stroke="#DDD" tick={{fontSize:8,fill:"#999"}} label={{value:"Laps",position:"insideBottomRight",offset:-5,fontSize:9,fill:"#BBB"}}/><YAxis domain={[35,100]} stroke="#DDD" tick={{fontSize:8,fill:"#999"}} label={{value:"Grip %",angle:-90,position:"insideLeft",fontSize:9,fill:"#BBB"}}/><Tooltip contentStyle={TT_S}/>
                  <Line type="monotone" dataKey="soft" stroke={TIRE_C.SOFT} strokeWidth={2} dot={false} name="Soft"/>
                  <Line type="monotone" dataKey="medium" stroke={TIRE_C.MEDIUM} strokeWidth={2} dot={false} name="Medium"/>
                  <Line type="monotone" dataKey="hard" stroke="#999" strokeWidth={2} dot={false} name="Hard"/>
                </LineChart></ResponsiveContainer>
                <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:6}}>{[["SOFT",TIRE_C.SOFT,"~18 laps"],["MEDIUM",TIRE_C.MEDIUM,"~30 laps"],["HARD","#999","~45 laps"]].map(([n,c,l])=>(<div key={n} style={{display:"flex",alignItems:"center",gap:4}}><TireChip compound={n}/><span style={{fontSize:9,color:"#999"}}>{l}</span></div>))}</div>
              </div></Card>
              {/* Throttle comparison D2 */}
              <Card><CardH>🦶 THROTTLE & BRAKE — {d2Info.code}</CardH><div style={{padding:16}}>
                <ResponsiveContainer width="100%" height={200}><AreaChart data={telemData}><CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC"/><XAxis dataKey="d" stroke="#DDD" tick={{fontSize:8,fill:"#999"}}/><YAxis stroke="#DDD" tick={{fontSize:8,fill:"#999"}} domain={[0,100]}/><Tooltip contentStyle={TT_S}/>
                  <Area type="monotone" dataKey="throttle2" stroke="#00C853" fill="#00C853" fillOpacity={0.08} strokeWidth={2} name={`Throttle (${d2Info.code})`}/>
                  <Area type="monotone" dataKey="brake2" stroke="#DC0000" fill="#DC0000" fillOpacity={0.08} strokeWidth={2} name={`Brake (${d2Info.code})`}/>
                </AreaChart></ResponsiveContainer>
              </div></Card>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
              <Card><CardH right={<select value={compareTeam} onChange={e=>setCompareTeam(e.target.value)} style={{background:"#F5F5F7",border:"1px solid #E4E4E8",borderRadius:6,padding:"4px 8px",color:"#333",fontSize:10,fontFamily:"var(--cond)"}}>{Object.entries(TEAMS).filter(([k])=>k!=="neutral"&&k!==teamKey).map(([k,t])=><option key={k} value={k}>{t.name}</option>)}</select>}>📊 TEAM RADAR COMPARISON</CardH>
                <div style={{padding:16}}><ResponsiveContainer width="100%" height={260}><RadarChart data={["Top Speed","Cornering","Tire Mgmt","Pit Stops","Qualifying","Race Pace","Wet","Reliability"].map(a=>({attr:a,t1:60+Math.random()*35,t2:60+Math.random()*35}))}><PolarGrid stroke="#E8E8EC"/><PolarAngleAxis dataKey="attr" tick={{fill:"#999",fontSize:9}}/><PolarRadiusAxis angle={30} domain={[0,100]} tick={{fill:"#CCC",fontSize:8}}/>
                  <Radar dataKey="t1" stroke={T.primary} fill={T.primary} fillOpacity={0.12} strokeWidth={2} name={T.short}/>
                  <Radar dataKey="t2" stroke={TEAMS[compareTeam]?.primary} fill={TEAMS[compareTeam]?.primary} fillOpacity={0.1} strokeWidth={2} name={TEAMS[compareTeam]?.short}/>
                  <Tooltip contentStyle={TT_S}/>
                </RadarChart></ResponsiveContainer></div>
              </Card>
              <Card><CardH>🌤️ LIVE WEATHER (OPENF1 API)</CardH><div style={{padding:16}}>
                {w?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[{ic:"🌡️",l:"AIR",v:`${w.air?.toFixed(1)}°C`},{ic:"🛣️",l:"TRACK",v:`${w.track?.toFixed(1)}°C`},{ic:"💧",l:"HUMIDITY",v:`${w.hum}%`},{ic:"💨",l:"WIND",v:`${w.wind?.toFixed(1)} m/s`},{ic:"🌧️",l:"RAIN",v:w.rain?"YES":"NO"}].filter(x=>x.v&&!x.v.includes("undefined")).map(x=>(<div key={x.l} style={{background:"#F8F8FA",borderRadius:8,padding:12,textAlign:"center"}}><div style={{fontSize:20}}>{x.ic}</div><div style={{fontSize:8,color:"#999",fontFamily:"var(--cond)",fontWeight:600,letterSpacing:1,marginTop:2}}>{x.l}</div><div style={{fontSize:16,fontFamily:"var(--mono)",color:T.primary,marginTop:2}}>{x.v}</div></div>))}</div>:<Loader label="FETCHING WEATHER"/>}
              </div></Card>
            </div>
            </>}
          </div>
        )}

        {/* ════ STANDINGS ════ */}
        {tab==="standings"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{display:"flex",gap:6,marginBottom:14}}>{["drivers","constructors"].map(v=><button key={v} onClick={()=>setStandingsTab(v)} style={{background:standingsTab===v?`${T.primary}10`:"#FAFAFA",border:`2px solid ${standingsTab===v?T.primary:"#E4E4E8"}`,borderRadius:10,padding:"9px 22px",fontFamily:"var(--mono)",fontSize:12,color:standingsTab===v?T.primary:"#999",cursor:"pointer",letterSpacing:2}}>{v.toUpperCase()}</button>)}</div>
            {standingsTab==="drivers"&&(<Card glow><CardH>🏆 2025 DRIVER CHAMPIONSHIP (JOLPICA)</CardH>
              {driverStandings?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#F8F8FA"}}>{["P","","DRIVER","TEAM","WINS","PTS"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{driverStandings.map((ds,i)=>{const tk=mapTeamKey(ds.Constructors?.[0]?.constructorId);return(
                  <tr key={i} style={{borderBottom:"1px solid #F0F0F4",background:tk===teamKey?`${T.primary}06`:"transparent"}}>
                    <td style={{padding:"7px 10px",fontFamily:"var(--mono)",fontSize:16,color:i<3?T.primary:"#CCC"}}>{i+1}</td>
                    <td><div style={{width:3,height:14,background:TEAMS[tk]?.primary||"#888",borderRadius:2}}/></td>
                    <td style={{padding:"7px 10px",fontWeight:700}}>{ds.Driver?.givenName} {ds.Driver?.familyName}</td>
                    <td style={{padding:"7px 10px",fontSize:10,color:"#888",fontFamily:"var(--cond)"}}>{ds.Constructors?.[0]?.name}</td>
                    <td style={{padding:"7px 10px",fontFamily:"var(--mono)",fontSize:14,color:"#999"}}>{ds.wins}</td>
                    <td style={{padding:"7px 10px",fontFamily:"var(--mono)",fontSize:18,color:T.primary}}>{ds.points}</td>
                  </tr>);})}</tbody>
              </table></div>:<Loader label="FETCHING"/>}
            </Card>)}
            {standingsTab==="constructors"&&constructorStandings&&(<Card glow><CardH>🏗️ 2025 CONSTRUCTOR CHAMPIONSHIP</CardH>
              <div style={{padding:16}}><ResponsiveContainer width="100%" height={280}><BarChart data={constructorStandings.map(cs=>({name:cs.Constructor?.name,pts:Number(cs.points),id:cs.Constructor?.constructorId}))} layout="vertical" margin={{left:0}}>
                <XAxis type="number" stroke="#DDD" tick={{fontSize:9,fill:"#999"}}/><YAxis type="category" dataKey="name" stroke="transparent" tick={{fontSize:9,fill:"#777"}} width={80}/>
                <Tooltip contentStyle={TT_S}/><Bar dataKey="pts" radius={[0,6,6,0]} barSize={14}>{constructorStandings.map(cs=><Cell key={cs.Constructor?.constructorId} fill={TEAMS[mapTeamKey(cs.Constructor?.constructorId)]?.primary||"#888"}/>)}</Bar>
              </BarChart></ResponsiveContainer></div>
            </Card>)}
          </div>
        )}

        {/* ════ CALENDAR ════ */}
        {tab==="calendar"&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <h3 style={{margin:"0 0 14px",fontSize:11,fontFamily:"var(--mono)",color:T.primary,letterSpacing:3}}>2026 RACE CALENDAR</h3>
            {schedule?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>{schedule.map(r=>{
              const isPast=new Date(r.date)<new Date();const isNext=!isPast&&new Date(r.date)-new Date()<14*86400000;
              return(<Card key={r.round} glow={isNext} style={{opacity:isPast?0.5:1,border:isNext?`2px solid ${T.primary}`:undefined}}><div style={{padding:14}}>
                {isNext&&<Badge color={T.primary} s>NEXT ▸</Badge>}
                <div style={{fontSize:8,color:"#999",fontFamily:"var(--cond)",fontWeight:600,letterSpacing:1,marginTop:isNext?4:0}}>ROUND {r.round}{r.Sprint?" · SPRINT":""}</div>
                <div style={{fontFamily:"var(--mono)",fontSize:18,color:isNext?T.primary:"#1A1A2E",letterSpacing:2}}>{r.raceName}</div>
                <div style={{fontSize:11,color:"#888",fontFamily:"var(--cond)"}}>{r.Circuit?.circuitName}</div>
                <div style={{fontSize:11,color:"#999",fontFamily:"var(--cond)",fontWeight:600}}>{r.Circuit?.Location?.locality}, {r.Circuit?.Location?.country} · {r.date}</div>
              </div></Card>);
            })}</div>:<Loader label="FETCHING SCHEDULE"/>}
          </div>
        )}
      </main>

      <footer style={{padding:"20px 16px",textAlign:"center",borderTop:"1px solid #E8E8EC",marginTop:24}}>
        <span style={{fontFamily:"var(--mono)",fontSize:18,letterSpacing:3,color:"#1A1A2E"}}>THE <span style={{color:T.primary}}>UNDERCUT</span></span>
        <p style={{color:"#CCC",fontSize:10,margin:"4px 0 0",fontFamily:"var(--cond)",letterSpacing:1}}>Real-time: OpenF1 API · Historical: Jolpica-F1 · Educational use</p>
      </footer>
    </div>
  );
}
