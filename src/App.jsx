import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  ShieldCheck, Users, UserPlus, CalendarDays, Calendar, Clock, MapPin, LogIn,
  LogOut, Plus, Trash2, Check, X, Home, FileText, ChevronLeft, ChevronRight,
  Pencil, Phone, Settings, AlertCircle, CheckCircle2, CalendarPlus, RefreshCw,
  Hash, Search, Navigation, CircleDot, Upload, Download,
  Camera, Eye, AlertTriangle, BadgeCheck, KeyRound, Lock, ShieldAlert, Bell, Sparkles, Send, Mail,
} from 'lucide-react';

/* ─────────────────────────── STORAGE ─────────────────────────── */
const K = { emp:'bsec:employees', shifts:'bsec:shifts', leaves:'bsec:leaves', avail:'bsec:availability', logs:'bsec:timelogs', docs:'bsec:documents', cfg:'bsec:config', sites:'bsec:sites', alerts:'bsec:alerts', seen:'bsec:seen' };
const docImgKey = (id) => `bsec:docimg:${id}`;
const RENEW_DAYS = 182;
const store = {
  async get(k,fb){try{const r=await window.storage.get(k,true);return(!r||r.value==null)?fb:JSON.parse(r.value);}catch(e){return fb;}},
  async set(k,v){try{await window.storage.set(k,JSON.stringify(v),true);return true;}catch(e){return false;}},
  async raw(k){try{const r=await window.storage.get(k,true);return r?r.value:null;}catch(e){return null;}},
  async setRaw(k,v){try{await window.storage.set(k,v,true);return true;}catch(e){return false;}},
  async del(k){try{await window.storage.delete(k,true);}catch(e){}},
};

/* ─────────────────────────── UTILS ───────────────────────────── */
const uid = () => (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const pad = (n) => String(n).padStart(2,'0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const norm = (s) => (s||'').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function frDate(k){if(!k)return'';const[y,m,d]=k.split('-').map(Number);return `${d} ${MOIS[m-1]} ${y}`;}
function frDateShort(k){if(!k)return'';const[,m,d]=k.split('-').map(Number);return `${pad(d)}/${pad(m)}`;}
function frHeure(iso){const d=new Date(iso);return `${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function frDateTime(iso){const d=new Date(iso);return `${pad(d.getDate())}/${pad(d.getMonth()+1)} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;}

function shiftDateParts(key) {
  if (!key) return {};
  const d = new Date(key + 'T00:00:00');
  return { dayAbbr: JOURS_COURT[d.getDay()], dayNum: d.getDate(), monthAbbr: MOIS[d.getMonth()].slice(0,3), isPast: key < todayKey(), isToday: key === todayKey() };
}
function groupShifts(shifts) {
  const map = new Map();
  shifts.forEach((s) => {
    const [y,m] = s.date.split('-');
    const k = `${y}-${m}`;
    if (!map.has(k)) map.set(k, { key:k, label:`${MOIS[+m-1]} ${y}`, list:[] });
    map.get(k).list.push(s);
  });
  return [...map.values()];
}
function monthGrid(year,month){
  const first=new Date(year,month,1),start=(first.getDay()+6)%7,nb=new Date(year,month+1,0).getDate(),cells=[];
  for(let i=0;i<start;i++)cells.push(null);
  for(let d=1;d<=nb;d++)cells.push(new Date(year,month,d));
  while(cells.length%7!==0)cells.push(null);
  return cells;
}
function getPosition(){return new Promise((res)=>{if(!navigator.geolocation)return res({ok:false,reason:'non supportée'});navigator.geolocation.getCurrentPosition((p)=>res({ok:true,lat:+p.coords.latitude.toFixed(6),lng:+p.coords.longitude.toFixed(6),accuracy:Math.round(p.coords.accuracy)}),(e)=>res({ok:false,reason:e.message||'refusée'}),{enableHighAccuracy:true,timeout:10000,maximumAge:0});});}
function currentStatus(empId,logs){const last=logs.filter((l)=>l.employeeId===empId).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];if(last&&last.type==='Prise')return{onDuty:true,since:last.timestamp};return{onDuty:false,since:last?.timestamp};}
function docStatus(dateExp){
  if(!dateExp)return{label:'Sans échéance',tone:'slate',days:null,level:0};
  const today=new Date();today.setHours(0,0,0,0);
  const exp=new Date(dateExp+'T00:00:00');
  const days=Math.round((exp-today)/86400000);
  if(days<0)return{label:`Expiré depuis ${-days} j`,tone:'rose',days,level:4};
  if(days<=30)return{label:`Expire dans ${days} j`,tone:'rose',days,level:3};
  if(days<=90)return{label:`Expire dans ~${Math.round(days/30)} mois`,tone:'amber',days,level:2};
  if(days<=RENEW_DAYS)return{label:`Expire dans ~${Math.round(days/30)} mois`,tone:'sky',days,level:1};
  return{label:'Valide',tone:'emerald',days,level:0};
}
const docBg=(tone)=>tone==='rose'?'bg-rose-500/15 text-rose-400':tone==='amber'?'bg-amber-500/15 text-amber-400':tone==='sky'?'bg-sky-500/15 text-sky-400':'bg-emerald-500/15 text-emerald-400';

const APS_CATEGORIES=['Surveillance humaine (APS)','Agent cynophile','Vidéoprotection','Sûreté aéroportuaire','Protection physique des personnes (A3P)','Transport de fonds','Agent de recherches privées','Opérateur SSIAP'];

/* Jours fériés France 2026-2027 */
const HOLIDAYS_FR=new Set(['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25','2027-01-01','2027-03-29','2027-05-01','2027-05-06','2027-05-08','2027-05-17','2027-07-14','2027-08-15','2027-11-01','2027-11-11','2027-12-25']);

function fmtH(h){const m=Math.round(h*60);return `${Math.floor(m/60)}h${pad(m%60)}`;}
function isoWeek(dateStr){const d=new Date(dateStr+'T00:00:00');const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day+3);const firstThu=new Date(d.getFullYear(),0,4);const week=1+Math.round(((d-firstThu)/86400000-3+((firstThu.getDay()+6)%7))/7);return `${d.getFullYear()}-W${week}`;}
function shiftMinutes(s){
  if(!s||!s.date||!s.debut||!s.fin)return{total:0,night:0,sunday:0,holiday:0};
  const start=new Date(`${s.date}T${s.debut}:00`);
  let endMs=new Date(`${s.date}T${s.fin}:00`).getTime();
  if(endMs<=start.getTime())endMs+=86400000;
  let total=0,night=0,sunday=0,holiday=0;
  for(let ms=start.getTime();ms<endMs;ms+=900000){
    const t=new Date(ms);const h=t.getHours();
    total+=15;
    if(h>=21||h<6)night+=15;
    if(t.getDay()===0)sunday+=15;
    if(HOLIDAYS_FR.has(dateKey(t)))holiday+=15;
  }
  return{total:total/60,night:night/60,sunday:sunday/60,holiday:holiday/60};
}
function monthlyHours(empId,year,month,shifts){
  const prefix=`${year}-${pad(month+1)}`;
  const ms=shifts.filter((s)=>s.employeeId===empId&&s.date.startsWith(prefix));
  let total=0,night=0,sunday=0,holiday=0;const weeks={};
  ms.forEach((s)=>{const b=shiftMinutes(s);total+=b.total;night+=b.night;sunday+=b.sunday;holiday+=b.holiday;const wk=isoWeek(s.date);weeks[wk]=(weeks[wk]||0)+b.total;});
  let supp=0;Object.values(weeks).forEach((w)=>{if(w>35)supp+=w-35;});
  return{total,normal:Math.max(0,total-supp),supp,night,sunday,holiday,count:ms.length};
}
function planningText(agent, shifts, ym){
  const prefix=`${ym.y}-${pad(ym.m+1)}`;
  const ms=shifts.filter((s)=>s.employeeId===agent.id&&s.date.startsWith(prefix)).sort((a,b)=>a.date.localeCompare(b.date)||a.debut.localeCompare(b.debut));
  const h=monthlyHours(agent.id,ym.y,ym.m,shifts);
  let t=`Planning de ${agent.prenom} ${agent.nom} — ${MOIS[ym.m]} ${ym.y}\n\n`;
  if(ms.length===0)t+='Aucune vacation ce mois.\n';
  else ms.forEach((s)=>{t+=`- ${frDate(s.date)} : ${s.debut}-${s.fin} ${s.type}${s.lieu?' — '+s.lieu:''}\n`;});
  t+=`\nTotal : ${fmtH(h.total)} (nuit ${fmtH(h.night)}, dimanche ${fmtH(h.sunday)}, fériés ${fmtH(h.holiday)})\nGroupe Buckler Security`;
  return t;
}
function shiftWarnings(empId,candidate,shifts,leaves){
  const w=[];
  if(!empId||!candidate.date)return w;
  const onLeave=leaves.find((l)=>l.employeeId===empId&&l.statut!=='Refusé'&&candidate.date>=l.dateDebut&&candidate.date<=l.dateFin);
  if(onLeave)w.push({tone:'rose',text:`En congé ce jour (${onLeave.type}${onLeave.statut==='En attente'?', en attente':''})`});
  const cs=Number(candidate.debut.replace(':',''));let ce=Number(candidate.fin.replace(':',''));if(ce<=cs)ce+=2400;
  const sameDay=shifts.filter((s)=>s.employeeId===empId&&s.date===candidate.date&&s.id!==candidate.id);
  const overlap=sameDay.find((s)=>{let ss=Number(s.debut.replace(':','')),se=Number(s.fin.replace(':',''));if(se<=ss)se+=2400;return cs<se&&ss<ce;});
  if(overlap)w.push({tone:'amber',text:`Déjà planifié(e) ce jour (${overlap.debut}–${overlap.fin})`});
  else if(sameDay.length>0)w.push({tone:'amber',text:'A déjà une vacation ce jour'});
  const wk=isoWeek(candidate.date);
  let weekH=shifts.filter((s)=>s.employeeId===empId&&s.id!==candidate.id&&isoWeek(s.date)===wk).reduce((a,s)=>a+shiftMinutes(s).total,0)+shiftMinutes(candidate).total;
  if(weekH>48)w.push({tone:'rose',text:`Dépasse 48h légales cette semaine (${fmtH(weekH)})`});
  else if(weekH>44)w.push({tone:'amber',text:`Semaine chargée : ${fmtH(weekH)}`});
  return w;
}
function WarnBox({warns}){
  if(!warns||warns.length===0)return null;
  return (
    <div className="space-y-1.5">
      {warns.map((w,i)=>(
        <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${w.tone==='rose'?'border-rose-500/30 bg-rose-500/10 text-rose-300':'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/><span>{w.text}</span>
        </div>
      ))}
    </div>
  );
}
function buildNotifs(me, data){
  const {shifts,leaves,documents,alerts}=data;
  const out=[];
  shifts.filter((s)=>s.employeeId===me.id&&s.createdAt).forEach((s)=>out.push({id:'sh'+s.id,eventTs:s.createdAt,icon:CalendarDays,tone:'sky',title:'Nouveau planning',text:`${frDate(s.date)} · ${s.debut}–${s.fin}${s.lieu?' · '+s.lieu:''}`,action:'planning'}));
  leaves.filter((l)=>l.employeeId===me.id&&l.decidedAt&&l.statut!=='En attente').forEach((l)=>out.push({id:'lv'+l.id,eventTs:l.decidedAt,icon:l.statut==='Approuvé'?CheckCircle2:X,tone:l.statut==='Approuvé'?'emerald':'rose',title:`Congé ${l.statut.toLowerCase()}`,text:`${l.type} · ${frDateShort(l.dateDebut)} → ${frDateShort(l.dateFin)}`,action:'leaves'}));
  (alerts||[]).forEach((a)=>out.push({id:'al'+a.id,eventTs:a.createdAt,icon:ShieldAlert,tone:'amber',title:'Demande de renfort',text:`${frDate(a.date)}${a.lieu?' · '+a.lieu:''}${a.message?' — '+a.message:''}`,action:'avail'}));
  documents.filter((d)=>d.employeeId===me.id).forEach((d)=>{const st=docStatus(d.dateExpiration);if(st.days!==null&&st.days<=RENEW_DAYS)out.push({id:'doc'+d.id,eventTs:null,icon:BadgeCheck,tone:st.level>=3?'rose':'amber',title:'Document à renouveler',text:`${d.type} — ${st.label}`,action:'docs'});});
  out.sort((a,b)=>(b.eventTs?new Date(b.eventTs).getTime():0)-(a.eventTs?new Date(a.eventTs).getTime():0));
  return out;
}
function unreadCount(items, lastSeen){const ls=lastSeen?new Date(lastSeen).getTime():0;return items.filter((i)=>i.eventTs&&new Date(i.eventTs).getTime()>ls).length;}
function buildCopilotContext(data){
  const {employees,shifts,leaves,documents,sites,alerts}=data;
  const now=new Date();
  const r1=(n)=>Math.round(n*10)/10;
  const agents=employees.map((e)=>{
    const h=monthlyHours(e.id,now.getFullYear(),now.getMonth(),shifts);
    const docs=documents.filter((d)=>d.employeeId===e.id).map((d)=>{const st=docStatus(d.dateExpiration);return {type:d.type,categorie:d.categorie||undefined,numero:d.numero||undefined,expire_le:d.dateExpiration||undefined,statut:st.label};});
    const vac=shifts.filter((s)=>s.employeeId===e.id&&s.date>=todayKey()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,15).map((s)=>`${s.date} ${s.debut}-${s.fin} ${s.type}${s.lieu?' @'+s.lieu:''}`);
    const cong=leaves.filter((l)=>l.employeeId===e.id).map((l)=>`${l.type} ${l.dateDebut}->${l.dateFin} (${l.statut})`);
    return {nom:`${e.prenom} ${e.nom}`,poste:e.poste,matricule:e.matricule,heures_mois_en_cours:{total:r1(h.total),normales:r1(h.normal),supplementaires:r1(h.supp),nuit:r1(h.night),dimanche:r1(h.sunday),feries:r1(h.holiday)},documents:docs,vacations_a_venir:vac,conges:cong};
  });
  return {date_du_jour:todayKey(),sites:(sites||[]).map((s)=>s.nom),demandes_de_renfort:(alerts||[]).map((a)=>`${a.date} ${a.lieu||''} ${a.message||''}`.trim()),agents};
}
function NotifRow({n, onClick}){
  const Ico=n.icon;
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className="flex items-start gap-3 p-3.5 transition hover:border-slate-700">
        <div className={`rounded-xl p-2 ${docBg(n.tone)}`}><Ico size={18}/></div>
        <div className="flex-1"><p className="font-semibold text-white">{n.title}</p><p className="text-xs text-slate-400">{n.text}</p></div>
        {n.action&&<ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-500"/>}
      </Card>
    </button>
  );
}
function compressImage(file,maxDim=1200,quality=0.6){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=(e)=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;if(w>=h&&w>maxDim){h=Math.round(h*maxDim/w);w=maxDim;}else if(h>maxDim){w=Math.round(w*maxDim/h);h=maxDim;}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality));};img.onerror=reject;img.src=e.target.result;};reader.onerror=reject;reader.readAsDataURL(file);});}
function normDate(s){if(!s)return null;s=s.trim();let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);if(m){let[,d,mo,y]=m;if(y.length===2)y='20'+y;return`${y}-${pad(+mo)}-${pad(+d)}`;}m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);if(m){const[,y,mo,d]=m;return`${y}-${pad(+mo)}-${pad(+d)}`;}return null;}

