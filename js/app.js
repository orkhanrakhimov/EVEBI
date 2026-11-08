(function(){
"use strict";
var C=window.EVEBI||{};
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var body=document.body;
var T={
 ka:{req:"გთხოვ, შეავსე ეს ველი",email:"შეიყვანე სწორი ელფოსტა",contact:"შეიყვანე WhatsApp ნომერი ან ელფოსტა",
  okT:"მადლობა, შეტყობინება გაიგზავნა!",okP:"მალე გიპასუხებ.",
  noEpT:"ფორმა ჯერ არ არის დაკავშირებული",noEpP:"შეტყობინება არ გაიგზავნა. მომწერე პირდაპირ WhatsApp-ით ან ელფოსტით — შენი ტექსტი უკვე მზადაა.",
  netT:"გაგზავნა ვერ მოხერხდა",netP:"შეამოწმე ინტერნეტი და სცადე თავიდან, ან მომწერე პირდაპირ:",
  send:"იგზავნება…",wa:"მოწერა WhatsApp-ზე",mail:"მოწერა ელფოსტით",
  none:"ჯერ არ არის გამოქვეყნებული"},
 en:{req:"Please fill in this field",email:"Enter a valid email",contact:"Enter a WhatsApp number or an email",
  okT:"Thank you, your message was sent!",okP:"I'll get back to you soon.",
  noEpT:"The form isn't connected yet",noEpP:"Your message was not sent. Write to me directly on WhatsApp or by email — your text is already prepared.",
  netT:"Couldn't send",netP:"Check your connection and try again, or write to me directly:",
  send:"Sending…",wa:"Message on WhatsApp",mail:"Send by email",
  none:"Not published yet"}
};
var lang="ka";
try{lang=localStorage.getItem("evebi_lang")||"ka"}catch(e){}
var q=new URLSearchParams(location.search).get("lang");
if(q==="en"||q==="ka")lang=q;

function pick(o){return o&&typeof o==="object"?(o[lang]||o.ka||""):(o||"")}

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

/* ---------- dynamic bits: links, stats, projects, media kit ---------- */
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
  var s=C.stats||{};
  $$("[data-stat]").forEach(function(el){var v=s[el.dataset.stat];el.textContent=pick(v)});
  var mk=$$("[data-mediakit]");mk.forEach(function(a){if(C.mediaKit){a.href=C.mediaKit;a.hidden=false}else a.hidden=true});
  $$("[data-mediakit-none]").forEach(function(el){el.hidden=!!C.mediaKit});
  var pr=$("#projects");
  if(pr){
    var list=C.projects||[];
    pr.innerHTML="";
    $$("[data-projects-empty]").forEach(function(e){e.hidden=list.length>0});
    list.forEach(function(p){
      var a=document.createElement(p.link?"a":"div");a.className="proj rv in";
      if(p.link){a.href=p.link;a.target="_blank";a.rel="noopener"}
      var ph=document.createElement("div");ph.className="ph ratio-169";ph.dataset.label=pick(p.type);
      if(p.image){var im=new Image();im.alt=pick(p.title);im.loading="lazy";im.onload=function(){ph.classList.add("has")};im.onerror=function(){im.remove()};im.src=p.image;ph.appendChild(im)}
      var h=document.createElement("h3");h.textContent=pick(p.title);
      var t=document.createElement("p");t.textContent=pick(p.text);
      a.appendChild(ph);a.appendChild(h);a.appendChild(t);pr.appendChild(a);
    });
  }
}

/* ---------- photo placeholders: real image replaces the placeholder if the file exists ---------- */
$$(".ph[data-src]").forEach(function(ph){
  var im=new Image();im.alt=ph.dataset.alt||"";im.loading="lazy";
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

/* ---------- forms ---------- */
function isEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)}
function isPhone(v){return v.replace(/[^\d]/g,"").length>=7&&/^[\d\s+()\-.]+$/.test(v)}
function setErr(field,msg){
  field.classList.toggle("bad",!!msg);
  var e=$(".err",field);if(!e){e=document.createElement("span");e.className="err";field.appendChild(e)}
  e.textContent=msg||"";
}
function checkField(field){
  var inp=$("input,select,textarea",field);if(!inp||inp.type==="radio"||inp.type==="checkbox")return true;
  var v=(inp.value||"").trim(),t=T[lang];
  if(inp.required&&!v){setErr(field,t.req);return false}
  if(v&&inp.type==="email"&&!isEmail(v)){setErr(field,t.email);return false}
  if(v&&inp.dataset.valid==="contact"&&!isEmail(v)&&!isPhone(v)){setErr(field,t.contact);return false}
  setErr(field,"");return true;
}
function checkScope(scope){
  var ok=true,first=null;
  $$(".field",scope).forEach(function(f){if(!checkField(f)){ok=false;if(!first)first=f}});
  if(first){var i=$("input,select,textarea",first);if(i)i.focus()}
  return ok;
}
function labelOf(el){
  var f=el.closest(".field");var l=f&&($("label",f)||$(".lbl",f));
  return l?l.textContent.replace("*","").trim():el.name;
}
function collect(form){
  var out=[],seen={};
  $$("input,select,textarea",form).forEach(function(el){
    if(!el.name||el.name==="_gotcha"||seen[el.name])return;
    if(el.type==="radio"){seen[el.name]=1;var c=form.querySelector('input[name="'+el.name+'"]:checked');if(c)out.push([labelOf(el),c.value]);return}
    var v=(el.value||"").trim();if(v)out.push([labelOf(el),v]);
  });
  return out;
}
function setupForm(form){
  var steps=$$("[data-step]",form),cur=0,prog=$$(".prog i",form);
  var state=$(".fstate",form.parentNode)||$(".fstate",form);
  function go(n){
    cur=n;steps.forEach(function(s,i){s.hidden=i!==n});
    prog.forEach(function(p,i){p.classList.toggle("on",i<=n)});
    var f=steps[n]&&$("input,select,textarea",steps[n]);
    if(n>0&&f)f.focus();
  }
  if(steps.length)go(0);
  $$("[data-next]",form).forEach(function(b){b.addEventListener("click",function(){if(checkScope(steps[cur]))go(cur+1)})});
  $$("[data-prev]",form).forEach(function(b){b.addEventListener("click",function(){go(cur-1)})});
  $$(".field input,.field select,.field textarea",form).forEach(function(i){
    var f=i.closest(".field");
    i.addEventListener("input",function(){if(f.classList.contains("bad"))checkField(f)});
    i.addEventListener("change",function(){if(f.classList.contains("bad"))checkField(f)});
    i.addEventListener("blur",function(){if(i.value&&!f.classList.contains("bad"))checkField(f)});
  });
  // prefill from ?model=
  var m=new URLSearchParams(location.search).get("model");
  var mi=m&&form.elements.models;if(mi&&!mi.value)mi.value=m;

  form.addEventListener("submit",function(ev){
    ev.preventDefault();
    var t=T[lang];
    if(steps.length&&cur<steps.length-1){if(checkScope(steps[cur]))go(cur+1);return}
    if(!checkScope(steps.length?steps[cur]:form))return;
    var rows=collect(form),subject=form.dataset.subject||"EVები inquiry";
    var text=subject+"\n\n"+rows.map(function(r){return r[0]+": "+r[1]}).join("\n");
    var hp=form.elements._gotcha;
    if(hp&&hp.value){showOk();return}
    function fallback(title,p){
      state.className="fstate fail show";
      state.innerHTML="<h4></h4><p></p><div class='btns'></div>";
      $("h4",state).textContent=title;$("p",state).textContent=p;
      var b=$(".btns",state);
      var a1=document.createElement("a");a1.className="btn btn-red";a1.target="_blank";a1.rel="noopener";a1.textContent=t.wa;a1.href=waHref(text);
      var a2=document.createElement("a");a2.className="btn btn-line";a2.textContent=t.mail;a2.href="mailto:"+C.email+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(text);
      b.appendChild(a1);b.appendChild(a2);state.scrollIntoView({block:"nearest",behavior:"smooth"});
    }
    function showOk(){
      state.className="fstate ok show";
      state.innerHTML="<h4></h4><p></p>";$("h4",state).textContent=t.okT;$("p",state).textContent=t.okP;
      form.reset();if(steps.length)go(0);state.scrollIntoView({block:"nearest",behavior:"smooth"});
    }
    if(!C.formEndpoint){fallback(t.noEpT,t.noEpP);return}
    var btn=$('[type=submit]',form),old=btn.textContent;btn.disabled=true;btn.textContent=t.send;
    var payload={_subject:subject,language:lang,page:location.pathname};
    rows.forEach(function(r){payload[r[0]]=r[1]});
    fetch(C.formEndpoint,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(function(r){if(!r.ok)throw new Error(r.status);showOk()})
      .catch(function(){fallback(t.netT,t.netP)})
      .then(function(){btn.disabled=false;btn.textContent=old;if(lang==="en"&&btn.dataset.en)btn.textContent=btn.dataset.en});
  });
}
$$("form[data-form]").forEach(setupForm);

applyLang(lang,false);
})();
