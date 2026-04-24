import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design tokens — warm cartoon factory palette ─────────────────────────────
const T = {
  bg:       "#1C1208",
  panel:    "#2A1C0E",
  border:   "#5C3A1E",
  rust:     "#C94B1A",
  amber:    "#E8A020",
  cream:    "#F5E6C8",
  tan:      "#C8915A",
  olive:    "#5C6B2A",
  teal:     "#2A8C7A",
  sky:      "#3A8CC4",
  cols: [
    "#E84040","#E87820","#E8C020","#60C840",
    "#20B8C8","#4060E8","#A040E8","#E840A0",
    "#40E880","#E86020","#C8E820",
  ],
  ink:      "#1C0E04",
  text:     "#F0DDB8",
  muted:    "#8C6A3A",
  dim:      "#4A3018",
  font:     "'Courier New','Lucida Console',monospace",
};

const CW = 720, CRATE_W = 76, CRATE_H = 60, MAX_LIVES = 3;
const CRATES_PER_LEVEL = 15;

const DIFF = {
  easy:   { speed:0.52, gap:195, speedInc:0.12, gapDec:18, label:"EASY",   color:"#60C840" },
  medium: { speed:0.92, gap:132, speedInc:0.16, gapDec:15, label:"MEDIUM", color:"#E8C020" },
  hard:   { speed:1.52, gap:86,  speedInc:0.20, gapDec:11, label:"HARD",   color:"#E84040" },
};

const MCFG = [
  {multiple:2},{multiple:3},{multiple:4},{multiple:5},{multiple:6},
  {multiple:7},{multiple:8},{multiple:9},{multiple:10},{multiple:11},{multiple:12},
].map((m,i)=>({...m, color:T.cols[i]}));

const CHARS = ["🤖","👷","🧑‍🏭","🦾","🐱","🐸"];
const BELT_COLORS = [T.rust, T.teal, T.olive];

function getCfg(m){ return MCFG.find(c=>c.multiple===m)||MCFG[0]; }
function getTimesTable(m){ return Array.from({length:12},(_,i)=>(i+1)*m); }
function getTodaySeed(){
  const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}

// ─── Belt generation ──────────────────────────────────────────────────────────
function makeBelt(multiple, bi, gap, level=1, allowSpecials=true){
  const table=[...getTimesTable(multiple)].sort(()=>Math.random()-0.5);
  const nonPool=[];
  for(let i=2;i<=144;i++) if(i%multiple!==0) nonPool.push(i);
  nonPool.sort(()=>Math.random()-0.5);
  const nums=[]; let ti=0,ni=0;
  for(let i=0;i<10;i++){
    if(Math.random()<0.40&&ti<table.length) nums.push({value:table[ti++],isCorrect:true,special:null});
    else if(ni<nonPool.length) nums.push({value:nonPool[ni++],isCorrect:false,special:null});
    else nums.push({value:table[ti++],isCorrect:true,special:null});
  }
  nums.sort(()=>Math.random()-0.5);
  if(allowSpecials){
    if(Math.random()<0.18) nums.splice(Math.floor(Math.random()*nums.length),0,{value:"❤️",isCorrect:true,special:"life"});
    if(Math.random()<0.13){
      const mv=[2,3,5][Math.floor(Math.random()*3)];
      nums.splice(Math.floor(Math.random()*nums.length),0,{value:`×${mv}`,isCorrect:true,special:"mult",multVal:mv});
    }
  }
  const MIN_GAP = 28;
  const baseGap = Math.max(gap, MIN_GAP);
  const batchOffset = Math.random() * (CRATE_W + baseGap) * 2;
  let cursor = -(CRATE_W + 20) - batchOffset;
  return nums.map((n,i)=>{
    const x = cursor;
    const jitter = Math.random() * baseGap * 0.5;
    cursor -= (CRATE_W + baseGap + jitter);
    return {
      id:`b${bi}-${Date.now()}-${i}-${Math.random()}`,
      value:n.value, isCorrect:n.isCorrect, special:n.special||null, multVal:n.multVal||null,
      x, caught:false, missed:false,
    };
  });
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function WoodBg(){
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",
      backgroundImage:`repeating-linear-gradient(90deg,rgba(0,0,0,0.06) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,0) 40px),repeating-linear-gradient(0deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0) 1px,rgba(0,0,0,0) 60px)`,
    }}/>
  );
}

function Btn({label,onClick,color=T.rust,size="md",style={},disabled=false}){
  const pad=size==="lg"?"18px 48px":size==="sm"?"9px 18px":"13px 28px";
  const fs=size==="lg"?18:size==="sm"?12:15;
  const shadow=size==="lg"?5:size==="sm"?2:4;
  return (
    <button onClick={disabled?undefined:onClick} style={{
      background:disabled?"#2A1C0E":color,
      border:`${size==="lg"?4:3}px solid ${disabled?T.dim:T.ink}`,
      color:disabled?T.dim:T.ink,
      padding:pad,borderRadius:8,cursor:disabled?"not-allowed":"pointer",
      fontSize:fs,fontWeight:900,fontFamily:T.font,letterSpacing:1.5,
      transition:"all 0.1s",opacity:disabled?0.5:1,
      boxShadow:disabled?"none":`${shadow}px ${shadow}px 0 ${T.ink}`,
      lineHeight:1,
      ...style,
    }}
      onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform="translate(-2px,-2px)";e.currentTarget.style.boxShadow=`${shadow+2}px ${shadow+2}px 0 ${T.ink}`;}}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translate(0,0)";e.currentTarget.style.boxShadow=disabled?"none":`${shadow}px ${shadow}px 0 ${T.ink}`;}}
    >{label}</button>
  );
}

function Label({children,color=T.muted,size="sm"}){
  const fs=size==="lg"?14:size==="md"?11:9;
  return <div style={{fontSize:fs,letterSpacing:3,color,fontFamily:T.font,fontWeight:900,textTransform:"uppercase"}}>{children}</div>;
}

function Panel({children,style={}}){
  return (
    <div style={{
      background:T.panel,border:`3px solid ${T.border}`,borderRadius:10,padding:24,
      boxShadow:`5px 5px 0 ${T.ink}44`,...style
    }}>{children}</div>
  );
}