/* ──────────────────────── UI PRIMITIVES ──────────────────────── */
function Btn({variant='primary',className='',children,...rest}){
  const base='inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-95 disabled:opacity-40 disabled:active:scale-100 px-4 py-2.5 text-sm';
  const st={primary:'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-500/20',secondary:'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',danger:'bg-rose-500/90 text-white hover:bg-rose-500'};
  return <button className={`${base} ${st[variant]} ${className}`} {...rest}>{children}</button>;
}
function Field({label,children,hint}){return(<label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>{children}{hint&&<span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>);}
const inputCls='w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400';
function Card({className='',children}){return <div className={`rounded-2xl border border-slate-800 bg-slate-900/70 ${className}`}>{children}</div>;}
function Pill({tone='slate',children,className=''}){const t={slate:'bg-slate-800 text-slate-300 border-slate-700',amber:'bg-amber-400/10 text-amber-300 border-amber-400/30',emerald:'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',rose:'bg-rose-500/10 text-rose-300 border-rose-500/30',sky:'bg-sky-500/10 text-sky-300 border-sky-500/30'};return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t[tone]} ${className}`}>{children}</span>;}
function Empty({icon:Icon,title,sub}){return(<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center"><div className="mb-3 rounded-2xl bg-slate-800/60 p-3 text-slate-500"><Icon size={26}/></div><p className="font-semibold text-slate-300">{title}</p>{sub&&<p className="mt-1 max-w-xs text-sm text-slate-500">{sub}</p>}</div>);}
function Modal({open,onClose,title,children,icon:Icon}){if(!open)return null;return(<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}><div className="max-h-screen w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl" onClick={(e)=>e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">{Icon&&<Icon size={18} className="text-amber-400"/>}{title}</h3><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={20}/></button></div>{children}</div></div>);}
function SectionTitle({icon:Icon,children,right}){return(<div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display text-base font-bold text-white">{Icon&&<Icon size={18} className="text-amber-400"/>}{children}</h2>{right}</div>);}
const dot=(c)=><span className={`h-1.5 w-1.5 rounded-full ${c}`}/>;
const statutTone=(s)=>s==='Approuvé'?'emerald':s==='Refusé'?'rose':'amber';

/* ── Cellule du calendrier ── */
function CalendarCell({d, tk, selectedKey, onDayClick, renderDay}) {
  const k = dateKey(d);
  const isToday = k === tk;
  const isSel = k === selectedKey;
  return (
    <button onClick={() => onDayClick && onDayClick(k, d)}
      className={`relative flex aspect-square flex-col items-center rounded-xl border p-1 text-sm transition ${isSel ? 'border-amber-400 bg-amber-400/10' : 'border-transparent hover:border-slate-700 hover:bg-slate-800/60'}`}>
      <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-amber-400 text-slate-950' : 'text-slate-200'}`}>{d.getDate()}</span>
      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">{renderDay ? renderDay(k, d) : null}</div>
    </button>
  );
}

function MonthCalendar({year,month,onPrev,onNext,renderDay,onDayClick,selectedKey}){
  const cells=monthGrid(year,month);const tk=todayKey();
  return(<Card className="p-4"><div className="mb-3 flex items-center justify-between"><button onClick={onPrev} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronLeft size={18}/></button><span className="font-display font-bold capitalize text-white">{MOIS[month]} {year}</span><button onClick={onNext} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronRight size={18}/></button></div><div className="mb-1 grid grid-cols-7 gap-1">{JOURS.map((j)=><div key={j} className="py-1 text-center text-xs font-semibold text-slate-500">{j}</div>)}</div><div className="grid grid-cols-7 gap-1">{cells.map((d,i)=>d?(<CalendarCell key={i} d={d} tk={tk} selectedKey={selectedKey} onDayClick={onDayClick} renderDay={renderDay}/>):<div key={i}/>)}</div></Card>);
}

/* ─────────────────────── SHIFT CARD (icône date) ──────────────── */
function ShiftCard({s, onDelete}) {
  const {dayAbbr, dayNum, monthAbbr, isPast, isToday} = shiftDateParts(s.date);
  return (
    <Card className={`flex items-center gap-3 p-3 ${isPast ? 'opacity-55' : ''}`}>
      <div className={`flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl border ${isToday ? 'border-amber-400 bg-amber-400/15' : isPast ? 'border-slate-700/60 bg-slate-800/40' : 'border-slate-700 bg-slate-800'}`}>
        <span className={`text-xs font-bold uppercase ${isToday ? 'text-amber-300' : 'text-slate-500'}`}>{dayAbbr}</span>
        <span className={`font-display text-xl font-extrabold leading-none ${isToday ? 'text-amber-400' : 'text-white'}`}>{dayNum}</span>
        <span className="text-xs capitalize text-slate-500">{monthAbbr}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{s.type}</p>
        {s.lieu && <p className="flex items-center gap-1 truncate text-xs text-slate-400"><MapPin size={10}/> {s.lieu}</p>}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="font-display text-sm font-bold tabular-nums text-amber-300">{s.debut}</p>
        <p className="text-xs tabular-nums text-slate-500">→ {s.fin}</p>
      </div>
      {onDelete && <button onClick={onDelete} className="flex-shrink-0 rounded-lg p-1.5 text-slate-600 hover:bg-slate-800 hover:text-rose-400"><Trash2 size={14}/></button>}
    </Card>
  );
}

/* ─────────────────────────── LOGIN ───────────────────────────── */
function Login({employees, config, onLogin, onSeedDemo}) {
  const [tab, setTab] = useState('employee');
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState('');
  const tryManager = () => { if(norm(u)===norm(config?.adminUser||'admin')&&p===(config?.adminPass||'admin'))onLogin({role:'manager'}); else setErr('Identifiant ou mot de passe incorrect.'); };
  const tryEmp = () => { const e=employees.find((x)=>norm(x.username)===norm(u)); if(!e){setErr('Identifiant inconnu.');return;} if(e.password===p)onLogin({role:'employee',employeeId:e.id}); else setErr('Mot de passe incorrect.'); };
  return (
    <div className="bsec-root flex min-h-screen flex-col items-center justify-center bg-slate-950 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"><ShieldCheck size={40} className="text-amber-400"/></div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">{config?.appName||'Buckler Security'}</h1>
          <p className="mt-1 text-sm text-slate-400">Espace personnel sécurisé</p>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-1.5">
          <button onClick={()=>{setTab('employee');setErr('');}} className={`rounded-xl py-2.5 text-sm font-semibold transition ${tab==='employee'?'bg-amber-400 text-slate-950':'text-slate-300'}`}>Salarié</button>
          <button onClick={()=>{setTab('manager');setErr('');}} className={`rounded-xl py-2.5 text-sm font-semibold transition ${tab==='manager'?'bg-amber-400 text-slate-950':'text-slate-300'}`}>Responsable / RH</button>
        </div>
        <Card className="space-y-4 p-5">
          <Field label="Identifiant"><div className="relative"><KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input className={`${inputCls} pl-9`} value={u} onChange={(e)=>{setU(e.target.value);setErr('');}} placeholder={tab==='manager'?'admin':'prenom.nom'} autoCapitalize="none"/></div></Field>
          <Field label="Mot de passe"><div className="relative"><Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input className={`${inputCls} pl-9`} type="password" value={p} onChange={(e)=>{setP(e.target.value);setErr('');}} onKeyDown={(e)=>e.key==='Enter'&&(tab==='manager'?tryManager():tryEmp())} placeholder="••••••"/></div></Field>
          {tab==='employee'&&employees.length===0&&<p className="text-sm text-slate-400">Aucun compte salarié. Le responsable crée les accès depuis son espace.</p>}
          <Btn className="w-full" onClick={tab==='manager'?tryManager:tryEmp}><LogIn size={16}/> Se connecter</Btn>
          {err&&<p className="flex items-center gap-1.5 text-sm text-rose-400"><AlertCircle size={14}/> {err}</p>}
        </Card>
        <div className="mt-5 text-center"><button onClick={onSeedDemo} className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-amber-400 hover:underline">Charger des données de démonstration</button></div>
      </div>
    </div>
  );
}

/* ── Carte document (responsable) ── */
function DocCard({d, onView, onDelete}) {
  const ds = docStatus(d.dateExpiration);
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onView(d)} disabled={!d.hasPhoto} className="flex items-start gap-3 text-left disabled:cursor-default">
          <div className={`rounded-xl p-2.5 ${docBg(ds.tone)}`}><BadgeCheck size={20}/></div>
          <div>
            <p className="font-semibold text-white">{d.type}</p>
            {d.categorie && <p className="text-xs text-sky-300">{d.categorie}</p>}
            {d.numero && <p className="text-xs text-slate-400">n° {d.numero}</p>}
            {d.dateExpiration && <p className="text-xs text-slate-400">Expire le {frDate(d.dateExpiration)}</p>}
            <div className="mt-1 flex items-center gap-2">
              <Pill tone={ds.tone}>{ds.label}</Pill>
              {d.hasPhoto && <span className="flex items-center gap-1 text-xs font-semibold text-sky-400"><Eye size={13}/> Voir</span>}
            </div>
          </div>
        </button>
        <button onClick={() => onDelete(d.id)} className="flex-shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400"><Trash2 size={16}/></button>
      </div>
    </Card>
  );
}

