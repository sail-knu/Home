(function () {
'use strict';
function demoVisible() {
  var page = document.getElementById('lecture-future');
  var block = document.getElementById('sim-los');
  return !!(page && block && !page.classList.contains('hidden-page') && !block.classList.contains('is-hidden'));
}
window.refresh_los_demo = function () {
  if (typeof resize === 'function' && demoVisible()) resize();
};

/* =========================================================================
   LOS(Line-of-Sight) Guidance — 웨이포인트 추종 시뮬레이터 · 모바일판
   -------------------------------------------------------------------------
   수치 계산부(유도 법칙 · 헤딩 PID · 유니사이클 운동학 · 적분기)는
   LOS_Guidance_Simulator.html 원본 기반. 이 판에서는 ILOS 를 제거하고
   '웨이포인트 직접 조준(wpt)' 법칙을 추가했다.
   ref) T.I.Fossen, Marine Craft Hydrodynamics and Motion Control, Ch.10
   ========================================================================= */

/* ---------- 수학 유틸 ---------- */
var PI=Math.PI, D2R=PI/180, R2D=180/PI, hypot=Math.hypot;
var wrap  = function(a){ return Math.atan2(Math.sin(a), Math.cos(a)); };
var clamp = function(v,a,b){ return v<a?a:(v>b?b:v); };
var _g2=null;
function gauss(){                                    // Box–Muller
  if(_g2!==null){ var g=_g2; _g2=null; return g; }
  var u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random();
  var r=Math.sqrt(-2*Math.log(u)), t=2*PI*v;
  _g2=r*Math.sin(t); return r*Math.cos(t);
}
var TAU_D = 0.25;    // 미분항 저역통과 시정수 [s] — dt 의 12배 (잡음 증폭 억제)

/* ---------- 파라미터 (원본과 동일한 기본값) ---------- */
var P={
  speedMul:1, dt:0.02,
  law:'los', delta:2.5, adaptive:false, dmin:1.0, dmax:6.0, gamma:0.35,
  Rlos:3.0, ppK:0.55, ppLc:1.2,
  Racc:1.2, switchMode:'circle', loop:false,
  vmax:1.8, wmax:110, kp:2.4, ki:0.0, kd:0.35, iLim:2.0, tau:0.12,
  slow:true, wheelLim:true, base:0.45, vwheel:2.6,
  e0:3.0, psi0:60,
  cur:0.0, curDir:90, noiseP:0.0, noiseA:0.0,
  showGrid:true, showTrail:true, showLOS:true, showBand:true, showRec:true, showCompass:true
};

/* ---------- 상태 ---------- */
var S={
  wps:[], k:0,
  x:0, y:0, yaw:0, v:0, omega:0,
  t:0, done:false, running:false,
  ei:0, myawPrev:null, dFilt:0,
  trail:[], hist:[], log:[],
  sumE2:0, nE:0, maxE:0, dist:0, g:null,
  nRev:0, wSgn:0,          // 조타 반전 누적 횟수 / 마지막 non-zero ω 부호 (표시용 파생 지표)
  iaeE:0, iseE:0, jw:0, scoreSaved:false
};
var W_DEAD = 1e-3;        // |ω| 가 이보다 작으면 '중립' — 0 근처 떨림을 반전으로 세지 않는다
var LS_LOS='sail-los-cte-smooth-v1';
var LAMBDA_REV=0.5;       // 종합 J = ∫|e| dt + λ·조타 반전
function comboJ(iae, nRev){ return iae + LAMBDA_REV*nRev; }
var drag=null;

/* ---------- 뷰(월드↔스크린) ----------
   좌표 변환식은 원본과 동일하다. 다만 모바일에서는 화면이 좁으므로
   ox/oy/scale 을 '레터박스 고정' 대신 auto-fit 으로 정한다.
   프리셋 좌표는 여전히 절대 미터라 los_guidance.py 와 같은 값을 쓴다. */
var view={W:0,H:0,scale:20,worldW:40,worldH:24,ox:0,oy:0,dpr:1};
function w2sx(x){ return view.ox + x*view.scale; }
function w2sy(y){ return view.oy + (view.worldH-y)*view.scale; }
function s2wx(px){ return (px-view.ox)/view.scale; }
function s2wy(py){ return view.worldH - (py-view.oy)/view.scale; }

/* =========================================================================
   1. 경로(웨이포인트) 기하
   ========================================================================= */
function N(){ return S.wps.length; }
function segCount(){ return P.loop ? N() : N()-1; }
function wpAt(i){ var n=N(); return S.wps[((i%n)+n)%n]; }
function normK(){ S.k = clamp(S.k, 0, Math.max(segCount()-1, 0)); }

function segGeom(k){
  var A=wpAt(k), B=wpAt(k+1), dx=B.x-A.x, dy=B.y-A.y;
  return {A:A, B:B, alpha:Math.atan2(dy,dx), L:hypot(dx,dy)};
}

/** 현재 진행 위치에서 경로를 따라 d[m] 전진한 점.
    원-경로 교점이 존재하지 않을 때 쓰는 명시적인 폴백이다. */
function pointAheadOnPath(k, sStart, d){
  var i=k, rem=Math.max(sStart,0)+Math.max(d,0);
  for(var n=0;n<200;n++){
    var g=segGeom(i), ca=Math.cos(g.alpha), sa=Math.sin(g.alpha);
    if(rem<=g.L || (!P.loop && i>=segCount()-1)){
      var a=clamp(rem,0,g.L);
      return {x:g.A.x+a*ca, y:g.A.y+a*sa};
    }
    rem-=g.L; i++;
  }
  var gl=segGeom(segCount()-1); return {x:gl.B.x, y:gl.B.y};
}

/** 로봇 중심 반경 R 원과 '전방 경로 선분'의 정확한 교점을 찾는다.
    찾지 못하면 null을 반환하며 반경을 몰래 확대하지 않는다. */
function circlePathIntersection(k, sStart, R, mx, my, currentOnly){
  var i=k, aFrom=Math.max(sStart,0);
  for(var n=0;n<200;n++){
    var g=segGeom(i), ca=Math.cos(g.alpha), sa=Math.sin(g.alpha);
    var dx=mx-g.A.x, dy=my-g.A.y;
    var along=dx*ca+dy*sa, perp=-dx*sa+dy*ca;
    var disc=R*R-perp*perp;
    if(disc>=0){
      var root=Math.sqrt(disc), a1=along-root, a2=along+root;
      var a=null;
      if(a1>=aFrom && a1<=g.L) a=a1;
      if(a2>=aFrom && a2<=g.L) a=a2;       // 전방 쪽(진행도가 큰) 교점 우선
      if(a!==null) return {x:g.A.x+a*ca, y:g.A.y+a*sa, along:a};
    }
    if(currentOnly || (!P.loop && i>=segCount()-1)) break;
    i++; aFrom=0;
  }
  return null;
}

/* =========================================================================
   2. 유도 법칙 (핵심)
   -------------------------------------------------------------------------
     α_k = atan2(y_{k+1}-y_k, x_{k+1}-x_k)                     경로 방위각
     s   =  (x-x_k)cosα + (y-y_k)sinα                          along-track
     e   = -(x-x_k)sinα + (y-y_k)cosα                          cross-track
   Lookahead LOS  χ_d = α + atan(-e/Δ)
   Waypoint 직접  χ_d = atan2(y_{k+1}-y, x_{k+1}-x)            조준점 = 다음 웨이포인트
   Enclosure LOS  반경 R 원과 '현재 구간'의 교점 → Δ_eff = √(R²-e²)
   Pure Pursuit   반경 L_d = k·v + L_fc 원과 '경로 전체'의 교점 (구간 경계를 넘음)
   ========================================================================= */
function guidance(mx,my){
  var g=segGeom(S.k), ca=Math.cos(g.alpha), sa=Math.sin(g.alpha);
  var dx=mx-g.A.x, dy=my-g.A.y;
  var s =  dx*ca + dy*sa;
  var e = -dx*sa + dy*ca;
  var foot={x:g.A.x+s*ca, y:g.A.y+s*sa};

  // 적응형 전방주시거리: 오차가 크면 짧게(공격적), 작으면 길게(부드럽게)
  var delta=P.delta;
  if(P.adaptive){
    var dlo=Math.min(P.dmin,P.dmax), dhi=Math.max(P.dmin,P.dmax);
    delta = dlo + (dhi-dlo)*Math.exp(-P.gamma*e*e);
  }

  var chid, losPt, dEff=delta, R, hit, fallback=false;
  switch(P.law){
    case 'los':
      chid=g.alpha+Math.atan2(-e,delta);
      losPt={x:foot.x+delta*ca, y:foot.y+delta*sa};
      break;

    case 'wpt':
      // 다음 웨이포인트 자체를 조준점으로 — 경로 복귀 개념이 없는 최단순 유도
      losPt={x:g.B.x, y:g.B.y};
      dEff=hypot(losPt.x-mx, losPt.y-my);
      chid=(dEff<1e-9) ? g.alpha : Math.atan2(losPt.y-my, losPt.x-mx);
      break;

    case 'enc':
      R=P.Rlos;
      hit=circlePathIntersection(S.k, s, R, mx, my, true);
      if(hit){
        losPt={x:hit.x,y:hit.y};
        dEff=Math.max(hit.along-s,0);
      }else{
        // 원이 현재 유한 선분과 만나지 않으면 가장 가까운 선분점을 직접 조준한다.
        var af=clamp(s,0,g.L);
        losPt={x:g.A.x+af*ca, y:g.A.y+af*sa};
        dEff=hypot(losPt.x-mx,losPt.y-my); fallback=true;
      }
      chid=(dEff<1e-9) ? g.alpha : Math.atan2(losPt.y-my,losPt.x-mx);
      break;

    case 'pp':
      R=P.ppK*Math.abs(S.v)+P.ppLc;
      hit=circlePathIntersection(S.k, s, R, mx, my, false);
      if(hit) losPt={x:hit.x,y:hit.y};
      else{ losPt=pointAheadOnPath(S.k,s,R); fallback=true; }
      chid=Math.atan2(losPt.y-my, losPt.x-mx);
      dEff=hypot(losPt.x-mx, losPt.y-my);
      break;
  }
  return {alpha:g.alpha, s:s, e:e, foot:foot, losPt:losPt,
          chid:chid, delta:dEff, radius:R, fallback:fallback, L:g.L, A:g.A, B:g.B};
}

/** 성능 지표·그림용 '참값' 오차를 g 에 덧붙인다. */
function attachTrue(g){
  var ca=Math.cos(g.alpha), sa=Math.sin(g.alpha);
  var dx=S.x-g.A.x, dy=S.y-g.A.y;
  var sT=dx*ca+dy*sa;
  g.eTrue    = -dx*sa+dy*ca;
  g.footTrue = {x:g.A.x+sT*ca, y:g.A.y+sT*sa};
  g.epTrue   = wrap(g.chid-S.yaw);
  return g;
}

/* =========================================================================
   3. 웨이포인트 전환 — '측정 위치' 기준 (실로봇과 동일한 정보)
   ========================================================================= */
function switchCheck(g, mx, my){
  var nx=wpAt(S.k+1);
  var hit = (P.switchMode==='circle')
          ? hypot(nx.x-mx, nx.y-my) < P.Racc
          : (g.L-g.s) < P.Racc;
  if(!hit) return;
  if(P.loop){ S.k=(S.k+1)%N(); }
  else if(S.k < N()-2){ S.k++; }
  else { S.done=true; S.running=false; commitLosScore(); syncStatus(); }
}

/* =========================================================================
   4. 한 스텝 (Guidance → Control → Model) — 원본 그대로
   ========================================================================= */
function step(dt){
  if(N()<2 || S.done) return;

  /* (0) 센서 측정 — 잡음 주입 */
  var mx  = S.x + P.noiseP*gauss();
  var my  = S.y + P.noiseP*gauss();
  var myaw= S.yaw + P.noiseA*D2R*gauss();

  /* (1) Guidance → 목표 침로 χ_d */
  var g=guidance(mx,my); S.g=g;

  /* (2) Control → 헤딩 PID
        · 미분항은 '측정 방위각' 미분 (χ_d 계단에 의한 미분 킥 제거)
        · 적분은 K_i>0 이고 포화되지 않을 때만 (조건부 적분) */
  var ePsi=wrap(g.chid-myaw);
  var dRaw = (S.myawPrev===null) ? 0 : -wrap(myaw-S.myawPrev)/dt;
  S.myawPrev=myaw;
  S.dFilt += (dRaw-S.dFilt)*(dt/(dt+TAU_D));

  var wLim=P.wmax*D2R, eiBefore=S.ei;
  if(P.ki<1e-9){ S.ei=0; }
  else{
    var wRaw=P.kp*ePsi + P.ki*S.ei + P.kd*S.dFilt;
    if(Math.abs(wRaw)<wLim || wRaw*ePsi<0)
      S.ei=clamp(S.ei+ePsi*dt, -P.iLim, P.iLim);
  }
  var wCmd=clamp(P.kp*ePsi + P.ki*S.ei + P.kd*S.dFilt, -wLim, wLim);

  var vCmd=P.vmax;
  if(P.slow) vCmd*=Math.max(0.15, Math.cos(ePsi));      // 헤딩 오차 크면 감속
  if(!P.loop && S.k===N()-2){                           // 종점 접근 감속
    var dEnd=hypot(wpAt(S.k+1).x-mx, wpAt(S.k+1).y-my);
    vCmd*=clamp(dEnd/Math.max(P.Racc*2,0.5), 0.12, 1);
  }

  /* (3) 액추에이터 1차 지연 */
  var a=1-Math.exp(-dt/Math.max(P.tau,1e-3));
  S.omega += (wCmd-S.omega)*a;
  S.v     += (vCmd-S.v)*a;

  /* (4) 차동구동 휠속도 포화 */
  if(P.wheelLim){
    var vL=S.v-S.omega*P.base/2, vR=S.v+S.omega*P.base/2;
    var m=Math.max(Math.abs(vL),Math.abs(vR))/P.vwheel;
    if(m>1){
      vL/=m; vR/=m; S.v=(vL+vR)/2; S.omega=(vR-vL)/P.base;
      // 하류의 휠 포화가 오차 방향의 조향을 막았으면 이번 적분을 되돌린다.
      if(P.ki>=1e-9 && wCmd*ePsi>0) S.ei=eiBefore;
    }
  }

  /* (5) 유니사이클 운동학 + 외란(해류·바람) */
  var px0=S.x, py0=S.y;
  var cd=P.curDir*D2R;
  S.x  += (S.v*Math.cos(S.yaw)+P.cur*Math.cos(cd))*dt;
  S.y  += (S.v*Math.sin(S.yaw)+P.cur*Math.sin(cd))*dt;
  S.yaw = wrap(S.yaw+S.omega*dt);
  S.t  += dt;
  S.dist += hypot(S.x-px0, S.y-py0);      // 대지 이동거리 (외란 표류 포함)

  /* (6) 지표·로그 — 참값 기준. g 가 붙들고 있는 A/α 를 쓰므로 (7) 의
         전환으로 S.k 가 바뀌어도 이번 스텝의 구간 기준이 유지된다. */
  attachTrue(g);
  var ae=Math.abs(g.eTrue);
  S.sumE2+=g.eTrue*g.eTrue; S.nE++; if(ae>S.maxE) S.maxE=ae;
  S.iaeE+=ae*dt; S.iseE+=g.eTrue*g.eTrue*dt; S.jw+=S.omega*S.omega*dt;

  /* 조타 반전 — ω 부호가 뒤집힌 횟수. 채터링(조타 진동)의 대가를 정량화한다.
     기존 상태량 S.omega 에서 파생만 하므로 운동 방정식에는 아무 영향이 없다. */
  var sg = (S.omega> W_DEAD) ? 1 : ((S.omega< -W_DEAD) ? -1 : 0);
  if(sg!==0){ if(S.wSgn!==0 && sg!==S.wSgn) S.nRev++; S.wSgn=sg; }

  var tl=S.trail[S.trail.length-1];
  if(!tl || hypot(S.x-tl.x,S.y-tl.y)>0.06) S.trail.push({x:S.x,y:S.y});
  if(S.trail.length>6000) S.trail.shift();
  S.hist.push({t:S.t, e:g.eTrue, ep:g.epTrue*R2D, w:S.omega*R2D, v:S.v});
  if(S.hist.length>20000) S.hist.shift();
  S.log.push([S.t.toFixed(3),S.x.toFixed(4),S.y.toFixed(4),(S.yaw*R2D).toFixed(3),
              g.eTrue.toFixed(4), g.e.toFixed(4), (g.epTrue*R2D).toFixed(3),
              S.v.toFixed(4), (S.omega*R2D).toFixed(3), S.k].join(','));
  if(S.log.length>60000) S.log.shift();

  /* (7) 전환 판정 */
  switchCheck(g,mx,my);
}

/* =========================================================================
   5. 리셋 · 프리셋 (좌표는 절대 미터 — los_guidance.py 와 동일)
   ========================================================================= */
function reset(keepPose){
  S.running=false; acc=0; drag=null;
  normK();
  S.k=0; S.t=0; S.done=false; S.ei=0; S.myawPrev=null; S.dFilt=0;
  S.v=0; S.omega=0; S.trail=[]; S.hist=[]; S.log=[];
  S.sumE2=0; S.nE=0; S.maxE=0; S.dist=0; S.g=null;
  S.nRev=0; S.wSgn=0;
  S.iaeE=0; S.iseE=0; S.jw=0; S.scoreSaved=false;
  if(!keepPose){
    if(N()>=2){
      var g=segGeom(0);
      S.x=g.A.x - P.e0*Math.sin(g.alpha);   // 초기 횡방향 오차
      S.y=g.A.y + P.e0*Math.cos(g.alpha);
      S.yaw=wrap(g.alpha + P.psi0*D2R);     // 초기 헤딩 오차
    }else{ S.x=view.worldW/2; S.y=view.worldH/2; S.yaw=0; }
  }
  S.trail.push({x:S.x,y:S.y});
  syncStatus();
}

var PRESETS={
  '지그재그'      : [[3,5],[12,19],[21,5],[30,19],[39,10]],
  '직선'          : [[2,12],[38,12]],
  '사각 순환'     : [[6,5],[34,5],[34,19],[6,19]],
  '경작 경로'     : [[3,3],[37,3],[37,8],[3,8],[3,13],[37,13],[37,18],[3,18]],
  'S 커브'       : (function(){ var a=[],i,u; for(i=0;i<13;i++){ u=i/12; a.push([3+u*34, 12+7*Math.sin(u*2*PI)]); } return a; })()
};
function loadPreset(name){
  var pts;
  if(name==='무작위'){
    pts=[]; for(var i=0;i<6;i++) pts.push([3+Math.random()*34, 3+Math.random()*18]);
  }else pts=PRESETS[name];
  S.wps=pts.map(function(p){ return {x:p[0], y:p[1]}; });
  P.loop=(name==='사각 순환'); syncUI();
  reset(false);
}

/* =========================================================================
   6. 렌더링
   ========================================================================= */
var cv=document.getElementById('los-cv'), ctx=cv.getContext('2d');
var rc=document.getElementById('los-rec'), rctx=rc.getContext('2d');
var recW=0, recH=0;          // 레코더 캔버스의 CSS 크기 (resize 가 실측해 둔다)
var C={};
function demoRoot(){ return document.getElementById('demo-los') || document.documentElement; }
function readTheme(){
  var cs=getComputedStyle(demoRoot());
  function g(n){ return cs.getPropertyValue(n).trim(); }
  C={ bg:g('--ink')||'#e7eef2', bg2:g('--ink-2')||'#ffffff', void_:g('--ink-4')||'#d3dfe7',
      grid:g('--grid')||'#dae7ee', gridM:g('--grid-major')||'#bed4e0',
      fg:g('--text')||'#0b2130', fg2:g('--text-2')||'#42606f', fg3:g('--text-3')||'#6b8798', rule:g('--rule')||'#cfdde5',
      track:g('--track')||'#0369a1', mark:g('--mark')||'#b45309', markH:g('--mark-hot')||'#92400e', hull:g('--hull')||'#15803d',
      devi:g('--devi')||'#be123c', sight:g('--sight')||'#4d7c0f', course:g('--course')||'#0d2644', accent:g('--accent')||'#1d4e89' };
}

/* ---------- devicePixelRatio 대응 리사이즈 ----------
   그리기 좌표는 전부 CSS 픽셀 기준(view.W / view.H / rc.clientWidth)이며,
   백킹스토어만 dpr 배로 키운다. */
/* ---------- 고정 스테이지 높이 예산 ----------
   스테이지(캔버스 + 핵심 수치)가 뷰포트의 45% 를 넘지 않도록 캔버스 높이를 정한다
   (MPPI 판과 동일한 예산). 나머지 55% 에서 하단 dock 을 빼면 컨트롤 공간이 남는다. */
var STAGE_FRAC=0.45;
function fitStage(){
  var vh=window.innerHeight||640;
  var cells=document.getElementById('los-cells');
  var bar=document.getElementById('los-scorebar');
  var rh=cells ? Math.round(cells.getBoundingClientRect().height) : 44;
  if(bar) rh+=Math.round(bar.getBoundingClientRect().height);
  if(!rh) rh=44;
  var wide=window.matchMedia('(min-width:900px)').matches;
  var h=wide
    ? Math.round(clamp(vh*0.40-rh, 280, 400))
    : Math.round(clamp(vh*STAGE_FRAC-rh, 150, 360));
  var root=demoRoot();
  var cur=root.style.getPropertyValue('--chartH');
  if(cur!==h+'px') root.style.setProperty('--chartH', h+'px');
}

/* 백킹스토어는 반드시 '캔버스 자신의 CSS 박스'로 잡는다.
   부모를 재면 부모의 border-box(테두리 포함)가 잡혀 캔버스보다 커진다:
   #recwrap 은 아래 1px 테두리가 있어 border-box 166.39px vs 캔버스 165.39px,
   즉 백킹이 CSS 보다 0.6% 커져 스트립 차트가 세로로 눌린다.
   그리기 좌표도 같은 값(view.W/H · recW/recH)을 써야 어긋나지 않는다. */
function resize(){
  fitStage();
  var dpr=window.devicePixelRatio||1;
  var r=cv.getBoundingClientRect();
  var cssW=Math.max(r.width,1), cssH=Math.max(r.height,1);
  view.dpr=dpr; view.W=cssW; view.H=cssH;
  cv.width =Math.max(Math.round(cssW*dpr),1);
  cv.height=Math.max(Math.round(cssH*dpr),1);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  var r2=rc.getBoundingClientRect();
  recW=Math.max(r2.width,1); recH=Math.max(r2.height,1);
  rc.width =Math.max(Math.round(recW*dpr),1);
  rc.height=Math.max(Math.round(recH*dpr),1);
  rctx.setTransform(dpr,0,0,dpr,0,0);

  autoFit();
}

/* ---------- auto-fit: 경로 전체가 여유를 두고 화면에 들어오도록 ---------- */
function autoFit(){
  if(!view.W || !view.H) return;
  var x0,y0,x1,y1,i,p;
  if(N()>0){
    x0=y0=1e9; x1=y1=-1e9;
    for(i=0;i<N();i++){
      p=S.wps[i];
      if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x;
      if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y;
    }
    if(S.x<x0)x0=S.x; if(S.x>x1)x1=S.x;      // 로봇도 항상 화면 안에
    if(S.y<y0)y0=S.y; if(S.y>y1)y1=S.y;
  }else{
    x0=0; y0=0; x1=view.worldW; y1=view.worldH;
  }
  var mw=Math.max(P.Racc*1.6, 1.4);          // 월드 여백 [m]
  x0-=mw; x1+=mw; y0-=mw; y1+=mw;
  var bw=Math.max(x1-x0, 2), bh=Math.max(y1-y0, 2);
  var padPx=8;
  var sc=clamp(Math.min((view.W-2*padPx)/bw, (view.H-2*padPx)/bh), 2, 90);
  view.scale=sc;
  view.ox = view.W/2 - ((x0+x1)/2)*sc;
  view.oy = view.H/2 - (view.worldH-(y0+y1)/2)*sc;
}
/* 주행 중 로봇이 화면 밖으로 나가면 한 번 다시 맞춘다 */
function ensureVisible(){
  if(drag) return;
  var px=w2sx(S.x), py=w2sy(S.y), m=20;
  if(px<m || px>view.W-m || py<m || py>view.H-m) autoFit();
}

var MONO='11px ui-monospace,"SF Mono",Consolas,monospace';
function dash(on){ ctx.setLineDash(on?[5,4]:[]); }

function drawGrid(){
  var x0=w2sx(0), y0=w2sy(view.worldH), w=view.worldW*view.scale, h=view.worldH*view.scale;
  ctx.fillStyle=C.void_; ctx.fillRect(0,0,view.W,view.H);          // 월드 밖 여백
  ctx.fillStyle=C.bg;    ctx.fillRect(x0,y0,w,h);                  // 월드 박스
  if(P.showGrid){
    var stepM=(view.scale<7)?5:1;                                  // 축소되면 5 m 격자만
    ctx.lineWidth=1; var i;
    for(i=0;i<=view.worldW;i+=stepM){
      ctx.strokeStyle=(i%5===0)?C.gridM:C.grid;
      ctx.beginPath(); ctx.moveTo(w2sx(i)+.5,y0); ctx.lineTo(w2sx(i)+.5,y0+h); ctx.stroke();
    }
    for(i=0;i<=view.worldH;i+=stepM){
      ctx.strokeStyle=(i%5===0)?C.gridM:C.grid;
      ctx.beginPath(); ctx.moveTo(x0,w2sy(i)+.5); ctx.lineTo(x0+w,w2sy(i)+.5); ctx.stroke();
    }
    ctx.fillStyle=C.fg3; ctx.font=MONO;
    for(i=5;i<view.worldW;i+=5) ctx.fillText(i+'m', w2sx(i)+3, y0+h-5);
    for(i=5;i<view.worldH;i+=5) ctx.fillText(i+'m', x0+4, w2sy(i)-4);
  }
  ctx.strokeStyle=C.rule; ctx.lineWidth=1; ctx.strokeRect(x0+.5,y0+.5,w,h);
}

function drawPath(){
  if(N()<1) return;
  var i;
  if(N()>=2){
    ctx.strokeStyle=C.track; ctx.lineWidth=1.8; ctx.globalAlpha=.45;
    ctx.beginPath(); ctx.moveTo(w2sx(S.wps[0].x), w2sy(S.wps[0].y));
    for(i=1;i<N();i++) ctx.lineTo(w2sx(S.wps[i].x), w2sy(S.wps[i].y));
    if(P.loop) ctx.closePath();
    ctx.stroke(); ctx.globalAlpha=1;

    var g=segGeom(S.k);                            // 활성 구간
    ctx.strokeStyle=C.track; ctx.lineWidth=3.4;
    ctx.beginPath(); ctx.moveTo(w2sx(g.A.x),w2sy(g.A.y)); ctx.lineTo(w2sx(g.B.x),w2sy(g.B.y)); ctx.stroke();

    if(P.showBand){                                // 허용 오차 밴드
      var off=P.Racc*view.scale, ca=Math.cos(g.alpha), sa=Math.sin(g.alpha);
      ctx.strokeStyle=C.track; ctx.globalAlpha=.2; ctx.lineWidth=1; dash(true);
      [1,-1].forEach(function(sg){
        ctx.beginPath();
        ctx.moveTo(w2sx(g.A.x)-sg*off*sa, w2sy(g.A.y)-sg*off*ca);
        ctx.lineTo(w2sx(g.B.x)-sg*off*sa, w2sy(g.B.y)-sg*off*ca);
        ctx.stroke();
      });
      dash(false); ctx.globalAlpha=1;
    }
  }
  for(i=0;i<N();i++){                              // 웨이포인트(부표)
    var p=S.wps[i], px=w2sx(p.x), py=w2sy(p.y), act=(N()>=2 && i===((S.k+1)%N()));
    if(act){
      ctx.strokeStyle=C.markH; ctx.lineWidth=1.4; ctx.globalAlpha=.7; dash(true);
      ctx.beginPath(); ctx.arc(px,py,P.Racc*view.scale,0,2*PI); ctx.stroke();
      dash(false); ctx.globalAlpha=1;
    }
    ctx.beginPath(); ctx.arc(px,py, act?9:7, 0,2*PI);
    ctx.fillStyle=act?C.markH:C.mark; ctx.fill();
    ctx.strokeStyle=C.bg; ctx.lineWidth=2.5; ctx.stroke();
    ctx.fillStyle=C.fg3; ctx.font=MONO; ctx.fillText('W'+i, px+11, py-10);
  }
}

function drawTrail(){
  if(!P.showTrail || S.trail.length<2) return;
  ctx.strokeStyle=C.hull; ctx.lineWidth=1.5; ctx.globalAlpha=.35;
  ctx.beginPath(); ctx.moveTo(w2sx(S.trail[0].x), w2sy(S.trail[0].y));
  for(var i=1;i<S.trail.length;i++) ctx.lineTo(w2sx(S.trail[i].x), w2sy(S.trail[i].y));
  ctx.stroke(); ctx.globalAlpha=1;
}

function drawGuidance(){
  var g=S.g;
  if(!g || !P.showLOS || N()<2) return;
  var rx=w2sx(S.x), ry=w2sy(S.y);
  var foot = g.footTrue || g.foot, eShow = (g.eTrue===undefined) ? g.e : g.eTrue;

  ctx.strokeStyle=C.devi; ctx.lineWidth=1.8; dash(true);          // cross-track error
  ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(w2sx(foot.x),w2sy(foot.y)); ctx.stroke();
  dash(false);
  ctx.beginPath(); ctx.arc(w2sx(foot.x),w2sy(foot.y),3.5,0,2*PI); ctx.fillStyle=C.devi; ctx.fill();
  ctx.font=MONO; ctx.fillStyle=C.devi;
  ctx.fillText('e = '+eShow.toFixed(2)+' m', (rx+w2sx(foot.x))/2+8, (ry+w2sy(foot.y))/2);

  if(P.law==='enc'||P.law==='pp'){    // 전방주시 원 — 반지름은 '실제 조준거리'
    var R=hypot(g.losPt.x-S.x, g.losPt.y-S.y);
    ctx.strokeStyle=C.sight; ctx.globalAlpha=.32; ctx.lineWidth=1.2; dash(true);
    ctx.beginPath(); ctx.arc(rx,ry,R*view.scale,0,2*PI); ctx.stroke();
    dash(false); ctx.globalAlpha=1;
  }
  ctx.strokeStyle=C.sight; ctx.lineWidth=2.2;                     // LOS 시선
  ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(w2sx(g.losPt.x),w2sy(g.losPt.y)); ctx.stroke();
  ctx.save(); ctx.translate(w2sx(g.losPt.x),w2sy(g.losPt.y)); ctx.lineWidth=2.2;
  ctx.beginPath(); ctx.moveTo(-6,-6); ctx.lineTo(6,6); ctx.moveTo(6,-6); ctx.lineTo(-6,6); ctx.stroke();
  ctx.restore();

  var Ld=2.3*view.scale;                                          // 목표 침로 χ_d
  ctx.strokeStyle=C.course; ctx.lineWidth=1.8; ctx.globalAlpha=.9; dash(true);
  ctx.beginPath(); ctx.moveTo(rx,ry);
  ctx.lineTo(rx+Ld*Math.cos(g.chid), ry-Ld*Math.sin(g.chid)); ctx.stroke();
  dash(false); ctx.globalAlpha=1;
}

/* 로봇 화면 크기 — auto-fit 으로 scale 이 9px/m 까지 내려가는 모바일에서는
   월드 비례(0.55·0.34 m)만으로는 13×11px 이 되어 찾기 어렵다. 픽셀 최소값을
   두고, 자세 핸들 간격(hand, 월드 [m])은 halo 바깥으로 밀되 그리기와
   히트테스트(pointerdown)가 반드시 같은 값을 쓰도록 여기서 함께 계산한다. */
function robotDims(){
  var sc=view.scale;
  var bl=Math.max(0.55*sc, 14), bw=Math.max(0.34*sc, 8.5);
  // halo 상한 48px: 고배율 확대에서 화면을 덮지 않고, 로봇 탭 반경으로도 쓴다
  var halo=Math.min(Math.max(bl*1.4, 19), 48);
  return {bl:bl, bw:bw, halo:halo, hand:Math.max(1.6*sc, bl*1.9)/sc};
}

function drawRobot(){
  var rx=w2sx(S.x), ry=w2sy(S.y), sc=view.scale;
  var dim=robotDims(), bl=dim.bl, bw=dim.bw;
  ctx.save(); ctx.translate(rx,ry); ctx.rotate(-S.yaw);
  var hr=dim.halo;                                      // 위치 halo — 자취·경로 위에서도 띈다
  ctx.fillStyle=C.hull; ctx.globalAlpha=.13;
  ctx.beginPath(); ctx.arc(0,0,hr,0,2*PI); ctx.fill();
  ctx.globalAlpha=.5; ctx.strokeStyle=C.hull; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(0,0,hr,0,2*PI); ctx.stroke();
  ctx.globalAlpha=1;
  ctx.fillStyle=C.hull;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(-bl*.75,-bw, bl*1.5, bw*2, 4);
  else ctx.rect(-bl*.75,-bw, bl*1.5, bw*2);
  ctx.fill();
  ctx.strokeStyle=C.bg; ctx.lineWidth=2.5; ctx.stroke(); // 배경색 외곽선 — 자취와 분리 (부표와 같은 관례)
  ctx.fillStyle=C.bg;                                   // 좌우 구동륜
  ctx.fillRect(-bl*.35,-bw-3, bl*.7, 3);
  ctx.fillRect(-bl*.35, bw,   bl*.7, 3);
  ctx.strokeStyle=C.bg; ctx.lineWidth=2;                // 선수 방향
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(bl*.7,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bl*.72,0); ctx.lineTo(bl*.42,-4); ctx.lineTo(bl*.42,4);
  ctx.closePath(); ctx.fillStyle=C.bg; ctx.fill();
  ctx.restore();

  if(!S.running){                                       // 자세 조정 핸들
    var hx=rx+dim.hand*sc*Math.cos(S.yaw), hy=ry-dim.hand*sc*Math.sin(S.yaw);
    ctx.strokeStyle=C.hull; ctx.globalAlpha=.45; ctx.lineWidth=1; dash(true);
    ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(hx,hy); ctx.stroke(); dash(false);
    ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(hx,hy,6,0,2*PI);
    ctx.fillStyle=C.hull; ctx.fill(); ctx.strokeStyle=C.bg; ctx.lineWidth=1.5; ctx.stroke();
  }
}

/* 컴퍼스 로즈 — 목표 침로 χ_d(보라)와 실제 선수각 ψ(초록) 바늘 */
function drawCompass(){
  if(!P.showCompass || view.W<300) return;
  var R=(view.W<420)?24:30, cx=view.W-R-14, cy=view.H-R-14, a, t, r0;
  ctx.save();
  ctx.fillStyle=C.bg2; ctx.globalAlpha=.92;
  ctx.beginPath(); ctx.arc(cx,cy,R+7,0,2*PI); ctx.fill(); ctx.globalAlpha=1;
  ctx.strokeStyle=C.rule; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy,R+7,0,2*PI); ctx.stroke();
  ctx.strokeStyle=C.fg3; ctx.globalAlpha=.5;
  for(a=0;a<360;a+=15){
    r0=(a%45===0)?R-6:R-3; t=a*D2R;
    ctx.beginPath();
    ctx.moveTo(cx+r0*Math.cos(t), cy-r0*Math.sin(t));
    ctx.lineTo(cx+R*Math.cos(t), cy-R*Math.sin(t)); ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.fillStyle=C.fg3; ctx.font='9px ui-monospace,monospace';
  ctx.fillText('E',cx+R-5,cy+3); ctx.fillText('N',cx-3,cy-R+8);
  if(S.g && N()>=2){
    ctx.strokeStyle=C.course; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+(R-9)*Math.cos(S.g.chid), cy-(R-9)*Math.sin(S.g.chid)); ctx.stroke();
  }
  ctx.strokeStyle=C.hull; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+(R-3)*Math.cos(S.yaw), cy-(R-3)*Math.sin(S.yaw)); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,2.5,0,2*PI); ctx.fillStyle=C.fg2; ctx.fill();
  ctx.restore();
}

