import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ════════════════════════════════════════════════════════════════════════
// THE UNDERCUT — REAL-TIME F1 INTELLIGENCE (v3 — Full Feature Build)
// ════════════════════════════════════════════════════════════════════════

const OPENF1 = "https://api.openf1.org/v1";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";

// ═══ RATE LIMITER ═══
class RateLimiter {
  constructor(rps) { this.queue = []; this.last = 0; this.ms = 1000 / rps; }
  async acquire() { return new Promise(r => { this.queue.push(r); if (this.queue.length === 1) this._drain(); }); }
  _drain() { const now = Date.now(), wait = Math.max(0, this.ms - (now - this.last)); setTimeout(() => { this.last = Date.now(); const cb = this.queue.shift(); if (cb) cb(); if (this.queue.length) this._drain(); }, wait); }
}
const openF1RL = new RateLimiter(3);
const jolpicaRL = new RateLimiter(10);

const fetchJ = async (url, rl) => {
  try { if (rl) await rl.acquire(); const r = await fetch(url); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { console.warn("API:", url.slice(-60), e.message); return null; }
};

const apiO = {
  latestSession: () => fetchJ(`${OPENF1}/sessions?session_key=latest`, openF1RL),
  latestPositions: () => fetchJ(`${OPENF1}/position?session_key=latest&position<=20`, openF1RL),
  latestWeather: () => fetchJ(`${OPENF1}/weather?session_key=latest`, openF1RL),
  latestRaceControl: () => fetchJ(`${OPENF1}/race_control?session_key=latest`, openF1RL),
  latestIntervals: () => fetchJ(`${OPENF1}/intervals?session_key=latest`, openF1RL),
  latestStints: () => fetchJ(`${OPENF1}/stints?session_key=latest`, openF1RL),
  latestPit: () => fetchJ(`${OPENF1}/pit?session_key=latest`, openF1RL),
  latestDrivers: () => fetchJ(`${OPENF1}/drivers?session_key=latest`, openF1RL),
  latestLaps: () => fetchJ(`${OPENF1}/laps?session_key=latest`, openF1RL),
  carData: (dn) => fetchJ(`${OPENF1}/car_data?session_key=latest&driver_number=${dn}&speed>=0`, openF1RL),
};
const apiJ = {
  schedule: (y = 2026) => fetchJ(`${JOLPICA}/${y}.json`, jolpicaRL),
  driverStandings: (y = 2025) => fetchJ(`${JOLPICA}/${y}/driverStandings.json`, jolpicaRL),
  constructorStandings: (y = 2025) => fetchJ(`${JOLPICA}/${y}/constructorStandings.json`, jolpicaRL),
  lastResult: () => fetchJ(`${JOLPICA}/current/last/results.json`, jolpicaRL),
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
  {num:3,code:"VER",name:"Max Verstappen",team:"red_bull"},{num:4,code:"LAW",name:"Liam Lawson",team:"red_bull"},
  {num:63,code:"RUS",name:"George Russell",team:"mercedes"},{num:12,code:"ANT",name:"Andrea Kimi Antonelli",team:"mercedes"},
  {num:14,code:"ALO",name:"Fernando Alonso",team:"aston_martin"},{num:18,code:"STR",name:"Lance Stroll",team:"aston_martin"},
  {num:10,code:"GAS",name:"Pierre Gasly",team:"alpine"},{num:7,code:"DOO",name:"Jack Doohan",team:"alpine"},
  {num:55,code:"SAI",name:"Carlos Sainz",team:"williams"},{num:23,code:"ALB",name:"Alexander Albon",team:"williams"},
  {num:31,code:"OCO",name:"Esteban Ocon",team:"haas"},{num:87,code:"BEA",name:"Oliver Bearman",team:"haas"},
  {num:22,code:"TSU",name:"Yuki Tsunoda",team:"rb"},{num:6,code:"HAD",name:"Isack Hadjar",team:"rb"},
  {num:27,code:"HUL",name:"Nico Hülkenberg",team:"audi"},{num:5,code:"BOR",name:"Gabriel Bortoleto",team:"audi"},
  {num:41,code:"LIN",name:"Arvid Lindblad",team:"cadillac"},{num:43,code:"COL",name:"Franco Colapinto",team:"cadillac"},
];

// ═══ DRIVER HEADSHOTS (media CDN) ═══
const DRIVER_HEADSHOTS = {
  1:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png",
  81:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png",
  16:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/1col/image.png",
  44:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png",
  3:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png",
  4:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png",
  63:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png",
  12:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ANDANT01_Andrea_Kimi_Antonelli/andant01.png.transform/1col/image.png",
  14:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/1col/image.png",
  18:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/1col/image.png",
  10:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png",
  55:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/1col/image.png",
  23:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png",
  31:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/1col/image.png",
  87:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png",
  22:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png",
  6:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png",
  27:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/1col/image.png",
  5:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png.transform/1col/image.png",
  41:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ARVLIN01_Arvid_Lindblad/arvlin01.png.transform/1col/image.png",
  43:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/1col/image.png",
  7:"https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/J/JACDOO01_Jack_Doohan/jacdoo01.png.transform/1col/image.png",
};
const NAME_TO_NUM = {norris:1,piastri:81,leclerc:16,hamilton:44,verstappen:3,russell:63,alonso:14,stroll:18,gasly:10,doohan:7,sainz:55,albon:23,ocon:31,bearman:87,tsunoda:22,hadjar:6,hulkenberg:27,hülkenberg:27,bottas:77,perez:11,pérez:11,antonelli:12,colapinto:43,bortoleto:5,lindblad:41,lawson:4};

// ═══ GP FLAGS & EMOJIS ═══
const GP_FLAGS = {australia:"au",china:"cn",japan:"jp",bahrain:"bh",saudi:"sa",usa:"us",miami:"us",canada:"ca",monaco:"mc",spain:"es",barcelona:"es",madrid:"es",austria:"at",uk:"gb",britain:"gb",silverstone:"gb",belgium:"be",hungary:"hu",netherlands:"nl",italy:"it",monza:"it",singapore:"sg",azerbaijan:"az",mexico:"mx",brazil:"br",vegas:"us",qatar:"qa",abu:"ae",uae:"ae",france:"fr",portugal:"pt",germany:"de",malaysia:"my"};
const GP_EMOJI = {australia:"🦘",china:"🐉",japan:"🗾",bahrain:"🏜️",saudi:"🕌",miami:"🌴",canada:"🍁",monaco:"🎰",spain:"☀️",austria:"⛰️",britain:"🇬🇧",silverstone:"🏎️",belgium:"🧇",hungary:"🌶️",netherlands:"🌷",italy:"🍝",monza:"🏁",singapore:"🌃",azerbaijan:"🔥",mexico:"🌮",brazil:"🎉",vegas:"🎲",qatar:"⭐",abu:"🌅"};
const getGPFlag = (n) => { if(!n)return null;const l=n.toLowerCase();for(const[k,v]of Object.entries(GP_FLAGS))if(l.includes(k))return v;return null; };
const getGPEmoji = (n) => { if(!n)return"🏁";const l=n.toLowerCase();for(const[k,v]of Object.entries(GP_EMOJI))if(l.includes(k))return v;return"🏁"; };

// ═══ GP HERO IMAGES (unsplash for calendar cards) ═══
const GP_IMAGES = {australia:"https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=600&h=300&fit=crop",china:"https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=600&h=300&fit=crop",japan:"https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&h=300&fit=crop",bahrain:"https://images.unsplash.com/photo-1597659840241-37e2b7c2f7b9?w=600&h=300&fit=crop",saudi:"https://images.unsplash.com/photo-1586724237569-9c920b3e9098?w=600&h=300&fit=crop",miami:"https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=600&h=300&fit=crop",monaco:"https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=600&h=300&fit=crop",canada:"https://images.unsplash.com/photo-1517935706615-2717063c2225?w=600&h=300&fit=crop",spain:"https://images.unsplash.com/photo-1509840841025-9088ba78a826?w=600&h=300&fit=crop",austria:"https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=600&h=300&fit=crop",britain:"https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=300&fit=crop",belgium:"https://images.unsplash.com/photo-1491557345352-5929e343eb89?w=600&h=300&fit=crop",hungary:"https://images.unsplash.com/photo-1551867633-194f125bddfa?w=600&h=300&fit=crop",netherlands:"https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=600&h=300&fit=crop",italy:"https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=600&h=300&fit=crop",singapore:"https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&h=300&fit=crop",azerbaijan:"https://images.unsplash.com/photo-1604156425963-9be03f86a428?w=600&h=300&fit=crop",mexico:"https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=600&h=300&fit=crop",brazil:"https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&h=300&fit=crop",vegas:"https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=600&h=300&fit=crop",qatar:"https://images.unsplash.com/photo-1549221987-25a490f65d34?w=600&h=300&fit=crop",abu:"https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=300&fit=crop"};
const getGPImage = (n) => { if(!n)return null;const l=n.toLowerCase();for(const[k,v]of Object.entries(GP_IMAGES))if(l.includes(k))return v;return"https://images.unsplash.com/photo-1504707748692-419802cf939d?w=600&h=300&fit=crop"; };

// ═══ TYRE COMPOUNDS ═══
const TYRE_COLORS = { S:"#FF3333", M:"#FFD700", H:"#EEEEEE", I:"#44BB44", W:"#2196F3" };
const TYRE_NAMES = { S:"Soft", M:"Medium", H:"Hard", I:"Intermediate", W:"Wet" };

// ═══ SECTOR COLORS ═══
const SEC_C = { purple:"#A855F7", green:"#22C55E", yellow:"#EAB308", red:"#EF4444" };

// ═══ DRIVER CAREER STATS (subset for demo — from API in prod) ═══
const CAREER_STATS = {
  1:{gp:131,wins:7,podiums:28,poles:10,fl:10,pts:1041,wdc:0,best:"1 (x7)",bestGrid:"1 (x10)",dnf:12,nationality:"British",dob:"1999-11-13",birthplace:"Bristol, England"},
  16:{gp:171,wins:8,podiums:50,poles:27,fl:12,pts:1672,wdc:0,best:"1 (x8)",bestGrid:"1 (x27)",dnf:23,nationality:"Monégasque",dob:"1997-10-16",birthplace:"Monte Carlo, Monaco"},
  44:{gp:353,wins:105,podiums:202,poles:104,fl:67,pts:4829,wdc:7,best:"1 (x105)",bestGrid:"1 (x104)",dnf:32,nationality:"British",dob:"1985-01-07",birthplace:"Stevenage, England"},
  3:{gp:210,wins:63,podiums:112,poles:40,fl:33,pts:3068,wdc:4,best:"1 (x63)",bestGrid:"1 (x40)",dnf:18,nationality:"Dutch",dob:"1997-09-30",birthplace:"Hasselt, Belgium"},
  63:{gp:131,wins:3,podiums:18,poles:5,fl:8,pts:659,wdc:0,best:"1 (x3)",bestGrid:"1 (x5)",dnf:14,nationality:"British",dob:"1998-02-15",birthplace:"King's Lynn, England"},
  14:{gp:401,wins:32,podiums:106,poles:22,fl:24,pts:2329,wdc:2,best:"1 (x32)",bestGrid:"1 (x22)",dnf:46,nationality:"Spanish",dob:"1981-07-29",birthplace:"Oviedo, Spain"},
  55:{gp:215,wins:4,podiums:25,poles:6,fl:6,pts:1198,wdc:0,best:"1 (x4)",bestGrid:"1 (x6)",dnf:20,nationality:"Spanish",dob:"1994-09-01",birthplace:"Madrid, Spain"},
  81:{gp:48,wins:2,podiums:14,poles:1,fl:2,pts:416,wdc:0,best:"1 (x2)",bestGrid:"1 (x1)",dnf:5,nationality:"Australian",dob:"2001-04-06",birthplace:"Melbourne, Australia"},
  10:{gp:173,wins:1,podiums:6,poles:0,fl:3,pts:445,wdc:0,best:"1 (x1)",bestGrid:"2 (x2)",dnf:17,nationality:"French",dob:"1996-02-07",birthplace:"Rouen, France"},
  23:{gp:93,wins:0,podiums:1,poles:0,fl:0,pts:232,wdc:0,best:"3 (x1)",bestGrid:"4 (x1)",dnf:11,nationality:"Thai-British",dob:"1996-03-23",birthplace:"London, England"},
  27:{gp:225,wins:0,podiums:4,poles:1,fl:2,pts:576,wdc:0,best:"4 (x5)",bestGrid:"1 (x1)",dnf:24,nationality:"German",dob:"1987-08-19",birthplace:"Emmerich am Rhein, Germany"},
  22:{gp:97,wins:1,podiums:4,poles:0,fl:1,pts:290,wdc:0,best:"1 (x1)",bestGrid:"2 (x1)",dnf:12,nationality:"Japanese",dob:"2000-05-11",birthplace:"Sagamihara, Japan"},
  31:{gp:158,wins:1,podiums:4,poles:1,fl:0,pts:453,wdc:0,best:"1 (x1)",bestGrid:"1 (x1)",dnf:22,nationality:"French",dob:"1996-09-17",birthplace:"Évreux, France"},
  18:{gp:173,wins:0,podiums:3,poles:1,fl:0,pts:292,wdc:0,best:"3 (x3)",bestGrid:"1 (x1)",dnf:25,nationality:"Canadian",dob:"1998-10-29",birthplace:"Montréal, Canada"},
  87:{gp:12,wins:0,podiums:0,poles:0,fl:0,pts:19,wdc:0,best:"7 (x2)",bestGrid:"5 (x1)",dnf:2,nationality:"British",dob:"2005-05-08",birthplace:"Chelmsford, England"},
  12:{gp:3,wins:0,podiums:0,poles:0,fl:0,pts:0,wdc:0,best:"12 (x1)",bestGrid:"10 (x1)",dnf:1,nationality:"Italian",dob:"2006-08-25",birthplace:"Bologna, Italy"},
  5:{gp:0,wins:0,podiums:0,poles:0,fl:0,pts:0,wdc:0,best:"-",bestGrid:"-",dnf:0,nationality:"Brazilian",dob:"2004-10-31",birthplace:"São Paulo, Brazil"},
  6:{gp:0,wins:0,podiums:0,poles:0,fl:0,pts:0,wdc:0,best:"-",bestGrid:"-",dnf:0,nationality:"French",dob:"2004-09-28",birthplace:"Paris, France"},
  41:{gp:0,wins:0,podiums:0,poles:0,fl:0,pts:0,wdc:0,best:"-",bestGrid:"-",dnf:0,nationality:"British",dob:"2006-01-14",birthplace:"London, England"},
  43:{gp:9,wins:0,podiums:0,poles:0,fl:0,pts:5,wdc:0,best:"8 (x1)",bestGrid:"9 (x1)",dnf:2,nationality:"Argentine",dob:"2003-05-27",birthplace:"Buenos Aires, Argentina"},
  4:{gp:16,wins:0,podiums:0,poles:0,fl:0,pts:8,wdc:0,best:"9 (x2)",bestGrid:"5 (x1)",dnf:3,nationality:"New Zealander",dob:"2002-10-17",birthplace:"Auckland, NZ"},
  7:{gp:2,wins:0,podiums:0,poles:0,fl:0,pts:0,wdc:0,best:"15 (x1)",bestGrid:"13 (x1)",dnf:1,nationality:"Australian",dob:"2003-01-20",birthplace:"Gold Coast, Australia"},
};

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
const mapDriverToTeam = (dn, apiDrv = []) => {
  const d = apiDrv.find(x => x.driver_number === dn);
  if (d?.team_name) return mapTeamKey(d.team_name);
  return DRIVERS_22.find(x => x.num === dn)?.team || "neutral";
};

// ═══ GENERATORS (with API fallback) ═══
const genPos = (lap, apiPos = [], apiInt = [], apiDrv = []) => {
  if (apiPos.length > 0) {
    const latest = {};
    apiPos.forEach(p => { if(!latest[p.driver_number]||new Date(p.date)>new Date(latest[p.driver_number].date)) latest[p.driver_number]=p; });
    const sorted = Object.values(latest).sort((a,b)=>a.position-b.position);
    return sorted.map((pos,i) => {
      const drv = apiDrv.find(d=>d.driver_number===pos.driver_number);
      const intv = apiInt.find(x=>x.driver_number===pos.driver_number);
      const tk = mapDriverToTeam(pos.driver_number, apiDrv);
      const sd = DRIVERS_22.find(x=>x.num===pos.driver_number);
      return { pos:i+1, num:pos.driver_number, code:drv?.name_acronym||sd?.code||"???", name:drv?.full_name||sd?.name||"Driver", team:tk, gap:i===0?"LEADER":intv?.gap_to_leader?`+${Number(intv.gap_to_leader).toFixed(3)}`:`+${(i*0.4+Math.random()*0.5).toFixed(3)}`, interval:i===0?"-":intv?.interval?`+${Number(intv.interval).toFixed(3)}`:`+${(Math.random()*0.8+0.1).toFixed(3)}`, lastLap:`1:${(30+Math.random()*4).toFixed(3)}`, bestLap:`1:${(29+Math.random()*3).toFixed(3)}`, tyre:["S","M","H"][Math.floor(Math.random()*3)], stint:Math.floor(Math.random()*3)+1, laps:Math.floor(Math.random()*25)+1 };
    });
  }
  const a=[...DRIVERS_22]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a.map((d,i)=>({ pos:i+1, num:d.num, code:d.code, name:d.name, team:d.team, gap:i===0?"LEADER":`+${(i*0.3+Math.random()*0.5).toFixed(3)}`, interval:i===0?"-":`+${(Math.random()*0.8+0.1).toFixed(3)}`, lastLap:`1:${(30+Math.random()*4).toFixed(3)}`, bestLap:`1:${(29+Math.random()*3).toFixed(3)}`, tyre:["S","M","H"][Math.floor(Math.random()*3)], stint:Math.floor(Math.random()*3)+1, laps:Math.floor(Math.random()*25)+1 }));
};

const genSectors = (apiLaps = [], apiDrv = []) => {
  if (apiLaps.length > 0) {
    const byDriver = {};
    apiLaps.forEach(l => { if(!byDriver[l.driver_number]||l.lap_number>byDriver[l.driver_number].lap_number) byDriver[l.driver_number]=l; });
    return Object.values(byDriver).map(lap => {
      const drv = apiDrv.find(d=>d.driver_number===lap.driver_number);
      const sd = DRIVERS_22.find(x=>x.num===lap.driver_number);
      const s1 = lap.duration_sector_1||24.5+Math.random()*2.5;
      const s2 = lap.duration_sector_2||31.5+Math.random()*3;
      const s3 = lap.duration_sector_3||27.5+Math.random()*2.5;
      const sc = (seg) => !seg?["purple","green","yellow"][Math.floor(Math.random()*3)]:seg.includes?seg.includes(2051)?"purple":seg.includes(2049)?"green":"yellow":"yellow";
      return { num:lap.driver_number, code:drv?.name_acronym||sd?.code||"???", team:mapDriverToTeam(lap.driver_number,apiDrv), s1:s1.toFixed(3), s2:s2.toFixed(3), s3:s3.toFixed(3), s1c:sc(lap.segments_sector_1), s2c:sc(lap.segments_sector_2), s3c:sc(lap.segments_sector_3), total:(s1+s2+s3).toFixed(3), bs1:(s1-Math.random()*0.5).toFixed(3), bs2:(s2-Math.random()*0.5).toFixed(3), bs3:(s3-Math.random()*0.5).toFixed(3), spd1:Math.floor(180+Math.random()*60), spd2:Math.floor(160+Math.random()*80), spd3:Math.floor(200+Math.random()*90) };
    }).sort((a,b)=>parseFloat(a.total)-parseFloat(b.total));
  }
  return DRIVERS_22.slice(0,20).map((d,i)=>{ const s1=24.5+Math.random()*2.5,s2=31.5+Math.random()*3,s3=27.5+Math.random()*2.5; return { num:d.num,code:d.code,team:d.team, s1:s1.toFixed(3),s2:s2.toFixed(3),s3:s3.toFixed(3), s1c:["purple","green","yellow"][Math.floor(Math.random()*3)], s2c:["purple","green","yellow"][Math.floor(Math.random()*3)], s3c:["purple","green","yellow"][Math.floor(Math.random()*3)], total:(s1+s2+s3).toFixed(3), bs1:(s1-Math.random()*0.5).toFixed(3),bs2:(s2-Math.random()*0.5).toFixed(3),bs3:(s3-Math.random()*0.5).toFixed(3), spd1:Math.floor(180+Math.random()*60),spd2:Math.floor(160+Math.random()*80),spd3:Math.floor(200+Math.random()*90) };}).sort((a,b)=>parseFloat(a.total)-parseFloat(b.total));
};

// Mini-segments: 8 blocks per sector (like official F1 segments view)
const genSegments = (positions) => {
  return (positions||DRIVERS_22.slice(0,20)).map(d => {
    const makeBlocks = () => Array.from({length:8},()=>["purple","green","yellow","yellow","yellow","green"][Math.floor(Math.random()*6)]);
    return { num:d.num, code:d.code, team:d.team, name:d.name, seg1:makeBlocks(), seg2:makeBlocks(), seg3:makeBlocks(), s1:(24+Math.random()*3).toFixed(3), s2:(30+Math.random()*4).toFixed(3), s3:(26+Math.random()*3).toFixed(3) };
  });
};

// Tyre stint history generator
const genTyreHistory = (positions) => {
  return (positions||DRIVERS_22.slice(0,20)).map(d => {
    const numStints = Math.floor(Math.random()*4)+1;
    const stints = Array.from({length:numStints},(_,i)=>{
      const comp = ["S","M","H","M","S"][Math.min(i,4)];
      return { compound:comp, laps:Math.floor(Math.random()*20)+5, new:Math.random()>0.3 };
    });
    const total = stints.reduce((a,s)=>a+s.laps,0);
    return { num:d.num, code:d.code, team:d.team, name:d.name, current:stints[stints.length-1]?.compound||"M", stintNum:numStints, totalStints:numStints, totalLaps:total, stints };
  });
};

// ═══ COMPONENTS ═══

// Driver Avatar with headshot + team-colored fallback
const DriverAvatar = ({num, code, team, size=32}) => {
  const [imgErr, setImgErr] = useState(false);
  const t = TEAMS[team]||TEAMS.neutral;
  const url = DRIVER_HEADSHOTS[num];
  if (!url || imgErr) return (
    <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${t.primary},${t.secondary||t.primary}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.32,fontWeight:700,color:"#FFF",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0,border:`2px solid ${t.primary}33`}}>
      {code||"?"}
    </div>
  );
  return <img src={url} alt={code} referrerPolicy="no-referrer" onError={()=>setImgErr(true)} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${t.primary}`,flexShrink:0,background:t.surface}} />;
};

// Tyre compound icon
const TyreIcon = ({compound="M",size=22}) => {
  const c = TYRE_COLORS[compound]||"#888";
  return (
    <div style={{width:size,height:size,borderRadius:"50%",border:`2.5px solid ${c}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.48,fontWeight:800,color:c,fontFamily:"monospace",flexShrink:0,background:"#1a1a22"}}>
      {compound}
    </div>
  );
};