// ─── Cartoon Crate SVG ────────────────────────────────────────────────────────
function CartoonCrate({value,color,isLife,isMult,nearCursor,beltColor,onClick,x,style={}}){
  const outlineColor=T.ink;
  const bgColor=isLife?"#E84040":isMult?color:nearCursor?`${beltColor}44`:"#C8915A";
  const woodColor=isLife?"#C83030":isMult?`${color}cc`:"#B07840";
  return (
    <div onClick={onClick} style={{
      position:"absolute",left:x,top:0,width:CRATE_W,height:CRATE_H,
      cursor:"pointer",zIndex:2,...style
    }}>
      <svg width={CRATE_W} height={CRATE_H} viewBox={`0 0 ${CRATE_W} ${CRATE_H}`} style={{overflow:"visible"}}>
        <rect x="4" y="4" width={CRATE_W-4} height={CRATE_H-4} rx="5" fill={T.ink} opacity="0.4"/>
        <rect x="0" y="0" width={CRATE_W-4} height={CRATE_H-4} rx="5" fill={bgColor} stroke={outlineColor} strokeWidth="3"/>
        <line x1="0" y1={CRATE_H*0.35} x2={CRATE_W-4} y2={CRATE_H*0.36} stroke={woodColor} strokeWidth="2.5" opacity="0.5"/>
        <line x1="0" y1={CRATE_H*0.65} x2={CRATE_W-4} y2={CRATE_H*0.64} stroke={woodColor} strokeWidth="2.5" opacity="0.5"/>
        <line x1={CRATE_W*0.33} y1="0" x2={CRATE_W*0.32} y2={CRATE_H-4} stroke={woodColor} strokeWidth="2.5" opacity="0.5"/>
        <line x1={CRATE_W*0.67} y1="0" x2={CRATE_W*0.68} y2={CRATE_H-4} stroke={woodColor} strokeWidth="2.5" opacity="0.5"/>
        {[[6,5],[CRATE_W-10,5],[6,CRATE_H-9],[CRATE_W-10,CRATE_H-9]].map(([cx,cy],i)=>(
          <circle key={i} cx={cx} cy={cy} r="4" fill="#8C6A3A" stroke={outlineColor} strokeWidth="1.5"/>
        ))}
        {(isLife||isMult||nearCursor)&&(
          <rect x="2" y="2" width={CRATE_W-8} height={CRATE_H-8} rx="4"
            fill="none" stroke={isLife?"#FF8888":isMult?color:beltColor} strokeWidth="2" opacity="0.7"/>
        )}
        <text
          x={(CRATE_W-4)/2} y={CRATE_H/2-2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={isLife?18:isMult?16:value>=100?15:value>=10?18:20}
          fontWeight="900" fontFamily="'Courier New',monospace"
          fill={isLife?"#FFF":isMult?"#FFF":nearCursor?beltColor:T.ink}
          stroke={isLife||isMult||nearCursor?"none":T.cream}
          strokeWidth="3" paintOrder="stroke"
        >{value}</text>
      </svg>
    </div>
  );
}

// ─── FOREMAN REED ─────────────────────────────────────────────────────────────
function ForemanReed({emotion="stern",size=1,talking=false}){
  const angry=emotion==="angry";
  const w=140*size, h=220*size;
  const browInnerL = angry?[52,26]:[46,32];
  const browOuterL = angry?[38,32]:[38,28];
  const browInnerR = angry?[88,26]:[94,32];
  const browOuterR = angry?[102,32]:[102,28];
  const mouthD     = angry?"M 52 82 Q 60 74 68 82":"M 50 80 Q 60 88 70 80";
  const eyeY       = angry?50:48;
  const pupilOff   = talking?1:0;

  return (
    <svg width={w} height={h} viewBox="0 0 140 220" style={{overflow:"visible",filter:`drop-shadow(3px 4px 0 ${T.ink}88)`}}>
      <rect x="42" y="108" width="56" height="72" rx="6" fill="#3A5C8C" stroke={T.ink} strokeWidth="3"/>
      <rect x="50" y="108" width="40" height="36" rx="4" fill="#4A78B0" stroke={T.ink} strokeWidth="2"/>
      <rect x="50" y="90" width="12" height="30" rx="5" fill="#3A5C8C" stroke={T.ink} strokeWidth="2"/>
      <rect x="78" y="90" width="12" height="30" rx="5" fill="#3A5C8C" stroke={T.ink} strokeWidth="2"/>
      <rect x="14" y="108" width="30" height="18" rx="9" fill="#E8C090" stroke={T.ink} strokeWidth="3"/>
      <rect x="96" y="108" width="30" height="18" rx="9" fill="#E8C090" stroke={T.ink} strokeWidth="3"/>
      <circle cx="22" cy="132" r="12" fill="#E8A870" stroke={T.ink} strokeWidth="3"/>
      <circle cx="118" cy="132" r="12" fill="#E8A870" stroke={T.ink} strokeWidth="3"/>
      <rect x="56" y="116" width="28" height="20" rx="3" fill="#3A6898" stroke={T.ink} strokeWidth="1.5"/>
      <rect x="72" y="112" width="4" height="18" rx="2" fill="#E8C020" stroke={T.ink} strokeWidth="1"/>
      <polygon points="72,130 76,130 74,136" fill="#E84040"/>
      <rect x="48" y="174" width="22" height="36" rx="6" fill="#2A4A70" stroke={T.ink} strokeWidth="3"/>
      <rect x="70" y="174" width="22" height="36" rx="6" fill="#2A4A70" stroke={T.ink} strokeWidth="3"/>
      <ellipse cx="59" cy="210" rx="18" ry="8" fill="#1C1208" stroke={T.ink} strokeWidth="2"/>
      <ellipse cx="81" cy="210" rx="18" ry="8" fill="#1C1208" stroke={T.ink} strokeWidth="2"/>
      <rect x="56" y="88" width="28" height="22" rx="6" fill="#E8A870" stroke={T.ink} strokeWidth="3"/>
      <rect x="24" y="30" width="92" height="72" rx="18" fill="#E8A870" stroke={T.ink} strokeWidth="3.5"/>
      {angry&&<>
        <ellipse cx="36" cy="72" rx="10" ry="6" fill="#E87070" opacity="0.5"/>
        <ellipse cx="104" cy="72" rx="10" ry="6" fill="#E87070" opacity="0.5"/>
      </>}
      <ellipse cx="24" cy="68" rx="9" ry="12" fill="#E8A870" stroke={T.ink} strokeWidth="3"/>
      <ellipse cx="116" cy="68" rx="9" ry="12" fill="#E8A870" stroke={T.ink} strokeWidth="3"/>
      <ellipse cx="70" cy="34" rx="52" ry="9" fill="#C84A10" stroke={T.ink} strokeWidth="3"/>
      <ellipse cx="70" cy="22" rx="44" ry="22" fill="#E85A18" stroke={T.ink} strokeWidth="3"/>
      <path d="M 28 28 Q 70 22 112 28" stroke="#E8A020" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M 26 34 Q 70 30 114 34" stroke={T.ink} strokeWidth="1.5" fill="none" opacity="0.3"/>
      <ellipse cx="50" cy={eyeY} rx="10" ry="10" fill="white" stroke={T.ink} strokeWidth="2.5"/>
      <ellipse cx="90" cy={eyeY} rx="10" ry="10" fill="white" stroke={T.ink} strokeWidth="2.5"/>
      <circle cx={50+pupilOff} cy={eyeY+1} r="5" fill="#1C0E04"/>
      <circle cx={90+pupilOff} cy={eyeY+1} r="5" fill="#1C0E04"/>
      <circle cx={48+pupilOff} cy={eyeY-2} r="2" fill="white"/>
      <circle cx={88+pupilOff} cy={eyeY-2} r="2" fill="white"/>
      {angry&&<>
        <ellipse cx="50" cy={eyeY-4} rx="10" ry="5" fill="#E8A870"/>
        <ellipse cx="90" cy={eyeY-4} rx="10" ry="5" fill="#E8A870"/>
      </>}
      <path d={`M ${browOuterL[0]} ${browOuterL[1]} Q 46 ${angry?20:24} ${browInnerL[0]} ${browInnerL[1]}`}
        stroke={T.ink} strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d={`M ${browInnerR[0]} ${browInnerR[1]} Q 94 ${angry?20:24} ${browOuterR[0]} ${browOuterR[1]}`}
        stroke={T.ink} strokeWidth="5" fill="none" strokeLinecap="round"/>
      <ellipse cx="70" cy="68" rx="6" ry="5" fill="#D89060" stroke={T.ink} strokeWidth="1.5"/>
      <path d={mouthD} stroke={T.ink} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      {talking&&<ellipse cx="60" cy="82" rx="6" ry="4" fill={T.ink} opacity="0.15"/>}
      <path d="M 44 72 Q 55 78 60 72 Q 65 78 76 72 Q 82 78 96 72"
        stroke={T.ink} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <rect x="96" y="118" width="32" height="42" rx="3" fill="#C8A060" stroke={T.ink} strokeWidth="2"/>
      <rect x="98" y="120" width="28" height="38" rx="2" fill="#F5E6C8"/>
      <rect x="107" y="116" width="10" height="7" rx="2" fill="#8C6030" stroke={T.ink} strokeWidth="1.5"/>
      <line x1="101" y1="128" x2="123" y2="128" stroke={T.muted} strokeWidth="1.5"/>
      <line x1="101" y1="134" x2="123" y2="134" stroke={T.muted} strokeWidth="1.5"/>
      <line x1="101" y1="140" x2="118" y2="140" stroke={T.muted} strokeWidth="1.5"/>
      <line x1="101" y1="146" x2="121" y2="146" stroke={T.muted} strokeWidth="1.5"/>
      {angry&&<>
        <circle cx="20" cy="52" r="6" fill="#CCCCCC" opacity="0.6"/>
        <circle cx="14" cy="42" r="4" fill="#CCCCCC" opacity="0.4"/>
        <circle cx="120" cy="52" r="6" fill="#CCCCCC" opacity="0.6"/>
        <circle cx="126" cy="42" r="4" fill="#CCCCCC" opacity="0.4"/>
      </>}
    </svg>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("landing");
  const [gameConfig,setGameConfig]=useState({diff:"easy",mode:"solo",multiples:[2]});
  const [lastResult,setLastResult]=useState(null);
  const [character,setCharacter]=useState("🤖");

  if(screen==="landing")    return <Landing    onPlay={()=>setScreen("cutscene")}/>;
  if(screen==="cutscene")   return <Cutscene   onDone={()=>setScreen("modeselect")}/>;
  if(screen==="modeselect") return <ModeSelect character={character} setCharacter={setCharacter} config={gameConfig} setConfig={setGameConfig} onStart={()=>setScreen("game")} onBack={()=>setScreen("landing")}/>;
  if(screen==="game")       return <Game       config={gameConfig} character={character} onEnd={r=>{setLastResult(r);setScreen("summary");}} onMenu={()=>setScreen("modeselect")}/>;
  if(screen==="summary")    return <Summary    result={lastResult} onPlay={()=>setScreen("game")} onMenu={()=>setScreen("modeselect")}/>;
  return null;
}

// ─── LANDING ─────────────────────────────────────────────────────────────────
function Landing({onPlay}){
  const [tick,setTick]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setTick(p=>p+1),50); return ()=>clearInterval(t); },[]);
  const beltPos=(tick*1.2)%80;

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:T.font,color:T.text,position:"relative",overflow:"hidden"}}>
      <WoodBg/>
      <div style={{position:"absolute",top:0,left:0,right:0,height:40,background:"#140C04",borderBottom:`4px solid ${T.border}`}}/>
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{position:"absolute",top:8,left:`${8+i*17}%`,display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{width:28,height:24,background:"#3A2010",border:`3px solid ${T.border}`,borderRadius:"4px 4px 0 0"}}/>
          <div style={{width:16,height:30,background:"#3A2010",border:`3px solid ${T.border}`}}/>
        </div>
      ))}
      <div style={{position:"absolute",top:"58%",left:0,right:0,height:60,
        background:"linear-gradient(180deg,#2A1C0E,#1C1208)",
        borderTop:`4px solid ${T.border}`,borderBottom:`4px solid ${T.border}`,overflow:"hidden"}}>
        {[...Array(22)].map((_,i)=>(
          <div key={i} style={{position:"absolute",top:0,bottom:0,
            left:`${((i*(100/22))+(beltPos/0.8))%100}%`,width:"2px",background:T.border}}/>
        ))}
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{position:"absolute",top:6,left:`${((i*22)+beltPos*0.5)%110-10}%`}}>
            <svg width={52} height={46} viewBox="0 0 52 46">
              <rect x="2" y="2" width="46" height="40" rx="4" fill={T.ink} opacity="0.4"/>
              <rect x="0" y="0" width="46" height="40" rx="4" fill={T.tan} stroke={T.ink} strokeWidth="2.5"/>
              <line x1="0" y1="16" x2="46" y2="16" stroke="#8C6030" strokeWidth="2" opacity="0.5"/>
              <line x1="0" y1="26" x2="46" y2="26" stroke="#8C6030" strokeWidth="2" opacity="0.5"/>
              <line x1="16" y1="0" x2="16" y2="40" stroke="#8C6030" strokeWidth="2" opacity="0.5"/>
              <text x="23" y="22" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="900" fontFamily="'Courier New',monospace" fill={T.ink}>{[12,18,24,36,42][i]}</text>
            </svg>
          </div>
        ))}
      </div>
      <div style={{position:"relative",zIndex:10,textAlign:"center",maxWidth:580}}>
        <div style={{
          display:"inline-block",padding:"10px 32px",
          background:T.rust,border:`4px solid ${T.ink}`,borderRadius:6,
          boxShadow:`6px 6px 0 ${T.ink}`,marginBottom:20,transform:"rotate(-1deg)",
        }}>
          <div style={{fontSize:13,letterSpacing:8,color:T.cream,fontWeight:900}}>⚙ EDUCATIONAL GAMES ⚙</div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:88,fontWeight:900,lineHeight:0.88,letterSpacing:-2,color:T.amber,
            WebkitTextStroke:`5px ${T.ink}`,textShadow:`8px 8px 0 ${T.ink}`,fontFamily:"'Courier New',monospace"}}>NUMBER</div>
          <div style={{fontSize:88,fontWeight:900,lineHeight:0.88,letterSpacing:-2,color:T.cream,
            WebkitTextStroke:`5px ${T.ink}`,textShadow:`8px 8px 0 ${T.ink}`,fontFamily:"'Courier New',monospace"}}>MILL</div>
        </div>
        <div style={{
          display:"inline-block",padding:"8px 24px",
          background:"#2A1C0E",border:`3px solid ${T.border}`,borderRadius:4,
          fontSize:13,color:T.muted,letterSpacing:3,marginBottom:40,fontWeight:700,
        }}>THE MATH IS THE MECHANIC · GRADES 3–8</div>
        <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:24,marginBottom:32}}>
          <div style={{animation:"bossFloat 2.5s ease-in-out infinite"}}>
            <ForemanReed emotion="stern" size={0.85}/>
          </div>
          <div style={{
            background:T.cream,border:`3px solid ${T.ink}`,borderRadius:12,
            padding:"16px 22px",maxWidth:240,textAlign:"left",
            boxShadow:`5px 5px 0 ${T.ink}`,position:"relative",fontFamily:"Georgia,serif",
          }}>
            <div style={{position:"absolute",left:-18,bottom:20,width:0,height:0,
              borderRight:`18px solid ${T.ink}`,borderTop:"10px solid transparent",borderBottom:"10px solid transparent"}}/>
            <div style={{position:"absolute",left:-12,bottom:22,width:0,height:0,
              borderRight:`14px solid ${T.cream}`,borderTop:"8px solid transparent",borderBottom:"8px solid transparent"}}/>
            <div style={{fontSize:14,color:T.ink,fontWeight:700,lineHeight:1.6}}>
              "The multiples won't sort themselves! Get to work, new hire!"
            </div>
          </div>
        </div>
        <Btn label="▶  PLAY NOW" onClick={onPlay} color={T.amber} size="lg"/>
      </div>
      <style>{`
        @keyframes bossFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);} }
      `}</style>
    </div>
  );
}