function draw(){
  drawGrid(); drawPath(); drawTrail(); drawGuidance(); drawRobot(); drawCompass();
}

/* ---------- 레코더(스트립 차트) — 계열은 범례 칩으로 on/off ---------- */
var SERIES=[
  {k:'e',  lab:'e 횡방향오차 [m]', c:'devi',   row:0, floor:0.5, on:true},
  {k:'ep', lab:'ψ 오차 [°]',      c:'course', row:1, floor:5,   on:true},
  {k:'w',  lab:'ω 조타각속도 [°/s]', c:'sight', row:1, floor:5,  on:true},
  {k:'v',  lab:'v 속도 [m/s]',    c:'mark',   row:2, floor:0.5, on:true}
];
function drawRecorder(){
  var W=recW||rc.clientWidth, H=recH||rc.clientHeight;   // 백킹스토어와 같은 CSS 크기
  if(!W || !H) return;
  rctx.clearRect(0,0,W,H);
  var rows=[];
  [0,1,2].forEach(function(ri){
    var ks=SERIES.filter(function(s){ return s.row===ri && s.on; });
    if(ks.length) rows.push({keys:ks, floor:Math.min.apply(null, ks.map(function(s){ return s.floor; }))});
  });
  if(!rows.length){
    rctx.fillStyle=C.fg3; rctx.font='11px ui-monospace,monospace';
    rctx.fillText('범례 칩을 눌러 표시할 계열을 고르세요', 12, H/2);
    return;
  }
  var win=20, t1=Math.max(S.t,win), t0=t1-win;
  var pad={l:40,r:8,t:16,b:14}, gap=8;
  var ph=(H-pad.t-pad.b-gap*(rows.length-1))/rows.length;
  var data=S.hist.filter(function(h){ return h.t>=t0; });
  function xOf(t){ return pad.l+(t-t0)/win*(W-pad.l-pad.r); }
  rows.forEach(function(row,ri){
    row.y=pad.t+ri*(ph+gap); row.h=ph;
    var m=1e-6;
    row.keys.forEach(function(kk){ data.forEach(function(h){ m=Math.max(m,Math.abs(h[kk.k])); }); });
    m=Math.max(m*1.25, row.floor);
    function yOf(v){ return row.y+row.h/2-(v/m)*(row.h/2); }
    rctx.strokeStyle=C.rule; rctx.lineWidth=1;
    rctx.strokeRect(pad.l+.5, row.y+.5, W-pad.l-pad.r, row.h);
    rctx.setLineDash([3,3]);
    rctx.beginPath(); rctx.moveTo(pad.l,yOf(0)); rctx.lineTo(W-pad.r,yOf(0)); rctx.stroke();
    rctx.setLineDash([]);
    rctx.fillStyle=C.fg3; rctx.font='9.5px ui-monospace,monospace';
    rctx.fillText(m.toFixed(1),   3, row.y+9);
    rctx.fillText('0',            3, yOf(0)+3);
    rctx.fillText((-m).toFixed(1),3, row.y+row.h);
    var lx=pad.l;
    row.keys.forEach(function(kk){
      rctx.strokeStyle=C[kk.c]; rctx.lineWidth=1.7; rctx.beginPath();
      data.forEach(function(h,i){
        var X=xOf(h.t), Y=clamp(yOf(h[kk.k]),row.y,row.y+row.h);
        if(i) rctx.lineTo(X,Y); else rctx.moveTo(X,Y);
      });
      rctx.stroke();
      rctx.fillStyle=C[kk.c]; rctx.font='10px ui-monospace,monospace';
      rctx.fillText(kk.lab, lx+6, row.y-4); lx+=rctx.measureText(kk.lab).width+14;
    });
  });
  rctx.fillStyle=C.fg3; rctx.font='9.5px ui-monospace,monospace';
  rctx.fillText(t0.toFixed(0)+'s', pad.l, H-3);
  rctx.fillText(t1.toFixed(0)+'s', W-pad.r-22, H-3);
}
function buildChips(){
  var host=document.getElementById('los-chips');
  SERIES.forEach(function(s){
    var b=document.createElement('button');
    b.className='chip'; b.type='button';
    var sw=document.createElement('i'); sw.style.background='var(--'+s.c+')';
    var tx=document.createElement('span'); tx.textContent=s.lab;
    b.appendChild(sw); b.appendChild(tx);
    var upd=function(){ b.classList.toggle('on', !!s.on); b.setAttribute('aria-pressed', s.on?'true':'false'); };
    b.onclick=function(){ s.on=!s.on; upd(); };
    upd(); host.appendChild(b);
  });
}

