// Parking rules engine: parses NYC DOT sign descriptions and decides park / pay / no parking at a given time.
(function (root) {
  // NYC DOT 2026: street cleaning suspended on every date; meters also suspended where flag is 1
  const HOL = {"2026-01-01":["New Year's Day",1],"2026-01-06":["Three Kings' Day",0],"2026-01-19":["MLK Jr. Day",0],"2026-02-12":["Lincoln's Birthday",0],"2026-02-16":["Presidents' Day",0],"2026-02-17":["Lunar New Year",0],"2026-02-18":["Ash Wednesday",0],"2026-03-03":["Purim",0],"2026-03-20":["Eid al-Fitr",0],"2026-03-21":["Eid al-Fitr",0],"2026-04-02":["Holy Thursday",0],"2026-04-03":["Good Friday",0],"2026-04-08":["Passover",0],"2026-04-09":["Passover",0],"2026-04-10":["Orthodox Good Friday",0],"2026-05-14":["Ascension",0],"2026-05-22":["Shavuot",0],"2026-05-23":["Shavuot",0],"2026-05-25":["Memorial Day",1],"2026-05-27":["Eid al-Adha",0],"2026-05-28":["Eid al-Adha",0],"2026-06-19":["Juneteenth",0],"2026-07-03":["Independence Day",1],"2026-07-04":["Independence Day",1],"2026-07-23":["Tisha B'Av",0],"2026-08-15":["Assumption",0],"2026-09-07":["Labor Day",1],"2026-09-12":["Rosh Hashanah",0],"2026-09-13":["Rosh Hashanah",0],"2026-09-21":["Yom Kippur",0],"2026-09-26":["Sukkot",0],"2026-09-27":["Sukkot",0],"2026-10-03":["Shemini Atzeret",0],"2026-10-04":["Simchat Torah",0],"2026-10-12":["Columbus Day",0],"2026-11-01":["All Saints' Day",0],"2026-11-03":["Election Day",0],"2026-11-08":["Diwali",0],"2026-11-11":["Veterans Day",0],"2026-11-26":["Thanksgiving",1],"2026-12-08":["Immaculate Conception",0],"2026-12-25":["Christmas",1]};
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAYS_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const ALL = [0,1,2,3,4,5,6];
  const fmt = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short"});
  function ny(t){const o={};for(const p of fmt.formatToParts(new Date(t)))o[p.type]=p.value;
    return {key:`${o.year}-${o.month}-${o.day}`,dow:DAYS.indexOf(o.weekday),min:(+o.hour%24)*60+(+o.minute)};}
  function hm(min){min=min%1440;let h=Math.floor(min/60),m=min%60,ap=h>=12?"PM":"AM";h=h%12||12;return m?`${h}:${String(m).padStart(2,"0")} ${ap}`:`${h} ${ap}`;}

  const DAYMAP = {SUNDAY:0,SUN:0,MONDAY:1,MON:1,TUESDAY:2,TUES:2,TUE:2,WEDNESDAY:3,WED:3,THURSDAY:4,THURS:4,THUR:4,THU:4,FRIDAY:5,FRI:5,SATURDAY:6,SAT:6};
  const DAYRX = "SUNDAY|SUN|MONDAY|MON|TUESDAY|TUES|TUE|WEDNESDAY|WED|THURSDAY|THURS|THUR|THU|FRIDAY|FRI|SATURDAY|SAT";
  const TIME = "(?:\\d{1,2}(?::\\d{2})?\\s?(?:AM|PM)?|MIDNIGHT|NOON)";
  const TOKEN = new RegExp(`(EXCEPT)|(SCHOOL DAYS)|(ALL DAYS)|(ANYTIME)|(${TIME})\\s?-\\s?(${TIME})|\\b(${DAYRX})\\b\\s?-\\s?\\b(${DAYRX})\\b|\\b(${DAYRX})\\b`,"g");

  function parseTime(s, fallbackAP){
    s=s.replace(/\s/g,"");
    if(s==="MIDNIGHT")return {m:0,ap:"AM",mid:true};
    if(s==="NOON")return {m:720,ap:"PM"};
    const m=s.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/); if(!m)return null;
    let h=+m[1],mi=+(m[2]||0),ap=m[3]||fallbackAP; if(!ap)return null;
    if(h===12)h=0; if(ap==="PM")h+=12; return {m:h*60+mi,ap};
  }
  function dayRange(a,b){const s=DAYMAP[a],e=DAYMAP[b];const out=[];for(let d=s;;d=(d+1)%7){out.push(d);if(d===e)break;}return out;}

  // kind: "asp" street cleaning, "meter" pay, "stop" no parking/standing/loading
  function classify(desc){
    const d=desc.toUpperCase();
    if(/PAY-BY-CELL|PANEL|METERS ARE NOT IN EFFECT|DESCRIPTION NOT AVAILABLE|RIDER|REAL TIME|ANGLE PARKING|CODING|NIGHT REGULATION ARROW/.test(d))return null;
    if(/BROOM|SANITATION/.test(d)&&/NO PARKING/.test(d))return "asp";
    if(/COMMERCIAL VEHICLES ONLY|TRUCK LOADING|LOADING ONLY|LOADING ZONE|AUTHORIZED VEHICLES|\bAVO\b|TAXI|BUS STOP|NO STANDING|NO STOPPING|NO PARKING|AMBULETTE|DIPLOMAT|CONSUL|POLICE|FIRE|HOTEL|CARSHARE|\bONLY\b/.test(d)&&!/INFORMATION SIGN|OPEN STREETS/.test(d))return "stop";
    if(/\bHMP\b|HOUR METERED|METERED PARKING|MUNI-METER/.test(d))return "meter";
    return null;
  }
  function parseSign(desc){
    const kind=classify(desc); if(!kind)return null;
    let d=desc.toUpperCase().replace(/\(SUPERSEDE[^)]*\)/g," ").replace(/\(SANITATION BROOM SYMBOL\)/g," ").replace(/<-*>|-+>|<-+/g," ").replace(/\bTHRU\b|\bTO\b/g,"-").replace(/\s+/g," ");
    const rules=[]; let pending=null, except=false, exceptDays=[], lastDays=null;
    TOKEN.lastIndex=0; let m;
    while((m=TOKEN.exec(d))){
      if(m[1]){except=true;continue;}
      if(m[2]){pending=[1,2,3,4,5];continue;}
      if(m[3]){pending=ALL.slice();continue;}
      if(m[4]){rules.push({days:ALL.slice(),s:0,e:1440});continue;}
      if(m[5]){
        const end=parseTime(m[6],null); if(!end)continue;
        const start=parseTime(m[5],end.ap); if(!start)continue;
        let e=end.mid?1440:end.m; const days=pending||lastDays;
        rules.push({days:days?days.slice():null,s:start.m,e});
        lastDays=days; pending=null; continue;
      }
      const ds=m[7]?dayRange(m[7],m[8]):[DAYMAP[m[9]]];
      if(except){exceptDays.push(...ds);}
      else pending=pending?pending.concat(ds):ds;
    }
    // days written after the time ("8AM-6PM MON-FRI"): attach to rules without days
    if(pending){for(const r of rules)if(r.days===null)r.days=pending.slice();}
    for(const r of rules){if(r.days===null)r.days=ALL.slice();if(exceptDays.length)r.days=r.days.filter(x=>!exceptDays.includes(x));}
    if(!rules.length){ if(kind==="stop")rules.push({days:ALL.slice(),s:0,e:1440}); else return null; }
    return {kind,rules,text:cleanText(desc)};
  }
  function cleanText(desc){return desc.replace(/\(SUPERSEDE[^)]*\)/gi,"").replace(/<-*>|-+>|<-+/g,"").replace(/\(SANITATION BROOM SYMBOL\)/gi,"(street cleaning)").replace(/\bHMP\b/g,"HR METERED PARKING").replace(/\s+/g," ").trim();}

  function ruleActive(sign,r,p){
    let inside;
    if(r.e>r.s) inside=r.days.includes(p.dow)&&p.min>=r.s&&p.min<r.e;
    else inside=(r.days.includes(p.dow)&&p.min>=r.s)||(r.days.includes((p.dow+6)%7)&&p.min<r.e);
    if(!inside)return false;
    const h=HOL[p.key];
    if(sign.kind==="asp"&&h)return false;
    if(sign.kind==="meter"&&h&&h[1])return false;
    return true;
  }
  function stateAt(signs,t){const p=ny(t);let st="free",why=null;
    for(const s of signs)for(const r of s.rules)if(ruleActive(s,r,p)){
      if(s.kind!=="meter")return {st:"stop",why:s};
      st="pay";why=s;}
    return {st,why};}
  function nextChange(signs,t0,cur,maxDays){const step=5*6e4,lim=t0+(maxDays||4)*864e5;
    for(let t=Math.ceil((t0+1)/step)*step;t<lim;t+=step){const s=stateAt(signs,t);if(s.st!==cur)return {t,st:s.st,why:s.why};}return null;}

  const API={HOL,DAYS,DAYS_LONG,ny,hm,parseSign,stateAt,nextChange,classify};
  if(typeof module!=="undefined")module.exports=API; else root.Park=API;
})(this);
