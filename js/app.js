(function(){
"use strict";
var C=window.EVEBI||{};
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var body=document.body;
var LANGS=C.languages||["ka","en"];
var lang=LANGS[0];
try{var sv=localStorage.getItem("evebi_lang");if(sv&&LANGS.indexOf(sv)>-1)lang=sv}catch(e){}
var q=new URLSearchParams(location.search).get("lang");
if(q&&LANGS.indexOf(q)>-1)lang=q;


/* ---------- language ---------- */
function applyLang(l,save){
  lang=l;
  document.documentElement.lang=l;
  $$("[data-en]").forEach(function(el){
    if(el.dataset.ka===undefined)el.dataset.ka=el.innerHTML;
    el.innerHTML=l==="en"?el.dataset.en:el.dataset.ka;
  });
  $$("[data-en-ph]").forEach(function(el){
    if(el.dataset.kaPh===undefined)el.dataset.kaPh=el.getAttribute("placeholder")||"";
    el.setAttribute("placeholder",l==="en"?el.dataset.enPh:el.dataset.kaPh);
  });
  if(body.dataset.titleKa===undefined){body.dataset.titleKa=document.title;var m=$('meta[name=description]');body.dataset.descKa=m?m.content:""}
  document.title=l==="en"?body.dataset.titleEn:body.dataset.titleKa;
  var md=$('meta[name=description]');if(md)md.content=l==="en"?body.dataset.descEn:body.dataset.descKa;
  $$(".lang button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.lang===l)});
  dynamic();
  if(save){try{localStorage.setItem("evebi_lang",l)}catch(e){}}
}
$$(".lang button").forEach(function(b){b.addEventListener("click",function(){applyLang(b.dataset.lang,true)})});

/* ---------- dynamic links ---------- */
function waMsg(el){
  var own=lang==="en"?el&&el.dataset.msgEn:el&&el.dataset.msgKa;
  return own||(lang==="en"?body.dataset.waEn:body.dataset.wa)||"";
}
function waHref(msg){return "https://wa.me/"+(C.whatsapp||"")+(msg?"?text="+encodeURIComponent(msg):"")}
function dynamic(){
  $$("[data-wa-link],[data-wa-float]").forEach(function(a){a.href=waHref(waMsg(a));a.target="_blank"});
  $$("[data-mail-link]").forEach(function(a){a.href="mailto:"+C.email;if(a.dataset.keep===undefined)a.textContent=C.email});
  $$("[data-tt-link]").forEach(function(a){if(C.tiktok)a.href=C.tiktok});
  $$("[data-ig-link]").forEach(function(a){if(C.instagram){a.href=C.instagram;a.hidden=false}else a.hidden=true});
  $$("[data-mediakit]").forEach(function(a){if(C.mediaKit){a.href=C.mediaKit;a.hidden=false}else a.hidden=true});
  $$("[data-mediakit-none]").forEach(function(el){el.hidden=!!C.mediaKit});
}

/* ---------- photo placeholders: real image replaces the placeholder if the file exists ---------- */
$$(".ph[data-src]").forEach(function(ph){
  var im=new Image();im.alt=ph.dataset.alt||"";
  im.onload=function(){ph.classList.add("has");ph.appendChild(im)};
  im.src=ph.dataset.src;
});

/* ---------- header, menu ---------- */
var hdr=$("#hdr");
function onScroll(){hdr.classList.toggle("stuck",window.scrollY>8)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
var burger=$("#burger"),nav=$("#nav");
function closeMenu(){burger.setAttribute("aria-expanded","false");nav.classList.remove("open");body.style.overflow=""}
burger.addEventListener("click",function(){
  var o=burger.getAttribute("aria-expanded")!=="true";
  burger.setAttribute("aria-expanded",o);nav.classList.toggle("open",o);body.style.overflow=o?"hidden":"";
});
$$(".dd-btn").forEach(function(b){
  if($(".dd-menu a[aria-current]",b.parentNode))b.classList.add("cur");
  b.addEventListener("click",function(e){e.stopPropagation();b.setAttribute("aria-expanded",b.getAttribute("aria-expanded")!=="true")});
});
document.addEventListener("click",function(e){
  $$(".dd-btn").forEach(function(b){if(!b.parentNode.contains(e.target)&&window.innerWidth>980)b.setAttribute("aria-expanded","false")});
});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){closeMenu();$$(".dd-btn").forEach(function(b){b.setAttribute("aria-expanded","false")})}});
$$("#nav a").forEach(function(a){a.addEventListener("click",closeMenu)});

/* ---------- reveal on scroll ---------- */
var rv=$$(".rv");
if("IntersectionObserver" in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:.12,rootMargin:"0px 0px -6% 0px"});
  rv.forEach(function(el){io.observe(el)});
}else rv.forEach(function(el){el.classList.add("in")});


/* the WhatsApp button waits until the hero is out of the way */
(function(){
  if(!$(".hero-cover"))return;
  body.classList.add("fab-late");
  var f=function(){body.classList.toggle("fab-on",window.scrollY>window.innerHeight*.6)};
  window.addEventListener("scroll",f,{passive:true});f();
})();

/* ---------- EV Explained ---------- */
(function(){
  var KEY="evebi-read";
  function getRead(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch(e){return []}}
  function setRead(list){try{localStorage.setItem(KEY,JSON.stringify(list))}catch(e){}}
  var page=body.getAttribute("data-page")||"";
  var bar=$(".progress i"),art=$(".prose");
  if(bar&&art){
    var marked=false;
    var onScroll=function(){
      var r=art.getBoundingClientRect(),h=r.height-window.innerHeight*.6;
      var p=Math.max(0,Math.min(1,(-r.top+window.innerHeight*.2)/Math.max(h,1)));
      bar.style.width=(p*100)+"%";
      if(!marked&&p>.7){marked=true;var l=getRead();if(l.indexOf(page)<0){l.push(page);setRead(l)}}
    };
    window.addEventListener("scroll",onScroll,{passive:true});onScroll();
    var links=$$(".toc a[href^='#']"),heads=$$(".prose h2[id]");
    if(heads.length&&"IntersectionObserver" in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){
        if(e.isIntersecting){links.forEach(function(a){a.classList.toggle("on",a.getAttribute("href")==="#"+e.target.id)})}
      })},{rootMargin:"-15% 0px -70% 0px"});
      heads.forEach(function(h){io.observe(h)});
    }
    $$(".toc-m a").forEach(function(a){a.addEventListener("click",function(){var d=$(".toc-m");if(d)d.open=false})});
  }
  var steps=$$(".gstep");
  if(steps.length){
    var read=getRead();
    steps.forEach(function(st){if(read.indexOf(st.getAttribute("data-slug"))>-1)st.classList.add("done")});
    $$(".chip-f").forEach(function(b){b.addEventListener("click",function(){
      $$(".chip-f").forEach(function(x){x.classList.toggle("on",x===b)});
      var f=b.getAttribute("data-filter");
      steps.forEach(function(st){st.hidden=!(f==="all"||st.getAttribute("data-topic")===f)});
    })});
  }
  var q=$("#gl-q");
  if(q){q.addEventListener("input",function(){
    var v=q.value.trim().toLowerCase(),n=0;
    $$(".gl-i").forEach(function(i){var m=!v||i.textContent.toLowerCase().indexOf(v)>-1;i.hidden=!m;if(m)n++});
    var none=$("#gl-none");if(none)none.hidden=n>0;
  })}
})();

applyLang(lang,false);
})();