/* ---------- 상태 수치 (3열 그리드) ---------- */
var LAWS={
  los :{n:'Lookahead-based LOS', eq:'χ_d = α_k + atan( −e ⁄ Δ )',
        s:'경로 위 수선발에서 Δ 만큼 앞선 점을 조준합니다. Δ 가 작을수록 공격적으로 복귀, 클수록 완만하게 수렴합니다.'},
  wpt :{n:'Waypoint 직접 조준',  eq:'χ_d = atan2( y_{k+1} − y, x_{k+1} − x )',
        s:'다음 웨이포인트를 곧장 바라봅니다. 가장 단순하지만 횡방향 오차 e 를 제어하지 않아, 초기 오차가 있으면 계획 직선으로 복귀하지 못하고 휘어진 경로로 웨이포인트에 도착합니다 — LOS 와 자취를 비교해 보세요.'},
  enc :{n:'Enclosure-based LOS', eq:'Δ_eff = √(R² − e²),  χ_d = α_k + atan( −e ⁄ Δ_eff )',
        s:'고정 반경 R 원과 현재 유한 선분의 교점을 조준합니다.'},
  pp  :{n:'Pure Pursuit',        eq:'L_d = k·v + L_fc,  χ_d = atan2( y_L − y, x_L − x )',
        s:'고정 L_d 원과 전방 경로 선분의 교점을 구간 경계 너머까지 찾습니다.'}
};