// ─── CUTSCENE ─────────────────────────────────────────────────────────────────
function Cutscene({onDone}){
  const lines=[
    {text:"HEY! NEW WORKER!", big:true, emotion:"angry"},
    {text:"The multiples are BACKING UP on the belts!", emotion:"angry"},
    {text:"Get DOWN there and sort them out...", emotion:"stern"},
    {text:"...before this whole factory GRINDS TO A HALT!", emotion:"angry"},
    {text:"Catch the correct multiples. IGNORE the wrong ones.", emotion:"stern"},
    {text:"Miss three correct crates and the shift ends!", emotion:"stern"},
    {text:"And DON'T grab the WRONG numbers or you'll lose a life!", emotion:"angry", last:true},
  ];
  const [idx,setIdx]=useState(0);
  const [beltPos,setBeltPos]=useState(0);
  const [armWave,setArmWave]=useState(false);
  const done=idx>=lines.length-1;
  const emotion=lines[idx]?.emotion||"stern";

  useEffect(()=>{ const t=setInterval(()=>setBeltPos(p=>(p+1.4)%80),30); return ()=>clearInterval(t); },[]);

  const advance=()=>{
    if(done){ onDone(); return; }
    setArmWave(true);
    setTimeout(()=>setArmWave(false),400);
    setIdx(i=>i+1);
  };

  return (
    <div style={{minHeight:"100vh",background:"#140C04",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:T.font,color:T.text,
      position:"relative",overflow:"hidden",cursor:"pointer"}}
      onClick={advance}>
      <WoodBg/>
      <div style={{position:"absolute",inset:0,
        backgroundImage:`repeating-linear-gradient(90deg,${T.border}22 0px,${T.border}22 2px,transparent 2px,transparent 80px)`,
      }}/>
      <div style={{position:"absolute",bottom:"28%",left:0,right:0,height:16,
        background:"#2A1810",border:`4px solid ${T.border}`,
        backgroundImage:`repeating-linear-gradient(90deg,${T.border}44 0px,${T.border}44 2px,transparent 2px,transparent 30px)`,
      }}/>
      {[...Array(8)].map((_,i)=>(
        <div key={i} style={{position:"absolute",bottom:"28%",left:`${i*14+3}%`,
          width:10,height:55,background:"#2A1810",border:`2px solid ${T.border}`,borderTop:"none"}}/>
      ))}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"28%",
        background:"linear-gradient(180deg,#1C1208,#0E0804)",
        borderTop:`4px solid ${T.border}`,overflow:"hidden"}}>
        <div style={{position:"absolute",top:20,left:0,right:0,height:55,
          background:"#1C1208",borderTop:`3px solid ${T.border}`,borderBottom:`3px solid ${T.border}`}}>
          {[...Array(20)].map((_,i)=>(
            <div key={i} style={{position:"absolute",top:0,bottom:0,
              left:`${((i*(100/20))+(beltPos/0.8))%100}%`,width:"2px",background:T.border}}/>
          ))}
        </div>
      </div>
      <div style={{position:"absolute",bottom:"28%",left:"8%",
        animation:emotion==="angry"?"bossShake 0.5s ease infinite":"bossFloat 2s ease-in-out infinite"}}>
        <ForemanReed emotion={emotion} size={1.1} talking={armWave}/>
      </div>
      <div style={{position:"absolute",bottom:"38%",left:"26%",right:"6%",zIndex:20}}>
        <div style={{position:"relative"}}>
          <div style={{position:"absolute",bottom:-16,left:50,width:0,height:0,
            borderLeft:"12px solid transparent",borderRight:"0px solid transparent",
            borderTop:`18px solid ${T.ink}`}}/>
          <div style={{position:"absolute",bottom:-11,left:53,width:0,height:0,
            borderLeft:"9px solid transparent",borderRight:"0px solid transparent",
            borderTop:`14px solid ${T.cream}`}}/>
          <div style={{
            background:T.cream,border:`3px solid ${T.ink}`,borderRadius:14,
            padding:"18px 22px",boxShadow:`5px 5px 0 ${T.ink}`,
            animation:"bubblePop 0.2s cubic-bezier(0.175,0.885,0.32,1.275)",
          }}>
            {lines.slice(0,idx+1).map((l,i)=>(
              <div key={i} style={{
                fontSize:i===0&&l.big?20:14,fontWeight:900,
                color:i===idx?(l.big?T.rust:T.ink):"#9C8060",
                fontFamily:i===0&&l.big?T.font:"Georgia,serif",
                letterSpacing:i===0&&l.big?1:0,
                lineHeight:1.6,marginBottom:i<idx?5:0,
              }}>{l.text}</div>
            ))}
          </div>
        </div>
      </div>
      <div style={{position:"absolute",bottom:30,right:30,display:"flex",gap:14,zIndex:30,alignItems:"center"}}>
        {!done&&<>
          <Btn label="NEXT ▶" onClick={e=>{e.stopPropagation();advance();}} color={T.amber}/>
          <button onClick={e=>{e.stopPropagation();onDone();}} style={{
            background:T.rust,border:`4px solid ${T.ink}`,color:T.cream,
            fontSize:15,fontWeight:900,fontFamily:T.font,letterSpacing:2,cursor:"pointer",
            padding:"12px 28px",borderRadius:8,boxShadow:`4px 4px 0 ${T.ink}`,transition:"all 0.12s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translate(-2px,-2px)";e.currentTarget.style.boxShadow=`6px 6px 0 ${T.ink}`;}}
            onMouseLeave={e=>{e.currentTarget.style.transform="translate(0,0)";e.currentTarget.style.boxShadow=`4px 4px 0 ${T.ink}`;}}
          >SKIP ⏭</button>
        </>}
        {done&&<Btn label="GET TO WORK! ▶" onClick={e=>{e.stopPropagation();onDone();}} color={T.rust} size="lg"/>}
      </div>
      {!done&&<div style={{position:"absolute",bottom:44,left:"50%",transform:"translateX(-50%)",fontSize:11,color:T.dim,letterSpacing:3}}>CLICK ANYWHERE OR PRESS NEXT</div>}
      <style>{`
        @keyframes bossFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);} }
        @keyframes bossShake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-5px);} 75%{transform:translateX(5px);} }
        @keyframes bubblePop { from{transform:scale(0.88);opacity:0;} to{transform:scale(1);opacity:1;} }
      `}</style>
    </div>
  );
}