// Segment block bar (mini-sectors visualization)
const SegmentBar = ({blocks=[], time=""}) => (
  <div style={{display:"flex",alignItems:"center",gap:1}}>
    {blocks.map((c,i)=>(
      <div key={i} style={{width:12,height:16,borderRadius:1,background:SEC_C[c]||"#444",opacity:c==="yellow"?0.7:1}} />
    ))}
    {time && <span style={{marginLeft:4,fontSize:11,fontWeight:600,color:"#555",fontFamily:"'JetBrains Mono',monospace"}}>{time}</span>}
  </div>
);

// Dot indicator
const Dot = ({color="#E10600",size=8}) => <span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:color,animation:color==="#22C55E"?"pulse 1.5s infinite":undefined}} />;

// Badge
const Badge = ({children,color="#E10600",s}) => <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,background:`${color}15`,color,fontSize:s?10:11,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{children}</span>;

// ═══ DRIVER PROFILE MODAL ═══
const DriverProfileModal = ({driver, onClose}) => {
  if (!driver) return null;
  const d = DRIVERS_22.find(x=>x.num===driver)||{};
  const t = TEAMS[d.team]||TEAMS.neutral;
  const stats = CAREER_STATS[driver]||{};
  const StatBlock = ({label, value}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #eee"}}>
      <span style={{fontSize:13,color:"#666",fontFamily:"'Barlow Condensed',sans-serif"}}>{label}</span>
      <span style={{fontSize:18,fontWeight:800,color:"#1a1a22",fontFamily:"'Barlow Condensed',sans-serif"}}>{value||"0"}</span>
    </div>
  );
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#FFF",borderRadius:16,maxWidth:520,width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
        {/* Hero Banner */}
        <div style={{background:`linear-gradient(135deg, ${t.primary}, ${t.primary}CC)`,padding:"28px 24px 20px",borderRadius:"16px 16px 0 0",display:"flex",alignItems:"center",gap:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-20,top:-20,fontSize:160,fontWeight:900,color:"#FFFFFF10",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1}}>{d.num}</div>
          <div style={{position:"absolute",left:12,bottom:8,width:40,height:40,opacity:0.08}}><img src="/logo-icon.png" alt="" style={{width:"100%",height:"100%",objectFit:"contain",filter:"brightness(10)"}} /></div>
          <DriverAvatar num={driver} code={d.code} team={d.team} size={80} />
          <div style={{position:"relative",zIndex:1}}>
            <div style={{fontSize:13,color:"#FFFFFF99",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>{t.name}</div>
            <div style={{fontSize:28,fontWeight:800,color:"#FFF",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{d.name||"Unknown"}</div>
            <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
              {stats.nationality && <span style={{fontSize:12,color:"#FFFFFFcc",background:"#FFFFFF22",padding:"2px 8px",borderRadius:4}}>{stats.nationality}</span>}
              <span style={{fontSize:12,color:"#FFFFFFcc",background:"#FFFFFF22",padding:"2px 8px",borderRadius:4}}>#{d.num}</span>
            </div>
          </div>
        </div>
        {/* Stats */}
        <div style={{padding:"16px 24px 24px"}}>
          <div style={{fontSize:13,fontWeight:700,color:t.primary,letterSpacing:2,marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif"}}>CAREER STATISTICS</div>
          <StatBlock label="Grand Prix Entered" value={stats.gp} />
          <StatBlock label="Career Points" value={stats.pts} />
          <StatBlock label="Race Wins" value={stats.wins} />
          <StatBlock label="Podiums" value={stats.podiums} />
          <StatBlock label="Pole Positions" value={stats.poles} />
          <StatBlock label="Fastest Laps" value={stats.fl} />
          <StatBlock label="World Championships" value={stats.wdc} />
          <StatBlock label="Highest Race Finish" value={stats.best} />
          <StatBlock label="Highest Grid Position" value={stats.bestGrid} />
          <StatBlock label="DNFs" value={stats.dnf} />
          {stats.dob && <StatBlock label="Date of Birth" value={stats.dob} />}
          {stats.birthplace && <StatBlock label="Birthplace" value={stats.birthplace} />}
        </div>
        <div style={{padding:"0 24px 20px",textAlign:"center"}}>
          <button onClick={onClose} style={{padding:"10px 32px",borderRadius:8,border:"none",background:t.primary,color:"#FFF",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
};

// ═══ TRACK MAP (Bahrain SVG — simplified) ═══
const TrackMap = ({positions=[], teamKey="neutral"}) => {
  const tc = TEAMS[teamKey]||TEAMS.neutral;
  const path = "M 150,280 L 150,120 Q 150,80 180,60 L 300,60 Q 330,60 340,90 L 340,130 Q 340,150 360,150 L 400,150 Q 420,150 420,130 L 420,80 Q 420,50 450,50 L 520,50 Q 560,50 560,80 L 560,350 Q 560,380 530,400 L 250,400 Q 200,400 180,370 L 150,310 Z";
  return (
    <div style={{background:"#1a1a22",borderRadius:12,padding:12,position:"relative"}}>
      <svg viewBox="0 0 620 460" style={{width:"100%",height:"auto"}}>
        <path d={path} fill="none" stroke="#333" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={path} fill="none" stroke="#555" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,6"/>
        {(positions||[]).slice(0,10).map((d,i) => {
          const angle = (i/10)*2*Math.PI;
          const cx = 350+Math.cos(angle)*150, cy = 220+Math.sin(angle)*120;
          const col = TEAMS[d.team]?.primary||"#888";
          return <g key={i}><circle cx={cx} cy={cy} r={10} fill={col} stroke="#FFF" strokeWidth="1.5"/><text x={cx} y={cy+3.5} textAnchor="middle" fill="#FFF" fontSize="7" fontWeight="700" fontFamily="monospace">{d.code||d.num}</text></g>;
        })}
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  // Theme
  const [teamKey, setTeamKey] = useState("neutral");
  const T = TEAMS[teamKey]||TEAMS.neutral;

  // Navigation
  const [page, setPage] = useState("command"); // command | weekend | calendar | standings | telemetry
  const [onboarding, setOnboarding] = useState(true);

  // Race weekend state
  const [weekendMode, setWeekendMode] = useState("gp"); // practice | quali | sprint | gp | podium
  const [live, setLive] = useState(false);
  const [lap, setLap] = useState(0);
  const [totalLaps] = useState(57);
  const [flag, setFlag] = useState("GREEN");
  const [positions, setPositions] = useState(() => genPos(0));
  const [sectors, setSectors] = useState(() => genSectors());
  const [segments, setSegments] = useState(() => genSegments());
  const [tyreHistory, setTyreHistory] = useState(() => genTyreHistory());

  // NEW: 4-tab timing system
  const [timingTab, setTimingTab] = useState("laps"); // laps | sectors | segments | tyres

  // API state
  const [schedule, setSchedule] = useState([]);
  const [driverStandings, setDriverStandings] = useState([]);
  const [constructorStandings, setConstructorStandings] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [weather, setWeather] = useState(null);
  const [rcMsgs, setRcMsgs] = useState([]);
  const [rcFilter, setRcFilter] = useState("all");
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiPositions, setApiPositions] = useState([]);
  const [apiIntervals, setApiIntervals] = useState([]);
  const [apiDriversData, setApiDriversData] = useState(null);
  const rcRef = useRef(null);

  // Telemetry
  const [telemDriver1, setTelemDriver1] = useState(1);
  const [telemDriver2, setTelemDriver2] = useState(16);
  const [telemData, setTelemData] = useState(null);

  // Calendar
  const [calendarExpanded, setCalendarExpanded] = useState(null);

  // Driver profile
  const [profileDriver, setProfileDriver] = useState(null);

  // ═══ DATA LOAD ═══
  useEffect(() => {
    if (onboarding) return;
    setIsLoading(true);
    (async () => {
      try {
        const [sch, ds, cs, lr] = await Promise.all([apiJ.schedule(2026), apiJ.driverStandings(2025), apiJ.constructorStandings(2025), apiJ.lastResult()]);
        if (sch?.MRData?.RaceTable?.Races) setSchedule(sch.MRData.RaceTable.Races);
        if (ds?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings) setDriverStandings(ds.MRData.StandingsTable.StandingsLists[0].DriverStandings);
        if (cs?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings) setConstructorStandings(cs.MRData.StandingsTable.StandingsLists[0].ConstructorStandings);
        if (lr?.MRData?.RaceTable?.Races?.[0]) setLastResult(lr.MRData.RaceTable.Races[0]);

        // Live session data
        const [sess,wthr,rc,pos,intv,drv,laps,stints,pits] = await Promise.all([
          apiO.latestSession(),apiO.latestWeather(),apiO.latestRaceControl(),
          apiO.latestPositions(),apiO.latestIntervals(),apiO.latestDrivers(),
          apiO.latestLaps(),apiO.latestStints(),apiO.latestPit()
        ]);
        if(Array.isArray(wthr)&&wthr.length>0) setWeather(wthr[wthr.length-1]);
        if(Array.isArray(rc)&&rc.length>0) { setRcMsgs(rc.slice(-20).reverse().map(m=>({flag:m.flag||"",msg:m.message||"",cat:m.category||"",time:m.date?.split("T")[1]?.slice(0,8)||""}))); rcRef.current=rc; }
        if(Array.isArray(drv)&&drv.length>0) setApiDriversData(drv);
        const hasLive = Array.isArray(pos)&&pos.length>0;
        setIsLiveSession(hasLive);
        if(hasLive) {
          setApiPositions(pos); setApiIntervals(Array.isArray(intv)?intv:[]);
          setPositions(genPos(0,pos,intv||[],drv||[]));
          setSectors(genSectors(laps||[],drv||[]));
        }
      } catch(e) { console.error("Load error:",e); }
      finally { setIsLoading(false); }
    })();
  }, [onboarding]);

  // ═══ 3-SECOND LIVE POLLING ═══
  useEffect(() => {
    if (onboarding) return;
    const iv = setInterval(async () => {
      try {
        const [wthr,rc,pos,intv,laps] = await Promise.all([apiO.latestWeather(),apiO.latestRaceControl(),apiO.latestPositions(),apiO.latestIntervals(),apiO.latestLaps()]);
        if(Array.isArray(wthr)&&wthr.length>0) setWeather(wthr[wthr.length-1]);
        if(Array.isArray(rc)&&rc.length>0) {
          const prev = rcRef.current||[];
          const newMsgs = rc.filter(m=>!prev.some(p=>p.date===m.date&&p.message===m.message));
          if(newMsgs.length>0) setRcMsgs(p=>[...newMsgs.map(m=>({flag:m.flag||"",msg:m.message||"",cat:m.category||"",time:m.date?.split("T")[1]?.slice(0,8)||""})),...p].slice(0,30));
          rcRef.current=rc;
        }
        if(Array.isArray(pos)&&pos.length>0) {
          setApiPositions(pos); if(Array.isArray(intv)) setApiIntervals(intv);
          if(!live) setPositions(genPos(lap,pos,intv||apiIntervals,apiDriversData||[]));
          setIsLiveSession(true);
        }
        if(Array.isArray(laps)&&laps.length>0) setSectors(genSectors(laps,apiDriversData||[]));
      } catch(e) { console.error("Poll:",e); }
    }, 3000);
    return () => clearInterval(iv);
  }, [onboarding, live, lap, apiIntervals, apiDriversData]);

  // ═══ RACE SIMULATION ═══
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => {
      setLap(p => {
        if (p >= totalLaps) { setLive(false); return totalLaps; }
        const n = p + 1;
        if (apiPositions.length>0) setPositions(genPos(n, apiPositions, apiIntervals, apiDriversData||[]));
        else setPositions(genPos(n));
        setSectors(s => genSectors([], apiDriversData||[]));
        setSegments(genSegments(positions));
        setTyreHistory(genTyreHistory(positions));
        // Random events
        if (Math.random()<0.03) setFlag(["YELLOW","VSC","SC"][Math.floor(Math.random()*3)]);
        else if (flag!=="GREEN"&&Math.random()<0.3) setFlag("GREEN");
        return n;
      });
    }, 2200);
    return () => clearInterval(iv);
  }, [live, totalLaps, apiPositions, apiIntervals, apiDriversData, flag, positions]);

  const startSim = useCallback(() => {
    setLive(true); setLap(0); setFlag("GREEN");
    if (apiPositions.length>0) setPositions(genPos(0,apiPositions,apiIntervals,apiDriversData||[]));
    else setPositions(genPos(0));
    setSegments(genSegments(positions));
    setTyreHistory(genTyreHistory(positions));
  }, [apiPositions, apiIntervals, apiDriversData, positions]);

  // Telemetry fetch
  useEffect(() => {
    if (page !== "telemetry" || onboarding) return;
    (async () => {
      const [d1, d2] = await Promise.all([apiO.carData(telemDriver1), apiO.carData(telemDriver2)]);
      if (d1 || d2) {
        const make = (data) => (data||[]).slice(-60).map((d,i)=>({lap:i,speed:d.speed||0,rpm:d.rpm||0,throttle:d.throttle||0,brake:d.brake||0,gear:d.n_gear||0,drs:d.drs||0}));
        setTelemData({d1:make(d1), d2:make(d2)});
      } else {
        // Generate mock telemetry
        const mock = (base) => Array.from({length:60},(_,i)=>({lap:i,speed:base+Math.sin(i/5)*40+Math.random()*20,rpm:8000+Math.sin(i/3)*3000+Math.random()*500,throttle:Math.max(0,Math.min(100,70+Math.sin(i/4)*30+Math.random()*10)),brake:Math.max(0,Math.random()>0.7?Math.random()*100:0),gear:Math.min(8,Math.max(1,Math.floor(4+Math.sin(i/5)*3))),drs:Math.random()>0.8?1:0}));
        setTelemData({d1:mock(280), d2:mock(275)});
      }
    })();
  }, [page, telemDriver1, telemDriver2, onboarding]);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  // ═══ ONBOARDING SCREEN ═══
  if (onboarding) {
    return (
      <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#0a0a12 0%,#1a1a24 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
        {/* Subtle racing line pattern background */}
        <div style={{position:"absolute",inset:0,opacity:0.03,background:"repeating-linear-gradient(90deg,#FFF 0px,#FFF 1px,transparent 1px,transparent 60px)",pointerEvents:"none"}} />
        
        {/* Ambient red glow behind logo */}
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(225,6,0,0.08) 0%,transparent 70%)",top:"15%",pointerEvents:"none"}} />
        
        {/* Logo — large, with mix-blend-mode to remove white background */}
        <div style={{marginBottom:16,position:"relative",zIndex:1}}>
          <img 
            src="/logo-wide.png" 
            alt="The Undercut" 
            style={{width:320,maxWidth:"80vw",height:"auto",objectFit:"contain",mixBlendMode:"lighten",filter:"drop-shadow(0 4px 24px rgba(225,6,0,0.3))"}} 
          />
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:28,position:"relative",zIndex:1}}>
          <Dot color="#E10600" /><span style={{fontSize:11,color:"#E10600",letterSpacing:3,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>2026 SEASON · LIVE DATA · 11 TEAMS</span>
        </div>

        {/* Team selector */}
        <div style={{fontSize:11,color:"#555",letterSpacing:2,marginBottom:12,fontFamily:"'Barlow Condensed',sans-serif",position:"relative",zIndex:1}}>SELECT YOUR TEAM</div>
        <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:8,maxWidth:420,marginBottom:36,position:"relative",zIndex:1}}>
          {Object.entries(TEAMS).filter(([k])=>k!=="neutral").map(([k,t])=>(
            <button key={k} onClick={()=>setTeamKey(k)} style={{padding:"6px 14px",borderRadius:20,border:teamKey===k?`2px solid ${t.primary}`:"2px solid #333",background:teamKey===k?`${t.primary}22`:"transparent",color:teamKey===k?t.primary:"#888",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.2s",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
              {t.short}
            </button>
          ))}
        </div>
        <button onClick={()=>setOnboarding(false)} style={{padding:"14px 48px",borderRadius:30,border:"none",background:"linear-gradient(135deg,#E10600,#B80500)",color:"#FFF",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,boxShadow:"0 8px 30px rgba(225,6,0,0.35)",transition:"transform 0.2s",position:"relative",zIndex:1}} onMouseOver={e=>e.target.style.transform="scale(1.05)"} onMouseOut={e=>e.target.style.transform="scale(1)"}>
          ENTER THE PIT WALL
        </button>
        <div style={{position:"absolute",bottom:20,fontSize:9,color:"#444",letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",pointerEvents:"none"}}>POWERED BY OPENF1 + JOLPICA-F1 APIs</div>
      </div>
    );
  }

  // ═══ FILTERED RC MESSAGES ═══
  const filteredRC = rcFilter === "all" ? rcMsgs : rcMsgs.filter(m => {
    if (rcFilter === "Flag") return m.flag && m.flag !== "";
    if (rcFilter === "Pit") return m.cat?.toLowerCase().includes("pit") || m.msg?.toLowerCase().includes("pit");
    if (rcFilter === "Steward") return m.cat?.toLowerCase().includes("steward") || m.msg?.toLowerCase().includes("investig");
    return true;
  });

  // ═══ 4-TAB TIMING RENDER ═══
  const renderTimingTable = () => {
    const tabStyle = (active) => ({padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer",border:"none",borderBottom:active?`3px solid ${T.primary}`:"3px solid transparent",background:"transparent",color:active?T.primary:"#888",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,transition:"all 0.2s"});

    return (
      <div style={{background:"#FFF",borderRadius:12,border:"1px solid #eee",overflow:"hidden"}}>
        {/* Tab bar */}
        <div style={{display:"flex",borderBottom:"1px solid #eee",background:"#FAFAFA"}}>
          {["laps","sectors","segments","tyres"].map(tab=>(
            <button key={tab} onClick={()=>setTimingTab(tab)} style={tabStyle(timingTab===tab)}>
              {tab.charAt(0).toUpperCase()+tab.slice(1)}
            </button>
          ))}
          <div style={{flex:1}} />
          {live && <Badge color="#E10600">● LIVE</Badge>}
          {!live && isLiveSession && <Badge color="#22C55E">● LIVE DATA</Badge>}
        </div>

        {/* LAPS TAB */}
        {timingTab === "laps" && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"'JetBrains Mono','Barlow Condensed',monospace"}}>
              <thead><tr style={{background:"#1a1a22",color:"#FFF"}}>
                <th style={{padding:"8px 6px",textAlign:"left",width:30}}>P</th>
                <th style={{textAlign:"left"}}>DRIVER</th>
                <th>BEST LAP</th><th>GAP</th><th style={{color:SEC_C.purple}}>S1</th><th style={{color:SEC_C.green}}>S2</th><th style={{color:SEC_C.yellow}}>S3</th><th>TYRE</th><th>LAPS</th>
              </tr></thead>
              <tbody>
                {positions.map((d,i)=>{
                  const t = TEAMS[d.team]||TEAMS.neutral;
                  return (
                    <tr key={d.num} style={{borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={()=>setProfileDriver(d.num)}>
                      <td style={{padding:"7px 6px",fontWeight:700}}>{d.pos}</td>
                      <td style={{display:"flex",alignItems:"center",gap:6,padding:"7px 4px"}}>
                        <div style={{width:3,height:20,background:t.primary,borderRadius:2}} />
                        <span style={{fontWeight:700,fontSize:12}}>{d.code}</span>
                      </td>
                      <td style={{textAlign:"center",color:i===0?"#A855F7":"#333",fontWeight:i===0?700:400}}>{d.bestLap}</td>
                      <td style={{textAlign:"center",color:d.gap==="LEADER"?"":"#666"}}>{d.gap==="LEADER"?"":d.gap}</td>
                      <td style={{textAlign:"center",color:SEC_C[["purple","green","yellow"][Math.floor(Math.random()*3)]]}}>{sectors[i]?.s1||"-"}</td>
                      <td style={{textAlign:"center",color:SEC_C[["purple","green","yellow"][Math.floor(Math.random()*3)]]}}>{sectors[i]?.s2||"-"}</td>
                      <td style={{textAlign:"center",color:SEC_C[["purple","green","yellow"][Math.floor(Math.random()*3)]]}}>{sectors[i]?.s3||"-"}</td>
                      <td style={{textAlign:"center"}}><TyreIcon compound={d.tyre} size={18} /></td>
                      <td style={{textAlign:"center"}}>{d.laps}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTORS TAB */}
        {timingTab === "sectors" && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
              <thead><tr style={{background:"#1a1a22",color:"#FFF"}}>
                <th style={{padding:"8px 4px",textAlign:"left",width:30}}>P</th>
                <th style={{textAlign:"left"}}>DRIVER</th>
                <th>BEST LAP</th><th>GAP</th>
                <th style={{color:SEC_C.purple}}>S1</th><th style={{color:"#0af"}}>BS1</th><th style={{color:"#f80",fontStyle:"italic"}}>SPD 1</th>
                <th style={{color:SEC_C.green}}>S2</th><th style={{color:"#0af"}}>BS2</th><th style={{color:"#f80",fontStyle:"italic"}}>SPD 2</th>
                <th style={{color:SEC_C.yellow}}>S3</th><th style={{color:"#0af"}}>BS3</th><th style={{color:"#f80",fontStyle:"italic"}}>SPD 3</th>
                <th>TYRE</th>
              </tr></thead>
              <tbody>
                {positions.map((d,i)=>{
                  const t = TEAMS[d.team]||TEAMS.neutral;
                  const sec = sectors[i]||{};
                  return (
                    <tr key={d.num} style={{borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={()=>setProfileDriver(d.num)}>
                      <td style={{padding:"7px 4px",fontWeight:700}}>{d.pos}</td>
                      <td><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:3,height:18,background:t.primary,borderRadius:2}}/><span style={{fontWeight:700}}>{d.code}</span></div></td>
                      <td style={{textAlign:"center",color:i===0?"#A855F7":"#333",fontWeight:i===0?700:400}}>{d.bestLap}</td>
                      <td style={{textAlign:"center",color:"#666"}}>{d.gap==="LEADER"?"":d.gap}</td>
                      <td style={{textAlign:"center",color:SEC_C[sec.s1c||"yellow"]}}>{sec.s1||"-"}</td>
                      <td style={{textAlign:"center",color:"#0af",fontSize:10}}>{sec.bs1||"-"}</td>
                      <td style={{textAlign:"center",color:"#f80",fontStyle:"italic",fontSize:10}}>{sec.spd1?`${sec.spd1} KPH`:"-"}</td>
                      <td style={{textAlign:"center",color:SEC_C[sec.s2c||"yellow"]}}>{sec.s2||"-"}</td>
                      <td style={{textAlign:"center",color:"#0af",fontSize:10}}>{sec.bs2||"-"}</td>
                      <td style={{textAlign:"center",color:"#f80",fontStyle:"italic",fontSize:10}}>{sec.spd2?`${sec.spd2} KPH`:"-"}</td>
                      <td style={{textAlign:"center",color:SEC_C[sec.s3c||"yellow"]}}>{sec.s3||"-"}</td>
                      <td style={{textAlign:"center",color:"#0af",fontSize:10}}>{sec.bs3||"-"}</td>
                      <td style={{textAlign:"center",color:"#f80",fontStyle:"italic",fontSize:10}}>{sec.spd3?`${sec.spd3} KPH`:"-"}</td>
                      <td style={{textAlign:"center"}}><TyreIcon compound={d.tyre} size={18} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SEGMENTS TAB */}
        {timingTab === "segments" && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
              <thead><tr style={{background:"#1a1a22",color:"#FFF"}}>
                <th style={{padding:"8px 4px",textAlign:"left",width:30}}>P</th>
                <th style={{textAlign:"left"}}>DRIVER</th>
                <th>BEST LAP</th><th>GAP</th><th>LAP TIME</th>
                <th style={{textAlign:"left"}}>SECTOR 1</th>
                <th style={{textAlign:"left"}}>SECTOR 2</th>
                <th style={{textAlign:"left"}}>SECTOR 3</th>
                <th>TYRE</th>
              </tr></thead>
              <tbody>
                {positions.map((d,i)=>{
                  const t = TEAMS[d.team]||TEAMS.neutral;
                  const seg = segments[i]||{seg1:[],seg2:[],seg3:[]};
                  return (
                    <tr key={d.num} style={{borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={()=>setProfileDriver(d.num)}>
                      <td style={{padding:"7px 4px",fontWeight:700}}>{d.pos}</td>
                      <td><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:3,height:18,background:t.primary,borderRadius:2}}/><span style={{fontWeight:700}}>{d.code}</span></div></td>
                      <td style={{textAlign:"center",color:i===0?"#A855F7":"#333",fontWeight:i===0?700:400}}>{d.bestLap}</td>
                      <td style={{textAlign:"center",color:"#666"}}>{d.gap==="LEADER"?"":d.gap}</td>
                      <td style={{textAlign:"center",color:"#E10600",fontWeight:600}}>PIT</td>
                      <td><SegmentBar blocks={seg.seg1||[]} time={seg.s1} /></td>
                      <td><SegmentBar blocks={seg.seg2||[]} time={seg.s2} /></td>
                      <td><SegmentBar blocks={seg.seg3||[]} time={seg.s3} /></td>
                      <td style={{textAlign:"center"}}><TyreIcon compound={d.tyre} size={18} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TYRES TAB */}
        {timingTab === "tyres" && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
              <thead><tr style={{background:"#1a1a22",color:"#FFF"}}>
                <th style={{padding:"8px 4px",textAlign:"left",width:30}}>P</th>
                <th style={{textAlign:"left"}}>DRIVER</th>
                <th>BEST LAP</th>
                <th>CURRENT</th><th>STINT</th><th>TOTAL</th><th>LAPS</th>
                <th style={{textAlign:"left"}}>PREVIOUS STINTS</th>
              </tr></thead>
              <tbody>
                {positions.map((d,i)=>{
                  const t = TEAMS[d.team]||TEAMS.neutral;
                  const th = tyreHistory[i]||{stints:[],current:"M",stintNum:1,totalLaps:0};
                  return (
                    <tr key={d.num} style={{borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={()=>setProfileDriver(d.num)}>
                      <td style={{padding:"7px 4px",fontWeight:700}}>{d.pos}</td>
                      <td><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:3,height:18,background:t.primary,borderRadius:2}}/><span style={{fontWeight:700}}>{d.code}</span></div></td>
                      <td style={{textAlign:"center",color:i===0?"#A855F7":"#333",fontWeight:i===0?700:400}}>{d.bestLap}</td>
                      <td style={{textAlign:"center"}}><TyreIcon compound={th.current} size={20} /></td>
                      <td style={{textAlign:"center"}}>{th.stintNum}</td>
                      <td style={{textAlign:"center"}}>{th.stints?.length||0}</td>
                      <td style={{textAlign:"center"}}>{th.totalLaps}</td>
                      <td>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                          {(th.stints||[]).map((s,si)=>(
                            <div key={si} style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",background:"#f5f5f7",borderRadius:4}}>
                              <span style={{fontSize:11,fontWeight:600,color:TYRE_COLORS[s.compound]||"#888"}}>{s.laps}</span>
                              <TyreIcon compound={s.compound} size={14} />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ═══ CALENDAR CARDS (Photo-backed, Next/Upcoming) ═══
  const renderCalendar = () => {
    const now = new Date();
    const upcoming = schedule.filter(r => new Date(r.date) >= now);
    const past = schedule.filter(r => new Date(r.date) < now);
    const next = upcoming[0];
    const rest = upcoming.slice(1);

    const RaceCard = ({race, isNext, isPast}) => {
      const flagCode = getGPFlag(race.raceName||race.Circuit?.Location?.country||"");
      const emoji = getGPEmoji(race.raceName||"");
      const img = getGPImage(race.raceName||race.Circuit?.Location?.country||"");
      const rDate = new Date(race.date);
      const expanded = calendarExpanded === race.round;

      return (
        <div style={{borderRadius:14,overflow:"hidden",background:"#FFF",border:"1px solid #eee",transition:"all 0.3s",cursor:"pointer",boxShadow:isNext?"0 8px 24px rgba(225,6,0,0.15)":"0 2px 8px rgba(0,0,0,0.06)"}} onClick={()=>setCalendarExpanded(expanded?null:race.round)}>
          {/* Hero image */}
          <div style={{height:isNext?180:140,background:`url(${img}) center/cover`,position:"relative"}}>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 30%,rgba(0,0,0,0.8) 100%)"}} />
            <div style={{position:"absolute",top:10,left:12}}>
              <span style={{background:isNext?"#E10600":isPast?"#666":"#333",color:"#FFF",padding:"3px 10px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>
                ROUND {race.round}
              </span>
            </div>
            <div style={{position:"absolute",bottom:12,left:14,right:14}}>
              <div style={{fontSize:isNext?26:20,fontWeight:800,color:"#FFF",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
                {flagCode && <img src={`https://flagcdn.com/20x15/${flagCode}.png`} alt="" style={{marginRight:8,verticalAlign:"middle"}} />}
                {race.raceName?.replace(" Grand Prix","")||"GP"}
              </div>
              <div style={{fontSize:12,color:"#FFFa",marginTop:2,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
                {rDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})} {emoji}
              </div>
            </div>
          </div>
          {/* Expanded content */}
          {expanded && (
            <div style={{padding:"12px 14px",borderTop:"2px solid "+T.primary}}>
              <div style={{fontSize:11,color:"#666",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,marginBottom:8}}>
                {race.Circuit?.circuitName||"Circuit"} · {race.Circuit?.Location?.locality||""}
              </div>
              {race.FirstPractice && <div style={{fontSize:11,color:"#888",padding:"3px 0"}}>FP1: {race.FirstPractice.date} {race.FirstPractice.time?.slice(0,5)||""}</div>}
              {race.SecondPractice && <div style={{fontSize:11,color:"#888",padding:"3px 0"}}>FP2: {race.SecondPractice.date} {race.SecondPractice.time?.slice(0,5)||""}</div>}
              {race.ThirdPractice && <div style={{fontSize:11,color:"#888",padding:"3px 0"}}>FP3: {race.ThirdPractice.date} {race.ThirdPractice.time?.slice(0,5)||""}</div>}
              {race.Sprint && <div style={{fontSize:11,color:"#E67300",padding:"3px 0",fontWeight:600}}>Sprint: {race.Sprint.date} {race.Sprint.time?.slice(0,5)||""}</div>}
              {race.Qualifying && <div style={{fontSize:11,color:"#888",padding:"3px 0"}}>Quali: {race.Qualifying.date} {race.Qualifying.time?.slice(0,5)||""}</div>}
              <div style={{fontSize:11,color:T.primary,padding:"3px 0",fontWeight:700}}>Race: {race.date} {race.time?.slice(0,5)||""}</div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        {next && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}}>NEXT RACE</div>
            <RaceCard race={next} isNext />
          </div>
        )}
        {rest.length > 0 && (
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}}>UPCOMING</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260,1fr))",gap:12}}>
              {rest.map(r=><RaceCard key={r.round} race={r} />)}
            </div>
          </div>
        )}
        {past.length > 0 && (
          <div style={{marginTop:24}}>
            <div style={{fontSize:13,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}}>COMPLETED</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260,1fr))",gap:12}}>
              {past.map(r=><RaceCard key={r.round} race={r} isPast />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═══ MAIN LAYOUT ═══
  const appStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Barlow Condensed',sans-serif; background:#F5F5F7; }
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    table th { white-space:nowrap; }
    table td { white-space:nowrap; }
  `;

  return (
    <div style={{minHeight:"100vh",background:"#F5F5F7"}}>
      <style>{appStyle}</style>

      {/* Loading shimmer */}
      {isLoading && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(255,255,255,0.92)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <img src="/logo-icon.png" alt="" style={{width:56,height:56,objectFit:"contain",animation:"pulse 1.5s infinite"}} />
          <div style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:3,fontFamily:"'Barlow Condensed',sans-serif"}}>LOADING DATA...</div>
          <div style={{width:200,height:3,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",background:`linear-gradient(90deg,transparent,#E10600,transparent)`,backgroundSize:"200% 100%",animation:"shimmer 1.5s linear infinite"}} />
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header style={{background:"#FFF",borderBottom:"1px solid #eee",padding:"0 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:52,gap:12}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setPage("command")}>
            <img src="/logo-icon.png" alt="The Undercut" style={{width:34,height:34,objectFit:"contain",filter:`drop-shadow(0 1px 2px ${T.primary}30)`}} />
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"#1a1a22",letterSpacing:2,fontStyle:"italic",lineHeight:1,fontFamily:"'Barlow Condensed',sans-serif"}}>THE UNDERCUT</div>
              <div style={{fontSize:8,color:"#999",letterSpacing:3,lineHeight:1.2,fontFamily:"'Barlow Condensed',sans-serif"}}>F1 INTELLIGENCE</div>
            </div>
          </div>

          <div style={{flex:1}} />

          {/* Nav */}
          {["command","weekend","calendar","standings","telemetry"].map(p=>(
            <button key={p} onClick={()=>setPage(p)} style={{padding:"6px 14px",borderRadius:6,border:"none",background:page===p?`${T.primary}15`:"transparent",color:page===p?T.primary:"#888",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",transition:"all 0.2s",textTransform:"uppercase"}}>
              {p==="command"?"🏠":p==="weekend"?"🏁":p==="calendar"?"📅":p==="standings"?"🏆":p==="telemetry"?"📊":""} {p}
            </button>
          ))}

          <div style={{flex:1}} />

          {/* Live indicator + Team selector */}
          {isLiveSession && <Badge color="#22C55E"><Dot color="#22C55E" size={5}/> LIVE DATA</Badge>}
          <select value={teamKey} onChange={e=>setTeamKey(e.target.value)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid #ddd",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",color:T.primary}}>
            {Object.entries(TEAMS).map(([k,t])=><option key={k} value={k}>{t.short}</option>)}
          </select>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main style={{maxWidth:1200,margin:"0 auto",padding:16}}>

        {/* ─── COMMAND CENTER ─── */}
        {page === "command" && (
          <div style={{position:"relative"}}>
            {/* Subtle logo watermark */}
            <div style={{position:"absolute",top:-20,right:-20,width:280,height:280,opacity:0.025,pointerEvents:"none",zIndex:0}}>
              <img src="/logo-icon.png" alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,position:"relative",zIndex:1}}>
            {/* Weather */}
            <div style={{background:"#FFF",borderRadius:12,padding:16,border:"1px solid #eee"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:10}}>WEATHER CONDITIONS</div>
              {weather ? (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  <div><div style={{fontSize:24,fontWeight:800,color:T.primary}}>{weather.air_temperature||"--"}°C</div><div style={{fontSize:10,color:"#888"}}>Air Temp</div></div>
                  <div><div style={{fontSize:24,fontWeight:800,color:"#f80"}}>{weather.track_temperature||"--"}°C</div><div style={{fontSize:10,color:"#888"}}>Track Temp</div></div>
                  <div><div style={{fontSize:24,fontWeight:800,color:"#0af"}}>{weather.humidity||"--"}%</div><div style={{fontSize:10,color:"#888"}}>Humidity</div></div>
                  <div><div style={{fontSize:16,fontWeight:700}}>{weather.wind_speed||"--"} km/h</div><div style={{fontSize:10,color:"#888"}}>Wind</div></div>
                  <div><div style={{fontSize:16,fontWeight:700}}>{weather.rainfall||0}mm</div><div style={{fontSize:10,color:"#888"}}>Rain</div></div>
                  <div><div style={{fontSize:16,fontWeight:700}}>{weather.pressure||"--"} mbar</div><div style={{fontSize:10,color:"#888"}}>Pressure</div></div>
                </div>
              ) : <div style={{color:"#bbb",fontSize:13,display:"flex",alignItems:"center",gap:8}}><img src="/logo-icon.png" alt="" style={{width:18,height:18,opacity:0.2}} />Waiting for session data...</div>}
            </div>

            {/* Race Control */}
            <div style={{background:"#FFF",borderRadius:12,padding:16,border:"1px solid #eee"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:2}}>RACE CONTROL</div>
                <div style={{display:"flex",gap:4}}>
                  {["all","Flag","Pit","Steward"].map(f=>(
                    <button key={f} onClick={()=>setRcFilter(f)} style={{padding:"2px 8px",borderRadius:4,border:"none",background:rcFilter===f?T.primary:"#f0f0f0",color:rcFilter===f?"#FFF":"#888",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{maxHeight:180,overflowY:"auto"}}>
                {filteredRC.length>0 ? filteredRC.slice(0,12).map((m,i)=>(
                  <div key={i} style={{padding:"5px 0",borderBottom:"1px solid #f5f5f5",display:"flex",gap:8,fontSize:11}}>
                    <span style={{color:"#999",fontFamily:"monospace",minWidth:55}}>{m.time}</span>
                    {m.flag && <span style={{color:m.flag==="YELLOW"?"#EAB308":m.flag==="RED"?"#E10600":m.flag==="GREEN"?"#22C55E":"#666",fontWeight:700}}>⚑</span>}
                    <span style={{color:"#444"}}>{m.msg}</span>
                  </div>
                )) : <div style={{color:"#bbb",fontSize:12}}>No messages</div>}
              </div>
            </div>

            {/* Mini Standings */}
            <div style={{background:"#FFF",borderRadius:12,padding:16,border:"1px solid #eee"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:10}}>DRIVER STANDINGS (2025)</div>
              {driverStandings.slice(0,8).map((d,i)=>{
                const num = NAME_TO_NUM[d.Driver?.familyName?.toLowerCase()]||0;
                const tk = d.Constructors?.[0]?.constructorId?mapTeamKey(d.Constructors[0].constructorId):"neutral";
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:"1px solid #f8f8f8",cursor:"pointer"}} onClick={()=>num&&setProfileDriver(num)}>
                    <span style={{width:18,fontSize:12,fontWeight:700,color:"#999"}}>{d.position}</span>
                    <DriverAvatar num={num} code={d.Driver?.code} team={tk} size={24} />
                    <span style={{flex:1,fontSize:12,fontWeight:600}}>{d.Driver?.familyName||""}</span>
                    <span style={{fontSize:13,fontWeight:800,color:T.primary}}>{d.points} pts</span>
                  </div>
                );
              })}
            </div>

            {/* Constructor Standings */}
            <div style={{background:"#FFF",borderRadius:12,padding:16,border:"1px solid #eee"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:10}}>CONSTRUCTOR STANDINGS</div>
              {constructorStandings.slice(0,8).map((c,i)=>{
                const tk = mapTeamKey(c.Constructor?.constructorId||"");
                const ct = TEAMS[tk]||TEAMS.neutral;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid #f8f8f8"}}>
                    <span style={{width:18,fontSize:12,fontWeight:700,color:"#999"}}>{c.position}</span>
                    <div style={{width:4,height:20,background:ct.primary,borderRadius:2}} />
                    <span style={{flex:1,fontSize:12,fontWeight:600}}>{c.Constructor?.name||""}</span>
                    <span style={{fontSize:13,fontWeight:800,color:ct.primary}}>{c.points} pts</span>
                  </div>
                );
              })}
            </div>

            {/* Next Race Preview (full width) */}
            {schedule.length > 0 && (() => {
              const next = schedule.find(r => new Date(r.date) >= new Date()) || schedule[0];
              const img = getGPImage(next.raceName||"");
              const flagCode = getGPFlag(next.raceName||"");
              return (
                <div style={{gridColumn:"1/-1",borderRadius:14,overflow:"hidden",background:`url(${img}) center/cover`,position:"relative",height:160,cursor:"pointer"}} onClick={()=>setPage("calendar")}>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.3) 100%)"}} />
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",padding:"0 32px",gap:20}}>
                    <div>
                      <div style={{fontSize:11,color:"#FFF8",letterSpacing:2,fontWeight:600}}>NEXT RACE · ROUND {next.round}</div>
                      <div style={{fontSize:32,fontWeight:800,color:"#FFF",letterSpacing:1}}>
                        {flagCode && <img src={`https://flagcdn.com/24x18/${flagCode}.png`} alt="" style={{marginRight:10,verticalAlign:"middle"}} />}
                        {next.raceName?.replace(" Grand Prix","")||"Grand Prix"}
                      </div>
                      <div style={{fontSize:13,color:"#FFFa",marginTop:4}}>{next.Circuit?.circuitName} · {new Date(next.date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          </div>
        )}
        {page === "weekend" && (
          <div>
            {/* Control bar */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {["practice","quali","sprint","gp","podium"].map(m=>(
                <button key={m} onClick={()=>{setWeekendMode(m);if(!live){setPositions(genPos(0));setSectors(genSectors());setSegments(genSegments());setTyreHistory(genTyreHistory());}}} style={{padding:"6px 16px",borderRadius:6,border:"none",background:weekendMode===m?T.primary:"#FFF",color:weekendMode===m?"#FFF":"#888",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",boxShadow:weekendMode===m?`0 4px 12px ${T.primary}40`:"0 1px 3px rgba(0,0,0,0.06)",transition:"all 0.2s"}}>
                  {m}
                </button>
              ))}
              <div style={{flex:1}} />
              {weekendMode !== "podium" && (!live ? (
                <button onClick={startSim} style={{padding:"6px 20px",borderRadius:6,border:"none",background:"#22C55E",color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>▶ START SIM</button>
              ) : (
                <button onClick={()=>setLive(false)} style={{padding:"6px 20px",borderRadius:6,border:"none",background:"#E10600",color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>⏸ STOP</button>
              ))}
              {isLiveSession && <Badge color="#22C55E">● LIVE API</Badge>}
            </div>

            {/* Session info banner */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",background:"#FFF",borderRadius:10,border:"1px solid #eee",marginBottom:14}}>
              <div style={{width:4,height:28,background:T.primary,borderRadius:2}} />
              <div>
                <div style={{fontSize:16,fontWeight:800,color:"#1a1a22",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
                  {weekendMode==="practice"?"FREE PRACTICE":weekendMode==="quali"?"QUALIFYING":weekendMode==="sprint"?"SPRINT RACE":weekendMode==="gp"?"GRAND PRIX":"PODIUM CEREMONY"}
                </div>
                <div style={{fontSize:10,color:"#999",letterSpacing:1}}>
                  {weekendMode==="practice"?"60 MIN SESSION — NO POINTS":weekendMode==="quali"?"Q1 → Q2 → Q3 — KNOCKOUT FORMAT":weekendMode==="sprint"?"100KM — 1/3 POINTS":weekendMode==="gp"?`${totalLaps} LAPS — FULL POINTS`:"TOP 3 FINISHERS"}
                </div>
              </div>
              <div style={{flex:1}} />
              {live && <>
                <div style={{fontSize:11,fontWeight:700,color:"#999",letterSpacing:1}}>LAP</div>
                <div style={{fontSize:22,fontWeight:800,color:T.primary}}>{lap}/{weekendMode==="sprint"?Math.floor(totalLaps/3):totalLaps}</div>
                <div style={{width:1,height:28,background:"#eee"}} />
                <div style={{fontSize:11,fontWeight:700,color:"#999",letterSpacing:1}}>FLAG</div>
                <div style={{fontSize:14,fontWeight:800,color:flag==="GREEN"?"#22C55E":flag==="RED"?"#E10600":flag==="YELLOW"?"#EAB308":"#f80"}}>{flag}</div>
                <div style={{width:200,height:6,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${(lap/(weekendMode==="sprint"?Math.floor(totalLaps/3):totalLaps))*100}%`,height:"100%",background:`linear-gradient(90deg,${T.primary},${T.secondary||T.primary})`,borderRadius:3,transition:"width 0.5s"}} />
                </div>
              </>}
            </div>

            {/* ═══ PODIUM MODE ═══ */}
            {weekendMode === "podium" && (
              <div style={{display:"flex",justifyContent:"center",gap:20,alignItems:"flex-end",padding:"40px 0",flexWrap:"wrap"}}>
                {[1,0,2].map(idx=>{
                  const d = positions[idx];
                  if(!d) return null;
                  const t = TEAMS[d.team]||TEAMS.neutral;
                  const heights = [220,260,190];
                  const medals = ["🥈","🥇","🥉"];
                  return (
                    <div key={idx} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setProfileDriver(d.num)}>
                      <div style={{fontSize:32}}>{medals[idx]}</div>
                      <DriverAvatar num={d.num} code={d.code} team={d.team} size={idx===0?80:idx===1?100:70} />
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{d.code}</div>
                        <div style={{fontSize:11,color:"#999"}}>{d.name}</div>
                      </div>
                      <div style={{width:120,height:heights[idx],background:`linear-gradient(180deg,${t.primary},${t.primary}88)`,borderRadius:"8px 8px 0 0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",paddingTop:16}}>
                        <div style={{fontSize:36,fontWeight:900,color:"#FFF",fontFamily:"'Barlow Condensed',sans-serif"}}>{idx===0?"2":idx===1?"1":"3"}</div>
                        <div style={{fontSize:11,color:"#FFFa",marginTop:4}}>{d.bestLap}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ QUALIFYING MODE ═══ */}
            {weekendMode === "quali" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>
                <div>
                  {/* Q session tabs */}
                  <div style={{display:"flex",gap:4,marginBottom:8}}>
                    {["Q1","Q2","Q3"].map(q=>(
                      <div key={q} style={{padding:"4px 16px",borderRadius:4,background:q==="Q3"?T.primary:"#f0f0f0",color:q==="Q3"?"#FFF":"#888",fontSize:11,fontWeight:700,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{q}</div>
                    ))}
                    <div style={{flex:1}} />
                    <Badge color="#E10600">KNOCKOUT</Badge>
                  </div>
                  {renderTimingTable()}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <TrackMap positions={positions} teamKey={teamKey} />
                  <div style={{background:"#FFF",borderRadius:12,padding:12,border:"1px solid #eee"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:6}}>ELIMINATION ZONE</div>
                    {positions.slice(15,20).map((d,i)=>{
                      const t=TEAMS[d.team]||TEAMS.neutral;
                      return <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f8f8f8"}}><div style={{width:3,height:16,background:t.primary,borderRadius:2}}/><span style={{fontSize:11,fontWeight:700,color:"#E10600"}}>{d.code}</span><span style={{flex:1}} /><span style={{fontSize:10,color:"#999"}}>{d.bestLap}</span></div>;
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ PRACTICE MODE ═══ */}
            {weekendMode === "practice" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>
                <div>
                  <div style={{display:"flex",gap:4,marginBottom:8}}>
                    {["FP1","FP2","FP3"].map(fp=>(
                      <div key={fp} style={{padding:"4px 16px",borderRadius:4,background:fp==="FP1"?T.primary:"#f0f0f0",color:fp==="FP1"?"#FFF":"#888",fontSize:11,fontWeight:700,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{fp}</div>
                    ))}
                    <div style={{flex:1}} />
                    <Badge color="#888">SESSION</Badge>
                  </div>
                  {renderTimingTable()}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <TrackMap positions={positions} teamKey={teamKey} />
                  <div style={{background:"#FFF",borderRadius:12,padding:12,border:"1px solid #eee",maxHeight:200,overflowY:"auto"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:6}}>SESSION NOTES</div>
                    <div style={{fontSize:11,color:"#666",lineHeight:1.5}}>
                      Free practice session — teams testing setup changes, tyre compounds, and race simulations. Times may not represent true pace.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ GP / SPRINT MODE ═══ */}
            {(weekendMode === "gp" || weekendMode === "sprint") && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>
                <div>
                  {weekendMode === "sprint" && (
                    <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                      <Badge color="#E67300">⚡ SPRINT</Badge>
                      <span style={{fontSize:11,color:"#999",fontFamily:"'Barlow Condensed',sans-serif"}}>100KM · {Math.floor(totalLaps/3)} LAPS · TOP 8 SCORE</span>
                    </div>
                  )}
                  {renderTimingTable()}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <TrackMap positions={positions} teamKey={teamKey} />
                  <div style={{background:"#FFF",borderRadius:12,padding:12,border:"1px solid #eee",maxHeight:200,overflowY:"auto"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:6}}>RACE CONTROL</div>
                    {filteredRC.slice(0,6).map((m,i)=>(
                      <div key={i} style={{padding:"4px 0",fontSize:10,color:"#666",borderBottom:"1px solid #f8f8f8"}}>{m.time} — {m.msg}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── CALENDAR ─── */}
        {page === "calendar" && renderCalendar()}

        {/* ─── STANDINGS ─── */}
        {page === "standings" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={{background:"#FFF",borderRadius:12,padding:16,border:"1px solid #eee"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:12}}>DRIVER CHAMPIONSHIP (2025)</div>
              {driverStandings.map((d,i)=>{
                const num = NAME_TO_NUM[d.Driver?.familyName?.toLowerCase()]||0;
                const tk = d.Constructors?.[0]?.constructorId?mapTeamKey(d.Constructors[0].constructorId):"neutral";
                const ct = TEAMS[tk]||TEAMS.neutral;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid #f5f5f5",cursor:"pointer"}} onClick={()=>num&&setProfileDriver(num)}>
                    <span style={{width:24,fontSize:13,fontWeight:800,color:i<3?T.primary:"#999"}}>{d.position}</span>
                    <DriverAvatar num={num} code={d.Driver?.code} team={tk} size={28} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700}}>{d.Driver?.givenName} {d.Driver?.familyName}</div>
                      <div style={{fontSize:10,color:"#999"}}>{ct.name}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:15,fontWeight:800,color:ct.primary}}>{d.points}</div>
                      <div style={{fontSize:9,color:"#bbb"}}>W:{d.wins||0}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{background:"#FFF",borderRadius:12,padding:16,border:"1px solid #eee"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:12}}>CONSTRUCTORS (2025)</div>
              {constructorStandings.map((c,i)=>{
                const tk = mapTeamKey(c.Constructor?.constructorId||"");
                const ct = TEAMS[tk]||TEAMS.neutral;
                const maxPts = parseFloat(constructorStandings[0]?.points)||1;
                return (
                  <div key={i} style={{padding:"8px 0",borderBottom:"1px solid #f5f5f5"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{width:24,fontSize:13,fontWeight:800,color:i<3?T.primary:"#999"}}>{c.position}</span>
                      <div style={{width:4,height:24,background:ct.primary,borderRadius:2}} />
                      <span style={{flex:1,fontSize:13,fontWeight:700}}>{c.Constructor?.name||""}</span>
                      <span style={{fontSize:16,fontWeight:800,color:ct.primary}}>{c.points}</span>
                    </div>
                    <div style={{marginLeft:38,marginTop:4,height:4,background:"#f0f0f0",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${(parseFloat(c.points)/maxPts)*100}%`,height:"100%",background:ct.primary,borderRadius:2}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TELEMETRY ─── */}
        {page === "telemetry" && (
          <div>
            {/* Driver selector */}
            <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#999",fontWeight:700,letterSpacing:1}}>DRIVER 1</span>
                <select value={telemDriver1} onChange={e=>setTelemDriver1(+e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:`2px solid ${TEAMS[DRIVERS_22.find(d=>d.num===telemDriver1)?.team]?.primary||"#888"}`,fontSize:12,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}}>
                  {DRIVERS_22.map(d=><option key={d.num} value={d.num}>{d.code} — {d.name}</option>)}
                </select>
              </div>
              <span style={{fontSize:18,fontWeight:800,color:"#ccc"}}>VS</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#999",fontWeight:700,letterSpacing:1}}>DRIVER 2</span>
                <select value={telemDriver2} onChange={e=>setTelemDriver2(+e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:`2px solid ${TEAMS[DRIVERS_22.find(d=>d.num===telemDriver2)?.team]?.primary||"#888"}`,fontSize:12,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}}>
                  {DRIVERS_22.map(d=><option key={d.num} value={d.num}>{d.code} — {d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Telemetry charts */}
            {telemData ? (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {[
                  {key:"speed",label:"Speed (km/h)",color1:TEAMS[DRIVERS_22.find(d=>d.num===telemDriver1)?.team]?.primary||"#E10600",color2:TEAMS[DRIVERS_22.find(d=>d.num===telemDriver2)?.team]?.primary||"#0077AA"},
                  {key:"throttle",label:"Throttle %",color1:"#22C55E",color2:"#0af"},
                  {key:"brake",label:"Brake %",color1:"#EF4444",color2:"#f80"},
                  {key:"rpm",label:"RPM",color1:"#A855F7",color2:"#EC4899"},
                ].map(({key,label,color1,color2})=>(
                  <div key={key} style={{background:"#FFF",borderRadius:12,padding:14,border:"1px solid #eee"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#999",letterSpacing:2,marginBottom:8}}>{label}</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="lap" hide />
                        <YAxis fontSize={10} stroke="#ddd" />
                        <Tooltip contentStyle={{fontSize:11,borderRadius:8}} />
                        <Area data={telemData.d1} dataKey={key} type="monotone" stroke={color1} fill={`${color1}20`} strokeWidth={2} name={DRIVERS_22.find(d=>d.num===telemDriver1)?.code} />
                        <Area data={telemData.d2} dataKey={key} type="monotone" stroke={color2} fill={`${color2}20`} strokeWidth={2} name={DRIVERS_22.find(d=>d.num===telemDriver2)?.code} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{background:"#FFF",borderRadius:12,padding:60,border:"1px solid #eee",textAlign:"center"}}>
                <img src="/logo-icon.png" alt="" style={{width:48,height:48,objectFit:"contain",opacity:0.15,marginBottom:12}} />
                <div style={{color:"#bbb",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>Loading telemetry data...</div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ DRIVER PROFILE MODAL ═══ */}
      {profileDriver && <DriverProfileModal driver={profileDriver} onClose={()=>setProfileDriver(null)} />}

      {/* ═══ FOOTER ═══ */}
      <footer style={{maxWidth:1200,margin:"40px auto 0",padding:"20px 16px",borderTop:"1px solid #eee",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,opacity:0.5}}>
          <img src="/logo-icon.png" alt="" style={{width:20,height:20,objectFit:"contain"}} />
          <span style={{fontSize:10,color:"#999",letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>THE UNDERCUT · F1 INTELLIGENCE</span>
        </div>
        <span style={{fontSize:9,color:"#bbb",letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>OPENF1 + JOLPICA-F1 APIs · 2026</span>
      </footer>
    </div>
  );
}
