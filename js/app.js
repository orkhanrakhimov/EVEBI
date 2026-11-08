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
var LANGS=C.languages||["ka","en"];
var lang=LANGS[0];
try{var sv=localStorage.getItem("evebi_lang");if(sv&&LANGS.indexOf(sv)>-1)lang=sv}catch(e){}
var q=new URLSearchParams(location.search).get("lang");
if(q&&LANGS.indexOf(q)>-1)lang=q;

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
  // stats: hide anything empty (no dashes)
  $$("[data-stat-wrap]").forEach(function(w){var v=pick(s[w.dataset.statWrap]);w.hidden=!v});
  var any=["followers","videos","views"].some(function(k){return pick(s[k])});
  $$("[data-stats-block]").forEach(function(el){el.hidden=!any});
  renderProjects();renderCars();renderCarProfile();renderDealers();renderDealerProfile();
}

function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function thumb(ph,src,alt){
  if(!src)return;var im=new Image();im.alt=alt||"";im.loading="lazy";
  im.onload=function(){ph.classList.add("has");ph.appendChild(im)};im.src=src;
}
function filterBar(host,values,onPick,label){
  host.innerHTML="";var all=["All"].concat(values);
  all.forEach(function(v,i){
    var b=el("button","chip"+(i?"":" on"),v);b.type="button";b.setAttribute("aria-pressed",i===0);
    b.addEventListener("click",function(){$$(".chip",host).forEach(function(c){c.classList.remove("on");c.setAttribute("aria-pressed","false")});b.classList.add("on");b.setAttribute("aria-pressed","true");onPick(i?v:null)});
    host.appendChild(b);
  });
  host.setAttribute("aria-label",label||"Filter");
}
function renderProjects(){
  var pr=$("#projects");if(!pr)return;
  var list=C.projects||[],lim=parseInt(pr.dataset.limit||"0",10),cat=null;
  function draw(){
    pr.innerHTML="";
    var items=list.filter(function(p){return !cat||p.category===cat});if(lim)items=items.slice(0,lim);
    $$("[data-projects-empty]").forEach(function(e){e.hidden=list.length>0});
    items.forEach(function(p){
      var a=el("a","proj");a.href=p.link||C.tiktok||"#";a.target="_blank";a.rel="noopener";
      var ph=el("div","ph ratio-169");ph.dataset.label="Thumbnail · "+(p.image||"");thumb(ph,p.image,p.title);
      var tag=el("span","proj-tag",p.category);ph.appendChild(tag);
      a.appendChild(ph);a.appendChild(el("h3","",p.title));
      if(p.text)a.appendChild(el("p","",p.text));
      a.appendChild(el("span","proj-go",p.link?"Watch on TikTok ↗":"See on TikTok ↗"));
      pr.appendChild(a);
    });
  }
  var fb=$("[data-project-filters]");
  if(fb&&!fb.dataset.done){fb.dataset.done=1;var cats=[];list.forEach(function(p){if(cats.indexOf(p.category)<0)cats.push(p.category)});filterBar(fb,cats,function(c){cat=c;draw()},"Filter projects")}
  draw();
}
function carHref(c){return "car.html?id="+encodeURIComponent(c.id)}
function renderCars(){
  var g=$("#cars-grid");if(!g)return;var list=C.cars||[],br=null;
  function draw(){
    g.innerHTML="";
    list.filter(function(c){return !br||c.brand===br}).forEach(function(c){
      var a=el("a","card car-card");a.href=carHref(c);
      a.appendChild(el("span","badge",c.type||"EV"));
      a.appendChild(el("h3","h3",c.brand+" "+c.model));
      a.appendChild(el("p","",c.intro||""));
      a.appendChild(el("span","link","View profile →"));
      g.appendChild(a);
    });
  }
  var fb=$("[data-car-filters]");
  if(fb&&!fb.dataset.done){fb.dataset.done=1;var bs=[];list.forEach(function(c){if(bs.indexOf(c.brand)<0)bs.push(c.brand)});filterBar(fb,bs,function(b){br=b;draw()},"Filter by brand")}
  draw();
}
function renderCarProfile(){
  var host=$("#car-profile");if(!host)return;
  var id=new URLSearchParams(location.search).get("id");
  var c=(C.cars||[]).filter(function(x){return x.id===id})[0];
  if(!c){host.innerHTML="";host.appendChild(el("p","lead","Car not found. "));var a=el("a","link","See all cars");a.href="cars.html";host.appendChild(a);return}
  var name=c.brand+" "+c.model;document.title=name+" — EVebi";
  $$("[data-car-name]").forEach(function(e){e.textContent=name});
  $$("[data-car-type]").forEach(function(e){e.textContent=c.type||"EV"});
  $$("[data-car-intro]").forEach(function(e){e.textContent=c.intro||""});
  $$("[data-car-ask]").forEach(function(a){a.href="find-my-ev.html?model="+encodeURIComponent(name)});
  $$("[data-car-wa]").forEach(function(a){a.dataset.msgEn="Hello! I have a question about the "+name+": ";a.href=waHref(a.dataset.msgEn);a.target="_blank"});
  var proj=(C.projects||[]).filter(function(p){return p.id===c.project})[0];
  var cov=$("[data-car-coverage]");if(cov){cov.href=proj&&proj.link?proj.link:C.tiktok;cov.hidden=!proj}
  var sp=$("[data-car-specs]");sp.innerHTML="";
  if((c.specs||[]).length){c.specs.forEach(function(r){var d=el("div");d.appendChild(el("dt","",r[0]));d.appendChild(el("dd","",r[1]+(r[2]?" ("+r[2]+")":"")));sp.appendChild(d)});$$("[data-specs-empty]").forEach(function(e){e.hidden=true})}
  else $$("[data-specs-empty]").forEach(function(e){e.hidden=false});
}
var DFIELDS=[["Brands represented","brands"],["Available models","models"],["Vehicle warranty","vehicleWarranty"],["Battery warranty","batteryWarranty"],["Local servicing","servicing"],["Parts availability","parts"],["Test drives","testDrive"],["Phone","phone"],["Website","website"]];
var STATUS={dealer:["Dealership-provided","b-dealer"],checked:["Independently checked","b-checked"]};
function val(v){return Array.isArray(v)?v.join(", "):v}
function renderDealers(){
  var g=$("#dealer-grid");if(!g)return;var list=C.dealerships||[],br=null;
  $$("[data-dealers-empty]").forEach(function(e){e.hidden=list.length>0});
  $$("[data-dealer-filters]").forEach(function(e){e.hidden=!list.length});
  function draw(){
    g.innerHTML="";
    list.filter(function(d){return !br||(d.brands||[]).indexOf(br)>-1}).forEach(function(d){
      var a=el("a","card");a.href="dealership.html?id="+encodeURIComponent(d.id);
      var st=STATUS[d.status]||["Not confirmed","b-none"];
      a.appendChild(el("span","badge "+st[1],st[0]));
      a.appendChild(el("h3","h3",d.name));
      a.appendChild(el("p","",[d.city,val(d.brands)].filter(Boolean).join(" · ")));
      if(d.updated)a.appendChild(el("p","note","Updated "+d.updated));
      g.appendChild(a);
    });
  }
  var fb=$("[data-dealer-filters]");
  if(fb&&list.length&&!fb.dataset.done){fb.dataset.done=1;var bs=[];list.forEach(function(d){(d.brands||[]).forEach(function(b){if(bs.indexOf(b)<0)bs.push(b)})});filterBar(fb,bs,function(b){br=b;draw()},"Filter by brand")}
  draw();
}
function renderDealerProfile(){
  var host=$("#dealer-profile");if(!host)return;
  var id=new URLSearchParams(location.search).get("id");
  var d=(C.dealerships||[]).filter(function(x){return x.id===id})[0];
  if(!d){host.innerHTML="";host.appendChild(el("p","lead","Dealership not found. "));var a=el("a","link","See the directory");a.href="dealerships.html";host.appendChild(a);return}
  document.title=d.name+" — EVebi";
  $$("[data-d-name]").forEach(function(e){e.textContent=d.name});
  $$("[data-d-city]").forEach(function(e){e.textContent=d.city||""});
  var st=STATUS[d.status]||["Not confirmed","b-none"];
  $$("[data-d-status]").forEach(function(e){e.textContent=st[0];e.className="badge "+st[1]});
  $$("[data-d-updated]").forEach(function(e){e.textContent=d.updated?"Last updated "+d.updated:"Last update: not recorded"});
  var dl=$("[data-d-facts]");dl.innerHTML="";
  DFIELDS.forEach(function(f){var v=val(d[f[1]]);var r=el("div");r.appendChild(el("dt","",f[0]));r.appendChild(el("dd",v?"":"nc",v||"Not confirmed"));dl.appendChild(r)});
  $$("[data-d-wa]").forEach(function(a){a.dataset.msgEn="Hello! I have a question about "+d.name+": ";a.href=waHref(a.dataset.msgEn);a.target="_blank"});
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