// ─── MODE SELECT ──────────────────────────────────────────────────────────────
function ModeSelect({character,setCharacter,config,setConfig,onStart,onBack}){
  const [selectedMode,setSelectedMode]=useState(null);
  const [practiceMultiples,setPracticeMultiples]=useState([2]);
  const [practiceDiff,setPracticeDiff]=useState("easy");

  const launchSolo=()=>{ setConfig({diff:"easy",mode:"solo",multiples:MCFG.map(c=>c.multiple)}); onStart(); };
  const launchPractice=()=>{ setConfig({diff:practiceDiff,mode:"practice",multiples:practiceMultiples}); onStart(); };
  const launchDaily=()=>{ setConfig({diff:"medium",mode:"daily",multiples:MCFG.map(c=>c.multiple),seed:getTodaySeed()}); onStart(); };
  const toggleM=(m)=>setPracticeMultiples(p=>p.includes(m)?p.filter(x=>x!==m):[...p,m]);

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font,color:T.text}}>
      <WoodBg/>
      {/* Nav */}
      <div style={{position:"relative",zIndex:2,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"14px 28px",borderBottom:`3px solid ${T.border}`,background:"#140C04"}}>
        <div style={{fontSize:22,fontWeight:900,color:T.amber,WebkitTextStroke:`1.5px ${T.ink}`,letterSpacing:1}}>
          NUMBER MILL
        </div>
        <Btn label="← HUB" onClick={onBack} color={T.cream} size="sm" style={{color:T.ink}}/>
      </div>

      <div style={{position:"relative",zIndex:2,maxWidth:700,margin:"0 auto",padding:"28px 24px"}}>
        {/* Character picker */}
        <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:32}}>
          <div style={{fontSize:56}}>{character}</div>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:T.amber,marginBottom:4,WebkitTextStroke:`1px ${T.ink}`}}>CHOOSE YOUR WORKER</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              {CHARS.map(ch=>(
                <button key={ch} onClick={()=>setCharacter(ch)} style={{
                  fontSize:26,background:character===ch?T.amber:"transparent",
                  border:`3px solid ${character===ch?T.ink:T.border}`,
                  borderRadius:7,padding:"5px 10px",cursor:"pointer",
                  boxShadow:character===ch?`3px 3px 0 ${T.ink}`:"none",
                  transition:"all 0.1s"}}>
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode cards */}
        {!selectedMode&&(
          <>
            <div style={{fontSize:13,color:T.muted,letterSpacing:4,marginBottom:16,fontWeight:900}}>CHOOSE YOUR SHIFT</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
              {[
                {key:"solo",    icon:"⚙",  color:T.rust,  label:"QUICK PLAY",      desc:"Jump straight in. All multiples, starts easy and builds up."},
                {key:"practice",icon:"📋", color:T.teal,  label:"PRACTICE MODE",   desc:"Pick your multiples and difficulty. Perfect for targeting weak spots."},
                {key:"daily",   icon:"⚡", color:T.amber, label:"DAILY CHALLENGE", desc:"Same puzzle every day for every student. Compare scores with classmates."},
              ].map(m=>(
                <div key={m.key} onClick={()=>setSelectedMode(m.key)} style={{
                  padding:22,borderRadius:9,cursor:"pointer",
                  background:T.panel,border:`3px solid ${T.border}`,
                  boxShadow:`5px 5px 0 ${T.ink}`,transition:"all 0.12s",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translate(-2px,-2px)";e.currentTarget.style.boxShadow=`7px 7px 0 ${T.ink}`;e.currentTarget.style.borderColor=m.color;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="translate(0,0)";e.currentTarget.style.boxShadow=`5px 5px 0 ${T.ink}`;e.currentTarget.style.borderColor=T.border;}}
                >
                  <div style={{fontSize:36,marginBottom:10}}>{m.icon}</div>
                  <div style={{fontSize:15,fontWeight:900,color:m.color,letterSpacing:2,marginBottom:9,WebkitTextStroke:`0.5px ${T.ink}`}}>{m.label}</div>
                  <div style={{fontSize:13,color:T.muted,lineHeight:1.7,fontFamily:"Georgia,serif"}}>{m.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedMode==="solo"&&(
          <Panel>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <button onClick={()=>setSelectedMode(null)} style={{background:"none",border:"none",color:T.muted,fontSize:16,cursor:"pointer",fontFamily:T.font,fontWeight:900}}>← BACK</button>
              <div style={{fontSize:18,fontWeight:900,color:T.rust,letterSpacing:2}}>⚙ QUICK PLAY</div>
            </div>
            <div style={{fontSize:15,color:T.muted,lineHeight:2,marginBottom:28,fontFamily:"Georgia,serif"}}>
              All multiples from ×2 to ×12. Starts easy and the belts speed up every 15 correct catches.
            </div>
            <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:28}}>
              {[
                {icon:"↑↓",label:"CHANGE BELT",sub:"W / S  or  ↑ / ↓"},
                {icon:"←→",label:"MOVE CURSOR",sub:"A / D  or  ← / →"},
                {icon:"⎵", label:"CATCH CRATE",sub:"Space or click crate"},
              ].map(h=>(
                <div key={h.label} style={{textAlign:"center",padding:"14px 18px",background:"#140C04",border:`2px solid ${T.border}`,borderRadius:7,minWidth:115}}>
                  <div style={{fontSize:24,marginBottom:7}}>{h.icon}</div>
                  <div style={{fontSize:12,fontWeight:900,color:T.text,letterSpacing:1}}>{h.label}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:4,fontFamily:"Georgia,serif"}}>{h.sub}</div>
                </div>
              ))}
            </div>
            <div style={{textAlign:"center"}}><Btn label="▶  START QUICK PLAY" onClick={launchSolo} color={T.amber} size="lg"/></div>
          </Panel>
        )}

        {selectedMode==="practice"&&(
          <Panel>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <button onClick={()=>setSelectedMode(null)} style={{background:"none",border:"none",color:T.muted,fontSize:16,cursor:"pointer",fontFamily:T.font,fontWeight:900}}>← BACK</button>
              <div style={{fontSize:18,fontWeight:900,color:T.teal,letterSpacing:2}}>📋 PRACTICE MODE</div>
            </div>
            <Label size="md">SELECT MULTIPLES TO PRACTICE</Label>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12,marginBottom:24}}>
              {MCFG.map(c=>{
                const sel=practiceMultiples.includes(c.multiple);
                return (
                  <button key={c.multiple} onClick={()=>toggleM(c.multiple)} style={{
                    width:60,height:60,borderRadius:8,cursor:"pointer",fontSize:17,fontWeight:900,
                    fontFamily:T.font,transition:"all 0.1s",
                    background:sel?c.color:T.panel,
                    border:`3px solid ${sel?T.ink:T.border}`,
                    color:sel?T.ink:c.color,
                    boxShadow:sel?`4px 4px 0 ${T.ink}`:"none",
                  }}>×{c.multiple}</button>
                );
              })}
            </div>
            <Label size="md">DIFFICULTY</Label>
            <div style={{display:"flex",gap:12,marginTop:12,marginBottom:26}}>
              {Object.entries(DIFF).map(([k,d])=>(
                <button key={k} onClick={()=>setPracticeDiff(k)} style={{
                  flex:1,padding:"14px",borderRadius:7,cursor:"pointer",fontSize:14,fontWeight:900,
                  fontFamily:T.font,letterSpacing:2,
                  background:practiceDiff===k?d.color:T.panel,
                  border:`3px solid ${practiceDiff===k?T.ink:T.border}`,
                  color:practiceDiff===k?T.ink:T.muted,
                  boxShadow:practiceDiff===k?`4px 4px 0 ${T.ink}`:"none",
                }}>{d.label}</button>
              ))}
            </div>
            <div style={{textAlign:"center"}}>
              <Btn label={practiceMultiples.length===0?"SELECT A MULTIPLE FIRST":"▶  START PRACTICE"}
                onClick={practiceMultiples.length>0?launchPractice:undefined}
                color={T.teal} size="lg" disabled={practiceMultiples.length===0}/>
            </div>
          </Panel>
        )}

        {selectedMode==="daily"&&(
          <Panel>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <button onClick={()=>setSelectedMode(null)} style={{background:"none",border:"none",color:T.muted,fontSize:16,cursor:"pointer",fontFamily:T.font,fontWeight:900}}>← BACK</button>
              <div style={{fontSize:18,fontWeight:900,color:T.amber,letterSpacing:2}}>⚡ DAILY CHALLENGE</div>
            </div>
            <div style={{fontSize:15,color:T.muted,lineHeight:2,marginBottom:20,fontFamily:"Georgia,serif"}}>
              Today's challenge is the same for every student. Same multiples, same crate order. Compare your score with classmates!
            </div>
            <div style={{padding:18,background:"#0E0804",border:`3px solid ${T.border}`,borderRadius:7,marginBottom:24,textAlign:"center",boxShadow:`4px 4px 0 ${T.ink}44`}}>
              <Label size="md" color={T.amber}>TODAY'S SHIFT</Label>
              <div style={{fontSize:28,fontWeight:900,color:T.amber,letterSpacing:4,marginTop:8,WebkitTextStroke:`1px ${T.ink}`}}>{getTodaySeed()}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:6}}>{new Date().toDateString()}</div>
            </div>
            <div style={{textAlign:"center"}}><Btn label="⚡  START DAILY CHALLENGE" onClick={launchDaily} color={T.amber} size="lg"/></div>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
function Game({config,character,onEnd,onMenu}){
  const {diff,mode,multiples}=config;
  const d=DIFF[diff]||DIFF.easy;

  const buildSeq=useCallback(()=>{
    if(mode==="solo") return [...MCFG.map(c=>c.multiple)].sort(()=>Math.random()-0.5);
    if(mode==="practice"){ const m=[...(multiples||[2])]; while(m.length<3) m.push(...(multiples||[2])); return m; }
    if(mode==="daily"){
      const base=MCFG.map(c=>c.multiple); let s=parseInt(config.seed||"20240101");
      return base.sort(()=>{ s=(s*9301+49297)%233280; return (s/233280)-0.5; });
    }
    return [2];
  },[mode,multiples,config.seed]);

  const seqRef=useRef(buildSeq());
  const seqIdxRef=useRef(0);

  const [belts,setBelts]=useState([[],[],[]]);
  const [lives,setLives]=useState(MAX_LIVES);
  const [score,setScore]=useState(0);
  const [streak,setStreak]=useState(0);
  const [level,setLevel]=useState(1);
  const [playerBelt,setPlayerBelt]=useState(1);
  const [cursorX,setCursorX]=useState(CW*0.65);
  const [curMult,setCurMult]=useState(seqRef.current[0]);
  const [feedback,setFeedback]=useState(null);
  const [particles,setParticles]=useState([]);
  const [beltOff,setBeltOff]=useState(0);
  const [flashRed,setFlashRed]=useState(false);
  const [multiplier,setMultiplier]=useState(1);
  const [multTimer,setMultTimer]=useState(0);
  const [multColor,setMultColor]=useState(T.amber);
  const [lvlBanner,setLvlBanner]=useState(null);
  const [burstWarning,setBurstWarning]=useState(false);
  const [burstActive,setBurstActive]=useState(false);
  const [cratesCleared,setCratesCleared]=useState(0);
  const [beltCount,setBeltCount]=useState(3);
  const [paused,setPaused]=useState(false);

  const beltsRef=useRef([[],[],[]]);
  const livesRef=useRef(MAX_LIVES);
  const scoreRef=useRef(0);
  const streakRef=useRef(0);
  const levelRef=useRef(1);
  const speedRef=useRef(d.speed);
  const gapRef=useRef(d.gap);
  const multipleRef=useRef(seqRef.current[0]);
  const screenRef=useRef("playing");
  const pbRef=useRef(1);
  const cursorXRef=useRef(CW*0.65);
  const multRef=useRef(1);
  const multEndRef=useRef(0);
  const multIntRef=useRef(null);
  const animRef=useRef();
  const lastTRef=useRef(null);
  const offsetRef=useRef(0);
  const fbTimerRef=useRef(null);
  const catchLogRef=useRef([]);
  const diffRef=useRef(diff);
  const cratesClearedRef=useRef(0);
  const burstTriggeredRef=useRef(false);
  const burstActiveRef=useRef(false);
  const preburstSpeedRef=useRef(d.speed);
  const beltCountRef=useRef(3);
  const beltsPausedRef=useRef(false);
  const pausedRef=useRef(false);
  const pauseStartRef=useRef(0);
  const totalPausedMsRef=useRef(0);

  const showFb=(fb)=>{
    setFeedback(fb);
    if(fbTimerRef.current) clearTimeout(fbTimerRef.current);
    fbTimerRef.current=setTimeout(()=>setFeedback(null),1500);
  };

  const addPts=useCallback((x,y,good,color)=>{
    const cols=color?[color]:good?[T.amber,T.teal,T.rust,"#60C840"]:["#E84040","#FF8888"];
    const pts=Array.from({length:good?14:6},(_,i)=>({
      id:Date.now()+i+Math.random(),x,y,
      color:cols[Math.floor(Math.random()*cols.length)],
      size:good?Math.random()*11+5:Math.random()*6+2,
    }));
    setParticles(p=>[...p,...pts]);
    setTimeout(()=>setParticles(p=>p.filter(pt=>!pts.find(np=>np.id===pt.id))),900);
  },[]);

  const activateMult=useCallback((val,col)=>{
    multRef.current=val; multEndRef.current=Date.now()+12000;
    setMultiplier(val); setMultColor(col);
    if(multIntRef.current) clearInterval(multIntRef.current);
    setMultTimer(12);
    multIntRef.current=setInterval(()=>{
      const r=Math.max(0,Math.ceil((multEndRef.current-Date.now())/1000));
      setMultTimer(r);
      if(r<=0){ clearInterval(multIntRef.current); multRef.current=1; setMultiplier(1); setMultTimer(0); }
    },200);
  },[]);

  const triggerBurst=useCallback(()=>{
    if(burstTriggeredRef.current||burstActiveRef.current) return;
    burstTriggeredRef.current=true;
    screenRef.current="burst_warn";
    beltsPausedRef.current=true;
    setBurstWarning(true);
    setTimeout(()=>{
      setBurstWarning(false);
      setTimeout(()=>{
        beltsPausedRef.current=false;
        preburstSpeedRef.current=speedRef.current;
        speedRef.current=Math.min(speedRef.current*1.85,5.2);
        burstActiveRef.current=true;
        setBurstActive(true);
        screenRef.current="playing";
        showFb({type:"burst",msg:"⚡ PRODUCTION QUOTA INCREASED!"});
        setTimeout(()=>{
          speedRef.current=preburstSpeedRef.current;
          burstActiveRef.current=false;
          setBurstActive(false);
        },8000);
      },500);
    },2500);
  },[]);

  const doLevelUp=useCallback(()=>{
    screenRef.current="levelup";
    beltsPausedRef.current=true;
    seqIdxRef.current=(seqIdxRef.current+1)%seqRef.current.length;
    const nextM=seqRef.current[seqIdxRef.current];
    levelRef.current+=1;
    const df=DIFF[diffRef.current];
    speedRef.current=Math.min(speedRef.current+df.speedInc,4.2);
    gapRef.current=Math.max(gapRef.current-df.gapDec,40);
    multipleRef.current=nextM;
    cratesClearedRef.current=0;
    burstTriggeredRef.current=false;
    setCratesCleared(0);
    const newBeltCount=levelRef.current>=7?5:levelRef.current>=4?4:3;
    if(newBeltCount!==beltCountRef.current){
      beltCountRef.current=newBeltCount;
      setBeltCount(newBeltCount);
    }
    setLvlBanner({label:`NOW: MULTIPLES OF ${nextM}`,multiple:nextM,isLevelUp:true});
    setTimeout(()=>{
      const nb=Array.from({length:beltCountRef.current},(_,bi)=>makeBelt(nextM,bi,gapRef.current,levelRef.current,true));
      beltsRef.current=nb; setBelts(nb); setLevel(levelRef.current); setCurMult(nextM);
      beltsPausedRef.current=false;
      screenRef.current="playing"; setLvlBanner(null); lastTRef.current=null;
    },2600);
  },[]);

  const catchCrate=useCallback((bi,crateId)=>{
    if(screenRef.current!=="playing") return;
    pbRef.current=bi; setPlayerBelt(bi);
    const belt=beltsRef.current[bi];
    const crate=belt.find(c=>c.id===crateId&&!c.caught&&!c.missed);
    if(!crate) return;
    const beltH=Math.floor(580/beltCountRef.current);
    const beltY=28+bi*beltH+beltH*0.3;
    const cx=Math.min(Math.max(crate.x+CRATE_W/2,0),CW);

    if(crate.special==="life"){
      livesRef.current=Math.min(livesRef.current+1,MAX_LIVES+4); setLives(livesRef.current);
      addPts(cx,beltY,true,T.rust); showFb({type:"life",msg:"❤️  EXTRA LIFE!"});
      catchLogRef.current.push({value:crate.value,correct:true,special:"life",multiple:multipleRef.current});
    } else if(crate.special==="mult"){
      const mc=crate.multVal===2?T.amber:crate.multVal===3?T.teal:T.rust;
      activateMult(crate.multVal,mc); addPts(cx,beltY,true,mc);
      showFb({type:"mult",msg:`⚡ ×${crate.multVal} MULTIPLIER — 12 SECONDS`,color:mc});
      catchLogRef.current.push({value:crate.value,correct:true,special:"mult",multiple:multipleRef.current});
    } else if(crate.isCorrect){
      streakRef.current+=1;
      const sb=streakRef.current>=5?2:1;
      const am=Date.now()<multEndRef.current?multRef.current:1;
      const pts=10*sb*am;
      scoreRef.current+=pts; setScore(scoreRef.current); setStreak(streakRef.current);
      addPts(cx,beltY,true);
      showFb({type:"correct",msg:streakRef.current>=5?`🔥 STREAK ×${streakRef.current}${am>1?` ×${am}`:""} +${pts}`:`+${pts}${am>1?` ×${am}`:""}`});
      cratesClearedRef.current+=1;
      setCratesCleared(cratesClearedRef.current);
      if(cratesClearedRef.current===8&&levelRef.current>=3&&!burstTriggeredRef.current) triggerBurst();
      if(cratesClearedRef.current>=CRATES_PER_LEVEL){ doLevelUp(); return; }
      catchLogRef.current.push({value:crate.value,correct:true,special:null,multiple:multipleRef.current});
    } else {
      streakRef.current=0; setStreak(0);
      livesRef.current-=1; setLives(livesRef.current);
      addPts(cx,beltY,false);
      showFb({type:"wrong",msg:`✗  ${crate.value} is NOT a multiple of ${multipleRef.current}`});
      setFlashRed(true); setTimeout(()=>setFlashRed(false),350);
      catchLogRef.current.push({value:crate.value,correct:false,special:null,multiple:multipleRef.current});
      if(livesRef.current<=0){ screenRef.current="gameover"; onEnd({score:scoreRef.current,level:levelRef.current,multiple:multipleRef.current,catchLog:catchLogRef.current,totalPausedMs:totalPausedMsRef.current}); return; }
    }
    const nb=beltsRef.current.map((b,bii)=>bii===bi?b.map(c=>c.id===crateId?{...c,caught:true}:c):b);
    beltsRef.current=nb; setBelts([...nb]);
  },[addPts,activateMult,doLevelUp,triggerBurst,onEnd]);

  const catchNearest=useCallback(()=>{
    if(screenRef.current!=="playing") return;
    const cx=cursorXRef.current;
    const belt=beltsRef.current[pbRef.current];
    const near=belt.filter(c=>!c.caught&&!c.missed&&c.x>-10&&c.x<CW)
      .sort((a,b)=>Math.abs((a.x+CRATE_W/2)-cx)-Math.abs((b.x+CRATE_W/2)-cx))[0];
    if(near) catchCrate(pbRef.current,near.id);
  },[catchCrate]);

  useEffect(()=>{
    const startM=multipleRef.current;
    const PRELOAD_OFFSET = CW * 0.52;
    const nb=Array.from({length:3},(_,bi)=>{
      const belt=makeBelt(startM,bi,gapRef.current,1,true);
      return belt.map(c=>({ ...c, x: c.x + PRELOAD_OFFSET }));
    });
    beltsRef.current=nb; setBelts(nb);
    beltsPausedRef.current=true;
    screenRef.current="levelup";
    setLvlBanner({label:`MULTIPLES OF ${startM}`,multiple:startM,isOpening:true});
    setTimeout(()=>{
      beltsPausedRef.current=false;
      screenRef.current="playing";
      setLvlBanner(null);
      lastTRef.current=null;
    },2200);
  },[]);

  useEffect(()=>{
    const loop=(ts)=>{
      if(!lastTRef.current) lastTRef.current=ts;
      const delta=Math.min((ts-lastTRef.current)/16,3); lastTRef.current=ts;
      const canMove=!beltsPausedRef.current&&!pausedRef.current&&(screenRef.current==="playing"||screenRef.current==="burst_warn");
      if(canMove){
        offsetRef.current=(offsetRef.current+speedRef.current*delta*0.7)%40;
        setBeltOff(offsetRef.current);
      }
      if(!beltsPausedRef.current&&!pausedRef.current){
        const bc=beltCountRef.current;
        const newBelts=beltsRef.current.slice(0,bc).map((belt,bi)=>{
          let updated=belt.map(crate=>{
            if(crate.caught||crate.missed) return crate;
            const nx=crate.x+speedRef.current*delta;
            if(nx>CW&&!crate.caught){
              if(crate.isCorrect&&!crate.special){
                livesRef.current-=1; setLives(livesRef.current);
                setFlashRed(true); setTimeout(()=>setFlashRed(false),350);
                showFb({type:"wrong",msg:`Missed a multiple of ${multipleRef.current}!`});
                catchLogRef.current.push({value:crate.value,correct:false,special:"missed",multiple:multipleRef.current});
                if(livesRef.current<=0){ screenRef.current="gameover"; onEnd({score:scoreRef.current,level:levelRef.current,multiple:multipleRef.current,catchLog:catchLogRef.current,totalPausedMs:totalPausedMsRef.current}); }
              }
              return {...crate,x:nx,missed:true};
            }
            return {...crate,x:nx};
          });
          if(updated.filter(c=>!c.caught&&!c.missed&&c.x<CW+20).length<3){
            updated=[...updated.filter(c=>c.x<CW+40),...makeBelt(multipleRef.current,bi,gapRef.current,levelRef.current,true)];
          }
          return updated;
        });
        beltsRef.current=newBelts; setBelts([...newBelts]);
      }
      animRef.current=requestAnimationFrame(loop);
    };
    lastTRef.current=null; animRef.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(animRef.current);
  },[onEnd]);

  useEffect(()=>{
    const onKey=(e)=>{
      if(e.key==="p"||e.key==="P"||e.key==="Escape"){
        if(screenRef.current==="playing"||screenRef.current==="paused"){
          const nowPaused=!pausedRef.current;
          pausedRef.current=nowPaused;
          screenRef.current=nowPaused?"paused":"playing";
          if(nowPaused){ pauseStartRef.current=Date.now(); }
          else { totalPausedMsRef.current+=Date.now()-pauseStartRef.current; }
          setPaused(nowPaused);
        }
        return;
      }
      const active=screenRef.current==="playing"&&!pausedRef.current;
      if(!active) return;
      const BASE_STEP=38;
      const lvlBonus=levelRef.current>=7?Math.min((levelRef.current-6)*3,26):0;
      const STEP=BASE_STEP+lvlBonus;
      if(e.key==="ArrowUp"  ||e.key==="w"||e.key==="W"){ const nb=Math.max(0,pbRef.current-1); pbRef.current=nb; setPlayerBelt(nb); }
      if(e.key==="ArrowDown"||e.key==="s"||e.key==="S"){ const nb=Math.min(beltCountRef.current-1,pbRef.current+1); pbRef.current=nb; setPlayerBelt(nb); }
      if(e.key==="ArrowLeft"||e.key==="a"||e.key==="A"){ const nx=Math.max(CRATE_W/2,cursorXRef.current-STEP); cursorXRef.current=nx; setCursorX(nx); }
      if(e.key==="ArrowRight"||e.key==="d"||e.key==="D"){ const nx=Math.min(CW-CRATE_W/2,cursorXRef.current+STEP); cursorXRef.current=nx; setCursorX(nx); }
      if(e.key===" "||e.key==="Enter"){
        e.preventDefault();
        const cx=cursorXRef.current;
        const belt=beltsRef.current[pbRef.current];
        const highlighted=belt.filter(c=>
          !c.caught&&!c.missed&&c.x>-10&&c.x<CW&&
          Math.abs((c.x+CRATE_W/2)-cx)<CRATE_W*0.8
        ).sort((a,b)=>Math.abs((a.x+CRATE_W/2)-cx)-Math.abs((b.x+CRATE_W/2)-cx))[0];
        if(highlighted) catchCrate(pbRef.current,highlighted.id);
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[catchCrate]);

  const mCfg=getCfg(curMult);
  const multActive=multiplier>1&&multTimer>0;
  const beltH=Math.floor(580/beltCount);

  const getBg=()=>{
    if(burstActive) return Math.floor(Date.now()/280)%2===0?"#200808":"#300A0A";
    if(flashRed) return "#2A0808";
    return "#1C1208";
  };

  return (
    <div style={{width:"100%",minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",fontFamily:T.font,color:T.text,userSelect:"none"}}>
      {/* HUD */}
      <div style={{width:CW,display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"10px 16px",boxSizing:"border-box",borderBottom:`3px solid ${T.border}`,background:"#140C04"}}>
        <div>
          <Label>TARGET</Label>
          <div style={{fontSize:24,fontWeight:900,color:mCfg.color,WebkitTextStroke:`1.5px ${T.ink}`}}>× {curMult}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <Label>SCORE</Label>
          <div style={{fontSize:26,fontWeight:900,color:T.amber,WebkitTextStroke:`1px ${T.ink}`}}>{score}</div>
        </div>
        <div style={{textAlign:"center",minWidth:100}}>
          <Label>SHIFT PROGRESS</Label>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:5}}>
            <div style={{flex:1,height:10,background:"#0E0804",border:`2px solid ${T.border}`,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(cratesCleared/CRATES_PER_LEVEL)*100}%`,
                background:mCfg.color,borderRadius:3,transition:"width 0.3s"}}/>
            </div>
            <div style={{fontSize:10,color:T.muted,minWidth:32}}>{cratesCleared}/{CRATES_PER_LEVEL}</div>
          </div>
          <div style={{fontSize:9,color:T.dim,letterSpacing:2,marginTop:2}}>LV {level}</div>
        </div>
        <div style={{textAlign:"center",minWidth:60}}>
          {multActive&&<>
            <Label color={multColor}>BONUS</Label>
            <div style={{fontSize:20,fontWeight:900,color:multColor,WebkitTextStroke:`1px ${T.ink}`}}>×{multiplier}</div>
            <div style={{fontSize:9,color:multColor+"88"}}>{multTimer}s</div>
          </>}
        </div>
        <div style={{textAlign:"right"}}>
          <Label>LIVES</Label>
          <div style={{fontSize:16,marginTop:2}}>
            {Array.from({length:Math.max(lives,0)}).map((_,i)=><span key={i} style={{marginLeft:2}}>❤️</span>)}
          </div>
        </div>
        <Btn label="MENU" onClick={()=>{screenRef.current="gameover"; onMenu();}} color={T.cream} size="sm" style={{color:T.ink}}/>
        <Btn
          label={paused?"▶ RESUME":"⏸ PAUSE"}
          onClick={()=>{
            const nowPaused=!pausedRef.current;
            pausedRef.current=nowPaused;
            screenRef.current=nowPaused?"paused":"playing";
            if(nowPaused){ pauseStartRef.current=Date.now(); }
            else { totalPausedMsRef.current+=Date.now()-pauseStartRef.current; }
            setPaused(nowPaused);
          }}
          color={paused?T.amber:T.tan} size="sm" style={{color:T.ink}}
        />
      </div>

      {/* Level banner */}
      {lvlBanner&&(
        <div style={{position:"fixed",top:"35%",left:"50%",transform:"translate(-50%,-50%)",
          background:T.cream,border:`5px solid ${T.ink}`,borderRadius:12,
          padding:"28px 56px",zIndex:300,textAlign:"center",
          boxShadow:`10px 10px 0 ${T.ink}`,animation:"bannerPop 0.35s ease"}}>
          <div style={{fontSize:12,color:T.muted,letterSpacing:5,marginBottom:10,fontFamily:"Georgia,serif",fontWeight:700}}>
            {lvlBanner.isOpening?"GET READY!":"SHIFT COMPLETE!"}
          </div>
          <div style={{fontSize:13,color:T.muted,letterSpacing:4,marginBottom:6,fontWeight:900,fontFamily:T.font}}>
            {lvlBanner.isOpening?"YOUR FIRST MULTIPLE:":"NEXT UP:"}
          </div>
          <div style={{fontSize:42,fontWeight:900,color:getCfg(lvlBanner.multiple).color,WebkitTextStroke:`3px ${T.ink}`,marginBottom:4}}>
            × {lvlBanner.multiple}
          </div>
          <div style={{fontSize:18,fontWeight:900,color:T.ink,fontFamily:"Georgia,serif",marginBottom:4}}>
            Multiples of {lvlBanner.multiple}
          </div>
          <div style={{fontSize:11,color:T.muted,letterSpacing:2,marginTop:10}}>
            {lvlBanner.isOpening?"Belts starting...":"Belts speeding up..."}
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {paused&&(
        <div style={{position:"fixed",inset:0,zIndex:500,background:`${T.bg}F0`,
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
          <div style={{position:"absolute",inset:0,
            backgroundImage:`repeating-linear-gradient(45deg,${T.border}22 0,${T.border}22 2px,transparent 2px,transparent 18px)`,
            pointerEvents:"none"}}/>
          <div style={{position:"relative",zIndex:2,background:T.cream,border:`5px solid ${T.ink}`,borderRadius:14,
            padding:"36px 56px",textAlign:"center",boxShadow:`10px 10px 0 ${T.ink}`}}>
            <div style={{marginBottom:8,animation:"bossFloat 2s ease-in-out infinite"}}>
              <ForemanReed emotion="stern" size={0.55}/>
            </div>
            <div style={{fontSize:36,fontWeight:900,color:T.rust,WebkitTextStroke:`2px ${T.ink}`,marginBottom:6,letterSpacing:2}}>BREAK TIME!</div>
            <div style={{fontSize:14,color:T.ink,fontFamily:"Georgia,serif",fontWeight:700,marginBottom:24,lineHeight:1.6,maxWidth:280}}>
              "Alright, take five. But don't think I'm not keeping track of this on your record."
            </div>
            <div style={{display:"flex",gap:24,justifyContent:"center",marginBottom:28}}>
              {[
                {label:"SCORE",value:score,color:T.amber},
                {label:"LEVEL",value:level,color:T.teal},
                {label:"LIVES",value:"❤️".repeat(Math.max(lives,0)),color:T.rust},
              ].map(s=>(
                <div key={s.label} style={{textAlign:"center"}}>
                  <div style={{fontSize:9,letterSpacing:3,color:T.muted,fontWeight:900,marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:s.label==="LIVES"?16:22,fontWeight:900,color:s.color,WebkitTextStroke:s.label==="LIVES"?"none":`1px ${T.ink}`}}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:12,justifyContent:"center"}}>
              <Btn label="▶  BACK TO WORK" onClick={()=>{
                totalPausedMsRef.current+=Date.now()-pauseStartRef.current;
                pausedRef.current=false; screenRef.current="playing"; setPaused(false);
              }} color={T.amber} size="lg"/>
              <Btn label="QUIT SHIFT" onClick={()=>{
                totalPausedMsRef.current+=Date.now()-pauseStartRef.current;
                screenRef.current="gameover";
                onEnd({score:scoreRef.current,level:levelRef.current,multiple:multipleRef.current,catchLog:catchLogRef.current,totalPausedMs:totalPausedMsRef.current});
              }} color={T.cream} size="md" style={{color:T.ink}}/>
            </div>
            <div style={{fontSize:11,color:T.muted,marginTop:14,letterSpacing:2}}>P or ESC to resume</div>
          </div>
        </div>
      )}

      {/* Burst warning */}
      {burstWarning&&(
        <div style={{position:"fixed",inset:0,zIndex:400,pointerEvents:"none",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(150,0,0,0.3)",animation:"warnPulse 0.35s ease infinite alternate"}}/>
          <div style={{
            position:"absolute",top:"44%",left:"50%",
            transform:"translate(-50%,-50%) rotate(-6deg)",
            width:"140%",padding:"20px 0",
            background:"#CC1A00",border:`6px solid ${T.ink}`,
            animation:"warnBannerSlide 0.4s cubic-bezier(0.175,0.885,0.32,1.275)",
          }}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:10,
              background:`repeating-linear-gradient(90deg,${T.amber} 0,${T.amber} 24px,${T.ink} 24px,${T.ink} 48px)`}}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:10,
              background:`repeating-linear-gradient(90deg,${T.amber} 0,${T.amber} 24px,${T.ink} 24px,${T.ink} 48px)`}}/>
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:12,letterSpacing:8,color:T.amber,fontFamily:T.font,fontWeight:900,marginBottom:6}}>⚠ FACTORY ALERT ⚠</div>
              <div style={{fontSize:26,letterSpacing:3,color:"white",fontFamily:T.font,fontWeight:900,WebkitTextStroke:`2px ${T.ink}`,lineHeight:1.2}}>
                PRODUCTION QUOTA<br/>INCREASING!
              </div>
            </div>
          </div>
          {[[0,0],[0,1],[1,0],[1,1]].map(([r,c],i)=>(
            <div key={i} style={{position:"absolute",
              top:r===0?"16px":"auto",bottom:r===1?"16px":"auto",
              left:c===0?"16px":"auto",right:c===1?"16px":"auto",
              width:44,height:44,borderRadius:"50%",
              background:"#FF2200",border:`3px solid ${T.ink}`,boxShadow:"0 0 20px #FF2200",
              animation:`warnLight 0.28s ease ${i*0.07}s infinite alternate`}}/>
          ))}
        </div>
      )}

      {burstActive&&(
        <div style={{position:"fixed",top:58,left:"50%",transform:"translateX(-50%)",
          background:T.rust,color:T.cream,padding:"5px 28px",
          border:`2px solid ${T.ink}`,fontFamily:T.font,fontSize:11,fontWeight:900,letterSpacing:4,zIndex:200,
          borderRadius:"0 0 6px 6px",animation:"burstPulse 0.4s ease infinite alternate",
          boxShadow:`0 3px 0 ${T.ink}`}}>
          ⚡ SPEED BURST — HOLD ON! ⚡
        </div>
      )}

      {feedback&&(
        <div style={{position:"fixed",top:64,left:"50%",transform:"translateX(-50%)",
          background:T.cream,border:`3px solid ${feedback.type==="correct"?"#40B840":feedback.type==="life"?T.rust:feedback.type==="mult"?(feedback.color||T.amber):feedback.type==="burst"?T.rust:"#E84040"}`,
          color:feedback.type==="correct"?"#207820":feedback.type==="life"?T.rust:feedback.type==="mult"?(feedback.color||T.amber):feedback.type==="burst"?T.rust:"#C82020",
          padding:"7px 20px",borderRadius:6,fontSize:13,fontWeight:700,
          boxShadow:`3px 3px 0 ${T.ink}`,letterSpacing:1,zIndex:199,whiteSpace:"nowrap",animation:"fadeSlide 0.15s ease",
        }}>{feedback.msg}</div>
      )}

      {/* Factory floor */}
      <div style={{position:"relative",width:CW,flex:1,background:getBg(),overflow:"hidden",transition:"background 0.15s"}}
        onClick={e=>{
          if(screenRef.current!=="playing"||pausedRef.current) return;
          const rect=e.currentTarget.getBoundingClientRect();
          const clickX=e.clientX-rect.left;
          const clickY=e.clientY-rect.top;
          const bc=beltCountRef.current;
          const bh=Math.floor(580/bc);
          const beltIdx=Math.max(0,Math.min(bc-1,Math.floor((clickY-22)/bh)));
          cursorXRef.current=clickX; setCursorX(clickX);
          pbRef.current=beltIdx; setPlayerBelt(beltIdx);
          const belt=beltsRef.current[beltIdx];
          const near=belt.filter(c=>!c.caught&&!c.missed&&c.x>-10&&c.x<CW)
            .sort((a,b)=>Math.abs((a.x+CRATE_W/2)-clickX)-Math.abs((b.x+CRATE_W/2)-clickX))[0];
          if(near&&Math.abs((near.x+CRATE_W/2)-clickX)<CRATE_W) catchCrate(beltIdx,near.id);
        }}>

        {particles.map(p=>(
          <div key={p.id} style={{position:"absolute",left:p.x,top:p.y,
            width:p.size,height:p.size,background:p.color,border:`2px solid ${T.ink}`,
            borderRadius:"50%",pointerEvents:"none",transform:"translate(-50%,-50%)"}}/>
        ))}

        <div style={{position:"absolute",top:0,left:0,right:0,height:24,
          background:"#0E0804",borderBottom:`4px solid ${T.border}`,
          display:"flex",alignItems:"center",paddingLeft:12,gap:22}}>
          {[...Array(12)].map((_,i)=>(
            <div key={i} style={{width:16,height:12,background:"#1C1208",border:`2px solid ${T.border}`,borderRadius:"3px 3px 0 0"}}/>
          ))}
        </div>

        {Array.from({length:beltCount},(_,bi)=>{
          const isActive=playerBelt===bi;
          const bc=BELT_COLORS[bi%BELT_COLORS.length];
          const beltTop=24+bi*beltH;
          return (
            <div key={bi} style={{position:"absolute",top:beltTop,left:0,right:0,height:beltH}}>
              <div style={{position:"absolute",top:CRATE_H*0.55,left:0,right:0,height:20,
                background:`linear-gradient(180deg,#2A1C0E,#1C1208)`,
                borderTop:`3px solid ${isActive?bc:T.border}`,
                borderBottom:`2px solid #0E0804`,overflow:"hidden"}}>
                {[...Array(24)].map((_,i)=>(
                  <div key={i} style={{position:"absolute",top:0,bottom:0,
                    left:`${((i*(100/24))+(beltOff/3.5))%100}%`,width:"2px",background:T.border}}/>
                ))}
              </div>
              <div style={{position:"absolute",left:8,top:5,fontSize:7,color:isActive?bc:T.dim,letterSpacing:3,fontWeight:900}}>BELT {bi+1}</div>
              {isActive&&(
                <div style={{position:"absolute",left:cursorX-2,top:0,width:4,height:beltH-4,
                  background:`linear-gradient(180deg,transparent,${bc}cc,${bc},${bc}cc,transparent)`,
                  boxShadow:`0 0 12px ${bc}`,pointerEvents:"none",zIndex:5,borderRadius:2}}/>
              )}
              {isActive&&(
                <div style={{
                  position:"absolute",left:cursorX-24,top:CRATE_H*0.55-46,
                  fontSize:42,filter:`drop-shadow(3px 3px 0 ${T.ink})`,
                  zIndex:10,transition:"left 0.07s ease",pointerEvents:"none",lineHeight:1,
                }}>{character}</div>
              )}
              <div style={{
                position:"absolute",right:0,top:CRATE_H*0.55-8,
                width:48,height:CRATE_H+16,
                background:`linear-gradient(90deg,#2A1C0E,#1C1208)`,
                borderLeft:`4px solid ${isActive?bc:T.border}`,
                borderTop:`3px solid ${T.border}`,borderBottom:`3px solid ${T.border}`,borderRight:`3px solid ${T.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"0 6px 6px 0",
              }}>
                <div style={{width:38,height:24,background:"#0A0604",border:`2px solid ${T.border}`,borderRadius:3,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,opacity:isActive?1:0.3}}>📦</div>
              </div>
              {belts[bi]&&belts[bi].filter(c=>!c.caught&&!c.missed&&c.x>-CRATE_W-10&&c.x<CW+10).map(crate=>{
                const isLife=crate.special==="life";
                const isMult=crate.special==="mult";
                const mColor=isMult?(crate.multVal===2?T.amber:crate.multVal===3?T.teal:T.rust):null;
                const nearCursor=isActive&&Math.abs((crate.x+CRATE_W/2)-cursorX)<CRATE_W*0.8;
                return (
                  <CartoonCrate
                    key={crate.id} x={crate.x} value={crate.value}
                    color={isLife?T.rust:isMult?mColor:mCfg.color}
                    isLife={isLife} isMult={isMult} nearCursor={nearCursor} beltColor={bc}
                    onClick={e=>{ e.stopPropagation(); catchCrate(bi,crate.id); }}
                  />
                );
              })}
            </div>
          );
        })}

        <div style={{position:"absolute",bottom:0,left:0,right:0,height:32,
          background:"linear-gradient(180deg,#140C04,#0E0804)",borderTop:`3px solid ${T.border}`,
          display:"flex",alignItems:"center",padding:"0 16px"}}>
          <div style={{fontSize:8,color:T.dim,letterSpacing:3}}>
            SPEED {"▮".repeat(Math.min(Math.round(speedRef.current*2.2),9))}{"▯".repeat(Math.max(0,9-Math.round(speedRef.current*2.2)))}
          </div>
          {streak>=3&&<div style={{marginLeft:"auto",fontSize:11,color:T.amber,fontWeight:900,WebkitTextStroke:`0.5px ${T.ink}`}}>🔥 {streak} STREAK</div>}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide   { from{opacity:0;transform:translateX(-50%) translateY(-8px);}to{opacity:1;transform:translateX(-50%) translateY(0);} }
        @keyframes bannerPop   { from{transform:translate(-50%,-50%) scale(0.88);opacity:0;}to{transform:translate(-50%,-50%) scale(1);opacity:1;} }
        @keyframes warnBannerSlide { from{transform:translate(-50%,-50%) rotate(-6deg) scaleY(0);}to{transform:translate(-50%,-50%) rotate(-6deg) scaleY(1);} }
        @keyframes warnPulse   { from{opacity:0.18;}to{opacity:0.38;} }
        @keyframes warnLight   { from{opacity:0.5;transform:scale(0.9);}to{opacity:1;transform:scale(1.12);} }
        @keyframes burstPulse  { from{opacity:0.75;}to{opacity:1;} }
        @keyframes bossFloat   { 0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);} }
      `}</style>
    </div>
  );
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
function Summary({result,onPlay,onMenu}){
  if(!result) return null;
  const {score,level,multiple,catchLog=[],totalPausedMs=0}=result;
  const pausedSec=Math.round(totalPausedMs/1000);

  const correct=catchLog.filter(c=>c.correct&&!c.special).length;
  const wrong=catchLog.filter(c=>!c.correct).length;
  const total=correct+wrong;
  const acc=total>0?Math.round((correct/total)*100):0;

  const multiples=Array.from(new Set(catchLog.filter(c=>!c.special&&c.multiple).map(c=>c.multiple)));
  const perMultiple=multiples.map(m=>{
    const entries=catchLog.filter(c=>c.multiple===m&&!c.special);
    const c=entries.filter(e=>e.correct).length;
    const w=entries.filter(e=>!e.correct).length;
    const t=c+w;
    return {multiple:m, correct:c, wrong:w, total:t, acc:t>0?Math.round((c/t)*100):0, color:getCfg(m).color};
  }).sort((a,b)=>a.multiple-b.multiple);

  const getForemanLine=()=>{
    if(pausedSec>=120) return `Two whole minutes on break?! Time is MONEY, and right now you owe me a lot of it. Back on the belt!`;
    if(pausedSec>=60)  return `A full minute off the clock? I hope the break was worth it. Spoiler: it wasn't. Get moving!`;
    if(pausedSec>=30)  return `Thirty seconds away from the belt. I'm not angry, I'm just disappointed. Mostly angry. Go again!`;
    if(acc>=95) return `I don't know what to say. You're a natural. Don't let it go to your head. Now do it again!`;
    if(acc>=85) return `Outstanding work! I might just give you a promotion someday. Keep it up!`;
    if(acc>=75) return `Not bad at all! You've got a real future on this factory floor. Keep pushing!`;
    if(acc>=65) return `Pretty good! A few slipped through, but you're getting the hang of it. Give it another go!`;
    if(acc>=50) return `You're halfway there! The belts aren't going to sort themselves, but you're learning. Try again!`;
    if(acc>=35) return `Hey, everyone starts somewhere! Those multiples are tricky little numbers. One more round and you'll have it!`;
    return `The belt got the better of you this time, but that's okay! Even the best workers had a first day. Ready for round two?`;
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font,color:T.text,padding:24,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",paddingTop:32}}>
      <WoodBg/>
      <div style={{position:"relative",zIndex:2,width:"100%",maxWidth:620}}>

        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:11,letterSpacing:6,color:T.muted,marginBottom:8,fontFamily:"Georgia,serif"}}>SHIFT COMPLETE</div>
          <div style={{fontSize:64,fontWeight:900,color:T.amber,WebkitTextStroke:`3px ${T.ink}`,marginBottom:4}}>{score}</div>
          <div style={{fontSize:11,color:T.muted,letterSpacing:3}}>POINTS · MULTIPLES OF {multiple} · LEVEL {level}</div>
        </div>

        <Panel style={{marginBottom:14}}>
          <Label size="md">OVERALL PERFORMANCE</Label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:12,textAlign:"center",marginTop:12}}>
            {[
              {label:"CAUGHT",   value:correct,      color:"#40B840"},
              {label:"ERRORS",   value:wrong,        color:"#E84040"},
              {label:"ACCURACY", value:`${acc}%`,    color:T.teal},
              {label:"LEVEL",    value:level,        color:T.amber},
              {label:"ON BREAK", value:pausedSec>0?`${pausedSec}s`:"—", color:pausedSec>=30?T.rust:T.muted},
            ].map(s=>(
              <div key={s.label}>
                <Label>{s.label}</Label>
                <div style={{fontSize:22,fontWeight:900,color:s.color,marginTop:6,WebkitTextStroke:`1px ${T.ink}`}}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14,height:12,background:"#0E0804",border:`2px solid ${T.border}`,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${acc}%`,background:T.amber,borderRadius:3,
              backgroundImage:`repeating-linear-gradient(90deg,transparent,transparent 8px,${T.rust}44 8px,${T.rust}44 10px)`}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
            <div style={{fontSize:10,color:"#E84040",fontFamily:"Georgia,serif"}}>{wrong} errors</div>
            <div style={{fontSize:10,color:"#40B840",fontFamily:"Georgia,serif"}}>{correct} correct</div>
          </div>
        </Panel>

        {perMultiple.length>0&&(
          <Panel style={{marginBottom:14}}>
            <Label size="md">BREAKDOWN BY MULTIPLE</Label>
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
              {perMultiple.map(m=>(
                <div key={m.multiple} style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{
                    width:44,height:34,flexShrink:0,
                    background:m.color,border:`2px solid ${T.ink}`,borderRadius:5,
                    boxShadow:`2px 2px 0 ${T.ink}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:13,fontWeight:900,color:T.ink,
                  }}>×{m.multiple}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <div style={{fontSize:10,color:T.muted,fontFamily:"Georgia,serif"}}>
                        {m.correct} correct, {m.wrong} error{m.wrong!==1?"s":""}
                      </div>
                      <div style={{fontSize:11,fontWeight:900,color:m.acc>=80?"#40B840":m.acc>=60?T.amber:"#E84040"}}>
                        {m.acc}%
                      </div>
                    </div>
                    <div style={{height:8,background:"#0E0804",border:`1px solid ${T.border}`,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${m.acc}%`,
                        background:m.acc>=80?"#40B840":m.acc>=60?T.amber:"#E84040",
                        borderRadius:3,transition:"width 0.4s"}}/>
                    </div>
                  </div>
                  <div style={{
                    width:28,height:28,flexShrink:0,borderRadius:"50%",
                    background:m.acc>=80?"#40B840":m.acc>=60?T.amber:"#E84040",
                    border:`2px solid ${T.ink}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,
                  }}>{m.acc>=80?"✓":m.acc>=60?"~":"✗"}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:16,marginBottom:22}}>
          <div style={{animation:"bossFloat 2s ease-in-out infinite",flexShrink:0}}>
            <ForemanReed emotion={acc>=70&&pausedSec<30?"stern":"angry"} size={0.65}/>
          </div>
          <div style={{
            background:T.cream,border:`3px solid ${T.ink}`,borderRadius:12,padding:"14px 18px",
            maxWidth:280,boxShadow:`5px 5px 0 ${T.ink}`,fontFamily:"Georgia,serif",
            fontSize:13,color:T.ink,fontWeight:700,lineHeight:1.6,position:"relative",
          }}>
            <div style={{position:"absolute",left:-16,bottom:16,width:0,height:0,
              borderRight:`16px solid ${T.ink}`,borderTop:"9px solid transparent",borderBottom:"9px solid transparent"}}/>
            <div style={{position:"absolute",left:-10,bottom:18,width:0,height:0,
              borderRight:`12px solid ${T.cream}`,borderTop:"7px solid transparent",borderBottom:"7px solid transparent"}}/>
            "{getForemanLine()}"
          </div>
        </div>

        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <Btn label="▶ PLAY AGAIN" onClick={onPlay} color={T.amber}/>
          <Btn label="MAIN MENU"    onClick={onMenu} color={T.cream} style={{color:T.ink}}/>
        </div>
      </div>
      <style>{`@keyframes bossFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}`}</style>
    </div>
  );
}