/* 핵심 4칸 — 고정 스테이지 안. 슬라이더를 만지며 봐야 하는 값만 남긴다.
   Δ 트레이드오프의 '대가' 쪽 지표(조타 반전)를 RMS 옆에 나란히 둔다. */
var RAIL_KEY=[
  {id:'t',    k:'시간 [s]'},
  {id:'e',    k:'e [m]'},
  {id:'rms',  k:'RMS |e| [m]'},
  {id:'rev',  k:'조타 반전 [회]'}
];
/* 부가 3칸 — 스크롤 영역. (정보량이 0이던 max |e| 는 조타 반전율로 교체) */
var RAIL_SUB=[
  {id:'seg',  k:'목표 구간'},
  {id:'ep',   k:'ψ 오차'},
  {id:'rrate',k:'조타 반전율'}
];
var RC={};
function buildRailInto(hostId, list){
  var host=document.getElementById(hostId);
  if(!host) return;
  list.forEach(function(c){
    var d=document.createElement('div'); d.className='cell';
    var k=document.createElement('span'); k.className='k';      k.textContent=c.k;
    var v=document.createElement('span'); v.className='v mono'; v.textContent='—';
    d.appendChild(k); d.appendChild(v); host.appendChild(d);
    RC[c.id]={cell:d, k:k, v:v};
  });
}
function buildRail(){
  buildRailInto('los-cells',  RAIL_KEY);
  buildRailInto('los-cells2', RAIL_SUB);
}
function updateRail(){
  var g=S.g, rms=S.nE?Math.sqrt(S.sumE2/S.nE):0;
  var e  = g ? ((g.eTrue===undefined)?g.e:g.eTrue) : 0;
  var ep = g ? ((g.epTrue===undefined)?wrap(g.chid-S.yaw):g.epTrue)*R2D : 0;
  var rrate = (S.t>1e-6) ? (S.nRev/S.t*60) : 0;

  RC.t.v.textContent    = S.t.toFixed(1);
  RC.t.v.className      = 'v mono'+(S.done?' ok':'');
  RC.e.v.textContent    = e.toFixed(2);
  RC.e.v.className      = 'v mono'+(Math.abs(e)>P.Racc?' warn':'');
  RC.rms.v.textContent  = rms.toFixed(3);
  RC.rev.v.textContent  = String(S.nRev);
  RC.rev.v.className    = 'v mono'+(S.nRev>=20?' warn':'');

  RC.seg.v.textContent  = N()>=2 ? ('W'+S.k+'→W'+((S.k+1)%N())) : '—';
  RC.ep.v.textContent   = ep.toFixed(0)+'°';
  RC.rrate.v.textContent= rrate.toFixed(0)+' 회/분';

  var L=LAWS[P.law];
  var ln=document.getElementById('los-lawName'); if(ln) ln.textContent=L.n;
  var le=document.getElementById('los-lawEq');   if(le) le.textContent=L.eq;
  var no=document.getElementById('los-lawNote'); if(no) no.textContent=L.s;
  updateLosHud();
}

