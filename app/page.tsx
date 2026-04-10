"use client";
// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  getBookings, addBooking, updateBookingStatus,
  getCourses, upsertCourse, getSettings, saveSetting
} from "./supabase";

const G={50:"#F9FAFB",100:"#F3F4F6",200:"#E5E7EB",300:"#D1D5DB",400:"#9CA3AF",500:"#6B7280",600:"#4B5563",700:"#374151",900:"#111827"};
const GR="#16A34A",GRB="#DCFCE7",AM="#D97706",AMB="#FEF3C7",RD="#DC2626",RDB="#FEF2F2";
const FF="'Noto Sans TC','Microsoft JhengHei',sans-serif";
const TODAY=new Date().toISOString().split("T")[0];
const CGRADS=["linear-gradient(135deg,#FF8C42,#FF6B6B)","linear-gradient(135deg,#56CCF2,#2F80ED)","linear-gradient(135deg,#6FCF97,#219653)","linear-gradient(135deg,#F2C94C,#F2994A)","linear-gradient(135deg,#C084FC,#818CF8)"];

// ── Editable settings ─────────────────────────────────────────────────────────
const INIT_S={
  shopName:"興麥蛋捲烘焙王國",
  shopSubtitle:"台灣第一家蛋捲觀光工廠 ｜ 把最好的都餡給你",
  phone:"047588389",
  mapUrl:"https://maps.app.goo.gl/Q6QYg3cx97H4Uqya9",
  address:"彰化縣線西鄉和線路741巷5號",
  hours:"週一至週日：09:00 - 17:30",
  noticeTitle:"【DIY 課程開課說明】",
  noticeBody:"假日：1 組即開課，享老師全程陪同教學。\n平日（翻糖蛋糕）：場次滿 4 組享全程教學；未達門檻調整為「翻糖蛋糕簡易版（無老師全程教學）」。\n平日（杯子蛋糕）：場次滿 4 組享全程教學；未達門檻改做翻糖蛋糕（無老師全程教學）。\n翻糖蛋糕：不限平假日，未滿 4 組仍可體驗「隨到隨做」服務。",
  primaryColor:"#F97316",
  staffEmails:["staff@xingmai.com","admin@xingmai.com"],
  sidebarName:"興麥蛋捲",
  fieldLabels:{
    course:"DIY 課程",
    date:"預約日期",
    slot:"預約時段",
    groups:"預約組數",
    name:"姓名",
    phone:"聯絡電話",
  },
};
const INIT_COURSES=[
  {id:"c1",name:"翻糖蛋糕",icon:"🎂",iconImg:null,price:150,maxGroups:20,minWd:4,minHd:1,fallbackWd:"改做翻糖蛋糕簡易版（無老師全程教學）",slots:["09:30","10:40","14:10"],active:true},
  {id:"c2",name:"杯子蛋糕",icon:"🧁",iconImg:null,price:200,maxGroups:10,minWd:4,minHd:1,fallbackWd:"改做翻糖蛋糕（無老師全程教學）",slots:["13:00","15:20"],active:true},
];
const INIT_BK=[
  {id:"b1",code:"XM-20260403-001",name:"王小明",phone:"0912345678",cid:"c1",cname:"翻糖蛋糕",date:"2026-04-03",slot:"09:30",groups:2,status:"pending"},
  {id:"b2",code:"XM-20260403-002",name:"李美玲",phone:"0987654321",cid:"c2",cname:"杯子蛋糕",date:"2026-04-03",slot:"13:00",groups:3,status:"checked_in"},
  {id:"b3",code:"XM-"+TODAY.replace(/-/g,"")+"001",name:"陳大文",phone:"0933111222",cid:"c1",cname:"翻糖蛋糕",date:TODAY,slot:"14:10",groups:4,status:"pending"},
  {id:"b4",code:"XM-20260405-001",name:"Kim",phone:"0970808076",cid:"c1",cname:"翻糖蛋糕",date:"2026-04-05",slot:"09:30",groups:2,status:"pending"},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const isWeekend=d=>{if(!d)return false;const w=new Date(d+"T12:00:00").getDay();return w===0||w===6;};
const fmtDate=d=>{if(!d)return"";const dt=new Date(d+"T12:00:00");const wd=["日","一","二","三","四","五","六"];return`${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 星期${wd[dt.getDay()]}`;};
const isPast=(date,slot)=>{if(!date||!slot)return false;if(date<TODAY)return true;if(date>TODAY)return false;const n=new Date();const[h,m]=slot.split(":").map(Number);return n.getHours()*60+n.getMinutes()>=h*60+m;};
const getBooked=(bks,date,slot,cid)=>bks.filter(b=>b.date===date&&b.slot===slot&&(!cid||b.cid===cid)&&b.status!=="cancelled"&&b.status!=="no_show").reduce((a,b)=>a+b.groups,0);
const cStatus=(date,slot,bks,course,extra=0)=>{
  const total=getBooked(bks,date,slot,course.id)+extra;
  const hd=isWeekend(date),min=hd?course.minHd:course.minWd;
  if(total>=min)return{ok:true,label:"已確認開課（老師全程陪同教學）",c:GR,bg:GRB};
  const diff=min-total;
  // II.1 — updated warning copy
  const label=diff===1
    ?`就差 1 組即可達標開課囉！💡 貼心提醒：滿 ${min} 組即享老師全程教學，若未滿 ${min} 組，將為您改為「簡易版翻糖蛋糕」隨到隨做 DIY 體驗。`
    :`距確認開課還差 ${diff} 組（屆時${course.fallbackWd}）`;
  return{ok:false,label,c:AM,bg:AMB};
};
const genCode=()=>{const n=new Date();return`XM-${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*900)+100)}`;};
const exportCSV=(bks)=>{
  const hdr=["訂單編號","姓名","電話","課程","預約日期","時段","組數","狀態"];
  const stMap={pending:"未報到",checked_in:"已報到",cancelled:"已取消",no_show:"未到"};
  const rows=bks.map(b=>[b.code,b.name,b.phone,b.cname,b.date,b.slot,b.groups,stMap[b.status]||b.status]);
  const csv=[hdr,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`xingmai-${TODAY}.csv`;a.click();URL.revokeObjectURL(url);
};
function useWide(){
  const[w,setW]=useState(false);
  useEffect(()=>{
    setW(window.innerWidth>=720);
    const h=()=>setW(window.innerWidth>=720);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);
  return w;
}
const mkS=(P)=>({
  INP:{width:"100%",padding:"13px 15px",border:`1.5px solid ${G[200]}`,borderRadius:10,fontSize:15,outline:"none",boxSizing:"border-box",background:"#fff",color:G[900],fontFamily:FF},
  BTN_P:{background:P,color:"#fff",border:"none",borderRadius:12,padding:"15px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:FF},
  BTN_O:{background:"#fff",color:P,border:`1.5px solid ${P}`,borderRadius:12,padding:"15px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:FF},
  pill:(a)=>({background:a?P:"#fff",color:a?"#fff":G[700],border:`1.5px solid ${a?P:G[200]}`,borderRadius:24,padding:"10px 20px",cursor:"pointer",fontSize:15,fontWeight:a?700:400,fontFamily:FF,display:"flex",alignItems:"center",gap:7}),
  CARD:{background:"#fff",borderRadius:16,padding:"20px",margin:"0 16px 14px",boxShadow:"0 1px 6px rgba(0,0,0,.07)"},
});

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic={
  Back:()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Cal:({s=14,c=G[400]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1" fill={c}/><circle cx="12" cy="15" r="1" fill={c}/><circle cx="16" cy="15" r="1" fill={c}/></svg>,
  Clock:({s=14,c=G[400]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  People:({s=14,c=G[400]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><circle cx="18" cy="8" r="2.5"/><path d="M21 21v-1a4 4 0 0 0-5-3.85"/></svg>,
  Check:({s=14,c="#fff"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ChevL:({s=18,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevR:({s=18,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Upload:({s=22,c=G[300]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  Plus:({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Phone:({s=15,c=G[500]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 5.54 5.54l1.21-1.21a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Pin:({s=15,c=G[500]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Tag:({s=13,c=G[400]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill={c} stroke="none"/></svg>,
  PhoneLine:({s=12,c=G[300]})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 5.54 5.54l1.21-1.21a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Undo:({s=13,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  Edit:({s=13,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Download:({s=15,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  BkCal:({s=22,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Search:({s=22,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Person:({s=22,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({msg,type}){
  if(!msg)return null;
  return(
    <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,background:type==="error"?RD:GR,color:"#fff",borderRadius:12,padding:"13px 20px",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 20px rgba(0,0,0,.25)",whiteSpace:"nowrap"}}>
      {type==="error"?<Ic.X s={14} c="#fff"/>:<Ic.Check s={14} c="#fff"/>}{msg}
    </div>
  );
}
// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({title,desc,confirmLabel="確認",confirmBg=RD,onConfirm,onCancel}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 24px"}}>
      <div style={{background:"#fff",borderRadius:18,padding:"28px 24px",width:"100%",maxWidth:380,boxShadow:"0 8px 32px rgba(0,0,0,.2)"}}>
        <div style={{fontSize:18,fontWeight:800,color:G[900],marginBottom:8}}>{title}</div>
        {desc&&<div style={{fontSize:15,color:G[500],marginBottom:26,lineHeight:1.7}}>{desc}</div>}
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:"#fff",color:G[700],border:`1.5px solid ${G[200]}`,borderRadius:12,padding:"13px",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:FF}} onClick={onCancel}>取消</button>
          <button style={{flex:1,background:confirmBg,color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FF}} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({s}){
  const M={pending:["#F97316","#FFF7ED","未報到"],checked_in:[GR,GRB,"已報到"],cancelled:[RD,RDB,"已取消"],no_show:["#2563EB","#DBEAFE","未到"]};
  const[c,bg,t]=M[s]||M.pending;
  return <span style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:bg,color:c,fontWeight:700,flexShrink:0}}>{t}</span>;
}
// ── Carousel ──────────────────────────────────────────────────────────────────
function Carousel({imgs,P}){
  const[idx,setIdx]=useState(0);
  const valid=imgs.filter(Boolean);
  const len=Math.max(1,imgs.length);
  const safeIdx=idx%len;
  useEffect(()=>{if(len<=1)return;const t=setInterval(()=>setIdx(i=>(i+1)%len),3500);return()=>clearInterval(t);},[len]);
  return(
    <div style={{margin:"0 0 14px",position:"relative",borderRadius:16,overflow:"hidden",height:170}}>
      {imgs[safeIdx]
        ?<img src={imgs[safeIdx]} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
        :<div style={{height:"100%",background:CGRADS[safeIdx%CGRADS.length],display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{color:"#fff",fontSize:14,fontWeight:600,opacity:.85}}>員工後台 › 設定 可上傳照片</span>
        </div>
      }
      {len>1&&<>
        {[[-1,"left"],[1,"right"]].map(([d,side])=>(
          <button key={side} onClick={()=>setIdx(i=>(i+len+d)%len)}
            style={{position:"absolute",[side]:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,.25)",border:"none",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,color:"#fff"}}>
            {d===-1?<Ic.ChevL s={16} c="#fff"/>:<Ic.ChevR s={16} c="#fff"/>}
          </button>
        ))}
        <div style={{position:"absolute",bottom:8,left:0,right:0,display:"flex",justifyContent:"center",gap:5}}>
          {imgs.map((_,i)=><div key={i} onClick={()=>setIdx(i)} style={{height:5,width:i===safeIdx?16:5,borderRadius:3,background:i===safeIdx?"#fff":"rgba(255,255,255,.45)",cursor:"pointer",transition:"width .3s"}}/>)}
        </div>
      </>}
    </div>
  );
}
// ── Image upload ──────────────────────────────────────────────────────────────
function ImgUpload({label,sub,value,onChange,height=130}){
  const ref=useRef();
  const handle=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>onChange(ev.target.result);r.readAsDataURL(f);};
  return(
    <div>
      {label&&<div style={{fontSize:14,fontWeight:600,color:G[700],marginBottom:2}}>{label}</div>}
      {sub&&<div style={{fontSize:12,color:G[400],marginBottom:8}}>{sub}</div>}
      <div onClick={()=>ref.current.click()} style={{border:`2px dashed ${G[200]}`,borderRadius:12,height,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",background:G[50]}}>
        {value?<img src={value} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
          :<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,color:G[400]}}><Ic.Upload s={20} c={G[300]}/><span style={{fontSize:13}}>點擊上傳圖片</span></div>}
      </div>
      {value&&<button onClick={e=>{e.stopPropagation();onChange(null);}} style={{background:"none",border:"none",color:G[400],fontSize:12,cursor:"pointer",fontFamily:FF,marginTop:4}}>移除</button>}
      <input type="file" accept="image/*" ref={ref} onChange={handle} style={{display:"none"}}/>
    </div>
  );
}
// ── Shared booking card ───────────────────────────────────────────────────────
// III.1 — removed onCheckIn / showCheckIn from customer-facing card
// III.2 — added showNoShow + onNoShow props for staff
function BkCard({b,onCheckIn,onUndoCheckIn,onCancel,onNoShow,showCheckIn=false,showUndo=false,showNoShow=false}){
  return(
    <div style={{borderTop:`1px solid ${G[50]}`,padding:"15px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        {/* I.3 — replaced · with space */}
        <span style={{fontWeight:700,fontSize:15,color:G[900]}}>{b.name} <span style={{fontWeight:400,fontSize:13,color:G[400]}}>{b.cname}</span></span>
        <Badge s={b.status}/>
      </div>
      <div style={{display:"flex",gap:12,fontSize:13,color:G[500],flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><Ic.Cal s={12} c={G[300]}/>{fmtDate(b.date).replace(/ 星期./,"")}</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><Ic.Clock s={12} c={G[300]}/>{b.slot}</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><Ic.People s={12} c={G[300]}/>{b.groups} 組</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><Ic.PhoneLine s={12} c={G[300]}/>{b.phone}</span>
      </div>
      <div style={{fontSize:11,color:G[300],marginTop:4}}>{b.code}</div>
      {b.status!=="cancelled"&&b.status!=="no_show"&&(
        <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"nowrap"}}>
          {showCheckIn&&b.status==="pending"&&onCheckIn&&(
            <button onClick={()=>onCheckIn(b.id)} style={{flex:2,minWidth:0,background:GR,color:"#fff",border:"none",borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontFamily:FF,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:4,whiteSpace:"nowrap"}}>
              <Ic.Check s={13} c="#fff"/>確認報到
            </button>
          )}
          {showUndo&&b.status==="checked_in"&&onUndoCheckIn&&(
            <button onClick={()=>onUndoCheckIn(b.id)} style={{flex:1,minWidth:0,background:AMB,color:AM,border:"none",borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontFamily:FF,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:4,whiteSpace:"nowrap"}}>
              <Ic.Undo s={13} c={AM}/>撤回
            </button>
          )}
          {b.date>=TODAY&&b.status==="pending"&&onCancel&&(
            <button onClick={()=>onCancel(b.id)} style={{flex:1,minWidth:0,background:RDB,color:RD,border:"none",borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontFamily:FF,fontWeight:600,whiteSpace:"nowrap"}}>取消</button>
          )}
          {showNoShow&&b.status==="pending"&&onNoShow&&(
            <button onClick={()=>onNoShow(b.id)} style={{flex:1,minWidth:0,background:"#DBEAFE",color:"#2563EB",border:"none",borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontFamily:FF,fontWeight:600,whiteSpace:"nowrap"}}>未到</button>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING PAGE
// I.1 — single-column layout for both desktop and mobile
// ══════════════════════════════════════════════════════════════════════════════
function BookingPage({courses,bookings,setBookings,bannerImg,successImg,carouselImgs,S,P,showToast}){
  const[step,setStep]=useState("form");
  const[f,setF]=useState({cid:"c1",date:"",slot:"",groups:"",name:"",phone:""});
  const[saved,setSaved]=useState(null);
  const[modal,setModal]=useState(false);
  const wide=useWide();
  const st=mkS(P);

  const ac=courses.filter(c=>c.active);
  const course=courses.find(c=>c.id===f.cid)||ac[0];
  const maxG=course?.maxGroups||10;
  const booked=f.date&&f.slot?getBooked(bookings,f.date,f.slot,f.cid):0;
  const rem=Math.max(0,maxG-booked);
  const cs=f.date&&f.slot&&f.groups&&course?cStatus(f.date,f.slot,bookings,course,Number(f.groups)):null;
  const phoneOk=f.phone.length===10&&/^\d+$/.test(f.phone);
  const ok=!!(f.cid&&f.date&&f.slot&&f.groups&&f.name&&phoneOk);

  const doConfirm=async()=>{
    const nb={id:"b"+Date.now(),code:genCode(),name:f.name,phone:f.phone,cid:f.cid,cname:course.name,date:f.date,slot:f.slot,groups:Number(f.groups),status:"pending"};
    setBookings((p:any)=>[...p,nb]);
    setSaved(nb);
    setStep("success");
    await addBooking(nb); // 寫入資料庫
  };
  const doCancelSaved=()=>{
    if(saved)setBookings(p=>p.map(b=>b.id===saved.id?{...b,status:"cancelled"}:b));
    showToast("預約已成功取消");setModal(false);setStep("form");setF({cid:"c1",date:"",slot:"",groups:"",name:"",phone:""});setSaved(null);
  };

  // I.1 — content wrapper: max-width centered for desktop
  const cw={maxWidth:wide?860:640,margin:"0 auto",width:"100%"};
  const fz=(base)=>wide?base+2:base; // desktop font bump

  if(step==="confirm") return(
    <div style={{background:G[50],minHeight:"100%",fontFamily:FF}}>
      <div style={{background:"#fff",padding:"15px 18px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${G[100]}`}}>
        <button onClick={()=>setStep("form")} style={{background:"none",border:"none",cursor:"pointer",color:G[700],display:"flex",padding:4}}><Ic.Back/></button>
        <span style={{fontSize:18,fontWeight:700,color:G[900]}}>請確認預約資訊</span>
      </div>
      <div style={{...cw,padding:wide?"0 32px":"0 16px",margin:"0 auto"}}>
        <div style={{...st.CARD,margin:"16px 0 14px"}}>
          <div style={{fontSize:24,fontWeight:800,color:G[900],marginBottom:2}}>{f.name}</div>
          {/* I.3 — replaced · with space */}
          <div style={{color:G[400],fontSize:14,marginBottom:18}}>{course?.name}  NT${course?.price}/組</div>
          {[["電話",f.phone],["預約日期",fmtDate(f.date)],["預約時段",f.slot],["組數",f.groups+" 組"]].map(([k,v],i,a)=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"13px 0",borderBottom:i<a.length-1?`1px solid ${G[100]}`:"none"}}>
              <span style={{color:G[500],fontSize:15}}>{k}</span><span style={{fontWeight:600,fontSize:15,color:G[900]}}>{v}</span>
            </div>
          ))}
        </div>
        {cs&&<div style={{padding:"13px 14px",borderRadius:10,background:cs.bg,color:cs.c,fontSize:15,marginBottom:14,textAlign:"center",lineHeight:1.7}}>{cs.label}</div>}
        <div style={{display:"flex",gap:10,paddingBottom:24}}>
          <button style={{...st.BTN_O,flex:1}} onClick={()=>setStep("form")}>取消</button>
          <button style={{...st.BTN_P,flex:1}} onClick={doConfirm}>確認</button>
        </div>
      </div>
    </div>
  );

  if(step==="success"&&saved){
    const sc=course?cStatus(saved.date,saved.slot,bookings,course):null;
    return(
      <div style={{background:G[50],minHeight:"100%",fontFamily:FF}}>
        <div style={{height:wide?360:240,overflow:"hidden",width:"100%"}}>
          {successImg?<img src={successImg} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
            :<div style={{height:"100%",background:`linear-gradient(140deg,${P},${P}cc)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80}}>🥚</div>}
        </div>
        <div style={{...cw,padding:wide?"0 32px":"0 16px",margin:"0 auto"}}>
          <div style={{textAlign:"center",padding:"22px 0 10px"}}><div style={{fontSize:28,fontWeight:800,color:G[900]}}>預約成功！</div></div>
          {sc&&<div style={{padding:"13px 14px",borderRadius:10,background:sc.bg,color:sc.c,fontSize:15,marginBottom:14,textAlign:"center",lineHeight:1.7}}>{sc.label}</div>}
          <div style={{...st.CARD,margin:"0 0 14px"}}>
            {[["姓名",saved.name],["DIY 項目",saved.cname],["電話",saved.phone],["預訂日期",fmtDate(saved.date).split(" ")[0]],["預約時段",saved.slot],["預約組數",saved.groups+" 組"],["訂單狀態","未報到"]].map(([k,v],i,a)=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:i<a.length-1?`1px solid ${G[100]}`:"none"}}>
                <span style={{color:G[500],fontSize:15}}>{k}</span><span style={{fontWeight:600,fontSize:15,color:G[900]}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{padding:"13px 15px",borderRadius:10,background:GRB,color:GR,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
            <Ic.Check s={15} c={GR}/>請於預約時段準時抵達，現場出示此畫面即可。
          </div>
          <div style={{display:"flex",gap:10,paddingBottom:24}}>
            <button style={{...st.BTN_O,flex:1}} onClick={()=>setModal(true)}>取消預約</button>
            <button style={{...st.BTN_P,flex:1}} onClick={()=>{setStep("form");setF({cid:"c1",date:"",slot:"",groups:"",name:"",phone:""});}}>回首頁</button>
          </div>
        </div>
        {/* II.2 — simplified cancel copy */}
        {modal&&<Modal title="確認取消預約" desc="確定要取消這筆預約嗎？" confirmBg={P} onConfirm={doCancelSaved} onCancel={()=>setModal(false)}/>}
      </div>
    );
  }

  // ── Main form — I.1 single column, same order as mobile ───────────────────
  return(
    <div style={{background:G[50],minHeight:"100%",fontFamily:FF}}>
      {/* Banner — 16:9 ratio feel, wider crop */}
      <div style={{height:wide?420:260,overflow:"hidden",width:"100%"}}>
        {bannerImg?<img src={bannerImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
          :<div style={{height:"100%",background:`linear-gradient(150deg,${P}88,${P},${P}dd)`}}/>}
      </div>
      {/* Single-column content */}
      <div style={{maxWidth:wide?860:640,margin:"0 auto",padding:wide?"0 32px 32px":"0 16px 32px"}}>
        {/* Title block */}
        <div style={{background:"#fff",borderRadius:16,padding:wide?"28px 24px 22px":"22px 20px 18px",margin:"16px 0 14px",textAlign:"center",boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
          <div style={{fontSize:wide?32:24,fontWeight:800,color:G[900]}}>{S.shopName}</div>
          <div style={{fontSize:wide?16:14,color:G[500],marginTop:6,lineHeight:1.6}}>{S.shopSubtitle}</div>
          <div style={{display:"flex",justifyContent:"center",gap:24,marginTop:14}}>
            <a href={`tel:${S.phone}`} style={{color:G[700],fontSize:wide?17:15,display:"flex",alignItems:"center",gap:6,textDecoration:"none"}}><Ic.Phone s={15} c={G[500]}/>{S.phone}</a>
            <a href={S.mapUrl} target="_blank" rel="noreferrer" style={{color:G[700],fontSize:wide?17:15,display:"flex",alignItems:"center",gap:6,textDecoration:"none"}}><Ic.Pin s={15} c={G[500]}/>查看地圖</a>
          </div>
        </div>
        {/* Notice */}
        <div style={{background:`${P}12`,border:`1px solid ${P}33`,borderRadius:16,padding:wide?"20px 22px":"16px 18px",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:wide?17:15,color:P,marginBottom:8}}>{S.noticeTitle}</div>
          <div style={{fontSize:wide?15:14,color:G[600],lineHeight:2,whiteSpace:"pre-line",textAlign:"left"}}>{S.noticeBody}</div>
        </div>
        {/* Carousel */}
        <Carousel imgs={carouselImgs} P={P}/>
        {/* Form card */}
        <div style={{background:"#fff",borderRadius:16,padding:wide?"28px":"20px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
          {/* Course */}
          <div style={{marginBottom:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <span style={{fontWeight:700,fontSize:wide?18:16,color:G[900]}}>{S.fieldLabels?.course||"DIY 課程"}</span><span style={{color:RD,fontSize:12}}>必填</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {ac.map(c=>(
                <button key={c.id} style={st.pill(f.cid===c.id)} onClick={()=>setF(p=>({...p,cid:c.id,slot:"",groups:""}))}>
                  {c.iconImg?<img src={c.iconImg} style={{width:22,height:22,borderRadius:4,objectFit:"cover"}} alt=""/>:<span style={{fontSize:18}}>{c.icon}</span>}
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Date */}
          <div style={{marginBottom:22}}>
            <div style={{fontWeight:700,fontSize:wide?18:16,color:G[900],marginBottom:13}}>{S.fieldLabels?.date||"預約日期"}</div>
            <input type="date" min={TODAY} value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value,slot:"",groups:""}))} style={st.INP}/>
            {f.date&&<div style={{fontSize:13,color:G[400],marginTop:7,display:"flex",alignItems:"center",gap:5}}>
              <Ic.Cal s={12} c={G[400]}/>{fmtDate(f.date)} 
              <span style={{color:isWeekend(f.date)?GR:AM,fontWeight:600}}>{isWeekend(f.date)?"假日（1 組即開課）":"平日"}</span>
            </div>}
          </div>
          {/* Slots */}
          <div style={{marginBottom:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <span style={{fontWeight:700,fontSize:wide?18:16,color:G[900]}}>{S.fieldLabels?.slot||"預約時段"}</span><span style={{color:RD,fontSize:12}}>必填</span>
            </div>
            {!f.date?<p style={{fontSize:14,color:G[400],margin:0}}>請先選擇日期</p>
              :<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(course?.slots||[]).map(s=>{
                  const past=isPast(f.date,s),full=getBooked(bookings,f.date,s,f.cid)>=maxG,dis=past||full,active=f.slot===s&&!dis;
                  return(
                    <button key={s} disabled={dis} style={{...st.pill(active),opacity:dis?.28:1,cursor:dis?"not-allowed":"pointer"}} onClick={()=>!dis&&setF(p=>({...p,slot:s,groups:""}))}>
                      <Ic.Clock s={13} c={active?"#fff":G[400]}/><span>{s}{past?" 已過":full?" 客滿":""}</span>
                    </button>
                  );
                })}
              </div>
            }
          </div>
          {/* Groups */}
          <div style={{marginBottom:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontWeight:700,fontSize:wide?18:16,color:G[900]}}>{S.fieldLabels?.groups||"預約組數"}</span>
                {f.date&&f.slot&&<span style={{fontSize:13,color:G[400]}}>(剩餘 {rem} 組)</span>}
              </div>
              <span style={{color:RD,fontSize:12}}>必填</span>
            </div>
            <select value={f.groups} onChange={e=>setF(p=>({...p,groups:e.target.value}))} style={st.INP} disabled={!f.slot||rem===0}>
              <option value="">{!f.slot?"請先選擇時段":rem===0?"此時段已客滿":"選擇組數"}</option>
              {Array.from({length:rem},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} 組</option>)}
            </select>
          </div>
          {cs&&<div style={{padding:"13px 14px",borderRadius:10,background:cs.bg,color:cs.c,fontSize:15,marginBottom:22,textAlign:"center",lineHeight:1.7}}>{cs.label}</div>}
          <div style={{marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:wide?18:16,color:G[900],marginBottom:13}}>{S.fieldLabels?.name||"姓名"}</div>
            <input type="text" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="請輸入姓名" style={st.INP}/>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontWeight:700,fontSize:wide?18:16,color:G[900],marginBottom:13}}>{S.fieldLabels?.phone||"聯絡電話"}</div>
            <input type="tel" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value.replace(/\D/g,"").slice(0,10)}))} placeholder="09xxxxxxxx（10碼）" maxLength={10} style={{...st.INP,borderColor:f.phone&&!phoneOk?RD:G[200]}}/>
            {f.phone&&!phoneOk&&<div style={{fontSize:12,color:RD,marginTop:5}}>請輸入正確的10碼手機號碼</div>}
          </div>
          <button style={{...st.BTN_P,width:"100%",opacity:ok?1:.35}} disabled={!ok} onClick={()=>setStep("confirm")}>確認預約</button>
        </div>
        {/* Business info */}
        <div style={{background:"#fff",borderRadius:16,padding:wide?"24px":"20px",boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
          {[["營業時間",S.hours],["地址",S.address],["聯絡電話",S.phone]].map(([label,val],i)=>(
            <div key={label} style={{paddingTop:i>0?16:0,paddingBottom:i<2?16:0,borderBottom:i<2?`1px solid ${G[100]}`:"none"}}>
              <div style={{fontSize:wide?14:13,color:G[400],marginBottom:4}}>{label}</div>
              <div style={{fontSize:wide?18:16,color:G[900],fontWeight:500}}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QUERY PAGE — III.1 no check-in button for customers
// ══════════════════════════════════════════════════════════════════════════════
function QueryPage({bookings,setBookings,S,P,showToast}){
  const[qName,setQName]=useState("");
  const[qPhone,setQPhone]=useState("");
  const[searched,setSearched]=useState(false);
  const[cancelModal,setCancelModal]=useState(null);
  const st=mkS(P);
  const wide=useWide();
  const phoneOk=qPhone.length===10&&/^\d+$/.test(qPhone);
  const canSearch=!!(qName.trim()&&phoneOk);
  const doSearch=()=>{if(canSearch)setSearched(true);};
  const results=searched?bookings.filter(b=>b.name===qName.trim()&&b.phone===qPhone):[];
  const handleCancel=id=>{setBookings(p=>p.map(b=>b.id===id?{...b,status:"cancelled"}:b));showToast("預約已成功取消");setCancelModal(null);};

  return(
    <div style={{background:G[50],minHeight:"100%",fontFamily:FF,position:"relative"}}>
      <div style={{background:"#fff",padding:wide?"18px 28px":"15px 18px",borderBottom:`1px solid ${G[100]}`}}>
        <span style={{fontSize:wide?22:18,fontWeight:700,color:G[900]}}>查詢系統</span>
      </div>
      <div style={{maxWidth:wide?860:640,margin:"0 auto",padding:wide?"0 32px":"0 16px"}}>
        <div style={{...st.CARD,margin:"16px 0 14px"}}>
          <div style={{fontSize:wide?18:16,fontWeight:700,color:G[900],marginBottom:4}}>輸入姓名與電話查詢預約</div>
          <div style={{fontSize:wide?15:13,color:G[500],marginBottom:16}}>須同時輸入預約時填寫的姓名與手機號碼</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:wide?16:14,color:G[600],fontWeight:600,marginBottom:7}}>姓名</div>
            <input type="text" value={qName} onChange={e=>{setQName(e.target.value);setSearched(false);}} placeholder="請輸入姓名" style={{...st.INP,fontSize:wide?16:15}}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:wide?16:14,color:G[600],fontWeight:600,marginBottom:7}}>聯絡電話</div>
            <input type="tel" value={qPhone} onChange={e=>{setQPhone(e.target.value.replace(/\D/g,"").slice(0,10));setSearched(false);}} placeholder="09xxxxxxxx" maxLength={10} style={{...st.INP,fontSize:wide?16:15,borderColor:qPhone&&!phoneOk?RD:G[200]}}/>
          </div>
          <button style={{...st.BTN_P,width:"100%",opacity:canSearch?1:.35,fontSize:wide?17:16}} disabled={!canSearch} onClick={doSearch}>查詢預約紀錄</button>
        </div>
        {searched&&(results.length===0
          ?<div style={{textAlign:"center",padding:"44px 0",color:G[400]}}><div style={{fontSize:36,marginBottom:12,opacity:.4}}>📭</div><div style={{fontSize:15}}>查無預約紀錄，請確認姓名與電話是否正確</div></div>
          :<div style={{...st.CARD,margin:"0 0 24px",padding:0,overflow:"hidden"}}>
            {results.map(b=>(
              <BkCard key={b.id} b={b}
                showCheckIn={false}  /* III.1 — no check-in for customers */
                onCancel={b.date>=TODAY&&b.status==="pending"?()=>setCancelModal(b.id):null}/>
            ))}
          </div>
        )}
      </div>
      {/* II.2 */}
      {cancelModal&&<Modal title="確認取消預約" desc="確定要取消這筆預約嗎？" confirmBg={P} onConfirm={()=>handleCancel(cancelModal)} onCancel={()=>setCancelModal(null)}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAFF PAGE
// ══════════════════════════════════════════════════════════════════════════════
function StaffPage({bookings,setBookings,courses,setCourses,bannerImg,setBannerImg,successImg,setSuccessImg,carouselImgs,setCarouselImgs,S,setS,P,showToast}){
  const[staff,setStaff]=useState(null);
  const[authLoading,setAuthLoading]=useState(false);
  const[authError,setAuthError]=useState("");
  const forcingOut=useRef(false); // prevent loop when we force-signout non-whitelisted user
  const[tab,setTab]=useState("today");
  const[searchQ,setSearchQ]=useState("");
  const[searchDate,setSearchDate]=useState("");
  const[editId,setEditId]=useState(null);
  const[addMode,setAddMode]=useState(false);
  const[cancelModal,setCancelModal]=useState(null);
  const[noShowModal,setNoShowModal]=useState(null);
  const[nc,setNc]=useState({name:"",icon:"🎨",iconImg:null,price:"",maxGroups:"",minWd:4,minHd:1,fallbackWd:"改做翻糖蛋糕（無老師全程教學）",slots:"09:30,10:40,14:10"});
  const st=mkS(P);
  const wide=useWide();

  // 監聽 Supabase Auth 狀態，登入後驗證白名單
  useEffect(()=>{
    import("./supabase").then(({supabase,isStaffEmail})=>{
      // 取得目前 session（頁面重新載入後恢復登入）
      supabase.auth.getSession().then(async({data:{session}})=>{
        if(session?.user&&!forcingOut.current){
          const email=session.user.email||"";
          const ok=await isStaffEmail(email);
          if(ok) setStaff({email,name:session.user.user_metadata?.full_name||email});
          else{
            forcingOut.current=true;
            await supabase.auth.signOut();
            forcingOut.current=false;
            setAuthError("此帳號不在員工白名單中，請聯絡管理員。");
          }
        }
      });
      // 監聽登入/登出事件
      const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
        if(event==="SIGNED_IN"&&session?.user&&!forcingOut.current){
          const email=session.user.email||"";
          const ok=await isStaffEmail(email);
          if(ok){
            setStaff({email,name:session.user.user_metadata?.full_name||email});
            setAuthError("");
          } else{
            forcingOut.current=true;
            await supabase.auth.signOut();
            forcingOut.current=false;
            setAuthError("此帳號不在員工白名單中，請聯絡管理員。");
          }
          setAuthLoading(false);
        }
        if(event==="SIGNED_OUT"&&!forcingOut.current) setStaff(null);
      });
      return()=>subscription.unsubscribe();
    });
  },[]);

  const handleGoogleLogin=async()=>{
    setAuthLoading(true); setAuthError("");
    const{supabase}=await import("./supabase");
    const{error}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.href}
    });
    if(error){ setAuthError("登入失敗，請再試一次。"); setAuthLoading(false); }
  };
  const handleLogout=async()=>{
    const{supabase}=await import("./supabase");
    await supabase.auth.signOut();
    setStaff(null);
  };

  if(!staff) return(
    <div style={{background:G[50],minHeight:"100%",fontFamily:FF}}>
      <div style={{background:"#fff",padding:"15px 18px",borderBottom:`1px solid ${G[100]}`}}><span style={{fontSize:18,fontWeight:700,color:G[900]}}>員工專用</span></div>
      <div style={{maxWidth:440,margin:"40px auto 0",padding:"0 16px"}}>
        <div style={{...st.CARD,textAlign:"center",padding:"44px 24px",margin:0}}>
          <div style={{width:68,height:68,borderRadius:"50%",background:`${P}18`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}><Ic.Person s={30} c={P}/></div>
          <div style={{fontSize:21,fontWeight:800,color:G[900],marginBottom:6}}>員工後台登入</div>
          <div style={{fontSize:14,color:G[500],marginBottom:24}}>僅限白名單員工帳號存取</div>
          {authError&&<div style={{background:RDB,color:RD,borderRadius:10,padding:"12px 14px",fontSize:13,marginBottom:16,lineHeight:1.6}}>{authError}</div>}
          <button onClick={handleGoogleLogin} disabled={authLoading}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"#fff",border:`1px solid ${G[200]}`,borderRadius:12,padding:"14px 20px",width:"100%",cursor:authLoading?"not-allowed":"pointer",fontSize:15,fontFamily:FF,boxShadow:"0 1px 4px rgba(0,0,0,.08)",opacity:authLoading?.6:1}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.2 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/><path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.6 37 26.9 38 24 38c-5.9 0-10.8-4-12.6-9.4l-7.1 5.5C7.8 41.5 15.4 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.4-2.4 4.5-4.5 6l6.7 5.5C41.9 36.3 45 30.6 45 24c0-1.3-.2-2.7-.5-4z"/></svg>
            {authLoading?"登入中...":"以 Google 帳號登入（員工）"}
          </button>
        </div>
      </div>
    </div>
  );

  const todayBs=bookings.filter(b=>b.date===TODAY&&b.status!=="cancelled");
  const pending=todayBs.filter(b=>b.status==="pending");
  const checked=todayBs.filter(b=>b.status==="checked_in");
  const noShows=todayBs.filter(b=>b.status==="no_show");
  const showSearch=!!(searchQ||searchDate);
  const searchResults=showSearch?bookings.filter(b=>{
    const qMatch=!searchQ||(b.name.includes(searchQ)||b.phone.includes(searchQ));
    const dMatch=!searchDate||b.date===searchDate;
    return qMatch&&dMatch;
  }):[];

  const checkIn=(id:string)=>{
    setBookings((p:any)=>p.map((b:any)=>b.id===id?{...b,status:"checked_in"}:b));
    showToast("已確認報到！");
    updateBookingStatus(id,"checked_in");
  };
  const undoCheckIn=(id:string)=>{
    setBookings((p:any)=>p.map((b:any)=>b.id===id?{...b,status:"pending"}:b));
    showToast("已撤回報到狀態");
    updateBookingStatus(id,"pending");
  };
  const confirmNoShow=(id:string)=>{
    setBookings((p:any)=>p.map((b:any)=>b.id===id?{...b,status:"no_show"}:b));
    showToast("已標記為未到");
    setNoShowModal(null);
    updateBookingStatus(id,"no_show");
  };
  const cancelB=(id:string)=>{
    setBookings((p:any)=>p.map((b:any)=>b.id===id?{...b,status:"cancelled"}:b));
    showToast("已取消該預約","error");
    setCancelModal(null);
    updateBookingStatus(id,"cancelled");
  };
  const toggleCourse=id=>setCourses(p=>p.map(c=>c.id===id?{...c,active:!c.active}:c));
  const saveCourseEdit=(id,patch)=>{
    setCourses(p=>p.map(c=>c.id===id?{...c,...patch,price:Number(patch.price||c.price),maxGroups:Number(patch.maxGroups||c.maxGroups),slots:typeof patch.slots==="string"?patch.slots.split(",").map(s=>s.trim()).filter(Boolean):c.slots}:c));
    setEditId(null);showToast("課程設定已儲存！");
  };
  const addCourse=()=>{
    if(!nc.name||!nc.price||!nc.maxGroups)return;
    setCourses(p=>[...p,{...nc,id:"c"+Date.now(),price:Number(nc.price),maxGroups:Number(nc.maxGroups),slots:nc.slots.split(",").map(s=>s.trim()).filter(Boolean),active:true}]);
    setNc({name:"",icon:"🎨",iconImg:null,price:"",maxGroups:"",minWd:4,minHd:1,fallbackWd:"改做翻糖蛋糕（無老師全程教學）",slots:"09:30,10:40,14:10"});
    setAddMode(false);showToast("課程已成功新增！");
  };
  const setCarImg=(i,v)=>setCarouselImgs(p=>{const a=[...p];a[i]=v;return a;});
  const removeCarSlot=i=>setCarouselImgs(p=>p.filter((_,idx)=>idx!==i));

  // IV.1 — merged tabs (removed "appearance", kept "settings" which now includes appearance)
  const TABS=[["today","今日"],["search","查詢"],["courses","課程"],["settings","設定"]];
  const tSt=t=>({padding:"12px 4px",background:"none",border:"none",cursor:"pointer",fontSize:wide?15:12,fontFamily:FF,fontWeight:tab===t?700:400,color:tab===t?P:G[500],borderBottom:`2.5px solid ${tab===t?P:"transparent"}`,whiteSpace:"nowrap",flex:1});
  const wrap={maxWidth:wide?1100:undefined,margin:wide?"0 auto":undefined,padding:wide?"0 24px":undefined};

  function CourseEditForm({c}){
    const[ec,setEc]=useState({...c,slots:c.slots.join(",")});
    const iconRef=useRef();
    const handleIconImg=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setEc(p=>({...p,iconImg:ev.target.result}));r.readAsDataURL(f);};
    return(
      <div style={{background:G[50],padding:"16px",borderTop:`1px solid ${G[100]}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div onClick={()=>iconRef.current.click()} style={{width:56,height:56,borderRadius:12,border:`2px dashed ${G[200]}`,overflow:"hidden",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",fontSize:26}}>
            {ec.iconImg?<img src={ec.iconImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:ec.icon}
          </div>
          <div style={{flex:1,fontSize:12,color:G[500]}}>點左側可更換圖片</div>
          <input value={ec.icon} onChange={e=>setEc(p=>({...p,icon:e.target.value}))} maxLength={2} style={{...st.INP,width:52,padding:"8px",fontSize:20,textAlign:"center",flex:"none"}}/>
          <input type="file" accept="image/*" ref={iconRef} onChange={handleIconImg} style={{display:"none"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:wide?"1fr 1fr":"1fr",gap:12}}>
          {[["課程名稱","text",ec.name,v=>setEc(p=>({...p,name:v})),"翻糖蛋糕"],["價格（元/組）","number",ec.price,v=>setEc(p=>({...p,price:v})),"150"],["最大預約組數","number",ec.maxGroups,v=>setEc(p=>({...p,maxGroups:Number(v)})),"10"],["平日最低開課組數","number",ec.minWd,v=>setEc(p=>({...p,minWd:Number(v)})),"4"],["假日最低開課組數","number",ec.minHd,v=>setEc(p=>({...p,minHd:Number(v)})),"1"]].map(([label,type,val,cb,ph])=>(
            <div key={label}><div style={{fontSize:13,color:G[600],fontWeight:600,marginBottom:5}}>{label}</div>
              <input type={type} value={val} onChange={e=>cb(e.target.value)} placeholder={ph} style={{...st.INP,padding:"10px 12px",fontSize:14}}/></div>
          ))}
        </div>
        {[["未達門檻說明","text",ec.fallbackWd,v=>setEc(p=>({...p,fallbackWd:v})),"改做翻糖蛋糕（無老師）"],["可預約時段（逗號分隔）","text",ec.slots,v=>setEc(p=>({...p,slots:v})),"09:30,10:40,14:10"]].map(([label,type,val,cb,ph])=>(
          <div key={label} style={{marginTop:12}}><div style={{fontSize:13,color:G[600],fontWeight:600,marginBottom:5}}>{label}</div>
            <input type={type} value={val} onChange={e=>cb(e.target.value)} placeholder={ph} style={{...st.INP,padding:"10px 12px",fontSize:14}}/></div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button style={{...st.BTN_O,flex:1,padding:"11px"}} onClick={()=>setEditId(null)}>取消</button>
          <button style={{...st.BTN_P,flex:1,padding:"11px"}} onClick={()=>saveCourseEdit(c.id,ec)}>儲存</button>
        </div>
      </div>
    );
  }

  return(
    <div style={{background:G[50],minHeight:"100%",fontFamily:FF,position:"relative"}}>
      <div style={{background:"#fff",padding:"15px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${G[100]}`}}>
        {/* I.3 — removed · from staff header */}
        <span style={{fontSize:18,fontWeight:700,color:G[900]}}>員工後台 <span style={{fontWeight:400,fontSize:14,color:G[400]}}>{staff.name}</span></span>
      <button onClick={handleLogout} style={{background:"none",border:"none",color:G[500],fontSize:14,cursor:"pointer",fontFamily:FF}}>登出</button>
      </div>
      <div style={{background:"#fff",display:"flex",borderBottom:`1px solid ${G[100]}`,marginBottom:14,overflowX:"auto"}}>
        {TABS.map(([id,label])=><button key={id} style={tSt(id)} onClick={()=>setTab(id)}>{label}</button>)}
      </div>
      <div style={wrap}>
        {/* TODAY */}
        {tab==="today"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"0 16px 16px"}}>
            {[["未報到",pending.length,AM,AMB],["已報到",checked.length,GR,GRB],["未到",noShows.length,"#2563EB","#DBEAFE"]].map(([l,n,c,bg])=>(
              <div key={l} style={{background:bg,borderRadius:14,padding:wide?"20px":"14px",textAlign:"center"}}>
                <div style={{fontSize:wide?42:30,fontWeight:800,color:c}}>{n}</div>
                <div style={{fontSize:wide?15:12,color:c,marginTop:2,opacity:.8}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:wide?"grid":undefined,gridTemplateColumns:wide?"1fr 1fr":undefined,gap:wide?16:undefined,margin:wide?"0 16px":undefined}}>
            {[["今日 DIY 未報到",pending,true,false,true],["今日 DIY 已報到",checked,false,true,false]].map(([title,list,actions,showUndo,showNoShow])=>(
              <div key={title} style={{...st.CARD,padding:0,overflow:"hidden",margin:wide?"0 0 0":undefined}}>
                <div style={{padding:wide?"18px 22px":"15px 18px",borderBottom:`1px solid ${G[50]}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:700,fontSize:wide?17:15,color:G[900]}}>{title}</span>
                  <span style={{background:G[100],borderRadius:12,padding:"3px 10px",fontSize:wide?14:13,color:G[500]}}>{list.length}</span>
                </div>
                {list.length===0?<div style={{padding:"22px",textAlign:"center",fontSize:wide?15:14,color:G[400]}}>暫無紀錄</div>
                  :list.map(b=><BkCard key={b.id} b={b}
                    showCheckIn={actions} showUndo={showUndo} showNoShow={showNoShow}
                    onCheckIn={checkIn} onUndoCheckIn={undoCheckIn}
                    onNoShow={id=>setNoShowModal(id)}
                    onCancel={()=>setCancelModal(b.id)}/>)}
              </div>
            ))}
          </div>
          {noShows.length>0&&<div style={{...st.CARD,padding:0,overflow:"hidden"}}>
            <div style={{padding:wide?"18px 22px":"15px 18px",borderBottom:`1px solid ${G[50]}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:700,fontSize:wide?17:15,color:G[900]}}>今日 DIY 未到</span>
              <span style={{background:"#DBEAFE",borderRadius:12,padding:"3px 10px",fontSize:13,color:"#2563EB"}}>{noShows.length}</span>
            </div>
            {noShows.map(b=><BkCard key={b.id} b={b}/>)}
          </div>}
        </>}

        {/* SEARCH */}
        {tab==="search"&&<>
          <div style={{...st.CARD,padding:"14px 16px"}}>
            <div style={{fontSize:wide?17:15,fontWeight:700,color:G[900],marginBottom:12}}>查詢預約紀錄</div>
            <div style={{display:wide?"grid":undefined,gridTemplateColumns:wide?"1fr 1fr":undefined,gap:wide?12:undefined}}>
              <div style={{marginBottom:wide?0:10}}>
                <div style={{fontSize:wide?15:13,color:G[500],marginBottom:5}}>姓名或電話</div>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="輸入姓名或電話..." style={{...st.INP,padding:"11px 12px",fontSize:wide?15:14}}/>
              </div>
              <div>
                <div style={{fontSize:wide?15:13,color:G[500],marginBottom:5}}>指定日期（選填）</div>
                <input type="date" value={searchDate} onChange={e=>setSearchDate(e.target.value)} style={{...st.INP,padding:"11px 12px",fontSize:wide?15:14}}/>
              </div>
            </div>
            {(searchQ||searchDate)&&<button onClick={()=>{setSearchQ("");setSearchDate("");}} style={{...st.BTN_O,marginTop:10,padding:"10px",fontSize:wide?15:14,width:"100%"}}>清除篩選</button>}
          </div>
          {showSearch?(searchResults.length===0
            ?<div style={{textAlign:"center",padding:"44px",color:G[400],fontSize:15}}>查無符合的預約紀錄</div>
            :<div style={{...st.CARD,padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${G[50]}`,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:14,color:G[500]}}>
                <span>共 {searchResults.length} 筆</span>
                <button onClick={()=>exportCSV(searchResults)} style={{background:"none",border:`1px solid ${G[200]}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:G[600],fontFamily:FF,display:"flex",alignItems:"center",gap:5}}>
                  <Ic.Download s={12} c={G[500]}/>匯出此結果
                </button>
              </div>
              {searchResults.map(b=><BkCard key={b.id} b={b}
                showCheckIn={b.date===TODAY} showUndo={b.date===TODAY} showNoShow={b.date===TODAY}
                onCheckIn={checkIn} onUndoCheckIn={undoCheckIn}
                onNoShow={id=>setNoShowModal(id)} onCancel={()=>setCancelModal(b.id)}/>)}
            </div>
          ):<div style={{textAlign:"center",padding:"44px",color:G[400],fontSize:14}}>請輸入姓名、電話或選擇日期</div>}
        </>}

        {/* COURSES */}
        {tab==="courses"&&<>
          <div style={{...st.CARD,padding:0,overflow:"hidden",marginBottom:12}}>
            {courses.map((c,i)=>(
              <div key={c.id}>
                <div style={{padding:wide?"18px 22px":"15px 18px",borderBottom:editId===c.id?`1px solid ${G[100]}`:i<courses.length-1?`1px solid ${G[50]}`:"none",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:wide?62:52,height:wide?62:52,background:G[50],borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",fontSize:wide?30:24}}>
                    {c.iconImg?<img src={c.iconImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:c.icon}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:wide?17:15,color:G[900]}}>{c.name}</div>
                    <div style={{fontSize:wide?14:12,color:G[400],marginTop:2}}>NT${c.price}/組  最多 {c.maxGroups} 組  {c.slots.join(" / ")}</div>
                    <div style={{fontSize:wide?13:11,color:G[300]}}>平日 ≥{c.minWd} 組  假日 ≥{c.minHd} 組</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>setEditId(editId===c.id?null:c.id)} style={{background:G[100],color:G[600],border:"none",borderRadius:8,padding:wide?"9px 14px":"7px 10px",cursor:"pointer",fontSize:wide?14:12,fontFamily:FF,display:"flex",alignItems:"center",gap:3}}><Ic.Edit s={wide?14:12} c={G[600]}/>編輯</button>
                    <button onClick={()=>toggleCourse(c.id)} style={{background:c.active?GRB:G[100],color:c.active?GR:G[500],border:"none",borderRadius:8,padding:wide?"9px 14px":"7px 10px",cursor:"pointer",fontSize:wide?14:12,fontFamily:FF,fontWeight:600}}>{c.active?"上架":"下架"}</button>
                  </div>
                </div>
                {editId===c.id&&<CourseEditForm c={c}/>}
              </div>
            ))}
          </div>
          {addMode?<div style={st.CARD}>
            <div style={{fontWeight:700,fontSize:16,color:G[900],marginBottom:16}}>新增 DIY 課程</div>
            <div style={{display:"grid",gridTemplateColumns:wide?"1fr 1fr":"1fr",gap:12,marginBottom:12}}>
              {[["課程名稱","text",nc.name,v=>setNc(p=>({...p,name:v})),"抹茶蛋糕"],["圖示 Emoji","text",nc.icon,v=>setNc(p=>({...p,icon:v})),"🎨"],["價格（元/組）","number",nc.price,v=>setNc(p=>({...p,price:v})),"150"],["最大預約組數","number",nc.maxGroups,v=>setNc(p=>({...p,maxGroups:v})),"10"],["平日最低開課組數","number",nc.minWd,v=>setNc(p=>({...p,minWd:Number(v)})),"4"],["假日最低開課組數","number",nc.minHd,v=>setNc(p=>({...p,minHd:Number(v)})),"1"]].map(([label,type,val,cb,ph])=>(
                <div key={label}><div style={{fontSize:13,color:G[500],fontWeight:600,marginBottom:6}}>{label}</div>
                  <input type={type} value={val} onChange={e=>cb(e.target.value)} placeholder={ph} style={{...st.INP,padding:"11px 12px",fontSize:14}}/></div>
              ))}
            </div>
            {[["未達門檻說明","text",nc.fallbackWd,v=>setNc(p=>({...p,fallbackWd:v})),"改做翻糖蛋糕"],["可預約時段（逗號分隔）","text",nc.slots,v=>setNc(p=>({...p,slots:v})),"09:30,10:40"]].map(([label,type,val,cb,ph])=>(
              <div key={label} style={{marginBottom:12}}><div style={{fontSize:13,color:G[500],fontWeight:600,marginBottom:6}}>{label}</div>
                <input type={type} value={val} onChange={e=>cb(e.target.value)} placeholder={ph} style={{...st.INP,padding:"11px 12px",fontSize:14}}/></div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:6}}>
              <button style={{...st.BTN_O,flex:1}} onClick={()=>setAddMode(false)}>取消</button>
              <button style={{...st.BTN_P,flex:1,opacity:nc.name&&nc.price&&nc.maxGroups?1:.4}} disabled={!nc.name||!nc.price||!nc.maxGroups} onClick={addCourse}>新增課程</button>
            </div>
          </div>:<button onClick={()=>setAddMode(true)} style={{...st.BTN_O,width:"calc(100% - 32px)",margin:"0 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Ic.Plus s={16} c={P}/>新增 DIY 課程</button>}
        </>}

        {/* SETTINGS — IV.1 merged with appearance, IV.2 live preview, IV.3 color picker */}
        {tab==="settings"&&<SettingsTab S={S} setS={setS} P={P} st={st} wide={wide} showToast={showToast}
          bannerImg={bannerImg} setBannerImg={setBannerImg}
          successImg={successImg} setSuccessImg={setSuccessImg}
          carouselImgs={carouselImgs} setCarouselImgs={setCarouselImgs}
          setCarImg={setCarImg} removeCarSlot={removeCarSlot}
          bookings={bookings}/>}
      </div>

      {/* III.2 — no-show modal */}
      {noShowModal&&<Modal title="確認客人未到嗎？" confirmBg="#2563EB" confirmLabel="確認未到" onConfirm={()=>confirmNoShow(noShowModal)} onCancel={()=>setNoShowModal(null)}/>}
      {cancelModal&&<Modal title="確認取消預約" desc="確定要取消這筆預約嗎？" confirmBg={P} onConfirm={()=>cancelB(cancelModal)} onCancel={()=>setCancelModal(null)}/>}
    </div>
  );
}

// ── IV. Settings tab with live preview ────────────────────────────────────────
function SettingsTab({S,setS,P,st,wide,showToast,bannerImg,setBannerImg,successImg,setSuccessImg,carouselImgs,setCarouselImgs,setCarImg,removeCarSlot,bookings}){
  const[d,setD]=useState({...S,staffEmails:[...S.staffEmails],fieldLabels:{...S.fieldLabels}});
  const[newEmail,setNewEmail]=useState("");
  const save=async()=>{
    setS(d);
    showToast("儲存中...");
    try {
      const {supabase}=await import("./supabase");

      // 1. 儲存文字設定
      const textKeys=["shopName","shopSubtitle","phone","mapUrl","address","hours",
        "noticeTitle","noticeBody","primaryColor","sidebarName","fieldLabels"];
      await Promise.all(textKeys.map(k=>saveSetting(k,(d as any)[k])));

      // 2. 圖片上傳到 Supabase Storage（比存 base64 在 DB 更穩定）
      async function uploadImg(key:string, dataUrl:string|null){
        if(!dataUrl){ await saveSetting(key,null); return; }
        // 已經是 storage URL 則直接存
        if(dataUrl.startsWith("http")){ await saveSetting(key,dataUrl); return; }
        // base64 → blob → upload
        const res=await fetch(dataUrl);
        const blob=await res.blob();
        const ext=blob.type.includes("png")?"png":"jpg";
        const path=`${key}-${Date.now()}.${ext}`;
        const{data,error}=await supabase.storage
          .from("site-images")
          .upload(path,blob,{upsert:true,contentType:blob.type});
        if(error){ console.error("upload error",error);
          // 退而儲存 base64（小圖仍可用）
          await saveSetting(key,dataUrl); return;
        }
        const{data:{publicUrl}}=supabase.storage.from("site-images").getPublicUrl(data.path);
        await saveSetting(key,publicUrl);
        // 更新本地 state 為 URL（避免下次再上傳）
        if(key==="bannerImg") setBannerImg(publicUrl);
        if(key==="successImg") setSuccessImg(publicUrl);
      }

      await uploadImg("bannerImg",bannerImg);
      await uploadImg("successImg",successImg);
      // 輪播圖逐張上傳
      const uploadedCarousel=await Promise.all(
        carouselImgs.map(async(img,i)=>{
          if(!img) return null;
          if(img.startsWith("http")) return img;
          const res=await fetch(img);
          const blob=await res.blob();
          const ext=blob.type.includes("png")?"png":"jpg";
          const path=`carousel-${i}-${Date.now()}.${ext}`;
          const{data,error}=await supabase.storage
            .from("site-images")
            .upload(path,blob,{upsert:true,contentType:blob.type});
          if(error){ return img; } // 失敗退回 base64
          const{data:{publicUrl}}=supabase.storage.from("site-images").getPublicUrl(data.path);
          return publicUrl;
        })
      );
      setCarouselImgs(uploadedCarousel);
      await saveSetting("carouselImgs",uploadedCarousel);

      showToast("設定已儲存！");
    } catch(e){
      console.error("save error",e);
      showToast("儲存時發生錯誤，請再試一次","error");
    }
  };
  const addEmail=()=>{if(newEmail&&!d.staffEmails.includes(newEmail)){setD(p=>({...p,staffEmails:[...p.staffEmails,newEmail]}));setNewEmail("");}};
  const removeEmail=e=>setD(p=>({...p,staffEmails:p.staffEmails.filter(x=>x!==e)}));

  // IV.2 — live preview component using draft `d`
  const prevP=d.primaryColor;
  const LivePreview=()=>(
    <div style={{marginBottom:24}}>
      <div style={{fontSize:14,fontWeight:700,color:G[700],marginBottom:10}}>即時預覽</div>
      <div style={{border:`1.5px solid ${G[200]}`,borderRadius:16,overflow:"hidden",background:"#fff",boxShadow:"0 2px 12px rgba(0,0,0,.08)"}}>
        {/* Mini banner */}
        <div style={{height:90,overflow:"hidden"}}>
          {bannerImg?<img src={bannerImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
            :<div style={{height:"100%",background:`linear-gradient(150deg,${prevP}88,${prevP},${prevP}dd)`}}/>}
        </div>
        {/* Title area */}
        <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${G[100]}`}}>
          <div style={{fontSize:17,fontWeight:800,color:G[900],marginBottom:3}}>{d.shopName||"（店名）"}</div>
          <div style={{fontSize:12,color:G[500]}}>{d.shopSubtitle||"（副標題）"}</div>
          <div style={{display:"flex",gap:14,marginTop:10}}>
            <span style={{fontSize:12,color:G[600],display:"flex",alignItems:"center",gap:4}}><Ic.Phone s={12} c={G[400]}/>{d.phone}</span>
            <span style={{fontSize:12,color:G[600],display:"flex",alignItems:"center",gap:4}}><Ic.Pin s={12} c={G[400]}/>查看地圖</span>
          </div>
        </div>
        {/* Sample buttons */}
        <div style={{padding:"14px 16px",display:"flex",gap:10}}>
          <div style={{background:prevP,color:"#fff",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,display:"inline-block"}}>確認預約</div>
          <div style={{background:"#fff",color:prevP,border:`1.5px solid ${prevP}`,borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,display:"inline-block",marginLeft:8}}>取消</div>
        </div>
        {/* Sample pill */}
        <div style={{padding:"0 16px 14px",display:"flex",gap:8}}>
          <div style={{background:prevP,color:"#fff",borderRadius:24,padding:"8px 16px",fontSize:13,fontWeight:700}}>翻糖蛋糕</div>
          <div style={{background:"#fff",color:G[700],border:`1.5px solid ${G[200]}`,borderRadius:24,padding:"8px 16px",fontSize:13}}>杯子蛋糕</div>
        </div>
      </div>
      <div style={{fontSize:11,color:G[400],marginTop:6,textAlign:"center"}}>↑ 修改設定後即時反映，按「儲存設定」才會正式生效</div>
    </div>
  );

  const Sec=({title,children})=>(
    <div style={{marginBottom:22}}>
      <div style={{fontSize:14,fontWeight:700,color:G[700],marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${G[100]}`}}>{title}</div>
      {children}
    </div>
  );
  const F=({label,val,onChange,multiline=false,type="text"})=>(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:600,color:G[600],marginBottom:6}}>{label}</div>
      {multiline
        ?<textarea value={val} onChange={e=>onChange(e.target.value)} rows={4} style={{...st.INP,resize:"vertical",lineHeight:1.8,fontSize:14,padding:"12px 14px"}}/>
        :<input type={type} value={val} onChange={e=>onChange(e.target.value)} style={{...st.INP,padding:"11px 13px",fontSize:14}}/>}
    </div>
  );

  return(
    <div style={{...st.CARD,margin:wide?"0 0 24px":undefined}}>
      <div style={{fontWeight:700,fontSize:wide?20:16,color:G[900],marginBottom:2}}>外觀與設定</div>
      <div style={{fontSize:wide?15:13,color:G[400],marginBottom:20}}>修改後按底部「儲存設定」生效</div>

      {/* IV.2 — live preview */}
      <LivePreview/>

      <Sec title="店家資訊">
        <div style={{display:wide?"grid":undefined,gridTemplateColumns:wide?"1fr 1fr":undefined,gap:wide?12:undefined}}>
          <F label="店名（預約頁主標題）" val={d.shopName} onChange={v=>setD(p=>({...p,shopName:v}))}/>
          <F label="側欄顯示名稱（電腦版左側）" val={d.sidebarName||""} onChange={v=>setD(p=>({...p,sidebarName:v}))}/>
          <F label="副標題" val={d.shopSubtitle} onChange={v=>setD(p=>({...p,shopSubtitle:v}))}/>
          <F label="聯絡電話" val={d.phone} onChange={v=>setD(p=>({...p,phone:v}))}/>
          <F label="查看地圖連結（URL）" val={d.mapUrl} onChange={v=>setD(p=>({...p,mapUrl:v}))}/>
          <F label="地址" val={d.address} onChange={v=>setD(p=>({...p,address:v}))}/>
          <F label="營業時間" val={d.hours} onChange={v=>setD(p=>({...p,hours:v}))}/>
        </div>
      </Sec>

      <Sec title="預約表單欄位名稱">
        <div style={{fontSize:12,color:G[400],marginBottom:10}}>可自由修改以下六個欄位的標題文字（功能不變）</div>
        <div style={{display:wide?"grid":undefined,gridTemplateColumns:wide?"1fr 1fr 1fr":undefined,gap:wide?12:undefined}}>
          {[["DIY 課程標題","course"],["預約日期標題","date"],["預約時段標題","slot"],["預約組數標題","groups"],["姓名標題","name"],["聯絡電話標題","phone"]].map(([label,key])=>(
            <div key={key} style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:G[600],marginBottom:6}}>{label}</div>
              <input value={d.fieldLabels?.[key]||""} onChange={e=>setD(p=>({...p,fieldLabels:{...p.fieldLabels,[key]:e.target.value}}))} style={{...st.INP,padding:"11px 13px",fontSize:14}}/>
            </div>
          ))}
        </div>
      </Sec>

      <Sec title="課程開課說明">
        <F label="說明標題" val={d.noticeTitle} onChange={v=>setD(p=>({...p,noticeTitle:v}))}/>
        <F label="說明內容（換行用 Enter）" val={d.noticeBody} onChange={v=>setD(p=>({...p,noticeBody:v}))} multiline/>
      </Sec>

      {/* IV.3 — color picker */}
      <Sec title="主題色">
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
          <input type="color" value={d.primaryColor} onChange={e=>setD(p=>({...p,primaryColor:e.target.value}))}
            style={{width:52,height:52,borderRadius:12,border:`1.5px solid ${G[200]}`,cursor:"pointer",padding:2,background:"#fff"}}/>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:G[900]}}>{d.primaryColor}</div>
            <div style={{fontSize:12,color:G[400],marginTop:2}}>影響按鈕、選取、圖示等主色系</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["#F97316","#EF4444","#3B82F6","#10B981","#8B5CF6","#F59E0B","#EC4899","#14B8A6"].map(c=>(
            <div key={c} onClick={()=>setD(p=>({...p,primaryColor:c}))}
              style={{width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:`3px solid ${d.primaryColor===c?"#111":"transparent"}`,transition:"border .15s"}}/>
          ))}
        </div>
      </Sec>

      <Sec title="頁面圖片">
        <div style={{display:wide?"grid":undefined,gridTemplateColumns:wide?"1fr 1fr":undefined,gap:wide?16:undefined}}>
          <ImgUpload label="首頁橫幅（Banner）" sub="建議 750×300px" value={bannerImg} onChange={setBannerImg} height={120}/>
          <ImgUpload label="預約成功頁封面" sub="建議 750×380px" value={successImg} onChange={setSuccessImg} height={120}/>
        </div>
      </Sec>

      <Sec title="輪播相簿（不限張數）">
        <div style={{fontSize:12,color:G[400],marginBottom:10}}>建議 750×450px · 自動輪播</div>
        <div style={{display:"grid",gridTemplateColumns:wide?"repeat(4,1fr)":"1fr 1fr",gap:10}}>
          {carouselImgs.map((img,i)=>(
            <div key={i} style={{position:"relative"}}>
              <ImgUpload value={img} onChange={v=>setCarImg(i,v)} height={90}/>
              <button onClick={()=>removeCarSlot(i)} style={{position:"absolute",top:0,right:0,background:RD,color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontSize:11}}>✕</button>
              <div style={{fontSize:11,color:G[400],textAlign:"center",marginTop:2}}>第 {i+1} 張</div>
            </div>
          ))}
          <div onClick={()=>setCarouselImgs(p=>[...p,null])}
            style={{height:90,border:`2px dashed ${G[200]}`,borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4,color:G[400]}}>
            <Ic.Plus s={18} c={G[300]}/><span style={{fontSize:12}}>新增一張</span>
          </div>
        </div>
      </Sec>

      <Sec title="資料匯出">
        <button onClick={()=>exportCSV(bookings)} style={{...st.BTN_O,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Ic.Download s={15} c={P}/>匯出所有預約紀錄（CSV）
        </button>
        <div style={{fontSize:12,color:G[400],marginTop:8,lineHeight:1.7}}>CSV 可直接用 Excel 或 Google Sheets 開啟。自動同步 Google Sheets 請見串接教學。</div>
      </Sec>

      <button onClick={save} style={{...st.BTN_P,width:"100%"}}>儲存設定</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
function App(){
  const[tab,setTab]=useState("booking");
  const[bookings,setBookings]=useState(INIT_BK);
  const[courses,setCourses]=useState(INIT_COURSES);
  const[bannerImg,setBannerImg]=useState(null);
  const[successImg,setSuccessImg]=useState(null);
  const[carouselImgs,setCarouselImgs]=useState([null,null,null,null]);
  const[S,setS]=useState(INIT_S);
  const[toast,setToast]=useState(null);
  const[loading,setLoading]=useState(true);

  // 初次載入：從資料庫讀取資料
  useEffect(()=>{
    async function init(){
      try {
        const [bks, crs, saved] = await Promise.all([
          getBookings(), getCourses(), getSettings()
        ]);
        if(bks.length>0) setBookings(bks);
        if(crs.length>0) setCourses(crs);
        if(saved.shopName) setS((p:any)=>({...p,...saved}));
        // 載入圖片設定
        if(saved.bannerImg) setBannerImg(saved.bannerImg);
        if(saved.successImg) setSuccessImg(saved.successImg);
        if(saved.carouselImgs) setCarouselImgs(saved.carouselImgs);
      } catch(e){ console.error(e); }
      setLoading(false);
    }
    init();
  },[]);
  const wide=useWide();
  const P=S.primaryColor;

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};
  const shared={bookings,setBookings,S,P,showToast};
  const TABS=[{id:"booking",label:"預約系統",I:Ic.BkCal},{id:"query",label:"查詢系統",I:Ic.Search},{id:"staff",label:"員工專用",I:Ic.Person}];

  return(
    <div style={{background:wide?"#E2E8F0":"#CBD5E1",minHeight:"100vh",fontFamily:FF}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input[type=date]::-webkit-calendar-picker-indicator{opacity:.5;cursor:pointer;}select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px;}input:focus,select:focus{border-color:${P}!important;outline:none;}button:active{transform:scale(.97);}textarea:focus{border-color:${P}!important;outline:none;}`}</style>

      {wide
        ?<div style={{display:"flex",minHeight:"100vh"}}>
          {/* Desktop sidebar */}
          <div style={{width:200,background:"#fff",borderRight:`1px solid ${G[100]}`,display:"flex",flexDirection:"column",padding:"24px 0",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
            <div style={{padding:"0 20px 24px",borderBottom:`1px solid ${G[100]}`}}>
              <div style={{fontSize:15,fontWeight:800,color:G[900]}}>{S.sidebarName||S.shopName}</div>
            </div>
            <nav style={{flex:1,padding:"12px 0"}}>
              {TABS.map(({id,label,I})=>{
                const a=tab===id;
                return(
                  <button key={id} onClick={()=>setTab(id)}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 20px",background:a?`${P}12`:"none",border:"none",cursor:"pointer",fontFamily:FF,color:a?P:G[500],fontSize:15,fontWeight:a?700:400,borderLeft:`3px solid ${a?P:"transparent"}`,textAlign:"left"}}>
                    <I s={20} c={a?P:G[400]}/>{label}
                  </button>
                );
              })}
            </nav>
          </div>
          {/* Main content */}
          <div style={{flex:1,overflow:"auto",position:"relative"}}>
            {toast&&<Toast msg={toast.msg} type={toast.type}/>}
            {tab==="booking"&&<BookingPage {...shared} courses={courses} bannerImg={bannerImg} successImg={successImg} carouselImgs={carouselImgs}/>}
            {tab==="query"&&<QueryPage {...shared}/>}
            {tab==="staff"&&<StaffPage {...shared} courses={courses} setCourses={setCourses} bannerImg={bannerImg} setBannerImg={setBannerImg} successImg={successImg} setSuccessImg={setSuccessImg} carouselImgs={carouselImgs} setCarouselImgs={setCarouselImgs} S={S} setS={setS}/>}
          </div>
        </div>
        // Mobile
        :<div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:G[50],position:"relative"}}>
          {toast&&<Toast msg={toast.msg} type={toast.type}/>}
          <div style={{height:"calc(100vh - 60px)",overflowY:"auto"}}>
            {tab==="booking"&&<BookingPage {...shared} courses={courses} bannerImg={bannerImg} successImg={successImg} carouselImgs={carouselImgs}/>}
            {tab==="query"&&<QueryPage {...shared}/>}
            {tab==="staff"&&<StaffPage {...shared} courses={courses} setCourses={setCourses} bannerImg={bannerImg} setBannerImg={setBannerImg} successImg={successImg} setSuccessImg={setSuccessImg} carouselImgs={carouselImgs} setCarouselImgs={setCarouselImgs} S={S} setS={setS}/>}
          </div>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#fff",borderTop:`1px solid ${G[100]}`,display:"flex",height:60}}>
            {TABS.map(({id,label,I})=>{
              const a=tab===id;
              return(
                <button key={id} onClick={()=>setTab(id)}
                  style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,fontFamily:FF,color:a?P:G[400]}}>
                  <I s={22} c={a?P:G[400]}/><span style={{fontSize:11,fontWeight:a?700:400}}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      }
    </div>
  );
}

export default dynamic(() => Promise.resolve(App), { ssr: false });