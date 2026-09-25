// Mobile support for the slide decks in html_presentation/.
// Portrait phones get a scroll view: every slide stacked at full screen width, each
// one starting its animations and videos as it scrolls into view. Rotating to
// landscape (or any wider screen) returns to the one-slide-at-a-time stage on the
// slide that was in view. Loaded in <head> so the scroll-view layout applies before
// first paint; the rest waits for the deck engine (window.deck) in the page.
(function(){
  const root=document.documentElement;
  const mq=matchMedia('(orientation:portrait) and (max-width:600px)');
  const GUTTER=12;
  function sizeFeed(){root.style.setProperty('--fz',((root.clientWidth-2*GUTTER)/1280).toFixed(5));}
  if(mq.matches){root.classList.add('feed');sizeFeed();}

  document.addEventListener('DOMContentLoaded',()=>{
    const deck=window.deck;
    if(!deck)return;
    const slides=deck.slides,total=slides.length;
    const counter=document.getElementById('counter'),progress=document.getElementById('progress');
    let io=null,cur=deck.cur,raf=0,lastW=0;

    // title block above the first slide and a back-to-top button after the last
    const [title,sub]=document.title.split(' — ');
    const head=document.createElement('header');
    head.id='feedHead';
    head.innerHTML='<p class="fh-eyebrow"></p><h1 class="fh-title"></h1>'+
      '<p class="fh-meta"><span class="fh-count"></span><span class="fh-rotate">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
      '<rect x="2.5" y="9" width="14" height="9" rx="2"/><path d="M9 5.2A8 8 0 0 1 21 11"/><path d="M21.6 7.6 21 11l-3.3-1"/></svg>'+
      '가로로 돌리면 한 장씩 크게 볼 수 있어요</span></p>';
    head.querySelector('.fh-eyebrow').textContent=sub||'';
    head.querySelector('.fh-title').textContent=title;
    head.querySelector('.fh-count').textContent=total+'장';
    document.body.prepend(head);
    const foot=document.createElement('footer');
    foot.id='feedFoot';
    foot.innerHTML='<button type="button">↑ 처음으로</button>';
    foot.firstChild.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
    document.getElementById('viewport').after(foot);

    // the slide under a line 40% down the screen (first/last at the ends of the page)
    function inView(){
      if(scrollY<=2)return 0;
      if(scrollY>=root.scrollHeight-innerHeight-2)return total-1;
      const y=innerHeight*.4;let best=0,bd=Infinity;
      slides.forEach((s,k)=>{
        const r=s.getBoundingClientRect(),d=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;
        if(d<bd){bd=d;best=k;}
      });
      return best;
    }
    function onScroll(){
      if(raf)return;
      raf=requestAnimationFrame(()=>{
        raf=0;
        if(!io)return;
        const i=inView();
        if(i!==cur){cur=i;history.replaceState(null,'','#'+(i+1));}
        counter.textContent=(cur+1)+' / '+total;
        const max=root.scrollHeight-innerHeight;
        progress.style.width=(max>0?Math.min(1,scrollY/max)*100:100)+'%';
      });
    }

    function enterFeed(){
      root.classList.add('feed');sizeFeed();
      cur=deck.cur;lastW=root.clientWidth;
      slides.forEach(s=>{
        // play only what is on screen: IntersectionObserver below starts each slide
        s.querySelectorAll('video').forEach(v=>{v.autoplay=false;});
        deck.setActive(s,false);
      });
      io=new IntersectionObserver(es=>es.forEach(e=>{
        const s=e.target,on=s.classList.contains('active');
        if(e.intersectionRatio>=.35&&!on)deck.setActive(s,true);
        else if(!e.isIntersecting&&on)deck.setActive(s,false);
      }),{threshold:[0,.35]});
      slides.forEach(s=>io.observe(s));
      if(cur>0)slides[cur].scrollIntoView({block:'center'});else scrollTo(0,0);
      onScroll();
    }
    // cur was tracked while scrolling: after a rotation the old layout is already gone
    function leaveFeed(){
      io.disconnect();io=null;
      root.classList.remove('feed');root.style.removeProperty('--fz');
      slides.forEach(s=>deck.setActive(s,false));
      scrollTo(0,0);
      deck.fit();deck.goTo(cur,false);
      history.replaceState(null,'','#'+(cur+1));
    }
    function sync(){
      if(mq.matches!==!!io)return mq.matches?enterFeed():leaveFeed();
      // same mode, new width (split screen, font zoom): resize and keep the slide in view
      if(io&&root.clientWidth!==lastW){
        lastW=root.clientWidth;sizeFeed();
        slides[cur].scrollIntoView({block:'center'});
      }
    }

    if(mq.matches)enterFeed();
    mq.addEventListener('change',sync);
    addEventListener('resize',sync);
    addEventListener('scroll',()=>{if(io)onScroll();},{passive:true});
    // in-deck links (#N) scroll to that slide
    addEventListener('hashchange',()=>{
      if(!io)return;
      const n=parseInt(location.hash.slice(1),10);
      if(n>=1&&n<=total)slides[n-1].scrollIntoView({behavior:'smooth',block:'center'});
    });
  });
})();