function loadLosScores(){ try{ return JSON.parse(localStorage.getItem(LS_LOS)||'[]'); }catch(_){ return []; } }
function saveLosScores(list){ try{ localStorage.setItem(LS_LOS, JSON.stringify(list)); }catch(_){} }
function bestJText(){
  var list=loadLosScores();
  if(!list.length) return '–';
  return Math.min.apply(null, list.map(function(e){ return e.j; })).toFixed(2);
}
function commitLosScore(){
  if(S.scoreSaved || !S.done || S.t<2) return;
  S.scoreSaved=true;
  var rms=S.nE?Math.sqrt(S.sumE2/S.nE):0;
  var list=loadLosScores();
  list.unshift({
    iae:+S.iaeE.toFixed(3), ise:+S.iseE.toFixed(3), jw:+S.jw.toFixed(3),
    nRev:S.nRev, j:+comboJ(S.iaeE, S.nRev).toFixed(3),
    t:+S.t.toFixed(2), rms:+rms.toFixed(4), maxE:+S.maxE.toFixed(3),
    delta:P.delta, law:P.law, at:Date.now()
  });
  saveLosScores(list.slice(0,20));
  renderLosScores();
}
function renderLosScores(){
  var el=document.getElementById('los-scoreList'); if(!el) return;
  var list=loadLosScores();
  var emptyNote='점수 = ∫|e| dt + 0.5×조타 반전. 경로를 완주하면 CTE와 부드러움이 함께 저장됩니다.';
  var note=document.getElementById('los-scoreNote');
  if(!list.length){
    el.innerHTML='<div class="note" style="margin:0">아직 기록이 없습니다. 경로를 완주하면 누적 |e|와 조타 반전이 함께 저장됩니다.</div>';
    if(note) note.textContent=emptyNote;
    return;
  }
  var minJ=Math.min.apply(null, list.map(function(e){ return e.j; }));
  var minIae=Math.min.apply(null, list.map(function(e){ return e.iae; }));
  var minRev=Math.min.apply(null, list.map(function(e){ return e.nRev; }));
  el.innerHTML=list.slice(0,8).map(function(e){
    var d=new Date(e.at);
    var p=function(n){ return String(n).padStart(2,'0'); };
    var when=p(d.getMonth()+1)+'/'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
    var tags=[];
    if(e.iae===minIae) tags.push('최저|e|');
    if(e.nRev===minRev) tags.push('최저반전');
    var tag=tags.length?tags.join(' ')+' ':'완주 ';
    var cls=(e.j===minJ)?' ok':'';
    return '<div class="score-row'+cls+'"><span class="sc">J '+e.j.toFixed(2)+'</span>'
      +'<span class="meta">'+tag+'|e| '+e.iae.toFixed(2)+' · 반전 '+e.nRev+' · Δ '+Number(e.delta).toFixed(1)
      +' · '+e.t.toFixed(1)+'s · '+when+'</span></div>';
  }).join('');
  var note=document.getElementById('los-scoreNote');
  if(note){
    note.textContent='최저 |e| '+minIae.toFixed(2)+' · 최저 반전 '+minRev+'회 · 최저 J '+minJ.toFixed(2)
      +'  ·  J = ∫|e| dt + 0.5×반전';
  }
}
function updateLosHud(){
  var iae=document.getElementById('los-rIae');
  var rv=document.getElementById('los-rRev');
  var rj=document.getElementById('los-rJ');
  var rb=document.getElementById('los-rBest');
  var J=comboJ(S.iaeE, S.nRev);
  if(iae) iae.textContent=S.iaeE.toFixed(2);
  if(rv){
    rv.textContent=String(S.nRev);
    rv.className='v'+(S.nRev>=20?' bad':'');
  }
  if(rj){
    rj.textContent=J.toFixed(2);
    rj.className='v'+(S.done?' ok':'');
  }
  if(rb) rb.textContent=bestJText();
  var el=document.getElementById('los-finishCd');
  if(!el) return;
  if(S.done){
    el.hidden=false; el.classList.add('ok');
    var num=document.getElementById('los-finishCdNum');
    var msg=document.getElementById('los-finishCdMsg');
    if(num) num.textContent='완주';
    if(msg) msg.textContent='기록됨';
  }else{
    el.hidden=true; el.classList.remove('ok');
  }
}