/* ── Carte document (salarié, lecture seule) ── */
function EmpDocCard({d, onView}) {
  const st = docStatus(d.dateExpiration);
  return (
    <button onClick={() => onView(d)} disabled={!d.hasPhoto} className="w-full text-left disabled:cursor-default">
      <Card className={`p-4 ${d.hasPhoto ? 'transition hover:border-slate-700' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2.5 ${docBg(st.tone)}`}><BadgeCheck size={20}/></div>
          <div>
            <p className="font-semibold text-white">{d.type}</p>
            {d.categorie && <p className="text-xs text-sky-300">{d.categorie}</p>}
            {d.numero && <p className="text-xs text-slate-400">n° {d.numero}</p>}
            {d.dateExpiration && <p className="text-xs text-slate-400">Expire le {frDate(d.dateExpiration)}</p>}
            <div className="mt-1.5 flex items-center gap-2">
              <Pill tone={st.tone}>{st.label}</Pill>
              {d.hasPhoto && <span className="flex items-center gap-1 text-xs font-semibold text-sky-400"><Eye size={13}/> Voir</span>}
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}

/* ───────── GRILLE PLANNING PAR SITES (façon Comète) ─────────── */
function PlanningGrid({agent, shifts, ym, onPrev, onNext}){
  const {y,m}=ym;
  const nbDays=new Date(y,m+1,0).getDate();
  const prefix=`${y}-${pad(m+1)}`;
  const ms=shifts.filter((s)=>s.employeeId===agent.id&&s.date.startsWith(prefix));
  const sites=[...new Set(ms.map((s)=>s.lieu||'Autre'))];
  const days=Array.from({length:nbDays},(_,i)=>i+1);
  const at=(site,d)=>ms.filter((s)=>(s.lieu||'Autre')===site&&Number(s.date.slice(8,10))===d);
  const dayTotal=(d)=>ms.filter((s)=>Number(s.date.slice(8,10))===d).reduce((a,s)=>a+shiftMinutes(s).total,0);
  const h=monthlyHours(agent.id,y,m,shifts);
  const sticky={position:'sticky',left:0};
  const legend=[];const seenL=new Set();
  ms.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((s)=>{const k=`${s.lieu}|${s.type}|${s.debut}|${s.fin}`;if(!seenL.has(k)){seenL.add(k);legend.push(s);}});
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onPrev} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronLeft size={18}/></button>
        <span className="font-display font-bold capitalize text-white">{MOIS[m]} {y}</span>
        <button onClick={onNext} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronRight size={18}/></button>
      </div>
      {ms.length===0?<Empty icon={Calendar} title="Aucune vacation ce mois"/>:(
        <div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="border-collapse">
              <thead>
                <tr className="bg-slate-900">
                  <th style={sticky} className="z-10 bg-slate-900 px-2 py-1 text-left text-xs font-semibold text-slate-400">Site</th>
                  {days.map((d)=>(
                    <th key={d} className={`w-11 px-0.5 py-1 text-center text-xs font-semibold ${new Date(y,m,d).getDay()===0?'text-amber-300':'text-slate-400'}`}>{JOURS_COURT[new Date(y,m,d).getDay()][0]}<br/>{pad(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map((site)=>(
                  <tr key={site} className="border-t border-slate-800">
                    <td style={sticky} className="z-10 bg-slate-900 px-2 py-1 text-xs font-semibold text-white">{site}</td>
                    {days.map((d)=>(
                      <td key={d} className={`w-11 border-l border-slate-800/50 px-0.5 py-1 text-center align-top ${new Date(y,m,d).getDay()===0?'bg-amber-400/5':''}`}>
                        {at(site,d).map((s)=>(<div key={s.id} className="leading-tight text-amber-300" style={{fontSize:'10px'}}>{s.debut}<br/>{s.fin}</div>))}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-slate-700 bg-slate-900/70">
                  <td style={sticky} className="z-10 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-300">Total/j</td>
                  {days.map((d)=>(
                    <td key={d} className="w-11 border-l border-slate-800/50 px-0.5 py-1 text-center" style={{fontSize:'10px'}}>{dayTotal(d)>0?<span className="font-bold text-white">{Math.round(dayTotal(d)*10)/10}</span>:<span className="text-slate-700">·</span>}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill>Services {ms.length}</Pill>
            <Pill tone="amber">Travaillées {fmtH(h.total)}</Pill>
            <Pill tone="sky">Nuit {fmtH(h.night)}</Pill>
            <Pill>Dimanche {fmtH(h.sunday)}</Pill>
            <Pill tone={h.holiday>0?'rose':'slate'}>Férié {fmtH(h.holiday)}</Pill>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Détail des vacations</p>
            {legend.map((s)=>(<p key={s.id} className="text-xs text-slate-400"><span className="font-semibold text-slate-300">{s.lieu||'Autre'}</span> — {s.type} de {s.debut} à {s.fin}</p>))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── FICHE AGENT : planning + documents ─────────── */
function AgentProfile({agent, data, actions, onBack}) {
  const {shifts, leaves, documents, logs, sites} = data;
  const [shiftFilter, setShiftFilter] = useState('upcoming');
  const [planView, setPlanView] = useState('grille');
  const [gridYm, setGridYm] = useState({y:new Date().getFullYear(), m:new Date().getMonth()});
  const [sendOpen, setSendOpen] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [photoView, setPhotoView] = useState(null);
  const blankShift = {date:todayKey(), debut:'08:00', fin:'20:00', lieu:'', type:'Poste fixe'};
  const [shiftForm, setShiftForm] = useState(blankShift);
  const blankDoc = {type:'Carte professionnelle (CNAPS)', numero:'', categorie:'', dateDelivrance:'', dateExpiration:'', photo:null};
  const [docForm, setDocForm] = useState(blankDoc);
  const [savingDoc, setSavingDoc] = useState(false);
  const shiftWarns = shiftWarnings(agent.id, shiftForm, shifts, leaves);
  const isCarte = docForm.type.startsWith('Carte professionnelle');

  const tk = todayKey();
  const now = new Date();
  const stt = currentStatus(agent.id, logs);
  const monthPrefix = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  const monthCount = shifts.filter((s)=>s.employeeId===agent.id&&s.date.startsWith(monthPrefix)).length;
  const upLeaves = leaves.filter((l)=>l.employeeId===agent.id&&l.dateFin>=tk);
  const agentDocs = documents.filter((d)=>d.employeeId===agent.id);
  const renewCount = agentDocs.map((d)=>docStatus(d.dateExpiration)).filter((x)=>x.days!==null&&x.days<=RENEW_DAYS).length;
  const myShifts = shifts.filter((s)=>s.employeeId===agent.id);
  const filtered = (shiftFilter==='upcoming'?myShifts.filter((s)=>s.date>=tk):shiftFilter==='past'?myShifts.filter((s)=>s.date<tk):myShifts)
    .sort((a,b)=>shiftFilter==='past'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  const groups = groupShifts(filtered);

  const saveShift = () => { actions.addShift({...shiftForm,id:uid(),employeeId:agent.id}); setShiftModal(false); };
  const gPrev=()=>setGridYm((s)=>s.m===0?{y:s.y-1,m:11}:{y:s.y,m:s.m-1});
  const gNext=()=>setGridYm((s)=>s.m===11?{y:s.y+1,m:0}:{y:s.y,m:s.m+1});
  const pickPhoto = async(file)=>{ if(!file)return; try{const url=await compressImage(file);setDocForm((f)=>({...f,photo:url}));}catch(e){alert("Impossible de lire l'image.");} };
  const saveDoc = async()=>{ setSavingDoc(true);const id=uid();await actions.addDocument({id,employeeId:agent.id,type:docForm.type,numero:docForm.numero.trim(),categorie:docForm.type.startsWith('Carte professionnelle')?docForm.categorie:'',dateDelivrance:docForm.dateDelivrance,dateExpiration:docForm.dateExpiration,hasPhoto:!!docForm.photo},docForm.photo);setDocForm(blankDoc);setDocModal(false);setSavingDoc(false); };
  const viewPhoto = async(d)=>{ if(!d.hasPhoto)return;setPhotoView({loading:true,type:d.type});const url=await actions.getDocPhoto(d.id);setPhotoView({loading:false,url,type:d.type}); };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-amber-400"><ChevronLeft size={16}/> Retour</button>

      {/* Identité */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-800 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 font-display text-lg font-bold text-amber-300">{agent.prenom[0]}{agent.nom[0]}</div>
          <div className="flex-1"><p className="font-display text-lg font-bold text-white">{agent.prenom} {agent.nom}</p><p className="text-sm text-slate-400">{agent.poste}</p></div>
          {stt.onDuty?<Pill tone="emerald"><ShieldCheck size={12}/> En service</Pill>:<Pill><CircleDot size={12}/> Hors service</Pill>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
          <div className="flex items-center gap-2 text-slate-300"><Hash size={14} className="text-slate-500"/> {agent.matricule}</div>
          <div className="flex items-center gap-2 text-slate-300"><KeyRound size={14} className="text-slate-500"/> {agent.username}</div>
          {agent.telephone&&<a href={`tel:${agent.telephone}`} className="flex items-center gap-2 text-sky-400"><Phone size={14}/> {agent.telephone}</a>}
          {agent.email&&<div className="flex items-center gap-2 truncate text-slate-300"><FileText size={14} className="text-slate-500"/> {agent.email}</div>}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center"><p className="font-display text-2xl font-extrabold text-white">{monthCount}</p><p className="text-xs text-slate-400">Vac. ce mois</p></Card>
        <Card className="p-3 text-center"><p className="font-display text-2xl font-extrabold text-white">{upLeaves.length}</p><p className="text-xs text-slate-400">Congés à venir</p></Card>
        <Card className="p-3 text-center"><p className={`font-display text-2xl font-extrabold ${renewCount?'text-rose-400':'text-white'}`}>{renewCount}</p><p className="text-xs text-slate-400">Docs à renouv.</p></Card>
      </div>

      {/* Planning */}
      <div>
        <SectionTitle icon={CalendarDays} right={<div className="flex gap-1.5"><Btn variant="secondary" onClick={()=>setSendOpen(true)} title="Envoyer le planning"><Send size={16}/></Btn><Btn onClick={()=>{setShiftForm(blankShift);setShiftModal(true);}}><Plus size={16}/> Vacation</Btn></div>}>Planning</SectionTitle>
        <div className="mb-3 flex gap-1.5">
          {[['grille','Par sites'],['liste','Liste']].map(([k,l])=>(
            <button key={k} onClick={()=>setPlanView(k)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${planView===k?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-800 text-slate-400 hover:border-slate-700'}`}>{l}</button>
          ))}
        </div>
        {planView==='grille'?(
          <PlanningGrid agent={agent} shifts={shifts} ym={gridYm} onPrev={gPrev} onNext={gNext}/>
        ):(
          <div>
            <div className="mb-3 flex gap-1.5">
              {[['upcoming','À venir'],['past','Passées'],['all','Toutes']].map(([k,l])=>(
                <button key={k} onClick={()=>setShiftFilter(k)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${shiftFilter===k?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-800 text-slate-400 hover:border-slate-700'}`}>{l}</button>
              ))}
            </div>
            {filtered.length===0?(
              <Empty icon={Calendar} title={shiftFilter==='upcoming'?'Aucune vacation à venir':'Aucune vacation'} sub="Touche + Vacation pour en affecter une."/>
            ):(
              <div className="space-y-4">{groups.map((g)=>(
                <div key={g.key}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 capitalize">{g.label}</p>
                  <div className="space-y-2">{g.list.map((s)=><ShiftCard key={s.id} s={s} onDelete={()=>actions.removeShift(s.id)}/>)}</div>
                </div>
              ))}</div>
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <SectionTitle icon={BadgeCheck} right={<Btn onClick={()=>{setDocForm(blankDoc);setDocModal(true);}}><Plus size={16}/> Document</Btn>}>Documents & diplômes</SectionTitle>
        {agentDocs.length===0?<Empty icon={BadgeCheck} title="Aucun document" sub="Ajoute la carte pro, le SST, le SSIAP…"/>:(
          <div className="space-y-2">{agentDocs.map((d) => <DocCard key={d.id} d={d} onView={viewPhoto} onDelete={(id)=>{if(confirm('Supprimer ce document ?'))actions.removeDocument(id);}}/>)}</div>
        )}
      </div>

      {/* Modals */}
      <Modal open={shiftModal} onClose={()=>setShiftModal(false)} title={`Vacation — ${agent.prenom} ${agent.nom}`} icon={CalendarPlus}>
        <div className="space-y-3">
          <Field label="Date"><input type="date" className={inputCls} value={shiftForm.date} onChange={(e)=>setShiftForm({...shiftForm,date:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début"><input type="time" className={inputCls} value={shiftForm.debut} onChange={(e)=>setShiftForm({...shiftForm,debut:e.target.value})}/></Field>
            <Field label="Fin"><input type="time" className={inputCls} value={shiftForm.fin} onChange={(e)=>setShiftForm({...shiftForm,fin:e.target.value})}/></Field>
          </div>
          <Field label="Type"><select className={inputCls} value={shiftForm.type} onChange={(e)=>setShiftForm({...shiftForm,type:e.target.value})}>{['Poste fixe','Ronde','Événementiel','Accueil / filtrage','PC sécurité','Renfort','Cynophile'].map((t)=><option key={t}>{t}</option>)}</select></Field>
          <Field label="Lieu / site"><SitePicker sites={sites} value={shiftForm.lieu} onPick={(nom)=>setShiftForm({...shiftForm,lieu:nom})}/><input className={inputCls} value={shiftForm.lieu} onChange={(e)=>setShiftForm({...shiftForm,lieu:e.target.value})} placeholder="ex : Studio 44…"/></Field>
          <WarnBox warns={shiftWarns}/>
          <Btn className="w-full" onClick={saveShift}><Check size={16}/> Affecter</Btn>
        </div>
      </Modal>

      <Modal open={sendOpen} onClose={()=>setSendOpen(false)} title="Envoyer le planning" icon={Send}>
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Planning de <span className="font-semibold text-white">{MOIS[gridYm.m]} {gridYm.y}</span> pour {agent.prenom} {agent.nom}.</p>
          {agent.email?(
            <a href={`mailto:${agent.email}?subject=${encodeURIComponent('Planning '+MOIS[gridYm.m]+' '+gridYm.y)}&body=${encodeURIComponent(planningText(agent,shifts,gridYm))}`} className="flex items-center gap-2 rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-300 hover:bg-sky-500/25"><FileText size={16}/> Par email ({agent.email})</a>
          ):<p className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 text-sm text-slate-400">Pas d'email renseigné pour cet agent.</p>}
          {agent.telephone&&(
            <a href={`https://wa.me/${agent.telephone.replace(/\D/g,'').replace(/^0/,'33')}?text=${encodeURIComponent(planningText(agent,shifts,gridYm))}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25"><Phone size={16}/> Par WhatsApp</a>
          )}
          <button onClick={()=>{try{navigator.clipboard.writeText(planningText(agent,shifts,gridYm));alert('Planning copié.');}catch(e){alert('Copie indisponible dans cet aperçu.');}}} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"><FileText size={16}/> Copier le texte</button>
          <p className="text-xs text-slate-500">Sur ton téléphone, ces boutons ouvrent directement Mail / WhatsApp. L'envoi automatique à toute l'équipe viendra avec le déploiement.</p>
        </div>
      </Modal>

      <Modal open={docModal} onClose={()=>setDocModal(false)} title={`Document — ${agent.prenom} ${agent.nom}`} icon={BadgeCheck}>
        <div className="space-y-3">
          <Field label="Type"><select className={inputCls} value={docForm.type} onChange={(e)=>setDocForm({...docForm,type:e.target.value})}>{['Carte professionnelle (CNAPS)','SST','MAC SST','SSIAP 1','SSIAP 2','SSIAP 3','Recyclage SSIAP','Habilitation électrique','CQP APS','Permis de conduire','Autre'].map((t)=><option key={t}>{t}</option>)}</select></Field>
          {isCarte&&<Field label="Catégorie CNAPS / APS"><select className={inputCls} value={docForm.categorie} onChange={(e)=>setDocForm({...docForm,categorie:e.target.value})}><option value="">— Sélectionner —</option>{APS_CATEGORIES.map((c)=><option key={c}>{c}</option>)}</select></Field>}
          <Field label="Numéro (optionnel)"><input className={inputCls} value={docForm.numero} onChange={(e)=>setDocForm({...docForm,numero:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Délivré le"><input type="date" className={inputCls} value={docForm.dateDelivrance} onChange={(e)=>setDocForm({...docForm,dateDelivrance:e.target.value})}/></Field>
            <Field label="Expire le"><input type="date" className={inputCls} value={docForm.dateExpiration} onChange={(e)=>setDocForm({...docForm,dateExpiration:e.target.value})}/></Field>
          </div>
          <Field label="Photo / scan (optionnel)">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 px-4 py-4 text-sm font-semibold text-slate-300 hover:border-amber-400">
              <Camera size={18}/> {docForm.photo?'Changer la photo':'Prendre / choisir une photo'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>pickPhoto(e.target.files?.[0])}/>
            </label>
            {docForm.photo&&<img src={docForm.photo} alt="aperçu" className="mt-2 max-h-40 rounded-xl border border-slate-800"/>}
          </Field>
          <Btn className="w-full" onClick={saveDoc} disabled={savingDoc}>{savingDoc?<><RefreshCw size={16} className="animate-spin"/> Enregistrement…</>:<><Check size={16}/> Enregistrer</>}</Btn>
        </div>
      </Modal>

      <Modal open={!!photoView} onClose={()=>setPhotoView(null)} title={photoView?.type||'Document'} icon={Eye}>
        {photoView?.loading?<div className="flex justify-center py-10"><RefreshCw className="animate-spin text-amber-400" size={24}/></div>
          :photoView?.url?<img src={photoView.url} alt="document" className="w-full rounded-xl border border-slate-800"/>
          :<p className="py-6 text-center text-sm text-slate-400">Image introuvable.</p>}
      </Modal>
    </div>
  );
}

/* ── Frise horaire : barre d'une vacation + agenda d'un site ── */
function DayBar({s, name, winStart, winSpan, onDelete}){
  const toMin=(t)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
  let a=toMin(s.debut), b=toMin(s.fin); const cross=b<=a; if(cross)b=1440;
  const left=Math.max(0,Math.min(96,((a-winStart)/winSpan)*100));
  const width=Math.max(4,Math.min(100-left,((b-a)/winSpan)*100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-white">{name}</span>
        <span className="flex-shrink-0 text-xs tabular-nums text-slate-400">{s.debut}–{s.fin}{cross?' +1j':''} · {s.type}</span>
      </div>
      <button onClick={onDelete} className="relative block h-6 w-full overflow-hidden rounded-lg bg-slate-800/60" title="Supprimer cette vacation">
        <span className="absolute top-0 h-6 rounded-lg bg-amber-400" style={{left:left+'%',width:width+'%'}}></span>
      </button>
    </div>
  );
}
function SiteAgenda({site, list, empName, winStart, winSpan, onDelete}){
  const total=list.reduce((a,s)=>a+shiftMinutes(s).total,0);
  return (
    <Card className="p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><MapPin size={15} className="flex-shrink-0 text-amber-400"/><p className="truncate font-semibold text-white">{site}</p></div>
        <Pill tone="amber">{list.length} · {fmtH(total)}</Pill>
      </div>
      <div className="space-y-2.5">
        {list.map((s)=><DayBar key={s.id} s={s} name={empName(s.employeeId)} winStart={winStart} winSpan={winSpan} onDelete={()=>onDelete(s.id)}/>)}
      </div>
    </Card>
  );
}

/* ─────────────── PLANNING GLOBAL (vue journée + CSV) ────────── */
function PlanningManager({data, actions}) {
  const {employees, shifts, leaves, sites, documents} = data;
  const now = new Date();
  const [ym, setYm] = useState({y:now.getFullYear(),m:now.getMonth()});
  const [sel, setSel] = useState(todayKey());
  const [modal, setModal] = useState(false);
  const [imp, setImp] = useState(false);
  const blank = {employeeId:'',date:sel,debut:'08:00',fin:'20:00',lieu:'',type:'Poste fixe'};
  const [form, setForm] = useState(blank);
  const [preview, setPreview] = useState(null);
  const [renfort, setRenfort] = useState(false);
  const [rForm, setRForm] = useState({date:todayKey(),lieu:'',message:''});
  const sendRenfort=()=>{actions.addAlert({id:uid(),date:rForm.date,lieu:rForm.lieu.trim(),message:rForm.message.trim(),createdAt:new Date().toISOString()});setRenfort(false);alert('Demande de renfort envoyée à tous les agents.');};
  const prev=()=>setYm((s)=>s.m===0?{y:s.y-1,m:11}:{y:s.y,m:s.m-1});
  const next=()=>setYm((s)=>s.m===11?{y:s.y+1,m:0}:{y:s.y,m:s.m+1});
  const empName=(id)=>{const e=employees.find((x)=>x.id===id);return e?`${e.prenom} ${e.nom}`:'—';};
  const dayShifts=shifts.filter((s)=>s.date===sel).sort((a,b)=>a.debut.localeCompare(b.debut));
  const sitesOfDay=[...new Set(dayShifts.map((s)=>s.lieu||'Autre'))];
  const agentsCount=new Set(dayShifts.map((s)=>s.employeeId)).size;
  const toMinP=(t)=>{const [h,mm]=t.split(':').map(Number);return h*60+mm;};
  const fmtMin=(x)=>`${pad(Math.floor(x/60))}:${pad(x%60)}`;
  let _mn=24*60,_mx=0; dayShifts.forEach((s)=>{let a=toMinP(s.debut),b=toMinP(s.fin);if(b<=a)b=1440;_mn=Math.min(_mn,a);_mx=Math.max(_mx,b);});
  if(dayShifts.length===0){_mn=6*60;_mx=22*60;}
  _mn=Math.floor(_mn/60)*60;_mx=Math.ceil(_mx/60)*60;
  const winStart=_mn,winSpan=Math.max(60,_mx-_mn);
  const _base=new Date(sel+'T00:00:00');const _mon=new Date(_base);_mon.setDate(_base.getDate()-((_base.getDay()+6)%7));
  const week=[...Array(7)].map((_,i)=>{const d=new Date(_mon);d.setDate(_mon.getDate()+i);return dateKey(d);});
  const goWeek=(delta)=>{const d=new Date(sel+'T00:00:00');d.setDate(d.getDate()+delta);setSel(dateKey(d));};
  const [genOpen,setGenOpen]=useState(false);
  const [genPrompt,setGenPrompt]=useState('');
  const [genBusy,setGenBusy]=useState(false);
  const [genResult,setGenResult]=useState(null);
  const [genErr,setGenErr]=useState('');
  const genContext=()=>{
    const ag=employees.map((e)=>{
      const hh=monthlyHours(e.id,now.getFullYear(),now.getMonth(),shifts);
      const quals=documents.filter((d)=>d.employeeId===e.id).map((d)=>d.type+(d.categorie?` (${d.categorie})`:''));
      const cong=leaves.filter((l)=>l.employeeId===e.id&&l.statut!=='Refusé').map((l)=>`${l.dateDebut}->${l.dateFin}`);
      return {employeeId:e.id,nom:`${e.prenom} ${e.nom}`,poste:e.poste,qualifications:quals,heures_planifiees_ce_mois:Math.round(hh.total*10)/10,conges:cong};
    });
    return {date_du_jour:todayKey(),sites:sites.map((s)=>s.nom),agents:ag};
  };
  const generate=async()=>{
    if(!genPrompt.trim()||genBusy)return;
    if(!employees.length){alert("Ajoute d'abord des salariés.");return;}
    setGenBusy(true);setGenErr('');setGenResult(null);
    try{
      const sys=`Tu es un planificateur pour une société de sécurité privée française. À partir de la demande et des données (agents avec leur employeeId, qualifications, heures déjà planifiées ce mois, congés ; sites ; date du jour), génère un planning.\nRègles strictes : utilise UNIQUEMENT les employeeId fournis ; n'affecte jamais un agent un jour où il est en congé ; ne dépasse pas 48h par semaine et par agent ; répartis équitablement entre agents ; respecte les qualifications demandées si précisé. Horaires au format HH:MM (24h). Si la demande ne précise pas l'année, utilise l'année en cours.\nRéponds STRICTEMENT en JSON, sans aucun texte ni balise de code, sous la forme exacte : {"vacations":[{"employeeId":"...","date":"YYYY-MM-DD","debut":"HH:MM","fin":"HH:MM","lieu":"...","type":"..."}]}\n\nDonnées :\n${JSON.stringify(genContext())}`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:sys,messages:[{role:'user',content:genPrompt.trim()}]})});
      const j=await res.json();
      const txt=(j.content||[]).map((c)=>c.type==='text'?c.text:'').join('').trim();
      let parsed;try{parsed=JSON.parse(txt.replace(/```json/gi,'').replace(/```/g,'').trim());}catch(e){parsed=null;}
      const arr=parsed?(Array.isArray(parsed)?parsed:(parsed.vacations||[])):[];
      const valid=[];
      arr.forEach((it)=>{
        const emp=employees.find((e)=>e.id===it.employeeId);
        if(!emp)return;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(it.date||''))return;
        if(!/^\d{1,2}:\d{2}$/.test(it.debut||'')||!/^\d{1,2}:\d{2}$/.test(it.fin||''))return;
        const cand={id:uid(),employeeId:it.employeeId,date:it.date,debut:it.debut,fin:it.fin,lieu:(it.lieu||'').toString(),type:(it.type||'Vacation').toString()};
        valid.push({...cand,_name:`${emp.prenom} ${emp.nom}`,warns:shiftWarnings(it.employeeId,cand,shifts,leaves)});
      });
      if(valid.length===0)setGenErr("L'IA n'a pas renvoyé de vacations exploitables. Reformule ta demande (dates, sites, agents).");
      setGenResult(valid);
    }catch(e){setGenErr("Impossible de générer le planning pour le moment. Réessaie.");}
    setGenBusy(false);
  };
  const confirmGen=async()=>{if(genResult&&genResult.length){await actions.addShifts(genResult.map(({_name,warns,...s})=>s));}setGenOpen(false);setGenResult(null);setGenPrompt('');};
  const openAdd=()=>{if(!employees.length){alert("Ajoute d'abord des salariés.");return;}setForm({...blank,date:sel,employeeId:employees[0].id});setModal(true);};
  const save=()=>{if(!form.employeeId)return;actions.addShift({...form,id:uid()});setModal(false);};
  const matchEmp=(token)=>{const t=norm(token);return employees.find((e)=>norm(e.matricule)===t)||employees.find((e)=>norm(e.username)===t)||employees.find((e)=>norm(`${e.prenom} ${e.nom}`)===t)||employees.find((e)=>norm(`${e.nom} ${e.prenom}`)===t);};
  const lc=(row)=>{const o={};Object.keys(row).forEach((k)=>{o[norm(k)]=row[k];});return o;};
  const handleFile=(file)=>{if(!file)return;const reader=new FileReader();reader.onload=(e)=>{const parsed=Papa.parse(e.target.result,{header:true,skipEmptyLines:true});const ok=[],ko=[];parsed.data.forEach((raw,i)=>{const r=lc(raw);const token=r['agent']||r['salarie']||r['nom']||r['matricule']||'';const date=normDate(r['date']);const debut=(r['debut']||r['début']||r['heure debut']||'').trim();const fin=(r['fin']||r['heure fin']||'').trim();const emp=matchEmp(token);if(emp&&date&&debut&&fin)ok.push({id:uid(),employeeId:emp.id,date,debut,fin,lieu:(r['lieu']||r['site']||'').trim(),type:(r['type']||'Vacation').trim(),_name:`${emp.prenom} ${emp.nom}`});else ko.push({line:i+2,token,raison:!emp?'agent introuvable':!date?'date invalide':'horaires manquants'});});setPreview({ok,ko});};reader.readAsText(file,'UTF-8');};
  const confirmImport=async()=>{if(preview?.ok?.length){await actions.addShifts(preview.ok.map(({_name,...s})=>s));}setImp(false);setPreview(null);};
  const downloadTemplate=()=>{const csv='Agent;Date;Debut;Fin;Lieu;Type\nBS-001;15/06/2026;08:00;20:00;Studio 44;Poste fixe\nprenom.nom;16/06/2026;20:00;06:00;Entrepot Nord;Ronde\n';try{const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modele-planning.csv';a.click();}catch(e){alert('Colonnes attendues :\nAgent ; Date ; Debut ; Fin ; Lieu ; Type');}};

  return (
    <div className="space-y-4">
      <SectionTitle icon={CalendarDays} right={<div className="flex gap-1.5"><Btn variant="secondary" onClick={()=>{setRForm({date:sel,lieu:'',message:''});setRenfort(true);}} title="Demande de renfort"><ShieldAlert size={16}/> Renfort</Btn><Btn variant="secondary" onClick={()=>{setImp(true);setPreview(null);}} title="Importer un planning"><Upload size={16}/></Btn></div>}>Planning</SectionTitle>
      <button onClick={()=>{setGenOpen(true);setGenResult(null);setGenErr('');}} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/20"><Sparkles size={16}/> Générer le planning (IA)</button>
      <div className="flex items-center gap-1.5">
        <button onClick={()=>goWeek(-7)} className="flex-shrink-0 rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronLeft size={18}/></button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {week.map((k)=>(
            <button key={k} onClick={()=>setSel(k)} className={`rounded-xl border py-1.5 text-center transition ${k===sel?'border-amber-400 bg-amber-400/10':'border-slate-800 hover:border-slate-700'}`}>
              <p className={`text-xs ${k===todayKey()?'font-bold text-amber-300':'text-slate-400'}`}>{JOURS_COURT[new Date(k+'T00:00:00').getDay()][0]}</p>
              <p className={`font-display text-sm font-bold ${k===sel?'text-white':'text-slate-300'}`}>{Number(k.slice(8,10))}</p>
              <span className={`mx-auto mt-0.5 block h-1 w-1 rounded-full ${shifts.some((s)=>s.date===k)?'bg-amber-400':'bg-transparent'}`}></span>
            </button>
          ))}
        </div>
        <button onClick={()=>goWeek(7)} className="flex-shrink-0 rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronRight size={18}/></button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><h3 className="truncate font-display font-bold capitalize text-white">{frDate(sel)}</h3><p className="text-xs text-slate-400">{dayShifts.length} vacation(s) · {agentsCount} agent(s) · {sitesOfDay.length} site(s)</p></div>
        <Btn onClick={openAdd}><Plus size={16}/> Vacation</Btn>
      </div>
      {dayShifts.length===0?<Empty icon={Calendar} title="Aucune vacation ce jour" sub="Ajoute une vacation ou importe le planning Comète."/>:(
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Frise horaire : {fmtMin(winStart)} → {fmtMin(winStart+winSpan)}</p>
          {sitesOfDay.map((site)=><SiteAgenda key={site} site={site} list={dayShifts.filter((s)=>(s.lieu||'Autre')===site)} empName={empName} winStart={winStart} winSpan={winSpan} onDelete={(id)=>{if(confirm('Supprimer cette vacation ?'))actions.removeShift(id);}}/>)}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Affecter une vacation" icon={CalendarPlus}>
        <div className="space-y-3">
          <Field label="Salarié"><select className={inputCls} value={form.employeeId} onChange={(e)=>setForm({...form,employeeId:e.target.value})}>{employees.map((e)=><option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}</select></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Début"><input type="time" className={inputCls} value={form.debut} onChange={(e)=>setForm({...form,debut:e.target.value})}/></Field><Field label="Fin"><input type="time" className={inputCls} value={form.fin} onChange={(e)=>setForm({...form,fin:e.target.value})}/></Field></div>
          <Field label="Type"><select className={inputCls} value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>{['Poste fixe','Ronde','Événementiel','Accueil / filtrage','PC sécurité','Renfort','Cynophile'].map((t)=><option key={t}>{t}</option>)}</select></Field>
          <Field label="Lieu / site"><SitePicker sites={sites} value={form.lieu} onPick={(nom)=>setForm({...form,lieu:nom})}/><input className={inputCls} value={form.lieu} onChange={(e)=>setForm({...form,lieu:e.target.value})} placeholder="ex : Studio 44, Boutique Dior…"/></Field>
          <WarnBox warns={shiftWarnings(form.employeeId, form, shifts, leaves)}/>
          <Btn className="w-full" onClick={save}><Check size={16}/> Affecter</Btn>
        </div>
      </Modal>
      <Modal open={imp} onClose={()=>{setImp(false);setPreview(null);}} title="Importer un planning" icon={Upload}>
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Exporte depuis <span className="font-semibold text-white">Comète</span> en CSV puis charge-le ici.</p>
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 text-xs text-slate-300"><code>Agent ; Date ; Debut ; Fin ; Lieu ; Type</code><p className="mt-1 text-slate-500">« Agent » = matricule, identifiant ou « Prénom Nom ».</p></div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:underline"><Download size={15}/> Télécharger le modèle</button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 px-4 py-6 text-sm font-semibold text-slate-300 hover:border-amber-400"><Upload size={18}/> Choisir un fichier CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>handleFile(e.target.files?.[0])}/></label>
          {preview&&(
            <div className="space-y-2">
              <div className="flex gap-2"><Pill tone="emerald">{preview.ok.length} vacation(s) reconnue(s)</Pill>{preview.ko.length>0&&<Pill tone="rose">{preview.ko.length} ligne(s) ignorée(s)</Pill>}</div>
              {preview.ok.length>0&&<div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-2">{preview.ok.slice(0,30).map((s)=><p key={s.id} className="text-xs text-slate-300">{frDateShort(s.date)} · {s.debut}-{s.fin} · {s._name}{s.lieu?` · ${s.lieu}`:''}</p>)}</div>}
              {preview.ko.length>0&&<div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/5 p-2">{preview.ko.slice(0,20).map((k,i)=><p key={i} className="text-xs text-rose-300">Ligne {k.line} : « {k.token||'?'} » — {k.raison}</p>)}</div>}
              {preview.ok.length>0&&<Btn className="w-full" onClick={confirmImport}><Check size={16}/> Importer {preview.ok.length} vacation(s)</Btn>}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={renfort} onClose={()=>setRenfort(false)} title="Demande de renfort" icon={ShieldAlert}>
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Diffuse une demande de renfort à tous les agents. Ils la reçoivent en notification et peuvent se signaler disponibles.</p>
          <Field label="Date"><input type="date" className={inputCls} value={rForm.date} onChange={(e)=>setRForm({...rForm,date:e.target.value})}/></Field>
          <Field label="Site / lieu"><SitePicker sites={sites} value={rForm.lieu} onPick={(nom)=>setRForm({...rForm,lieu:nom})}/><input className={inputCls} value={rForm.lieu} onChange={(e)=>setRForm({...rForm,lieu:e.target.value})} placeholder="ex : Louis Vuitton"/></Field>
          <Field label="Message"><textarea className={`${inputCls} h-20 resize-none`} value={rForm.message} onChange={(e)=>setRForm({...rForm,message:e.target.value})} placeholder="ex : 2 agents pour soldes, 9h-19h"/></Field>
          <Btn className="w-full" onClick={sendRenfort}><ShieldAlert size={16}/> Envoyer à tous</Btn>
        </div>
      </Modal>

      <Modal open={genOpen} onClose={()=>setGenOpen(false)} title="Générer le planning (IA)" icon={Sparkles}>
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Décris le besoin : l'IA propose un planning conforme (congés respectés, max 48h/sem, réparti). Tu vérifies avant d'ajouter.</p>
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-xs text-slate-400">
            <p><span className="font-semibold text-slate-300">Sites : </span>{sites.length?sites.map((s)=>s.nom).join(', '):'aucun'}</p>
            <p><span className="font-semibold text-slate-300">Agents : </span>{employees.length?employees.map((e)=>e.prenom).join(', '):'aucun'}</p>
          </div>
          <textarea rows={4} value={genPrompt} onChange={(e)=>setGenPrompt(e.target.value)} placeholder="ex : Couvre Boutique Dior du 16 au 22 avril, 8h-20h du lundi au samedi, et Chanel le samedi 9h-19h. Répartis entre Karim, Sophie et Yacine." className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400"/>
          {!genResult&&<Btn className="w-full" onClick={generate} disabled={genBusy}>{genBusy?<><RefreshCw size={16} className="animate-spin"/> Génération…</>:<><Sparkles size={16}/> Générer</>}</Btn>}
          {genErr&&<p className="flex items-center gap-1.5 text-sm text-rose-400"><AlertCircle size={14}/> {genErr}</p>}
          {genResult&&genResult.length>0&&(
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">{genResult.length} vacation(s) proposée(s)</p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {genResult.map((s)=>(
                  <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-white">{s._name}</span><span className="flex-shrink-0 text-xs tabular-nums text-slate-400">{frDateShort(s.date)} · {s.debut}-{s.fin}</span></div>
                    <p className="text-xs text-slate-400">{s.type}{s.lieu?' · '+s.lieu:''}</p>
                    {s.warns.map((w,i)=>(<p key={i} className={`mt-1 flex items-center gap-1 text-xs ${w.tone==='rose'?'text-rose-400':'text-amber-300'}`}><AlertTriangle size={11}/> {w.text}</p>))}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Btn variant="secondary" className="flex-1" onClick={()=>{setGenResult(null);setGenErr('');}}>Modifier</Btn>
                <Btn className="flex-1" onClick={confirmGen}><Check size={16}/> Ajouter</Btn>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────────────── CONGÉS MANAGER ─────────────────────── */
function LeavesManager({data, actions}) {
  const {leaves, employees} = data;
  const [filter, setFilter] = useState('En attente');
  const empName=(id)=>{const e=employees.find((x)=>x.id===id);return e?`${e.prenom} ${e.nom}`:'Inconnu';};
  const list=leaves.filter((l)=>filter==='Tous'?true:l.statut===filter).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return(
    <div className="space-y-4">
      <SectionTitle icon={FileText}>Demandes de congé</SectionTitle>
      <div className="flex gap-2 overflow-x-auto pb-1">{['En attente','Approuvé','Refusé','Tous'].map((f)=><button key={f} onClick={()=>setFilter(f)} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${filter===f?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-800 text-slate-400'}`}>{f}</button>)}</div>
      {list.length===0?<Empty icon={FileText} title="Aucune demande"/>:(
        <div className="space-y-2">{list.map((l)=>(
          <Card key={l.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2"><p className="font-semibold text-white">{empName(l.employeeId)}</p><Pill tone={statutTone(l.statut)}>{l.statut}</Pill></div>
                <p className="mt-0.5 text-sm text-slate-300">{l.type}</p>
                <p className="text-xs text-slate-400">{frDate(l.dateDebut)} → {frDate(l.dateFin)}</p>
                {l.motif&&<p className="mt-1 text-xs italic text-slate-500">« {l.motif} »</p>}
              </div>
              {l.statut==='En attente'&&(
                <div className="flex flex-col gap-1.5">
                  <button onClick={()=>actions.setLeaveStatus(l.id,'Approuvé')} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400 hover:bg-emerald-500/25"><Check size={16}/></button>
                  <button onClick={()=>actions.setLeaveStatus(l.id,'Refusé')} className="rounded-lg bg-rose-500/15 p-2 text-rose-400 hover:bg-rose-500/25"><X size={16}/></button>
                </div>
              )}
            </div>
          </Card>
        ))}</div>
      )}
    </div>
  );
}

/* ─────────────────────── DISPONIBILITÉS (responsable) ───────── */
function DispoRow({a, employees, leaves, day}){
  const e=employees.find((x)=>x.id===a.employeeId);
  if(!e)return null;
  const busy=leaves.some((l)=>l.employeeId===e.id&&l.statut==='Approuvé'&&day>=l.dateDebut&&day<=l.dateFin);
  return (
    <Card className="flex items-center justify-between p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 font-display font-bold text-emerald-300">{e.prenom[0]}{e.nom[0]}</div>
        <div>
          <p className="font-semibold text-white">{e.prenom} {e.nom}</p>
          <p className="text-xs text-slate-400">{e.poste}</p>
          {a.note&&<p className="text-xs italic text-slate-500">« {a.note} »</p>}
          {busy&&<Pill tone="rose" className="mt-1">Déjà en congé approuvé</Pill>}
        </div>
      </div>
      {e.telephone&&<a href={`tel:${e.telephone}`} className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400 hover:bg-emerald-500/25"><Phone size={18}/></a>}
    </Card>
  );
}
function DispoManager({data}){
  const {avail, employees, leaves} = data;
  const [day,setDay]=useState(todayKey());
  const dispoDay=avail.filter((a)=>a.date===day);
  const next7=[];for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()+i);const k=dateKey(d);next7.push({k,count:avail.filter((a)=>a.date===k).length});}
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Les agents signalent leurs jours dispo (heures supp.) depuis leur espace. Retrouve-les ici pour un renfort.</p>
      <Card className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Aperçu 7 jours</p>
        <div className="flex gap-1.5">{next7.map((d)=>(
          <button key={d.k} onClick={()=>setDay(d.k)} className={`flex-1 rounded-xl border py-2 text-center transition ${day===d.k?'border-amber-400 bg-amber-400/10':'border-slate-800'}`}>
            <p className="text-xs text-slate-400">{frDateShort(d.k)}</p>
            <p className={`font-display text-lg font-bold ${d.count>0?'text-amber-300':'text-slate-600'}`}>{d.count}</p>
          </button>
        ))}</div>
      </Card>
      <Field label="Choisir une date"><input type="date" className={inputCls} value={day} onChange={(e)=>setDay(e.target.value)}/></Field>
      <div>
        <h3 className="mb-2 font-display font-bold capitalize text-white">Disponibles le {frDate(day)}</h3>
        {dispoDay.length===0?<Empty icon={CalendarPlus} title="Personne de disponible ce jour"/>:(
          <div className="space-y-2">{dispoDay.map((a)=><DispoRow key={a.id} a={a} employees={employees} leaves={leaves} day={day}/>)}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── PAIE (calcul heures) ───────────────── */
function PayrollChip({label, value, tone}){
  return (
    <div className="rounded-xl bg-slate-800/60 px-1.5 py-2 text-center">
      <p className={`font-display text-sm font-bold ${tone||'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
function PayrollView({data}){
  const {employees, shifts} = data;
  const now = new Date();
  const [ym, setYm] = useState({y:now.getFullYear(), m:now.getMonth()});
  const prev=()=>setYm((s)=>s.m===0?{y:s.y-1,m:11}:{y:s.y,m:s.m-1});
  const next=()=>setYm((s)=>s.m===11?{y:s.y+1,m:0}:{y:s.y,m:s.m+1});
  const rows = employees.map((e)=>({e, h:monthlyHours(e.id, ym.y, ym.m, shifts)}));
  const tot = rows.reduce((a,r)=>({total:a.total+r.h.total, supp:a.supp+r.h.supp, night:a.night+r.h.night, sunday:a.sunday+r.h.sunday, holiday:a.holiday+r.h.holiday}), {total:0,supp:0,night:0,sunday:0,holiday:0});
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={prev} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronLeft size={18}/></button>
          <span className="font-display font-bold capitalize text-white">{MOIS[ym.m]} {ym.y}</span>
          <button onClick={next} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><ChevronRight size={18}/></button>
        </div>
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Total entreprise</p>
        <div className="grid grid-cols-5 gap-1.5">
          <PayrollChip label="Total" value={fmtH(tot.total)} tone="text-amber-300"/>
          <PayrollChip label="Supp." value={fmtH(tot.supp)} tone={tot.supp>0?'text-amber-300':'text-white'}/>
          <PayrollChip label="Nuit" value={fmtH(tot.night)}/>
          <PayrollChip label="Dim." value={fmtH(tot.sunday)}/>
          <PayrollChip label="Fériés" value={fmtH(tot.holiday)} tone={tot.holiday>0?'text-rose-300':'text-white'}/>
        </div>
      </Card>
      {employees.length===0?<Empty icon={Users} title="Aucun salarié" sub="Crée des comptes pour calculer les heures."/>:rows.map(({e,h})=>(
        <Card key={e.id} className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 font-display text-sm font-bold text-amber-300">{e.prenom[0]}{e.nom[0]}</div>
              <div><p className="font-semibold text-white">{e.prenom} {e.nom}</p><p className="text-xs text-slate-400">{h.count} vacation(s)</p></div>
            </div>
            <div className="text-right"><p className="font-display text-lg font-extrabold text-white">{fmtH(h.total)}</p><p className="text-xs text-slate-500">ce mois</p></div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <PayrollChip label="Normales" value={fmtH(h.normal)}/>
            <PayrollChip label="Supp." value={fmtH(h.supp)} tone={h.supp>0?'text-amber-300':'text-slate-600'}/>
            <PayrollChip label="Nuit" value={fmtH(h.night)} tone={h.night>0?'text-sky-300':'text-slate-600'}/>
            <PayrollChip label="Dim." value={fmtH(h.sunday)} tone={h.sunday>0?'text-white':'text-slate-600'}/>
            <PayrollChip label="Fériés" value={fmtH(h.holiday)} tone={h.holiday>0?'text-rose-300':'text-slate-600'}/>
          </div>
        </Card>
      ))}
      <p className="text-center text-xs text-slate-500">Calculé sur le planning · nuit 21h–6h · heures supp. au-delà de 35h/semaine · jours fériés FR · indicatif.</p>
    </div>
  );
}
function TimeView({data}){
  const [sub, setSub] = useState('pointages');
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {[['pointages','Pointages'],['paie','Paie'],['dispos','Dispos']].map(([k,l])=>(
          <button key={k} onClick={()=>setSub(k)} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${sub===k?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-800 text-slate-400'}`}>{l}</button>
        ))}
      </div>
      {sub==='pointages'?<PointagesManager data={data}/>:sub==='paie'?<PayrollView data={data}/>:<DispoManager data={data}/>}
    </div>
  );
}

/* ─────────────────────── POINTAGES MANAGER ──────────────────── */
function PointagesManager({data}) {
  const {logs, employees} = data;
  const [f, setF] = useState('');
  const empName=(id)=>{const e=employees.find((x)=>x.id===id);return e?`${e.prenom} ${e.nom}`:'Inconnu';};
  const list=logs.filter((l)=>f?l.employeeId===f:true).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,100);
  return(
    <div className="space-y-4">
      <SectionTitle icon={Clock}>Pointages</SectionTitle>
      <Field label="Filtrer par salarié"><select className={inputCls} value={f} onChange={(e)=>setF(e.target.value)}><option value="">Tous les salariés</option>{employees.map((e)=><option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}</select></Field>
      {list.length===0?<Empty icon={Clock} title="Aucun pointage"/>:(
        <div className="space-y-2">{list.map((l)=>(
          <Card key={l.id} className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2 ${l.type==='Prise'?'bg-emerald-500/15 text-emerald-400':'bg-rose-500/15 text-rose-400'}`}>{l.type==='Prise'?<LogIn size={18}/>:<LogOut size={18}/>}</div>
                <div>
                  <p className="font-semibold text-white">{empName(l.employeeId)}</p>
                  <p className="text-xs text-slate-400">{l.type} de service · {frDateTime(l.timestamp)}</p>
                  {l.lat!=null?<a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><MapPin size={12}/> {l.lat}, {l.lng}</a>:<p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500"><MapPin size={12}/> Position non disponible</p>}
                </div>
              </div>
              <Pill tone={l.type==='Prise'?'emerald':'rose'}>{l.type}</Pill>
            </div>
          </Card>
        ))}</div>
      )}
    </div>
  );
}

/* ─────────────────────────── SALARIÉS ───────────────────────── */
function StaffView({data, actions}) {
  const {employees} = data;
  const [modal, setModal] = useState(null); const [q, setQ] = useState('');
  const blank={prenom:'',nom:'',poste:'Agent de sécurité',telephone:'',email:'',matricule:'',username:'',password:'',dateEmbauche:''};
  const [form, setForm] = useState(blank);
  const open=(emp)=>{setForm(emp?{...emp}:blank);setModal(emp?{mode:'edit',id:emp.id}:{mode:'add'});};
  const autoUser=()=>norm(`${form.prenom}.${form.nom}`).replace(/\s+/g,'');
  const save=()=>{
    if(!form.prenom.trim()||!form.nom.trim())return;
    const username=(form.username.trim()||autoUser());
    if(!username){alert('Identifiant requis.');return;}
    if(!form.password||form.password.length<4){alert('Mot de passe : 4 caractères minimum.');return;}
    const dup=employees.find((e)=>norm(e.username)===norm(username)&&e.id!==modal.id);
    if(dup){alert('Cet identifiant est déjà utilisé.');return;}
    const matricule=form.matricule.trim()||`BS-${String(employees.length+1).padStart(3,'0')}`;
    if(modal.mode==='add')actions.addEmployee({...form,username,matricule,id:uid()});
    else actions.updateEmployee(modal.id,{...form,username,matricule});
    setModal(null);
  };
  const filtered=employees.filter((e)=>`${e.prenom} ${e.nom} ${e.poste} ${e.matricule} ${e.username}`.toLowerCase().includes(q.toLowerCase()));
  return(
    <div className="space-y-4">
      <SectionTitle icon={Users} right={<Btn onClick={()=>open(null)}><UserPlus size={16}/> Ajouter</Btn>}>Salariés ({employees.length})</SectionTitle>
      {employees.length>3&&<div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input className={`${inputCls} pl-9`} placeholder="Rechercher…" value={q} onChange={(e)=>setQ(e.target.value)}/></div>}
      {employees.length===0?<Empty icon={Users} title="Aucun salarié" sub="Ajoute un salarié pour lui créer un compte."/>:(
        <div className="space-y-2">{filtered.map((e)=>(
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 font-display font-bold text-amber-300">{e.prenom[0]}{e.nom[0]}</div>
                <div>
                  <p className="font-semibold text-white">{e.prenom} {e.nom}</p>
                  <p className="text-xs text-slate-400">{e.poste}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5"><Pill><Hash size={11}/> {e.matricule}</Pill><Pill tone="sky"><KeyRound size={11}/> {e.username}</Pill></div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={()=>open(e)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><Pencil size={16}/></button>
                <button onClick={()=>{if(confirm(`Supprimer ${e.prenom} ${e.nom} ?`))actions.removeEmployee(e.id);}} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400"><Trash2 size={16}/></button>
              </div>
            </div>
          </Card>
        ))}</div>
      )}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.mode==='edit'?'Modifier le salarié':'Nouveau salarié'} icon={UserPlus}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Field label="Prénom"><input className={inputCls} value={form.prenom} onChange={(e)=>setForm({...form,prenom:e.target.value})}/></Field><Field label="Nom"><input className={inputCls} value={form.nom} onChange={(e)=>setForm({...form,nom:e.target.value})}/></Field></div>
          <Field label="Poste"><select className={inputCls} value={form.poste} onChange={(e)=>setForm({...form,poste:e.target.value})}>{['Agent de sécurité','Agent SSIAP 1','Agent SSIAP 2','Chef de poste','Agent cynophile','Agent événementiel','Rondier','Opérateur PC'].map((p)=><option key={p}>{p}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Téléphone"><input className={inputCls} value={form.telephone} onChange={(e)=>setForm({...form,telephone:e.target.value})}/></Field><Field label="Matricule" hint="auto si vide"><input className={inputCls} value={form.matricule} onChange={(e)=>setForm({...form,matricule:e.target.value})}/></Field></div>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></Field>
          <Field label="Date d'embauche"><input type="date" className={inputCls} value={form.dateEmbauche} onChange={(e)=>setForm({...form,dateEmbauche:e.target.value})}/></Field>
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300"><Lock size={12}/> Accès personnel du salarié</p>
            <div className="grid grid-cols-2 gap-3"><Field label="Identifiant" hint="auto : prenom.nom"><input className={inputCls} autoCapitalize="none" value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})} placeholder={autoUser()}/></Field><Field label="Mot de passe" hint="4 caractères min."><input className={inputCls} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="ex : 1234"/></Field></div>
          </div>
          <Btn className="w-full" onClick={save}><Check size={16}/> Enregistrer</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────────────────── SITES ──────────────────────────── */
function SitePicker({sites, value, onPick}){
  if(!sites||sites.length===0)return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {sites.map((s)=>(
        <button key={s.id} type="button" onClick={()=>onPick(s.nom)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${value===s.nom?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-700 text-slate-300 hover:border-slate-600'}`}>{s.nom}</button>
      ))}
    </div>
  );
}
function SiteCard({s, agents, onEdit, onDelete}){
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300"><MapPin size={20}/></div>
          <div><p className="font-semibold text-white">{s.nom}</p>{s.adresse&&<p className="text-xs text-slate-400">{s.adresse}</p>}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button onClick={onEdit} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><Pencil size={16}/></button>
          <button onClick={onDelete} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400"><Trash2 size={16}/></button>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        {s.responsable&&<div className="flex items-center gap-2 text-slate-300"><Users size={13} className="text-slate-500"/> {s.responsable}</div>}
        {s.telephone&&<a href={`tel:${s.telephone}`} className="flex items-center gap-2 text-sky-400"><Phone size={13}/> {s.telephone}</a>}
        {s.consignes&&<div className="flex items-start gap-2 text-slate-400"><FileText size={13} className="mt-0.5 flex-shrink-0 text-slate-500"/><span>{s.consignes}</span></div>}
      </div>
      <div className="mt-3 border-t border-slate-800 pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Agents affectés (à venir)</p>
        {agents.length===0?<p className="text-xs text-slate-500">Aucun agent planifié.</p>:(
          <div className="flex flex-wrap gap-1.5">{agents.map((a)=><Pill key={a.id} tone="sky">{a.prenom} {a.nom}</Pill>)}</div>
        )}
      </div>
    </Card>
  );
}
function SitesView({data, actions}){
  const {sites, shifts, employees} = data;
  const [modal, setModal] = useState(null);
  const blank={nom:'',adresse:'',responsable:'',telephone:'',consignes:''};
  const [form, setForm] = useState(blank);
  const open=(s)=>{setForm(s?{...s}:blank);setModal(s?{mode:'edit',id:s.id}:{mode:'add'});};
  const save=()=>{if(!form.nom.trim())return;if(modal.mode==='add')actions.addSite({...form,id:uid()});else actions.updateSite(modal.id,form);setModal(null);};
  const agentsFor=(nom)=>{const tk=todayKey();const ids=new Set(shifts.filter((s)=>s.lieu===nom&&s.date>=tk).map((s)=>s.employeeId));return employees.filter((e)=>ids.has(e.id));};
  return (
    <div className="space-y-4">
      <SectionTitle icon={MapPin} right={<Btn onClick={()=>open(null)}><Plus size={16}/> Site</Btn>}>Sites ({sites.length})</SectionTitle>
      {sites.length===0?<Empty icon={MapPin} title="Aucun site" sub="Ajoute tes sites : Dior, Chanel, YSL, Louis Vuitton…"/>:(
        <div className="space-y-2">{sites.map((s)=><SiteCard key={s.id} s={s} agents={agentsFor(s.nom)} onEdit={()=>open(s)} onDelete={()=>{if(confirm('Supprimer ce site ?'))actions.removeSite(s.id);}}/>)}</div>
      )}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.mode==='edit'?'Modifier le site':'Nouveau site'} icon={MapPin}>
        <div className="space-y-3">
          <Field label="Nom du site"><input className={inputCls} value={form.nom} onChange={(e)=>setForm({...form,nom:e.target.value})} placeholder="ex : Boutique Dior"/></Field>
          <Field label="Adresse"><input className={inputCls} value={form.adresse} onChange={(e)=>setForm({...form,adresse:e.target.value})} placeholder="ex : 30 Av. Montaigne, Paris"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsable site"><input className={inputCls} value={form.responsable} onChange={(e)=>setForm({...form,responsable:e.target.value})}/></Field>
            <Field label="Téléphone"><input className={inputCls} value={form.telephone} onChange={(e)=>setForm({...form,telephone:e.target.value})}/></Field>
          </div>
          <Field label="Consignes"><textarea className={`${inputCls} h-24 resize-none`} value={form.consignes} onChange={(e)=>setForm({...form,consignes:e.target.value})} placeholder="ex : Tenue costume. Filtrage entrée VIP. Pas de photo."/></Field>
          <Btn className="w-full" onClick={save}><Check size={16}/> Enregistrer</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────────────── COPILOTE IA ────────────────────────── */
function CopilotView({data, onClose}){
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  useEffect(()=>{ if(scroller.current) scroller.current.scrollTop=scroller.current.scrollHeight; },[msgs,busy]);
  const suggestions=[
    "Combien d'heures supplémentaires ce mois, et pour qui ?",
    "Quelles cartes professionnelles expirent bientôt ?",
    "Qui est qualifié SSIAP 1 et a le moins d'heures cette semaine ?",
    "Résume la situation de l'équipe et les points d'alerte.",
  ];
  const ask=async(q)=>{
    const question=(q||input).trim();
    if(!question||busy)return;
    const next=[...msgs,{role:'user',content:question}];
    setMsgs(next); setInput(''); setBusy(true);
    try{
      const ctx=buildCopilotContext(data);
      const sys=`Tu es l'assistant IA de la société de sécurité privée Buckler Security. Réponds en français, de façon concise et professionnelle, en t'appuyant UNIQUEMENT sur les données JSON fournies. Les heures sont calculées sur le planning : travail de nuit 21h-6h, heures supplémentaires au-delà de 35h par semaine, jours fériés français. Donne des chiffres précis, cite les noms des agents, et signale les risques (carte professionnelle expirée ou bientôt expirée, dépassement des 48h légales par semaine, conflit de planning, congé en cours). Si une information n'est pas dans les données, dis-le clairement. N'invente jamais d'information.\n\nDonnées actuelles (JSON) :\n${JSON.stringify(ctx)}`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:next.map((m)=>({role:m.role,content:m.content}))})});
      const j=await res.json();
      const text=(j.content||[]).map((c)=>c.type==='text'?c.text:'').join('\n').trim()||"Je n'ai pas pu générer de réponse.";
      setMsgs((m)=>[...m,{role:'assistant',content:text}]);
    }catch(e){
      setMsgs((m)=>[...m,{role:'assistant',content:"Erreur : impossible de contacter l'IA pour le moment. Réessaie."}]);
    }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><ChevronLeft size={22}/></button>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-1.5"><Sparkles size={18} className="text-amber-400"/></div>
          <div><p className="font-display text-sm font-bold text-white">Assistant IA</p><p className="text-xs text-slate-400">Heures · planning · CNAPS · congés</p></div>
        </div>
      </div>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length===0&&(
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Pose une question sur ton équipe : heures, planning, cartes professionnelles, disponibilités… Je réponds à partir de tes données.</div>
            <div className="space-y-2">{suggestions.map((s,i)=>(
              <button key={i} onClick={()=>ask(s)} className="flex w-full items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-2.5 text-left text-sm text-slate-200 hover:border-amber-400/40"><Sparkles size={14} className="flex-shrink-0 text-amber-400"/> {s}</button>
            ))}</div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
            <div style={{maxWidth:'85%'}} className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role==='user'?'bg-amber-400 text-slate-950':'border border-slate-800 bg-slate-900 text-slate-100'}`}>{m.content}</div>
          </div>
        ))}
        {busy&&<div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-400"><RefreshCw size={14} className="animate-spin text-amber-400"/> L'IA réfléchit…</div></div>}
      </div>
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-end gap-2">
          <textarea rows={1} value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}}} placeholder="Écris ta question…" className="max-h-32 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400"/>
          <button onClick={()=>ask()} disabled={busy||!input.trim()} className="flex-shrink-0 rounded-xl bg-amber-400 p-3 text-slate-950 transition hover:bg-amber-300 disabled:opacity-40"><Send size={18}/></button>
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-500">Réponses générées par IA — à vérifier avant décision.</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── RÉGLAGES ───────────────────────── */
function SettingsView({actions, config}) {
  const [u,setU]=useState(config?.adminUser||'admin');const [p,setP]=useState('');const [name,setName]=useState(config?.appName||'Buckler Security');const [msg,setMsg]=useState('');
  return(
    <div className="space-y-4">
      <SectionTitle icon={Settings}>Réglages</SectionTitle>
      <Card className="space-y-3 p-4">
        <Field label="Nom de l'application"><input className={inputCls} value={name} onChange={(e)=>setName(e.target.value)}/></Field>
        <Field label="Identifiant responsable"><input className={inputCls} autoCapitalize="none" value={u} onChange={(e)=>setU(e.target.value)}/></Field>
        <Field label="Nouveau mot de passe" hint="laisse vide pour ne pas changer"><input className={inputCls} value={p} onChange={(e)=>setP(e.target.value)} placeholder="••••••"/></Field>
        <Btn onClick={async()=>{await actions.saveConfig({appName:name.trim()||'Buckler Security',adminUser:u.trim()||'admin',...(p?{adminPass:p}:{})});setP('');setMsg('Réglages enregistrés ✓');}}><Check size={16}/> Enregistrer</Btn>
        {msg&&<p className="text-sm text-emerald-400">{msg}</p>}
      </Card>
      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-200">Données</p>
        <p className="text-xs text-slate-400">Maquette : données partagées entre tous ceux qui ouvrent l'application.</p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={actions.seedDemo}><RefreshCw size={16}/> Charger la démo</Btn>
          <Btn variant="danger" onClick={()=>{if(confirm('Tout effacer ?'))actions.resetAll();}}><Trash2 size={16}/> Réinitialiser</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ ESPACE SALARIÉ ══════════════════════════ */
function EmployeeHome({me, data, goTo}) {
  const {logs, shifts, documents} = data;
  const st=currentStatus(me.id,logs);
  const tShifts=shifts.filter((s)=>s.employeeId===me.id&&s.date===todayKey()).sort((a,b)=>a.debut.localeCompare(b.debut));
  const myRenew=documents.filter((d)=>d.employeeId===me.id).map((d)=>({d,st:docStatus(d.dateExpiration)})).filter((x)=>x.st.days!==null&&x.st.days<=RENEW_DAYS);
  return(
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-800 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 font-display text-lg font-bold text-amber-300">{me.prenom[0]}{me.nom[0]}</div>
          <div><p className="font-display text-lg font-bold text-white">{me.prenom} {me.nom}</p><p className="text-sm text-slate-400">{me.poste} · {me.matricule}</p></div>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">{st.onDuty?<><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"/></span><span className="font-semibold text-emerald-400">En service</span></>:<><CircleDot size={12} className="text-slate-500"/><span className="font-semibold text-slate-400">Hors service</span></>}</div>
          {st.since&&<span className="text-xs text-slate-500">depuis {frHeure(st.since)}</span>}
        </div>
      </Card>
      {myRenew.length>0&&(
        <button onClick={()=>goTo('docs')} className="w-full text-left">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5"><AlertTriangle size={20} className="text-amber-300"/><div className="flex-1"><p className="text-sm font-semibold text-amber-200">{myRenew.length} document(s) à renouveler</p><p className="text-xs text-amber-300/70">{myRenew.map((x)=>x.d.type).join(', ')}</p></div><ChevronRight size={18} className="text-amber-300"/></div>
        </button>
      )}
      <div>
        <SectionTitle icon={CalendarDays}>Mon service aujourd'hui</SectionTitle>
        {tShifts.length===0?<Empty icon={Calendar} title="Pas de vacation prévue aujourd'hui"/>:(
          <div className="space-y-2">{tShifts.map((s)=><ShiftCard key={s.id} s={s}/>)}</div>
        )}
      </div>
    </div>
  );
}

function EmployeePointage({me, data, actions}) {
  const {logs} = data;
  const st=currentStatus(me.id,logs);
  const [busy,setBusy]=useState(false);const [fb,setFb]=useState(null);const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  const myLogs=logs.filter((l)=>l.employeeId===me.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,12);
  const punch=async()=>{setBusy(true);setFb(null);const type=st.onDuty?'Fin':'Prise';const pos=await getPosition();await actions.addLog({id:uid(),employeeId:me.id,type,timestamp:new Date().toISOString(),lat:pos.ok?pos.lat:null,lng:pos.ok?pos.lng:null,accuracy:pos.ok?pos.accuracy:null});setFb(pos.ok?{ok:true,text:`${type} de service enregistrée avec votre position.`}:{ok:false,text:`${type} enregistrée, mais position indisponible (${pos.reason}).`});setBusy(false);};
  return(
    <div className="space-y-5">
      <Card className="flex flex-col items-center p-6 text-center">
        <p className="font-display text-4xl font-extrabold tabular-nums text-white">{pad(now.getHours())}:{pad(now.getMinutes())}<span className="text-slate-600">:{pad(now.getSeconds())}</span></p>
        <p className="mt-1 text-sm capitalize text-slate-400">{frDate(todayKey())}</p>
        <div className="my-5">{st.onDuty?<Pill tone="emerald"><ShieldCheck size={13}/> En service depuis {frHeure(st.since)}</Pill>:<Pill><CircleDot size={13}/> Hors service</Pill>}</div>
        <button onClick={punch} disabled={busy} className={`flex h-40 w-40 flex-col items-center justify-center rounded-full text-white shadow-2xl transition active:scale-95 disabled:opacity-60 ${st.onDuty?'bg-rose-500 shadow-rose-500/30 hover:bg-rose-400':'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400'}`}>
          {busy?<RefreshCw size={34} className="animate-spin"/>:(st.onDuty?<LogOut size={38}/>:<LogIn size={38}/>)}
          <span className="mt-2 px-4 text-center text-sm font-bold leading-tight">{busy?'Localisation…':st.onDuty?'Terminer le service':'Prendre mon service'}</span>
        </button>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Navigation size={12}/> Position enregistrée automatiquement</p>
        {fb&&<div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${fb.ok?'bg-emerald-500/10 text-emerald-300':'bg-amber-500/10 text-amber-300'}`}>{fb.ok?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {fb.text}</div>}
      </Card>
      <div>
        <SectionTitle icon={Clock}>Mes derniers pointages</SectionTitle>
        {myLogs.length===0?<Empty icon={Clock} title="Aucun pointage"/>:(
          <div className="space-y-2">{myLogs.map((l)=>(
            <Card key={l.id} className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3"><div className={`rounded-xl p-2 ${l.type==='Prise'?'bg-emerald-500/15 text-emerald-400':'bg-rose-500/15 text-rose-400'}`}>{l.type==='Prise'?<LogIn size={16}/>:<LogOut size={16}/>}</div><div><p className="text-sm font-semibold text-white">{l.type} de service</p><p className="text-xs text-slate-400">{frDateTime(l.timestamp)}</p></div></div>
              {l.lat!=null?<a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" className="text-sky-400"><MapPin size={16}/></a>:<MapPin size={16} className="text-slate-600"/>}
            </Card>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function EmployeePlanning({me, data}) {
  const {shifts, sites} = data;
  const now=new Date();
  const [view,setView]=useState('grille');
  const [gym,setGym]=useState({y:now.getFullYear(),m:now.getMonth()});
  const gPrev=()=>setGym((s)=>s.m===0?{y:s.y-1,m:11}:{y:s.y,m:s.m-1});
  const gNext=()=>setGym((s)=>s.m===11?{y:s.y+1,m:0}:{y:s.y,m:s.m+1});
  const [filter,setFilter]=useState('upcoming');
  const [detail,setDetail]=useState(null);
  const [aiOpen,setAiOpen]=useState(false);const [ai,setAi]=useState('');const [aiBusy,setAiBusy]=useState(false);
  const tk=todayKey();
  const mine=shifts.filter((s)=>s.employeeId===me.id);
  const upcoming=mine.filter((s)=>s.date>=tk).sort((a,b)=>a.date.localeCompare(b.date)||a.debut.localeCompare(b.debut));
  const nextShift=upcoming[0];
  const siteOf=(nom)=>sites.find((x)=>x.nom===nom);
  const openDetail=(s)=>setDetail({shift:s,site:siteOf(s.lieu)});
  const filtered=(filter==='upcoming'?mine.filter((s)=>s.date>=tk):filter==='past'?mine.filter((s)=>s.date<tk):mine).sort((a,b)=>filter==='past'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  const groups=groupShifts(filtered);
  const askAI=async()=>{
    setAiOpen(true); if(ai||aiBusy)return; setAiBusy(true);
    try{
      const h=monthlyHours(me.id,gym.y,gym.m,shifts);
      const prefix=`${gym.y}-${pad(gym.m+1)}`;
      const list=mine.filter((s)=>s.date.startsWith(prefix)).sort((a,b)=>a.date.localeCompare(b.date)).map((s)=>`${s.date} ${s.debut}-${s.fin} ${s.type}${s.lieu?' @'+s.lieu:''}`);
      const r1=(n)=>Math.round(n*10)/10;
      const ctx={mois:`${MOIS[gym.m]} ${gym.y}`,agent:`${me.prenom} ${me.nom}`,heures:{total:r1(h.total),normales:r1(h.normal),supplementaires:r1(h.supp),nuit:r1(h.night),dimanche:r1(h.sunday),feries:r1(h.holiday)},nombre_vacations:list.length,vacations:list,prochaine:nextShift?`${nextShift.date} ${nextShift.debut} @${nextShift.lieu||''}`:'aucune'};
      const sys=`Tu es l'assistant de l'agent de sécurité. À partir du JSON de SON planning du mois, écris un résumé clair et bienveillant en français, en 3 ou 4 phrases courtes, en le tutoyant. Mentionne le total d'heures et le nombre de vacations, les heures de nuit et de dimanche s'il y en a, les sites principaux, et rappelle sa prochaine vacation. Termine par un conseil bienveillant si pertinent (ex: beaucoup d'heures de nuit, pense à récupérer). N'invente aucune donnée.\n\nDonnées:\n${JSON.stringify(ctx)}`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system:sys,messages:[{role:'user',content:'Résume mon mois.'}]})});
      const j=await res.json();
      setAi((j.content||[]).map((c)=>c.type==='text'?c.text:'').join('\n').trim()||"Résumé indisponible.");
    }catch(e){setAi("Impossible de générer le résumé pour le moment.");}
    setAiBusy(false);
  };
  return (
    <div className="space-y-4">
      <SectionTitle icon={CalendarDays}>Mon planning</SectionTitle>

      {nextShift&&(
        <button onClick={()=>openDetail(nextShift)} className="w-full text-left">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Prochaine vacation</p><ChevronRight size={16} className="text-amber-300"/></div>
            <p className="mt-1 font-display text-lg font-bold capitalize text-white">{frDate(nextShift.date)}</p>
            <p className="text-sm text-slate-300">{nextShift.debut}–{nextShift.fin} · {nextShift.type}{nextShift.lieu?` · ${nextShift.lieu}`:''}</p>
          </div>
        </button>
      )}

      <div>
        <button onClick={askAI} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/20"><Sparkles size={16}/> Mon mois en clair (IA)</button>
        {aiOpen&&(
          <Card className="mt-2 p-3.5">
            {aiBusy?<div className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw size={14} className="animate-spin text-amber-400"/> L'IA prépare ton résumé…</div>:<p className="whitespace-pre-wrap text-sm text-slate-200">{ai}</p>}
            <p className="mt-2 text-xs text-slate-500">Généré par IA — à titre indicatif.</p>
          </Card>
        )}
      </div>

      <div className="flex gap-1.5">
        {[['grille','Par sites'],['liste','Liste']].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${view===k?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-800 text-slate-400'}`}>{l}</button>
        ))}
      </div>

      {view==='grille'?(
        <PlanningGrid agent={me} shifts={shifts} ym={gym} onPrev={gPrev} onNext={gNext}/>
      ):(
        <div>
          <div className="mb-3 flex gap-1.5">
            {[['upcoming','À venir'],['past','Passées'],['all','Toutes']].map(([k,l])=>(<button key={k} onClick={()=>setFilter(k)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${filter===k?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-800 text-slate-400'}`}>{l}</button>))}
          </div>
          {filtered.length===0?<Empty icon={Calendar} title="Aucune vacation" sub="Tes prochaines vacations s'affichent ici."/>:(
            <div className="space-y-4">{groups.map((g)=>(
              <div key={g.key}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 capitalize">{g.label}</p>
                <div className="space-y-2">{g.list.map((s)=><button key={s.id} onClick={()=>openDetail(s)} className="block w-full text-left"><ShiftCard s={s}/></button>)}</div>
              </div>
            ))}</div>
          )}
        </div>
      )}

      <Modal open={!!detail} onClose={()=>setDetail(null)} title="Détail de la vacation" icon={CalendarDays}>
        {detail&&(
          <div className="space-y-3">
            <Card className="p-3.5">
              <p className="font-display text-lg font-bold capitalize text-white">{frDate(detail.shift.date)}</p>
              <p className="text-sm text-slate-300">{detail.shift.debut}–{detail.shift.fin} · {detail.shift.type}</p>
            </Card>
            {detail.site?(
              <Card className="space-y-2 p-3.5">
                <div className="flex items-center gap-2"><MapPin size={15} className="text-amber-400"/><p className="font-semibold text-white">{detail.site.nom}</p></div>
                {detail.site.adresse&&<p className="text-sm text-slate-400">{detail.site.adresse}</p>}
                {detail.site.consignes&&<div className="rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-sm text-slate-300"><span className="font-semibold text-slate-200">Consignes : </span>{detail.site.consignes}</div>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {detail.site.adresse&&<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.site.adresse)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/25"><Navigation size={15}/> Y aller</a>}
                  {detail.site.telephone&&<a href={`tel:${detail.site.telephone}`} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25"><Phone size={15}/> {detail.site.responsable||'Responsable site'}</a>}
                </div>
              </Card>
            ):(detail.shift.lieu?(
              <Card className="p-3.5">
                <div className="flex items-center gap-2"><MapPin size={15} className="text-slate-500"/><p className="text-sm text-slate-300">{detail.shift.lieu}</p></div>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.shift.lieu)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-300"><Navigation size={15}/> Y aller</a>
              </Card>
            ):<p className="text-sm text-slate-400">Aucun lieu précisé pour cette vacation.</p>)}
          </div>
        )}
      </Modal>
    </div>
  );
}

function EmployeeDocuments({me, data, actions}) {
  const {documents} = data;
  const mine=documents.filter((d)=>d.employeeId===me.id);
  const [photoView,setPhotoView]=useState(null);
  const viewPhoto=async(d)=>{if(!d.hasPhoto)return;setPhotoView({loading:true,type:d.type});const url=await actions.getDocPhoto(d.id);setPhotoView({loading:false,url,type:d.type});};
  return(
    <div className="space-y-4">
      <SectionTitle icon={BadgeCheck}>Mes documents</SectionTitle>
      <p className="-mt-2 text-sm text-slate-400">Gérés par le service RH. Touche un document pour voir le scan.</p>
      {mine.length===0?<Empty icon={BadgeCheck} title="Aucun document" sub="Vos documents seront ajoutés par les ressources humaines."/>:(
        <div className="space-y-2">{mine.map((d) => <EmpDocCard key={d.id} d={d} onView={viewPhoto}/>)}</div>
      )}
      <Modal open={!!photoView} onClose={()=>setPhotoView(null)} title={photoView?.type||'Document'} icon={Eye}>
        {photoView?.loading?<div className="flex justify-center py-10"><RefreshCw className="animate-spin text-amber-400" size={24}/></div>:photoView?.url?<img src={photoView.url} alt="document" className="w-full rounded-xl border border-slate-800"/>:<p className="py-6 text-center text-sm text-slate-400">Image introuvable.</p>}
      </Modal>
    </div>
  );
}

function EmployeeLeaves({me, data, actions}) {
  const {leaves} = data;
  const [modal,setModal]=useState(false);
  const blank={type:'Congé payé',dateDebut:todayKey(),dateFin:todayKey(),motif:''};
  const [form,setForm]=useState(blank);
  const mine=leaves.filter((l)=>l.employeeId===me.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const submit=()=>{if(form.dateFin<form.dateDebut){alert('La date de fin doit être après le début.');return;}actions.addLeave({...form,id:uid(),employeeId:me.id,statut:'En attente',createdAt:new Date().toISOString()});setForm(blank);setModal(false);};
  return(
    <div className="space-y-4">
      <SectionTitle icon={FileText} right={<Btn onClick={()=>{setForm(blank);setModal(true);}}><Plus size={16}/> Demander</Btn>}>Mes congés</SectionTitle>
      {mine.length===0?<Empty icon={FileText} title="Aucune demande" sub="Touche « Demander » pour déposer une demande."/>:(
        <div className="space-y-2">{mine.map((l)=>(
          <Card key={l.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div><div className="flex items-center gap-2"><p className="font-semibold text-white">{l.type}</p><Pill tone={statutTone(l.statut)}>{l.statut}</Pill></div><p className="mt-0.5 text-xs text-slate-400">{frDate(l.dateDebut)} → {frDate(l.dateFin)}</p>{l.motif&&<p className="mt-1 text-xs italic text-slate-500">« {l.motif} »</p>}</div>
              {l.statut==='En attente'&&<button onClick={()=>{if(confirm('Annuler cette demande ?'))actions.removeLeave(l.id);}} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400"><Trash2 size={16}/></button>}
            </div>
          </Card>
        ))}</div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Demande de congé" icon={CalendarPlus}>
        <div className="space-y-3">
          <Field label="Type"><select className={inputCls} value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>{['Congé payé','RTT','Maladie','Sans solde','Récupération'].map((t)=><option key={t}>{t}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Du"><input type="date" className={inputCls} value={form.dateDebut} onChange={(e)=>setForm({...form,dateDebut:e.target.value})}/></Field><Field label="Au"><input type="date" className={inputCls} value={form.dateFin} onChange={(e)=>setForm({...form,dateFin:e.target.value})}/></Field></div>
          <Field label="Motif (optionnel)"><textarea className={`${inputCls} h-24 resize-none`} value={form.motif} onChange={(e)=>setForm({...form,motif:e.target.value})}/></Field>
          <Btn className="w-full" onClick={submit}><Check size={16}/> Envoyer la demande</Btn>
        </div>
      </Modal>
    </div>
  );
}

function EmployeeAvail({me, data, actions}) {
  const {avail} = data;const now=new Date();
  const [ym,setYm]=useState({y:now.getFullYear(),m:now.getMonth()});
  const prev=()=>setYm((s)=>s.m===0?{y:s.y-1,m:11}:{y:s.y,m:s.m-1});
  const next=()=>setYm((s)=>s.m===11?{y:s.y+1,m:0}:{y:s.y,m:s.m+1});
  const mine=avail.filter((a)=>a.employeeId===me.id);const tk=todayKey();
  const isAvail=(k)=>mine.find((a)=>a.date===k);
  const toggle=(k)=>{if(k<tk)return;const ex=isAvail(k);if(ex)actions.removeAvail(ex.id);else actions.addAvail({id:uid(),employeeId:me.id,date:k,note:''});};
  const upcoming=[...mine].filter((a)=>a.date>=tk).sort((a,b)=>a.date.localeCompare(b.date));
  return(
    <div className="space-y-4">
      <SectionTitle icon={CalendarPlus}>Mes disponibilités</SectionTitle>
      <p className="-mt-2 text-sm text-slate-400">Touche les jours où tu es dispo pour des heures supplémentaires. Le responsable les voit directement.</p>
      <MonthCalendar year={ym.y} month={ym.m} onPrev={prev} onNext={next} onDayClick={(k)=>toggle(k)} renderDay={(k)=>isAvail(k)?<span className="rounded-full bg-emerald-500/30 px-1 text-xs font-bold text-emerald-300">✓</span>:null}/>
      <div><h3 className="mb-2 font-display font-bold text-white">Jours sélectionnés</h3>{upcoming.length===0?<Empty icon={CalendarPlus} title="Aucun jour sélectionné"/>:<div className="flex flex-wrap gap-2">{upcoming.map((a)=><button key={a.id} onClick={()=>actions.removeAvail(a.id)} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20">{frDateShort(a.date)} <X size={13}/></button>)}</div>}</div>
    </div>
  );
}

/* ─────────────────────────── DEMO ───────────────────────────── */
const DEMO = () => {
  const dk=(o)=>{const d=new Date();d.setDate(d.getDate()+o);return dateKey(d);};
  const emps=[
    {id:'e1',prenom:'Karim',nom:'Benali',poste:'Chef de poste',telephone:'0612345678',email:'k.benali@buckler.fr',matricule:'BS-001',username:'karim.benali',password:'1111',dateEmbauche:'2023-03-01'},
    {id:'e2',prenom:'Sophie',nom:'Marchand',poste:'Agent SSIAP 1',telephone:'0623456789',email:'s.marchand@buckler.fr',matricule:'BS-002',username:'sophie.marchand',password:'2222',dateEmbauche:'2024-01-15'},
    {id:'e3',prenom:'Yacine',nom:'Traoré',poste:'Agent de sécurité',telephone:'0634567890',email:'y.traore@buckler.fr',matricule:'BS-003',username:'yacine.traore',password:'3333',dateEmbauche:'2024-09-10'},
  ];
  const shifts=[
    {id:'s1',employeeId:'e1',date:dk(0),debut:'08:00',fin:'20:00',lieu:'Studio 44',type:'Poste fixe'},
    {id:'s2',employeeId:'e2',date:dk(0),debut:'14:00',fin:'22:00',lieu:'Boutique Dior',type:'Accueil / filtrage'},
    {id:'s3',employeeId:'e1',date:dk(1),debut:'20:00',fin:'06:00',lieu:'Entrepôt Nord',type:'Ronde'},
    {id:'s4',employeeId:'e3',date:dk(2),debut:'09:00',fin:'18:00',lieu:'Studio 44',type:'PC sécurité'},
    {id:'s5',employeeId:'e2',date:dk(5),debut:'08:00',fin:'20:00',lieu:'Boutique Chanel',type:'Poste fixe'},
    {id:'s6',employeeId:'e1',date:dk(-2),debut:'08:00',fin:'20:00',lieu:'Studio 44',type:'Poste fixe'},
  ];
  const leaves=[
    {id:'l1',employeeId:'e3',type:'Congé payé',dateDebut:dk(10),dateFin:dk(15),motif:'Vacances famille',statut:'En attente',createdAt:new Date().toISOString()},
    {id:'l2',employeeId:'e2',type:'RTT',dateDebut:dk(5),dateFin:dk(5),motif:'',statut:'Approuvé',createdAt:new Date().toISOString(),decidedAt:new Date(Date.now()-2*3600e3).toISOString()},
  ];
  const avail=[{id:'a1',employeeId:'e2',date:dk(1),note:'Dispo toute la journée'},{id:'a2',employeeId:'e3',date:dk(1),note:''},{id:'a3',employeeId:'e1',date:dk(3),note:'Après-midi seulement'}];
  const logs=[{id:'t1',employeeId:'e1',type:'Prise',timestamp:new Date(Date.now()-3*3600e3).toISOString(),lat:48.8566,lng:2.3522,accuracy:12}];
  const documents=[
    {id:'d1',employeeId:'e1',type:'Carte professionnelle (CNAPS)',numero:'CAR-075-2021',dateDelivrance:'2021-04-01',dateExpiration:dk(40),hasPhoto:false},
    {id:'d2',employeeId:'e1',type:'SST',numero:'',dateDelivrance:'2024-02-10',dateExpiration:dk(-12),hasPhoto:false},
    {id:'d3',employeeId:'e2',type:'SSIAP 1',numero:'SSIAP1-2023',dateDelivrance:'2023-06-01',dateExpiration:dk(150),hasPhoto:false},
    {id:'d4',employeeId:'e2',type:'Carte professionnelle (CNAPS)',numero:'CAR-075-2023',dateDelivrance:'2023-01-15',dateExpiration:dk(700),hasPhoto:false},
  ];
  const sites=[
    {id:'site1',nom:'Boutique Dior',adresse:'30 Av. Montaigne, 75008 Paris',responsable:'M. Lefèvre',telephone:'0145000001',consignes:'Tenue costume. Filtrage entrée VIP. Pas de photo en boutique.'},
    {id:'site2',nom:'Boutique Chanel',adresse:'31 Rue Cambon, 75001 Paris',responsable:'Mme Roche',telephone:'0145000002',consignes:'Accueil clientèle. Rondes toutes les heures.'},
    {id:'site3',nom:'Boutique YSL',adresse:'38 Rue du Faubourg Saint-Honoré, 75008 Paris',responsable:'M. Diallo',telephone:'0145000003',consignes:'PC sécurité au sous-sol. Contrôle des livraisons.'},
    {id:'site4',nom:'Louis Vuitton',adresse:'101 Av. des Champs-Élysées, 75008 Paris',responsable:'Mme Albert',telephone:'0145000004',consignes:'Forte affluence. Gestion de la file. Anti-vol prioritaire.'},
  ];
  const alerts=[{id:'al1',date:dk(3),lieu:'Louis Vuitton',message:'Renfort demandé pour soldes (2 agents)',createdAt:new Date(Date.now()-1*3600e3).toISOString()}];
  const stampedShifts=shifts.map((s)=>({...s,createdAt:new Date(Date.now()-90*60000).toISOString()}));
  return {emps,shifts:stampedShifts,leaves,avail,logs,documents,sites,alerts};
};

/* ════════════════════════════ APP ═══════════════════════════════ */
export default function App() {
  const [loaded,setLoaded]=useState(false);
  const [session,setSession]=useState(null);
  const [tab,setTab]=useState('planning');
  const [activeAgent,setActiveAgent]=useState(null);
  const [showSearch,setShowSearch]=useState(false);
  const [searchQ,setSearchQ]=useState('');
  const [employees,setEmployees]=useState([]);
  const [shifts,setShifts]=useState([]);
  const [leaves,setLeaves]=useState([]);
  const [avail,setAvail]=useState([]);
  const [logs,setLogs]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [sites,setSites]=useState([]);
  const [alerts,setAlerts]=useState([]);
  const [seen,setSeen]=useState({});
  const [showNotifs,setShowNotifs]=useState(false);
  const [showCopilot,setShowCopilot]=useState(false);
  const [config,setConfig]=useState({appName:'Buckler Security',adminUser:'admin',adminPass:'admin'});

  useEffect(()=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap';document.head.appendChild(link);
    const style=document.createElement('style');style.textContent=`.bsec-root,.bsec-root input,.bsec-root select,.bsec-root textarea,.bsec-root button{font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif}.font-display{font-family:'Sora','Plus Jakarta Sans',sans-serif;letter-spacing:-.02em}.bsec-root ::-webkit-scrollbar{width:7px;height:7px}.bsec-root ::-webkit-scrollbar-thumb{background:#334155;border-radius:9999px}`;document.head.appendChild(style);
    return()=>{try{document.head.removeChild(link);document.head.removeChild(style);}catch(e){}};
  },[]);

  const loadAll=async()=>{
    const[e,s,l,a,t,d,c,si,al,sn]=await Promise.all([store.get(K.emp,[]),store.get(K.shifts,[]),store.get(K.leaves,[]),store.get(K.avail,[]),store.get(K.logs,[]),store.get(K.docs,[]),store.get(K.cfg,null),store.get(K.sites,[]),store.get(K.alerts,[]),store.get(K.seen,{})]);
    setEmployees(e);setShifts(s);setLeaves(l);setAvail(a);setLogs(t);setDocuments(d);setSites(si);setAlerts(al);setSeen(sn||{});
    if(c)setConfig(c);else{const def={appName:'Buckler Security',adminUser:'admin',adminPass:'admin'};setConfig(def);await store.set(K.cfg,def);}
    setLoaded(true);
  };
  useEffect(()=>{loadAll();},[]);
  useEffect(()=>{const f=()=>loadAll();window.addEventListener('focus',f);return()=>window.removeEventListener('focus',f);},[]);

  const data={employees,shifts,leaves,avail,logs,documents,sites,alerts,seen};
  const actions={
    addEmployee:async(x)=>{const n=[...employees,x];setEmployees(n);await store.set(K.emp,n);},
    updateEmployee:async(id,p)=>{const n=employees.map((e)=>e.id===id?{...e,...p}:e);setEmployees(n);await store.set(K.emp,n);},
    removeEmployee:async(id)=>{const n=employees.filter((e)=>e.id!==id);setEmployees(n);await store.set(K.emp,n);documents.filter((d)=>d.employeeId===id).forEach((d)=>store.del(docImgKey(d.id)));const dd=documents.filter((d)=>d.employeeId!==id);setDocuments(dd);await store.set(K.docs,dd);},
    addShift:async(s)=>{const sx={createdAt:new Date().toISOString(),...s};const n=[...shifts,sx];setShifts(n);await store.set(K.shifts,n);},
    addShifts:async(arr)=>{const stamp=new Date().toISOString();const sx=arr.map((s)=>({createdAt:stamp,...s}));const n=[...shifts,...sx];setShifts(n);await store.set(K.shifts,n);},
    removeShift:async(id)=>{const n=shifts.filter((s)=>s.id!==id);setShifts(n);await store.set(K.shifts,n);},
    addLeave:async(l)=>{const n=[...leaves,l];setLeaves(n);await store.set(K.leaves,n);},
    removeLeave:async(id)=>{const n=leaves.filter((l)=>l.id!==id);setLeaves(n);await store.set(K.leaves,n);},
    setLeaveStatus:async(id,statut)=>{const n=leaves.map((l)=>l.id===id?{...l,statut,decidedAt:new Date().toISOString()}:l);setLeaves(n);await store.set(K.leaves,n);},
    addSite:async(s)=>{const n=[...sites,s];setSites(n);await store.set(K.sites,n);},
    updateSite:async(id,p)=>{const n=sites.map((s)=>s.id===id?{...s,...p}:s);setSites(n);await store.set(K.sites,n);},
    removeSite:async(id)=>{const n=sites.filter((s)=>s.id!==id);setSites(n);await store.set(K.sites,n);},
    addAlert:async(a)=>{const n=[a,...alerts];setAlerts(n);await store.set(K.alerts,n);},
    removeAlert:async(id)=>{const n=alerts.filter((a)=>a.id!==id);setAlerts(n);await store.set(K.alerts,n);},
    markSeen:async(empId)=>{const n={...seen,[empId]:new Date().toISOString()};setSeen(n);await store.set(K.seen,n);},
    addAvail:async(a)=>{const n=[...avail,a];setAvail(n);await store.set(K.avail,n);},
    removeAvail:async(id)=>{const n=avail.filter((a)=>a.id!==id);setAvail(n);await store.set(K.avail,n);},
    addLog:async(lg)=>{const n=[...logs,lg];setLogs(n);await store.set(K.logs,n);},
    addDocument:async(doc,photoDataUrl)=>{const n=[...documents,doc];setDocuments(n);await store.set(K.docs,n);if(photoDataUrl)await store.setRaw(docImgKey(doc.id),photoDataUrl);},
    removeDocument:async(id)=>{const n=documents.filter((d)=>d.id!==id);setDocuments(n);await store.set(K.docs,n);store.del(docImgKey(id));},
    getDocPhoto:async(id)=>await store.raw(docImgKey(id)),
    saveConfig:async(p)=>{const n={...config,...p};setConfig(n);await store.set(K.cfg,n);},
    seedDemo:async()=>{const d=DEMO();setEmployees(d.emps);setShifts(d.shifts);setLeaves(d.leaves);setAvail(d.avail);setLogs(d.logs);setDocuments(d.documents);setSites(d.sites);setAlerts(d.alerts);await Promise.all([store.set(K.emp,d.emps),store.set(K.shifts,d.shifts),store.set(K.leaves,d.leaves),store.set(K.avail,d.avail),store.set(K.logs,d.logs),store.set(K.docs,d.documents),store.set(K.sites,d.sites),store.set(K.alerts,d.alerts)]);},
    resetAll:async()=>{setEmployees([]);setShifts([]);setLeaves([]);setAvail([]);setLogs([]);setDocuments([]);setSites([]);setAlerts([]);await Promise.all([store.set(K.emp,[]),store.set(K.shifts,[]),store.set(K.leaves,[]),store.set(K.avail,[]),store.set(K.logs,[]),store.set(K.docs,[]),store.set(K.sites,[]),store.set(K.alerts,[])]);},
  };

  if(!loaded)return(<div className="bsec-root flex min-h-screen items-center justify-center bg-slate-950"><RefreshCw className="animate-spin text-amber-400" size={28}/></div>);
  if(!session)return(<Login employees={employees} config={config} onLogin={(s)=>{setSession(s);setTab(s.role==='manager'?'planning':'home');}} onSeedDemo={async()=>{await actions.seedDemo();}}/>);

  const me=session.role==='employee'?employees.find((e)=>e.id===session.employeeId):null;
  if(session.role==='employee'&&!me){setSession(null);return null;}

  const managerTabs=[{key:'planning',label:'Planning',icon:CalendarDays},{key:'leaves',label:'Congés',icon:FileText},{key:'pointages',label:'Temps',icon:Clock},{key:'sites',label:'Sites',icon:MapPin},{key:'staff',label:'Salariés',icon:Users}];
  const employeeTabs=[{key:'home',label:'Accueil',icon:Home},{key:'pointage',label:'Pointage',icon:Clock},{key:'planning',label:'Planning',icon:CalendarDays},{key:'docs',label:'Documents',icon:BadgeCheck},{key:'leaves',label:'Congés',icon:FileText},{key:'avail',label:'Dispo',icon:CalendarPlus}];
  const pendingCount=leaves.filter((l)=>l.statut==='En attente').length;
  const searchList=searchQ.trim()?employees.filter((e)=>`${e.prenom} ${e.nom} ${e.matricule} ${e.username}`.toLowerCase().includes(searchQ.toLowerCase())):employees;
  const tabBadge=(key)=>session.role==='manager'&&key==='leaves'?pendingCount:0;
  const myNotifs=(session.role==='employee'&&me)?buildNotifs(me,data):[];
  const myUnread=(session.role==='employee'&&me)?unreadCount(myNotifs,seen[me.id]):0;

  return(
    <div className="bsec-root min-h-screen bg-slate-950 text-slate-100">

      {showCopilot&&<CopilotView data={data} onClose={()=>setShowCopilot(false)}/>}

      {/* ── Overlay de recherche ── */}
      {showSearch&&(
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
          <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
            <button onClick={()=>{setShowSearch(false);setSearchQ('');}} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><ChevronLeft size={22}/></button>
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input autoFocus className={`${inputCls} pl-9`} placeholder="Nom, matricule ou identifiant…" value={searchQ} onChange={(e)=>setSearchQ(e.target.value)}/>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {employees.length===0?(
              <Empty icon={Users} title="Aucun salarié" sub="Crée des comptes depuis l'onglet Salariés."/>
            ):searchList.length===0?(
              <Empty icon={Search} title="Aucun agent trouvé" sub={`Rien pour « ${searchQ} »`}/>
            ):searchList.map((e)=>(
              <button key={e.id} onClick={()=>{setActiveAgent(e);setShowSearch(false);setSearchQ('');}} className="w-full text-left">
                <Card className="flex items-center gap-3 p-3.5 transition hover:border-slate-700">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 font-display font-bold text-amber-300">{e.prenom[0]}{e.nom[0]}</div>
                  <div className="flex-1"><p className="font-semibold text-white">{e.prenom} {e.nom}</p><p className="text-xs text-slate-400">{e.poste} · {e.matricule}</p></div>
                  <ChevronRight size={18} className="text-slate-500"/>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex-shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 p-1.5"><ShieldCheck size={20} className="text-amber-400"/></div>
            <div className="min-w-0"><p className="truncate font-display text-sm font-extrabold leading-tight text-white">{config.appName}</p><p className="truncate text-xs leading-tight text-slate-400">{session.role==='manager'?'Responsable / RH':`${me.prenom} ${me.nom}`}</p></div>
          </div>
          {session.role==='manager'&&(
            <button onClick={()=>setShowCopilot(true)} className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2.5 text-amber-300 transition hover:bg-amber-400/20" title="Assistant IA">
              <Sparkles size={20}/>
            </button>
          )}
          {session.role==='manager'&&(
            <button onClick={()=>setShowSearch(true)} className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:border-amber-400 hover:text-amber-400" title="Rechercher un agent">
              <Search size={20}/>
            </button>
          )}
          {session.role==='manager'&&(
            <button onClick={()=>{setActiveAgent(null);setTab('settings');}} className={`rounded-xl border p-2.5 transition ${tab==='settings'?'border-amber-400 bg-amber-400/10 text-amber-300':'border-slate-700 bg-slate-800 text-slate-300 hover:border-amber-400 hover:text-amber-400'}`} title="Réglages">
              <Settings size={20}/>
            </button>
          )}
          {session.role==='employee'&&(
            <button onClick={()=>{setShowNotifs(true);actions.markSeen(me.id);}} className="relative rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:border-amber-400 hover:text-amber-400" title="Notifications">
              <Bell size={20}/>
              {myUnread>0&&<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">{myUnread}</span>}
            </button>
          )}
          <button onClick={()=>{setSession(null);setActiveAgent(null);}} className="rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-slate-300 hover:bg-slate-700" title="Se déconnecter"><LogOut size={18}/></button>
        </div>
        {/* Tab strip — masqué quand fiche agent affichée */}
        {!activeAgent&&(
          <div className="mx-auto max-w-2xl overflow-x-auto px-2 pb-1.5">
            <div className="flex gap-1">
              {(session.role==='manager'?managerTabs:employeeTabs).map((t)=>(
                <button key={t.key} onClick={()=>setTab(t.key)} className={`relative flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab===t.key?'bg-amber-400 text-slate-950':'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <t.icon size={16}/> {t.label}
                  {tabBadge(t.key)>0&&<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">{tabBadge(t.key)}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Contenu principal ── */}
      <main className="mx-auto max-w-2xl px-4 py-5 pb-16">
        {session.role==='manager'&&activeAgent?(
          <AgentProfile agent={activeAgent} data={data} actions={actions} onBack={()=>setActiveAgent(null)}/>
        ):session.role==='manager'?(
          <>
            {tab==='planning'&&<PlanningManager data={data} actions={actions}/>}
            {tab==='leaves'&&<LeavesManager data={data} actions={actions}/>}
            {tab==='pointages'&&<TimeView data={data}/>}
            {tab==='sites'&&<SitesView data={data} actions={actions}/>}
            {tab==='staff'&&<StaffView data={data} actions={actions}/>}
            {tab==='settings'&&<SettingsView actions={actions} config={config}/>}
          </>
        ):(
          <>
            {tab==='home'&&<EmployeeHome me={me} data={data} goTo={setTab}/>}
            {tab==='pointage'&&<EmployeePointage me={me} data={data} actions={actions}/>}
            {tab==='planning'&&<EmployeePlanning me={me} data={data}/>}
            {tab==='docs'&&<EmployeeDocuments me={me} data={data} actions={actions}/>}
            {tab==='leaves'&&<EmployeeLeaves me={me} data={data} actions={actions}/>}
            {tab==='avail'&&<EmployeeAvail me={me} data={data} actions={actions}/>}
          </>
        )}
      </main>

      <Modal open={showNotifs} onClose={()=>setShowNotifs(false)} title="Notifications" icon={Bell}>
        {myNotifs.length===0?<Empty icon={Bell} title="Aucune notification" sub="Tes nouveaux plannings, réponses de congés et alertes s'afficheront ici."/>:(
          <div className="space-y-2">{myNotifs.map((n)=><NotifRow key={n.id} n={n} onClick={()=>{if(n.action)setTab(n.action);setShowNotifs(false);}}/>)}</div>
        )}
      </Modal>
    </div>
  );
}