/* =========================================================================
   7. 메인 루프 — 어떤 예외에도 렌더 루프가 죽지 않도록 finally 로 재등록
   ========================================================================= */
var acc=0, last=performance.now();
function loop(now){
  try{
    var real=Math.min((now-last)/1000, .1); last=now;
    if(S.running){
      acc+=real*P.speedMul;
      var n=0; while(acc>=P.dt && n<400){ step(P.dt); acc-=P.dt; n++; }
      ensureVisible();
    }else{
      acc=0;
      // 정지 중에도 유도 기하를 참값으로 재계산 → 끌면 오버레이가 따라온다
      S.g = (N()>=2) ? attachTrue(guidance(S.x,S.y)) : null;
    }
    draw(); drawRecorder(); updateRail();
  } finally {
    requestAnimationFrame(loop);
  }
}

/* =========================================================================
   8. 캔버스 터치 인터랙션 — Pointer Events 로 마우스·터치 통합
   -------------------------------------------------------------------------
     탭(빈 곳)  : 웨이포인트 추가 (일시정지 상태에서만)
     드래그     : 웨이포인트 · 로봇 · 자세 핸들 이동
     길게 누르기 : 웨이포인트 삭제
   손끝은 마우스보다 부정확하므로 히트 반경을 CSS 22px 이상으로 잡는다.
   ========================================================================= */
var HIT_WP=26, HIT_ROBOT=26, HIT_YAW=24, LONGPRESS=550;
var lpTimer=null, lpFrom=null;

function evPos(e){ var r=cv.getBoundingClientRect(); return {px:e.clientX-r.left, py:e.clientY-r.top}; }
function clearLP(){ if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } }

function deleteWp(idx){
  if(idx>=N()) return;
  S.wps.splice(idx,1);
  if(idx<=S.k && S.k>0){ S.k--; S.ei=0; }   // 앞쪽 삭제 → 활성 구간 보정
  normK();
  if(N()<2){ S.running=false; S.g=null; }
  drag=null;
  if(!S.running) reset(false);
  syncStatus(); autoFit();
}

cv.addEventListener('pointerdown', function(e){
  if(e.pointerType==='mouse' && e.button!==0) return;
  e.preventDefault();
  try{ cv.setPointerCapture(e.pointerId); }catch(_e){}
  var pos=evPos(e), px=pos.px, py=pos.py;
  lpFrom={px:px, py:py};

  /* 히트테스트는 '가장 가까운 후보' 로 — 고정 우선순위를 쓰면 웨이포인트가
     로봇을 완전히 가리거나 그 반대가 된다. 동률이면 로봇을 우선한다. */
  var best=null, bd=1e9, i, d;
  for(i=0;i<N();i++){
    d=hypot(px-w2sx(S.wps[i].x), py-w2sy(S.wps[i].y));
    if(d<HIT_WP && d<bd){ bd=d; best={type:'wp', i:i}; }
  }
  if(!S.running){                       // 로봇 조작은 정지 상태에서만
    var dim=robotDims();                // 그리기와 같은 핸들 간격·halo 반경
    var hx=S.x+dim.hand*Math.cos(S.yaw), hy=S.y+dim.hand*Math.sin(S.yaw);
    d=hypot(px-w2sx(hx), py-w2sy(hy));
    if(d<HIT_YAW && d<=bd){ bd=d; best={type:'yaw'}; }
    d=hypot(px-w2sx(S.x), py-w2sy(S.y));
    // 고배율에서는 로봇이 26px 보다 커진다 — 보이는 만큼(halo)은 탭에 걸려야
    // 로봇을 탭했는데 웨이포인트가 추가되는 오동작이 없다
    if(d<Math.max(HIT_ROBOT, dim.halo) && d<=bd){ bd=d; best={type:'robot'}; }
  }
  if(best){
    drag=best;
    if(best.type==='wp'){
      var idx=best.i;
      clearLP();
      lpTimer=setTimeout(function(){ lpTimer=null; deleteWp(idx); }, LONGPRESS);
    }
    return;
  }
  if(S.running) return;                 // 주행 중 실수 탭으로 점이 늘지 않도록
  var w={x:s2wx(px), y:s2wy(py)};
  S.wps.push(w); drag={type:'wp', i:N()-1};
  if(N()===2) reset(false);
});

cv.addEventListener('pointermove', function(e){
  if(!drag) return;
  e.preventDefault();
  var pos=evPos(e);
  if(lpFrom && hypot(pos.px-lpFrom.px, pos.py-lpFrom.py)>10) clearLP();
  var w={x:s2wx(pos.px), y:s2wy(pos.py)};
  if(drag.type==='wp'){
    if(drag.i>=N()){ drag=null; return; }         // 드래그 중 경로가 지워진 경우
    S.wps[drag.i]=w;
    if(!S.running && S.t<1e-9) reset(false);
  }
  else if(drag.type==='robot' && !S.running){ S.x=w.x; S.y=w.y; }
  else if(drag.type==='yaw'   && !S.running){ S.yaw=Math.atan2(w.y-S.y, w.x-S.x); }
});

function endPointer(e){
  clearLP(); lpFrom=null;
  if(drag){ drag=null; autoFit(); }
  try{ cv.releasePointerCapture(e.pointerId); }catch(_e){}
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('lostpointercapture', function(){ clearLP(); });
cv.addEventListener('contextmenu', function(e){ e.preventDefault(); });   // 길게 누르기 메뉴 차단

/* =========================================================================
   9. 컨트롤 패널 — 실습에 꼭 필요한 것만
   ========================================================================= */
/* 캔버스 바로 아래 1순위 컨트롤 (스크롤 없이 만질 수 있어야 한다)
   Δ 는 Lookahead LOS 에만 있는 파라미터 — 웨이포인트 직접 조준에서는 숨긴다 */
var PRIMARY={type:'range', k:'delta', label:'전방주시거리 Δ', min:0.3, max:10, step:0.1, unit:'m', dec:1,
             show:function(){ return P.law==='los'; }};

var CONTROLS=[
{ title:'유도 법칙', open:true, items:[
  {type:'seg', k:'law', opts:[['los','Lookahead LOS'],['wpt','웨이포인트 직접 조준']]},
  {type:'lawinfo'}
]},

{ title:'경로 · 웨이포인트', open:true, items:[
  {type:'seg', kind:'preset', opts:[['지그재그'],['직선'],['사각 순환'],['S 커브']]},
  {type:'range', k:'Racc', label:'웨이포인트 도달 반경 R_acc', min:0.2, max:5, step:0.1, unit:'m', dec:1,
   after:function(){ autoFit(); }}
]},

{ title:'조타', open:true, items:[
  {type:'range', k:'wmax',     label:'조타 제한 ω_max',        min:10,  max:300, step:5,    unit:'°/s', dec:0}
]}
];

var visRules=[], syncFns=[];
function buildPrimary(){
  document.getElementById('los-primary').appendChild(buildItem(PRIMARY));
}
function buildPanel(){
  var panel=document.getElementById('los-panel');
  CONTROLS.forEach(function(sec){
    var el=document.createElement('section'); el.className='sec'+(sec.open?'':' closed');
    var h=document.createElement('button'); h.className='sec-h'; h.type='button';
    h.innerHTML='<span class="t">'+sec.title+'</span><span class="ln"></span><span class="car">▼</span>';
    h.onclick=function(){ el.classList.toggle('closed'); };
    var b=document.createElement('div'); b.className='sec-b';
    el.appendChild(h); el.appendChild(b); panel.appendChild(el);
    sec.items.forEach(function(it){ b.appendChild(buildItem(it)); });
  });
  refreshVis(); syncUI();
}
function buildItem(it){
  var w=document.createElement('div'); w.className='ctl';
  if(it.show) visRules.push({el:w, fn:it.show});

  if(it.type==='range'){
    w.innerHTML='<div class="lab"><span class="n">'+it.label+'</span><span class="v"></span></div>';
    var inp=document.createElement('input');
    inp.type='range'; inp.min=it.min; inp.max=it.max; inp.step=it.step; inp.value=P[it.k];
    inp.setAttribute('aria-label', it.label);
    var num=w.querySelector('.v');
    var dec=(it.dec===undefined)?2:it.dec;
    var upd=function(){ num.textContent=Number(P[it.k]).toFixed(dec)+(it.unit?' '+it.unit:''); };
    if(it.afterOn==='change'){          // 손을 뗄 때 1회만 (리셋이 수십 번 걸리지 않게)
      inp.oninput =function(){ P[it.k]=parseFloat(inp.value); upd(); refreshVis(); };
      inp.onchange=function(){ if(it.after) it.after(); };
    }else{
      inp.oninput =function(){ P[it.k]=parseFloat(inp.value); upd(); refreshVis(); if(it.after) it.after(); };
    }
    syncFns.push(function(){ inp.value=P[it.k]; upd(); });
    w.appendChild(inp); upd();

  }else if(it.type==='seg'){
    var d=document.createElement('div'); d.className='seg';
    it.opts.forEach(function(o){
      var val=o[0], lab=o[1];
      var b=document.createElement('button'); b.type='button'; b.textContent=lab||val;
      if(it.kind==='preset'){ b.onclick=function(){ loadPreset(val); autoFit(); }; }
      else{
        b.onclick=function(){ P[it.k]=val; if(it.k==='law'){ S.ei=0; } refreshVis(); syncUI(); };
        syncFns.push(function(){ b.classList.toggle('on', P[it.k]===val); });
      }
      d.appendChild(b);
    });
    w.appendChild(d);

  }else if(it.type==='row'){
    var dr=document.createElement('div'); dr.className='row';
    it.items.forEach(function(bi){
      var b=document.createElement('button'); b.type='button';
      b.textContent=bi.label; b.id='btn_'+bi.id;
      b.onclick=bi.on; dr.appendChild(b);
    });
    w.appendChild(dr);

  }else if(it.type==='note'){
    w.innerHTML='<div class="note">'+it.html+'</div>';

  }else if(it.type==='lawinfo'){          // 선택된 유도 법칙 수식·설명 (updateRail 이 갱신)
    w.innerHTML='<div class="eqbox"><span class="lbl" id="lawName">—</span>'+
                '<span class="eq mono" id="lawEq">—</span></div>'+
                '<div class="note" id="lawNote"></div>';
  }
  return w;
}
function refreshVis(){ visRules.forEach(function(r){ r.el.classList.toggle('off', !r.fn()); }); }
function syncUI(){ syncFns.forEach(function(f){ f(); }); }
function syncStatus(){
  var pill=document.getElementById('los-statusPill'), b=document.getElementById('los-btn_play');
  var s=S.done?'done':(S.running?'run':'hold');
  if(pill){
    pill.dataset.s=s;
    pill.textContent = (s==='done') ? '완주' : (s==='run' ? '주행 중' : '대기');
  }
  if(b){
    b.textContent = S.running ? '정지' : '시작';
    b.classList.toggle('danger', S.running);
  }
}
function togglePlay(){
  if(N()<2) return;
  if(S.done) reset(false);
  S.running=!S.running; syncStatus();
}

/* ---------- 하단 고정 바 · 헤더 ---------- */
document.getElementById('los-btn_play').onclick=function(){ togglePlay(); };
document.getElementById('los-btn_rst').onclick =function(){ reset(false); autoFit(); };
var clrLos=document.getElementById('los-btnClearScores');
if(clrLos) clrLos.onclick=function(){
  if(!confirm('이 기기의 LOS 점수를 모두 지울까요?')) return;
  saveLosScores([]); renderLosScores(); updateLosHud();
};
(function(){          // 하단 고정 배속 슬라이더
  var spd=document.getElementById('los-spd'), spdv=document.getElementById('los-spdv');
  var upd=function(){ spdv.textContent=Number(P.speedMul).toFixed(2)+' ×'; };
  spd.value=P.speedMul;
  spd.oninput=function(){ P.speedMul=parseFloat(spd.value); upd(); };
  upd();
})();
var themeBtn=document.getElementById('los-themeBtn');
if(themeBtn) themeBtn.onclick=function(){};

/* ---------- 부트 ---------- */
function onResize(){ readTheme(); resize(); }
try{
  var mq=matchMedia('(prefers-color-scheme: dark)');
  if(mq.addEventListener) mq.addEventListener('change', readTheme);
  else if(mq.addListener) mq.addListener(readTheme);

  readTheme(); buildRail(); buildChips(); buildPrimary(); buildPanel();
  resize();
  loadPreset('지그재그'); autoFit();
  renderLosScores(); updateLosHud();

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', function(){ setTimeout(onResize, 250); });
  if(window.ResizeObserver){
    var ro=new ResizeObserver(function(){ resize(); });
    ro.observe(cv.parentElement);
    ro.observe(document.getElementById('los-recwrap'));   // 레코더 CSS 크기도 항상 최신으로
  }
  requestAnimationFrame(function(t){ last=t; loop(t); });
  window.refresh_los_demo = function () {
    if (!demoVisible()) return;
    readTheme();
    resize();
  };
}catch(err){
  document.body.insertAdjacentHTML('beforeend',
    '<p style="padding:16px;font-size:14px">브라우저가 이 시뮬레이터를 실행할 수 없습니다: '+
    (err && err.message ? err.message : err)+'</p>');
}

})();