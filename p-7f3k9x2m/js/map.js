(function(){
  "use strict";
  var $=function(id){return document.getElementById(id)};
  var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  var CONN={ccs:"CCS2",type2:"Type 2",chademo:"CHAdeMO",tesla:"Tesla",gbt:"GB/T"};
  var DC={ccs:1,chademo:1,gbt:1};
  var POPULAR=[["თბილისი",41.7151,44.8271],["ბათუმი",41.6168,41.6367],["ქუთაისი",42.2679,42.6946],["რუსთავი",41.5495,45.0050],["გორი",41.9842,44.1089],["თელავი",41.9198,45.4735],["გუდაური",42.4775,44.4800],["ბორჯომი",41.8396,43.3794],["ზუგდიდი",42.5088,41.8709],["მესტია",43.0450,42.7277],["ყაზბეგი",42.6567,44.6428],["სიღნაღი",41.6192,45.9216]];

  /* ---------- helpers ---------- */
  function hav(a,b){var R=6371,dLa=(b[0]-a[0])*Math.PI/180,dLo=(b[1]-a[1])*Math.PI/180;
    var x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return 2*R*Math.asin(Math.sqrt(x))}
  var fmtKm=function(n){return Math.round(n)+" კმ"};
  function fmtMin(m){m=Math.round(m);var h=Math.floor(m/60);return (h?h+" სთ ":"")+(m%60)+" წთ"}
  function clock(ms){var d=new Date(ms);return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}
  var toastT=null;
  function toast(t){var e=$("toast");e.textContent=t;e.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){e.hidden=true},2600)}

  /* ---------- map ---------- */
  var map=L.map("map",{zoomControl:false,preferCanvas:true}).setView([42.0,43.7],7);
  if(L.control&&L.control.zoom)L.control.zoom({position:"topright"}).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:19,className:"dark-tiles"}).addTo(map);
  var cluster=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:50});
  map.addLayer(cluster);
  var routeLayer=L.layerGroup().addTo(map);

  /* ---------- state ---------- */
  var garage={carId:"",name:"",kwh:0,cons:0,dc:0,deg:0,conn:"",saved:false};
  var S={soc:80,minC:10,minD:10,maxC:80,cond:1};
  var CARS=[],stations=[],partners=[],osmEls=[];
  var dests=[null,null];           // [origin, via..., destination]
  var routes=[],selRoute=0,userPos=null,meMarker=null,planStart=Date.now();
  function loadState(){
    try{var g=JSON.parse(store.get("evebi_garage")||"null");
      if(g){ if(!g.kwh&&g.range){g.kwh=Math.round(g.range*0.17);g.cons=17;g.dc=g.dc||50}
        garage=Object.assign(garage,g)}}catch(e){}
    try{var s=JSON.parse(store.get("evebi_set")||"null");if(s)S=Object.assign(S,s)}catch(e){}
  }
  function saveGarage(){store.set("evebi_garage",JSON.stringify(garage));syncPush()}
  function saveSet(){store.set("evebi_set",JSON.stringify(S));syncPush()}
  function effKwh(g){return g.kwh*(1-(g.deg||0)/100)}
  function rangeOf(g){return g.kwh&&g.cons?effKwh(g)/g.cons*100:0}

  /* ---------- views / navigation ---------- */
  var viewStack=["home"];
  function show(v,push){
    if(push!==false&&viewStack[viewStack.length-1]!==v)viewStack.push(v);
    document.querySelectorAll(".view").forEach(function(x){x.classList.toggle("on",x.id==="v-"+v)});
    $("panel").classList.remove("min");
    var el=$("v-"+v);if(el)el.scrollTop=0;
    if(v==="car")pickShow("brands");
    if(v==="dest")renderDests();
    if(v==="saved")renderSaved();
    if(v==="places")fillPlaces();
    if(v==="account")renderAccount();
    if(v==="vehicle")fillVehicle();
    if(v==="charging")fillCharging();
    renderCarBoxes();
  }
  function back(){
    if(viewStack.length>1)viewStack.pop();
    var v=viewStack[viewStack.length-1]||"home";
    if(v==="route"&&!routes.length)v="dest";
    if(v!=="route")routeLayer.clearLayers();
    show(v,false);
    if(v==="route")drawRoute();
  }
  document.addEventListener("click",function(e){
    var g=e.target.closest("[data-go]");if(g){show(g.getAttribute("data-go"));return}
    if(e.target.closest("[data-back]")){back();return}
    if(e.target.closest("[data-pick]")){show("car");return}
    if(e.target.closest("[data-savesoc]")){saveSet();saveGarage();toast("შენახულია")}
  });
  $("grab").addEventListener("click",function(){$("panel").classList.toggle("min")});
  function menuOpen(o){$("menu").hidden=!o;$("btnMenu").setAttribute("aria-expanded",o?"true":"false")}
  $("btnMenu").addEventListener("click",function(e){e.stopPropagation();menuOpen($("menu").hidden)});
  $("menu").addEventListener("click",function(e){
    var b=e.target.closest("[data-m]");if(!b){menuOpen(false);return}
    var m=b.getAttribute("data-m");menuOpen(false);
    if(m==="filter"){$("filters").hidden=false;return}
    viewStack=["home"];show(m);
  });
  document.addEventListener("click",function(e){if(!$("menu").hidden&&!e.target.closest(".topbtns"))menuOpen(false)});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")menuOpen(false)});

  /* ---------- car box ---------- */
  var BODY={
    fastback:{b:"M8 78V64Q8 56 24 53L60 48Q80 28 108 24H138Q158 24 172 36L194 48L224 54Q234 57 234 66V78Z",w:"M86 46Q96 31 112 29H136Q150 29 160 38L172 46Z",d:"M118 29V46"},
    suv:{b:"M8 78V56Q8 48 18 46L34 43L44 26Q48 14 62 12H146Q160 12 170 22L190 44L222 50Q234 53 234 64V78Z",w:"M54 42L60 22Q62 17 70 17H146Q154 17 160 24L176 42Z",d:"M108 17V42"},
    hatch:{b:"M10 78V58Q10 50 22 48L44 45Q54 28 76 24H128Q152 24 166 38L190 48L220 53Q232 56 232 66V78Z",w:"M64 45Q70 31 84 29H126Q142 29 154 40L164 46Z",d:"M106 29V46"}
  };
  var svgN=0;
  function carSvg(body){
    var s=BODY[body]||BODY.fastback,id="g"+(++svgN);
    return '<svg class="carsvg" viewBox="0 0 240 100" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f2ec"/><stop offset=".5" stop-color="#d2cec5"/><stop offset="1" stop-color="#8f8c86"/></linearGradient></defs>'+
      '<ellipse cx="121" cy="94" rx="110" ry="5" fill="rgba(0,0,0,.4)"/><path d="'+s.b+'" fill="url(#'+id+')"/><path d="'+s.w+'" fill="#1b1d21" opacity=".93"/><path d="'+s.d+'" stroke="#d2cec5" stroke-width="2.5" opacity=".85"/>'+
      '<circle cx="56" cy="78" r="17" fill="#0f1012"/><circle cx="56" cy="78" r="8.5" fill="#6b6f77"/><circle cx="186" cy="78" r="17" fill="#0f1012"/><circle cx="186" cy="78" r="8.5" fill="#6b6f77"/></svg>';
  }
  function sliderPct(sl){sl.style.setProperty("--p",((sl.value-5)/95*100)+"%")}
  function renderCarBoxes(){
    document.querySelectorAll("[data-box]").forEach(function(b){
      if(!garage.saved){
        b.innerHTML='<h3>მანქანა არ არის არჩეული</h3>'+carSvg()+'<button class="light wide" data-pick>აირჩიე მანქანა</button>';
        return;
      }
      var ro=b.classList.contains("ro");
      b.innerHTML='<div class="ch"><h3>'+esc(garage.name||"ჩემი მანქანა")+'</h3>'+(ro?'':'<button class="gear" data-go="vehicle" aria-label="მანქანის პარამეტრები"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></button>')+'</div>'+
        '<div class="cmeta">'+garage.kwh+' კვტსთ · ~'+Math.round(rangeOf(garage))+' კმ'+(garage.conn?' · '+CONN[garage.conn]:'')+'</div>'+carSvg(garage.body)+
        (ro?'':'<div class="soc"><span class="battico"></span><b data-socv>'+S.soc+'%</b></div><input class="slider" type="range" min="5" max="100" step="1" value="'+S.soc+'" aria-label="ბატარეა გასვლისას">'+
        '<div class="two"><button class="soft" data-pick>შეცვლა</button><button class="light" data-savesoc>შენახვა</button></div>');
      var sl=b.querySelector(".slider");
      if(sl){sliderPct(sl);
        sl.addEventListener("input",function(){S.soc=parseInt(sl.value,10);sliderPct(sl);
          document.querySelectorAll("[data-socv]").forEach(function(x){x.textContent=S.soc+"%"});
          document.querySelectorAll(".slider").forEach(function(o){if(o!==sl){o.value=S.soc;sliderPct(o)}})});
        sl.addEventListener("change",saveSet)}
    });
  }

  /* ---------- car picker: brand -> model -> connector ---------- */
  var pending=null,pickStep="brands";
  function pickShow(step){
    pickStep=step;
    $("pickBrands").hidden=step!=="brands";$("pickModels").hidden=step!=="models";$("pickConn").hidden=step!=="conn";
    var el=$("v-car");if(el)el.scrollTop=0;
  }
  function loadCars(){
    fetch("data/cars.json").then(function(r){return r.json()}).then(function(j){CARS=j.cars||[];buildBrands()}).catch(function(){});
  }
  function buildBrands(){
    var box=$("brandList");box.innerHTML="";
    var seen={},order=[];CARS.forEach(function(c){if(!seen[c.brand]){seen[c.brand]=[];order.push(c.brand)}seen[c.brand].push(c)});
    order.forEach(function(br){
      var b=document.createElement("button");b.className="bcard";
      b.innerHTML=carSvg(seen[br][0].body)+'<b>'+esc(br)+'</b><span>'+seen[br].length+' მოდელი</span>';
      b.addEventListener("click",function(){buildModels(br,seen[br])});
      box.appendChild(b);
    });
  }
  function buildModels(br,list){
    $("brandName").textContent=br;
    var box=$("carList");box.innerHTML="";
    list.forEach(function(c){
      var b=document.createElement("button");b.className="car";
      b.innerHTML='<div class="ct"><b>'+esc(c.model)+'</b><span>'+c.kwh+' კვტსთ · ~'+Math.round(c.kwh/c.cons*100)+' კმ</span></div>'+carSvg(c.body);
      b.addEventListener("click",function(){
        pending=c;$("pickName").textContent=c.name;$("pickCar").innerHTML=carSvg(c.body);pickShow("conn");
        var sel=c.conn||"";document.querySelectorAll("#pickChips .chip").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-k")===sel)});
        $("pickGo").disabled=!sel;$("pickGo").setAttribute("data-k",sel);
      });
      box.appendChild(b);
    });
    pickShow("models");
  }
  document.querySelectorAll("#pickChips .chip").forEach(function(ch){ch.addEventListener("click",function(){
    document.querySelectorAll("#pickChips .chip").forEach(function(x){x.classList.toggle("on",x===ch)});
    $("pickGo").setAttribute("data-k",ch.getAttribute("data-k"));$("pickGo").disabled=false;
  })});
  $("modelsBack").addEventListener("click",function(){pickShow("brands")});
  $("pickBack").addEventListener("click",function(){pickShow("models")});
  $("pickGo").addEventListener("click",function(){
    if(!pending)return;
    garage={carId:pending.id,name:pending.name,body:pending.body,kwh:pending.kwh,cons:pending.cons,dc:pending.dc,deg:0,conn:$("pickGo").getAttribute("data-k"),saved:true};
    saveGarage();applyGarageFilter();
    viewStack=["home"];show("home",false);
    if(pendingShare){var sh=pendingShare;pendingShare=null;applyShare(sh)}
  });
  $("pickOther").addEventListener("click",function(){
    garage={carId:"other",name:"ჩემი მანქანა",body:"fastback",kwh:60,cons:17,dc:100,deg:0,conn:"",saved:true};
    saveGarage();viewStack=["home","settings"];show("vehicle");
  });
  function applyGarageFilter(){
    if(!garage.conn)return;
    activeConn={};activeConn[garage.conn]=true;
    document.querySelectorAll("#connChips .chip").forEach(function(c){c.classList.toggle("on",c.getAttribute("data-k")===garage.conn)});
    render();
  }

  /* ---------- vehicle & charging settings ---------- */
  function fillVehicle(){
    $("vTitle").textContent=garage.name||"მანქანა";
    $("gKwh").value=garage.kwh||"";$("gCons").value=garage.cons||"";$("gDc").value=garage.dc||"";$("gDeg").value=garage.deg||0;$("gConn").value=garage.conn||"";rangeOut();
  }
  function rangeOut(){var r=rangeOf(garage);$("gRangeOut").textContent=r?("დაახლოებით "+Math.round(r)+" კმ ერთი დატენვით (რეალური მგზავრობისას)"):""}
  [["gKwh","kwh",10,200],["gCons","cons",8,40],["gDc","dc",3,400],["gDeg","deg",0,40]].forEach(function(f){
    $(f[0]).addEventListener("input",function(){var v=parseFloat($(f[0]).value);if(v>=f[2]&&v<=f[3]){garage[f[1]]=v;garage.saved=true;saveGarage();rangeOut();renderCarBoxes()}});
  });
  $("gConn").addEventListener("change",function(){garage.conn=$("gConn").value;saveGarage();applyGarageFilter();renderCarBoxes()});
  $("changeCar").addEventListener("click",function(){show("car")});
  function fillCharging(){$("sMinC").value=S.minC;$("sMinD").value=S.minD;$("sMax").value=S.maxC;$("cond").value=String(S.cond)}
  [["sMinC","minC",3,40],["sMinD","minD",3,60],["sMax","maxC",50,100]].forEach(function(f){
    $(f[0]).addEventListener("input",function(){var v=parseFloat($(f[0]).value);if(v>=f[2]&&v<=f[3]){S[f[1]]=v;saveSet()}});
  });
  $("cond").addEventListener("change",function(){S.cond=parseFloat($("cond").value)||1;saveSet()});

  /* ---------- station parsing ---------- */
  function parsePower(v){if(!v)return 0;var m=String(v).match(/([\d.]+)\s*(kW|W|MW)?/i);if(!m)return 0;var n=parseFloat(m[1]);var u=(m[2]||"kW").toLowerCase();return u==="w"?n/1000:u==="mw"?n*1000:n}
  function parseStation(el){
    var t=el.tags||{};
    var lat=el.lat!=null?el.lat:(el.center&&el.center.lat),lon=el.lon!=null?el.lon:(el.center&&el.center.lon);
    if(lat==null||lon==null)return null;
    var conns={},power=0,anyDC=false;
    var keys={ccs:["socket:type2_combo"],type2:["socket:type2","socket:type2_cable"],chademo:["socket:chademo"],
      tesla:["socket:tesla_supercharger","socket:tesla_destination","socket:tesla_standard"],gbt:["socket:gb_t","socket:chinese_gb_t","socket:gb_t_dc"]};
    Object.keys(keys).forEach(function(c){keys[c].forEach(function(k){
      if(t[k]&&t[k]!=="no"){conns[c]=true;var p=parsePower(t[k+":output"]);if(p>power)power=p;if(DC[c])anyDC=true}
    })});
    if(t["socket:tesla_supercharger"])anyDC=true;
    var fast=anyDC||power>=40;
    return {id:el.type+el.id,lat:lat,lon:lon,
      name:t.name||t.operator||t.brand||"დამტენი სადგური",operator:t.operator||t.brand||"",
      conns:conns,known:Object.keys(conns).length>0,power:power,fast:fast,fee:t.fee||"",hours:t.opening_hours||"",
      cap:t.capacity||"",addr:[t["addr:street"],t["addr:housenumber"],t["addr:city"]].filter(Boolean).join(", ")};
  }

  /* ---------- filters & markers ---------- */
  var activeConn={};
  function passes(s){
    var keys=Object.keys(activeConn).filter(function(k){return activeConn[k]});
    if(keys.length){
      if(!s.known){ if(!$("showUnknown").checked)return false }
      else if(!keys.some(function(k){return s.conns[k]}))return false;
    }
    if($("fastOnly").checked&&!s.fast)return false;
    if(!okPower(s))return false;
    var op=$("opSel").value;if(op&&s.operator!==op)return false;
    return true;
  }
  function okPower(s){
    var mk=parseFloat($("minKw").value)||0;if(!mk)return true;
    if(s.power)return s.power>=mk;
    return mk<=22;
  }
  function render(){
    cluster.clearLayers();
    var n=0,markers=[];
    stations.forEach(function(s){
      if(!passes(s))return;
      n++;
      var icon=L.divIcon({className:"",html:'<div class="dot'+(s.fast?' fast':'')+(s.partner?' official':'')+'"></div>',iconSize:[14,14],iconAnchor:[7,7]});
      var m=L.marker([s.lat,s.lon],{icon:icon,title:s.name});
      m.on("click",function(){openCharger(s)});
      markers.push(m);
    });
    cluster.addLayers(markers);
    if(stations.length)$("status").textContent="ნაჩვენებია "+n+" სადგური "+stations.length+"-დან"+(partners.length?" (მათგან "+partners.length+" ოფიციალური)":"");
  }
  document.querySelectorAll("#connChips .chip").forEach(function(c){c.addEventListener("click",function(){
    var k=c.getAttribute("data-k");activeConn[k]=!activeConn[k];c.classList.toggle("on",activeConn[k]);render();
  })});
  $("fastOnly").addEventListener("change",render);
  $("minKw").addEventListener("change",render);
  $("opSel").addEventListener("change",render);
  function fillOps(){
    var cnt={};stations.forEach(function(s){if(s.operator)cnt[s.operator]=(cnt[s.operator]||0)+1});
    var names=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,15),cur=$("opSel").value;
    $("opSel").innerHTML='<option value="">ყველა</option>'+names.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+' ('+cnt[n]+')</option>'}).join("");
    $("opSel").value=names.indexOf(cur)>=0?cur:"";
  }
  $("showUnknown").addEventListener("change",render);
  $("btnFilter").addEventListener("click",function(){$("filters").hidden=!$("filters").hidden});
  $("filtersClose").addEventListener("click",function(){$("filters").hidden=true});

  /* ---------- load stations ---------- */
  var QUERY='[out:json][timeout:60];nwr["amenity"="charging_station"](41.0,40.0,43.7,46.8);out center tags;';
  var ENDPOINTS=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
  function loadFrom(i){
    if(i>=ENDPOINTS.length)return Promise.reject(new Error("fail"));
    return fetch(ENDPOINTS[i],{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"data="+encodeURIComponent(QUERY)})
      .then(function(r){if(!r.ok)throw new Error("http "+r.status);return r.json()})
      .catch(function(){return loadFrom(i+1)});
  }
  function rebuild(){
    var seen={};
    var osm=osmEls.map(parseStation).filter(function(s){if(!s||seen[s.id])return false;seen[s.id]=1;return true});
    osm=osm.filter(function(s){return !partners.some(function(p){return hav([p.lat,p.lon],[s.lat,s.lon])<0.08})});
    stations=osm.concat(partners);
    fillOps();render();
  }
  function setStations(els){osmEls=els;rebuild()}
  function init(){
    var cached=null,ts=0;
    try{cached=JSON.parse(store.get("evebi_osm")||"null");ts=parseInt(store.get("evebi_osm_ts")||"0",10)}catch(e){}
    if(cached&&Date.now()-ts<24*3600*1000){setStations(cached);return}
    $("status").textContent="სადგურები იტვირთება…";
    loadFrom(0).then(function(j){
      var els=j.elements||[];
      try{store.set("evebi_osm",JSON.stringify(els));store.set("evebi_osm_ts",String(Date.now()))}catch(e){}
      setStations(els);
      if(!stations.length)$("status").textContent="ამ ტერიტორიაზე სადგურები ვერ ვიპოვეთ.";
    }).catch(function(){
      if(cached){setStations(cached);return}
      $("status").textContent="სადგურების ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი და განაახლე გვერდი.";
    });
  }
  function loadPartners(){
    fetch("data/partners.json?v="+Date.now()).then(function(r){return r.ok?r.json():[]}).then(function(a){
      partners=(Array.isArray(a)?a:[]).filter(function(p){return p&&typeof p.lat==="number"&&typeof p.lon==="number"}).map(function(p){
        var conns={},dc=false;Object.keys(p.conns||{}).forEach(function(k){if(CONN[k]&&p.conns[k]){conns[k]=true;if(DC[k])dc=true}});
        var pw=parseFloat(p.power)||0;
        return {id:"p-"+(p.id||p.name),lat:p.lat,lon:p.lon,name:p.name||"დამტენი სადგური",operator:p.operator||"",conns:conns,known:Object.keys(conns).length>0,
          power:pw,fast:dc||pw>=40,fee:"",hours:p.hours||"",cap:p.plugs||"",addr:p.addr||"",partner:true,price:p.price||"",pay:p.pay||"",phone:p.phone||""};
      });
      if(stations.length||osmEls.length)rebuild();
    }).catch(function(){});
  }

  /* ---------- locate ---------- */
  function setMe(cb){
    if(!navigator.geolocation){toast("ეს ბრაუზერი მდებარეობას ვერ განსაზღვრავს.");return}
    navigator.geolocation.getCurrentPosition(function(p){
      userPos=[p.coords.latitude,p.coords.longitude];
      if(meMarker)map.removeLayer(meMarker);
      meMarker=L.marker(userPos,{icon:L.divIcon({className:"",html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
      if(cb)cb();else map.setView(userPos,12);
    },function(err){
      toast(err&&err.code===1?"მდებარეობაზე წვდომა დაბლოკილია. ბრაუზერის პარამეტრებში ჩართე ლოკაციის უფლება.":"მდებარეობის განსაზღვრა ვერ მოხერხდა.");
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  $("locate").addEventListener("click",function(){
    setMe(function(){
      map.setView(userPos,12);
      var best=null;stations.forEach(function(s){if(!passes(s))return;var d=hav(userPos,[s.lat,s.lon]);if(!best||d<best.d)best={s:s,d:d}});
      if(best)toast("უახლოესი სადგური: "+best.s.name+", "+(best.d<10?best.d.toFixed(1):Math.round(best.d))+" კმ");
    });
  });

  /* ---------- place search (OpenStreetMap Nominatim) ---------- */
  var searchCache={};
  function getPlaces(){try{return JSON.parse(store.get("evebi_places")||"{}")||{}}catch(e){return {}}}
  function setPlace(k,p){var o=getPlaces();o[k]=p;store.set("evebi_places",JSON.stringify(o));syncPush()}
  function nominatim(q){
    if(searchCache[q])return Promise.resolve(searchCache[q]);
    var url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ge&accept-language=ka&q="+encodeURIComponent(q);
    return fetch(url).then(function(r){if(!r.ok)throw new Error("s");return r.json()}).then(function(a){
      var out=a.map(function(x){var parts=String(x.display_name).split(",");return {name:parts.slice(0,2).join(",").trim(),lat:parseFloat(x.lat),lon:parseFloat(x.lon)}});
      searchCache[q]=out;return out;
    });
  }
  function bindSearch(input,list,onPick,withMe){
    var timer=null,seq=0;
    function draw(items){
      list.innerHTML="";
      if(withMe){var m=document.createElement("button");m.className="sg me";m.textContent="ჩემი მდებარეობა";m.addEventListener("mousedown",function(e){e.preventDefault()});m.addEventListener("click",function(){
        list.hidden=true;setMe(function(){onPick({name:"ჩემი მდებარეობა",lat:userPos[0],lon:userPos[1]})})});list.appendChild(m)}
      items.forEach(function(it){var b=document.createElement("button");b.className="sg";b.textContent=it.name;
        b.addEventListener("mousedown",function(e){e.preventDefault()});
        b.addEventListener("click",function(){list.hidden=true;input.blur();onPick(it)});list.appendChild(b)});
      list.hidden=!list.children.length;
    }
    function popular(){
      var pl=getPlaces(),own=[];
      if(pl.home)own.push({name:"სახლი",lat:pl.home.lat,lon:pl.home.lon});
      if(pl.work)own.push({name:"სამსახური",lat:pl.work.lat,lon:pl.work.lon});
      return own.concat(POPULAR.map(function(c){return {name:c[0],lat:c[1],lon:c[2]}}));
    }
    input.addEventListener("focus",function(){if(!input.value.trim())draw(popular())});
    input.addEventListener("input",function(){
      clearTimeout(timer);var q=input.value.trim();
      if(q.length<2){draw(q?[]:popular());return}
      var local=popular().filter(function(c){return c.name.indexOf(q)===0});
      draw(local);
      timer=setTimeout(function(){var my=++seq;
        nominatim(q).then(function(r){if(my!==seq)return;var names={};local.forEach(function(x){names[x.name]=1});draw(local.concat(r.filter(function(x){return !names[x.name]})))}).catch(function(){});
      },450);
    });
    input.addEventListener("blur",function(){setTimeout(function(){list.hidden=true},150)});
  }
  bindSearch($("homeSearch"),$("homeSugg"),function(p){
    $("homeSearch").value="";dests=[userPos?{name:"ჩემი მდებარეობა",lat:userPos[0],lon:userPos[1]}:null,p];show("dest");
  },false);

  [["homeIn","homeInS","home"],["workIn","workInS","work"]].forEach(function(a){
    bindSearch($(a[0]),$(a[1]),function(p){setPlace(a[2],{name:p.name,lat:p.lat,lon:p.lon});$(a[0]).value=p.name;toast("შენახულია")},false);
  });
  function fillPlaces(){var pl=getPlaces();$("homeIn").value=pl.home?pl.home.name:"";$("workIn").value=pl.work?pl.work.name:""}

  /* ---------- pick a place by tapping the map ---------- */
  var pickIdx=null;
  function reverse(lat,lon){
    var fb="პინი ("+lat.toFixed(3)+", "+lon.toFixed(3)+")";
    return fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=ka&lat="+lat+"&lon="+lon)
      .then(function(r){if(!r.ok)throw new Error("r");return r.json()})
      .then(function(x){var n=x&&(x.name||String(x.display_name||"").split(",").slice(0,2).join(",").trim());return n||fb}).catch(function(){return fb});
  }
  if(map.on)map.on("click",function(e){
    if(pickIdx===null||!e||!e.latlng)return;
    var i=pickIdx;pickIdx=null;$("map").classList.remove("picking");
    var lat=e.latlng.lat,lon=e.latlng.lng;
    reverse(lat,lon).then(function(n){dests[i]={name:n,lat:lat,lon:lon};show("dest",false);viewStack.indexOf("dest")<0&&viewStack.push("dest");renderDests()});
  });
  function startPick(i){
    pickIdx=i;$("map").classList.add("picking");$("panel").classList.add("min");toast("დააჭირე რუკაზე ადგილს");
  }

  /* ---------- share a trip by link ---------- */
  var pendingShare=null;
  function shareLink(){
    var d=dests.map(function(x){return [x.name,+x.lat.toFixed(5),+x.lon.toFixed(5)]});
    return location.origin+location.pathname+"#t="+encodeURIComponent(JSON.stringify({d:d,s:Math.round(S.soc)}));
  }
  function readShare(){
    var m=String(location.hash||"").match(/^#t=(.+)$/);if(!m)return null;
    try{var o=JSON.parse(decodeURIComponent(m[1]));
      if(!o||!Array.isArray(o.d)||o.d.length<2||o.d.length>8)return null;
      var d=o.d.map(function(x){return {name:String(x[0]).slice(0,80),lat:+x[1],lon:+x[2]}});
      if(d.some(function(x){return !isFinite(x.lat)||!isFinite(x.lon)||Math.abs(x.lat)>90||Math.abs(x.lon)>180}))return null;
      return {d:d,s:Math.min(100,Math.max(5,+o.s||80))};
    }catch(e){return null}
  }
  function applyShare(sh){dests=sh.d;S.soc=sh.s;viewStack=["home"];show("dest");plan()}
  function copyLink(){
    var u=shareLink();
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(function(){toast("ბმული დაკოპირდა")},function(){window.prompt("დააკოპირე ბმული",u)})}
    else window.prompt("დააკოპირე ბმული",u);
  }

  /* ---------- destinations ---------- */
  function renderDests(){
    var box=$("destRows");box.innerHTML="";
    dests.forEach(function(d,i){
      var last=i===dests.length-1,first=i===0;
      var row=document.createElement("div");row.className="drow";
      var ph=first?"საიდან":last?"სად":"გაჩერება";
      row.innerHTML='<span class="dm '+(first?"a":last?"z":"v")+'"></span><div class="sbox"><input type="search" autocomplete="off" placeholder="'+ph+'" value="'+esc(d?d.name:"")+'" aria-label="'+ph+'"><div class="sugg" hidden></div></div>'+
        (!first&&!last?'<button class="x" aria-label="წაშლა">×</button>':'')+'<button class="pin" aria-label="რუკაზე არჩევა" title="რუკაზე არჩევა"><svg viewBox="0 0 24 24"><path d="M12 21s-6-5.600-6-11a6 6 0 0 1 12 0c0 5.400-6 11-6 11z"/><circle cx="12" cy="10" r="2.200"/></svg></button>';
      box.appendChild(row);
      var inp=row.querySelector("input"),lst=row.querySelector(".sugg");
      bindSearch(inp,lst,function(p){dests[i]=p;renderDests()},first);
      row.querySelector(".pin").addEventListener("click",function(){startPick(i)});
      var rm=row.querySelector(".x");if(rm)rm.addEventListener("click",function(){dests.splice(i,1);renderDests()});
    });
    $("planMsg").innerHTML="";
  }
  $("addStop").addEventListener("click",function(){dests.splice(dests.length-1,0,null);renderDests()});
  $("planBtn").addEventListener("click",function(){plan()});

  /* ---------- trip planner (pure, exported for tests) ----------
     car: {kwh (effective), cons (kWh/100km incl. conditions), dc}
     o: {minC,minD,maxC} percents. Timeline entries are {d:km, soc:%}. */
  function cumOf(pts){var cum=[0];for(var i=1;i<pts.length;i++)cum.push(cum[i-1]+hav(pts[i-1],pts[i]));return cum}
  function planTrip(pts,cands,car,startPct,o,prof){
    var cum=cumOf(pts);
    var total=cum[cum.length-1];
    var near=[];
    cands.forEach(function(s){
      var best=Infinity,bi=-1;
      for(var i=0;i<pts.length;i+=1){var d=Math.abs(pts[i][0]-s.lat)+Math.abs(pts[i][1]-s.lon);if(d<best){best=d;bi=i}}
      if(bi<0)return;
      var dist=hav(pts[bi],[s.lat,s.lon]);
      if(dist<=4)near.push({s:s,along:cum[bi],off:dist});
    });
    var base=car.cons/100,kwh=car.kwh,resC=kwh*o.minC/100,resD=kwh*o.minD/100,cap=kwh*o.maxC/100;
    /* cumulative energy (kWh) along the route; climbs cost extra, descents give back 50% */
    var ce=[0],mass=car.mass||1900;
    function hAt(d){
      if(!prof)return 0;var D=prof.d,H=prof.h;
      if(d<=D[0])return H[0];
      for(var k=1;k<D.length;k++){if(d<=D[k]){var t=(d-D[k-1])/((D[k]-D[k-1])||1);return H[k-1]+(H[k]-H[k-1])*t}}
      return H[H.length-1];
    }
    for(var i=1;i<cum.length;i++){
      var seg=cum[i]-cum[i-1],be=seg*base,e=be;
      if(prof){var dh=hAt(cum[i])-hAt(cum[i-1]);e+=dh>0?mass*9.81*dh/3.6e6/0.85:mass*9.81*dh/3.6e6*0.5*0.85}
      if(e<be*0.15)e=be*0.15;
      ce.push(ce[i-1]+e);
    }
    function En(d){
      if(d<=0)return 0;if(d>=total)return ce[ce.length-1];
      var lo=0,hi=cum.length-1;
      while(hi-lo>1){var mid=(lo+hi)>>1;if(cum[mid]<=d)lo=mid;else hi=mid}
      var t=(d-cum[lo])/((cum[hi]-cum[lo])||1);return ce[lo]+(ce[hi]-ce[lo])*t;
    }
    function maxReach(pos,avail){
      if(En(total)-En(pos)<=avail)return total;
      var lo=pos,hi=total;
      for(var k=0;k<30;k++){var m=(lo+hi)/2;if(En(m)-En(pos)<=avail)lo=m;else hi=m}
      return lo;
    }
    var soc=kwh*startPct/100,pos=0,stops=[],guard=0;
    var res={total:total,stops:stops,gap:null,arrivePct:null,startLow:false,lowArrival:false,chargeMin:0,timeline:[{d:0,soc:startPct}],cum:cum,energy:ce[ce.length-1]};
    if(soc<=resC){res.startLow=true;return res}
    while(guard++<25){
      var toEnd=En(total)-En(pos);
      if(toEnd<=soc-resD){
        var fin=Math.max(0,(soc-toEnd)/kwh*100);res.arrivePct=fin;res.timeline.push({d:total,soc:fin});return res}
      var avail=soc-resC,reach=maxReach(pos,avail);
      var inR=near.filter(function(n){return n.along>pos+1&&n.along<=reach});
      var fastR=inR.filter(function(n){return n.s.fast});
      var pool=fastR.length?fastR:inR,pick=null;
      pool.forEach(function(n){if(!pick||n.along>pick.along)pick=n});
      if(!pick){
        if(toEnd<=avail){var f2=Math.max(0,(soc-toEnd)/kwh*100);res.arrivePct=f2;res.timeline.push({d:total,soc:f2});res.lowArrival=true;return res}
        res.gap={from:pos,to:Math.min(reach,total)};return res}
      var arrive=soc-(En(pick.along)-En(pos));
      var need=(En(total)-En(pick.along))+resD+kwh*0.03;
      var target=need<=cap?Math.max(need,arrive):Math.max(cap,arrive);
      var add=target-arrive,p,avg;
      if(pick.s.fast){p=Math.min(car.dc||50,pick.s.power||50);avg=p*0.7}
      else{p=Math.min(11,pick.s.power||7);avg=p*0.95}
      var mins=add>0.2?add/avg*60:0;
      pick.arrivePct=arrive/kwh*100;pick.targetPct=target/kwh*100;pick.addKwh=add;pick.mins=mins;pick.kw=Math.round(avg);
      res.timeline.push({d:pick.along,soc:pick.arrivePct});res.timeline.push({d:pick.along,soc:pick.targetPct});
      res.chargeMin+=mins;stops.push(pick);soc=target;pos=pick.along;
    }
    return res;
  }
  window.__planTrip=planTrip;
  function socAt(tl,d){
    for(var i=1;i<tl.length;i++){if(d<=tl[i].d){var a=tl[i-1],b=tl[i];if(b.d===a.d)return b.soc;return a.soc+(b.soc-a.soc)*(d-a.d)/(b.d-a.d)}}
    return tl[tl.length-1].soc;
  }

  /* ---------- plan ---------- */
  function carForPlan(factor){
    var cond=(S.cond||1)*(factor||1);
    return garage.saved?{kwh:effKwh(garage),cons:garage.cons*cond,dc:garage.dc}:{kwh:60,cons:17*cond,dc:100};
  }
  function tempFactor(t){
    if(t==null)return 1;
    if(t<15)return 1+Math.min(0.4,(15-t)*0.012);
    if(t>28)return 1+Math.min(0.15,(t-28)*0.01);
    return 1;
  }
  function fetchProfile(pts){
    var cum=cumOf(pts),total=cum[cum.length-1]||1;
    var n=Math.max(2,Math.min(90,Math.round(total/4)+1)),ds=[],lats=[],lons=[];
    for(var k=0;k<n;k++){
      var d=total*k/(n-1),lo=0,hi=cum.length-1;
      while(hi-lo>1){var m=(lo+hi)>>1;if(cum[m]<=d)lo=m;else hi=m}
      var p=pts[(d-cum[lo])<(cum[hi]-d)?lo:hi];ds.push(d);lats.push(p[0].toFixed(4));lons.push(p[1].toFixed(4));
    }
    return fetch("https://api.open-meteo.com/v1/elevation?latitude="+lats.join(",")+"&longitude="+lons.join(","))
      .then(function(r){if(!r.ok)throw new Error("el");return r.json()})
      .then(function(j){if(!j.elevation||j.elevation.length!==ds.length)throw new Error("el");
        var h=j.elevation.map(function(v,i){return i&&i<j.elevation.length-1?(j.elevation[i-1]+v+j.elevation[i+1])/3:v});
        var up=0;for(var i=1;i<h.length;i++)if(h[i]>h[i-1])up+=h[i]-h[i-1];
        return {d:ds,h:h,up:up,min:Math.min.apply(null,h),max:Math.max.apply(null,h)}}).catch(function(){return null});
  }
  function fetchTemp(pt){
    return fetch("https://api.open-meteo.com/v1/forecast?latitude="+pt[0].toFixed(3)+"&longitude="+pt[1].toFixed(3)+"&current=temperature_2m")
      .then(function(r){if(!r.ok)throw new Error("w");return r.json()})
      .then(function(j){var t=j&&j.current&&j.current.temperature_2m;return typeof t==="number"?t:null}).catch(function(){return null});
  }
  function plan(){
    var msg=$("planMsg");
    if(dests.some(function(d){return !d})||dests.length<2){msg.innerHTML='<div class="warn">აირჩიე გამოსვლისა და დანიშნულების ადგილი.</div>';return}
    if(!garage.saved){msg.innerHTML='<div class="warn">ჯერ აირჩიე მანქანა.</div>';return}
    var btn=$("planBtn");btn.disabled=true;btn.textContent="ითვლება…";
    var coords=dests.map(function(d){return d.lon+","+d.lat}).join(";");
    var url="https://router.project-osrm.org/route/v1/driving/"+coords+"?overview=full&geometries=geojson&alternatives=true";
    fetch(url).then(function(r){if(!r.ok)throw new Error("route");return r.json()}).then(function(j){
      if(!j.routes||!j.routes.length)throw new Error("noroute");
      var rts=j.routes.slice(0,3).map(function(rt){return {pts:rt.geometry.coordinates.map(function(c){return [c[1],c[0]]}),dur:rt.duration}});
      var mid=rts[0].pts[Math.floor(rts[0].pts.length/2)];
      return Promise.all([Promise.all(rts.map(function(r){return fetchProfile(r.pts)})),fetchTemp(mid)]).then(function(res){
        var cands=stations.filter(function(s){return (!garage.conn||!s.known||s.conns[garage.conn])&&okPower(s)});
        var t=res[1],f=tempFactor(t),car=carForPlan(f);
        routes=rts.map(function(r,i){var prof=res[0][i];return {pts:r.pts,dur:r.dur,prof:prof,temp:t,tf:f,plan:planTrip(r.pts,cands,car,S.soc,S,prof)}});
        selRoute=0;planStart=Date.now();
        show("route");drawRoute();
      });
    }).catch(function(){
      msg.innerHTML='<div class="warn">მარშრუტის გამოთვლა ვერ მოხერხდა. სცადე ცოტა ხანში.</div>';
    }).then(function(){btn.disabled=false;btn.textContent="გათვლა"});
  }
  function totalSec(r){return r.dur+r.plan.chargeMin*60}

  /* ---------- route drawing & panel ---------- */
  function pill(txt,cls){return L.divIcon({className:"",html:'<div class="pill '+(cls||"")+'">'+txt+'</div>',iconSize:[10,10],iconAnchor:[-6,14]})}
  function drawRoute(){
    routeLayer.clearLayers();
    var r=routes[selRoute];if(!r)return;
    routes.forEach(function(o,i){if(i!==selRoute){var l=L.polyline(o.pts,{color:"#8b9199",weight:5,opacity:.7}).addTo(routeLayer);if(l.on)l.on("click",function(){selRoute=i;drawRoute()})}});
    var line=L.polyline(r.pts,{color:"#d2354a",weight:6,opacity:.95}).addTo(routeLayer);
    var pts=r.pts,p=r.plan;
    L.marker(pts[0],{icon:L.divIcon({className:"",html:'<div class="endm"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(routeLayer);
    L.marker(pts[0],{icon:pill(Math.round(S.soc)+"%","start"),interactive:false}).addTo(routeLayer);
    var last=pts[pts.length-1];
    L.marker(last,{icon:L.divIcon({className:"",html:'<div class="endm z"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(routeLayer);
    if(p.arrivePct!=null)L.marker(last,{icon:pill(Math.round(p.arrivePct)+"%",p.arrivePct<5?"low":""),interactive:false}).addTo(routeLayer);
    p.stops.forEach(function(st,i){
      var m=L.marker([st.s.lat,st.s.lon],{icon:L.divIcon({className:"",html:'<div class="stopm">'+(i+1)+'</div>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(routeLayer);
      m.on("click",function(){openCharger(st.s)});
      if(st.mins)L.marker([st.s.lat,st.s.lon],{icon:pill("⚡ "+fmtMin(st.mins),"chg"),interactive:false}).addTo(routeLayer);
    });
    map.fitBounds(line.getBounds(),{padding:[50,50]});
    renderRoutePanel();
  }
  function chartSvg(r){
    var tl=r.plan.timeline,W=330,H=130,pl=34,pb=22,pt=8,pr=8,total=r.plan.total||1;
    var x=function(d){return pl+(W-pl-pr)*d/total},y=function(s){return pt+(H-pt-pb)*(1-s/100)};
    var path=tl.map(function(t,i){return (i?"L":"M")+x(t.d).toFixed(1)+" "+y(t.soc).toFixed(1)}).join(" ");
    var grid=[0,25,50,75,100].map(function(v){return '<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="gl"/><text x="'+(pl-6)+'" y="'+(y(v)+4)+'" class="gt" text-anchor="end">'+v+'%</text>'}).join("");
    var xt=[0,.5,1].map(function(f){return '<text x="'+x(total*f)+'" y="'+(H-6)+'" class="gt" text-anchor="'+(f===0?'start':f===1?'end':'middle')+'">'+Math.round(total*f)+' კმ</text>'}).join("");
    var resY=y(S.minC),elev="";
    if(r.prof){var pf=r.prof,span=Math.max(50,pf.max-pf.min),eh=(H-pt-pb)*0.4;
      var ep=pf.d.map(function(d,i){return (i?"L":"M")+x(d).toFixed(1)+" "+((H-pb)-(pf.h[i]-pf.min)/span*eh).toFixed(1)}).join(" ");
      elev='<path d="'+ep+' L'+x(pf.d[pf.d.length-1]).toFixed(1)+' '+(H-pb)+' L'+x(pf.d[0]).toFixed(1)+' '+(H-pb)+'Z" class="el"/>'}
    return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="ბატარეის დონე გზაზე">'+grid+'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+resY+'" y2="'+resY+'" class="rl"/>'+elev+'<path d="'+path+'" class="cl"/>'+xt+'</svg>';
  }
  function renderRoutePanel(){
    var r=routes[selRoute],p=r.plan;
    var dest=dests[dests.length-1];
    $("rTitle").textContent=dest?dest.name:"";
    $("alts").innerHTML=routes.length>1?routes.map(function(o,i){return '<button class="altb'+(i===selRoute?' on':'')+'" data-alt="'+i+'">'+fmtMin(totalSec(o)/60)+'</button>'}).join(""):"";
    $("alts").querySelectorAll("[data-alt]").forEach(function(b){b.addEventListener("click",function(){selRoute=parseInt(b.getAttribute("data-alt"),10);drawRoute()})});
    var h=[];
    if(p.startLow){$("rBody").innerHTML='<div class="warn">გასვლისას ბატარეა მინიმუმზე ნაკლებია. ჯერ დატენე ან შეამცირე მინიმუმი პარამეტრებში.</div>';return}
    var kwhUsed=Math.round(p.energy||p.total*carForPlan().cons/100);
    h.push('<div class="sumcard"><div class="big">'+fmtMin(totalSec(r)/60)+'</div><div class="chipsrow"><span>🚗 '+fmtMin(r.dur/60)+'</span><span>⚡ '+fmtMin(p.chargeMin)+'</span><span>'+fmtKm(p.total)+'</span><span>'+p.stops.length+' გაჩერება</span><span>'+kwhUsed+' კვტსთ</span>'+(r.prof?'<span>↗ '+Math.round(r.prof.up)+' მ ასვლა</span>':'')+(r.temp!=null?'<span>🌡 '+Math.round(r.temp)+'°C</span>':'')+'</div></div>');
    if(!r.prof)h.push('<p class="hint" style="margin:0 0 10px">სიმაღლის მონაცემი ვერ ჩაიტვირთა, ამიტომ გათვლა უფრო მიახლოებითია (მთაში ხარჯი მეტი იქნება).</p>');
    var vias=[];
    for(var i=1;i<dests.length-1;i++){
      var best=Infinity,bi=0;for(var k=0;k<r.pts.length;k+=3){var dd=Math.abs(r.pts[k][0]-dests[i].lat)+Math.abs(r.pts[k][1]-dests[i].lon);if(dd<best){best=dd;bi=k}}
      vias.push({name:dests[i].name,along:p.cum[bi]});
    }
    var events=[];
    p.stops.forEach(function(st,i){events.push({along:st.along,type:"stop",st:st,i:i})});
    vias.forEach(function(v){events.push({along:v.along,type:"via",v:v})});
    events.sort(function(a,b){return a.along-b.along});
    h.push('<div class="tl"><div class="tcard"><div class="tt">'+esc(dests[0].name)+'</div><div class="tm">🔋 '+Math.round(S.soc)+'% · '+clock(planStart)+'</div></div>');
    var prevAlong=0,clk=planStart;
    events.forEach(function(ev){
      clk+=(ev.along-prevAlong)/(p.total||1)*r.dur*1000;prevAlong=ev.along;
      if(ev.type==="via"){h.push('<div class="seg">'+fmtKm(ev.along)+'</div><div class="tcard via"><div class="tt">'+esc(ev.v.name)+'</div><div class="tm">🔋 '+Math.round(socAt(p.timeline,ev.along))+'% · '+clock(clk)+'</div></div>');return}
      var st=ev.st;
      h.push('<div class="seg">გზის '+fmtKm(st.along)+'-ზე</div><button class="tcard stop" data-stop="'+ev.i+'"><div class="tt"><span class="n">'+(ev.i+1)+'</span>'+esc(st.s.name)+(st.s.partner?' <em>ოფიციალური</em>':'')+'</div>'+
        '<div class="tm">⚡ ~'+st.kw+' კვტ · '+(st.s.fast?'სწრაფი':'ნელი დატენვა')+(st.off>0.3?' · გზიდან '+st.off.toFixed(1)+' კმ':'')+'</div>'+
        '<div class="tm">🔋 '+Math.round(st.arrivePct)+'% → '+Math.round(st.targetPct)+'%'+(st.mins?' · '+fmtMin(st.mins):'')+' · '+clock(clk)+'</div></button>');
      clk+=st.mins*60000;
    });
    if(p.gap)h.push('<div class="warn">გზის '+fmtKm(p.gap.from)+'–'+fmtKm(p.gap.to)+' მონაკვეთზე შენი კონექტორისთვის სადგური ვერ ვიპოვეთ. შეიძლება რუკაზე მონაცემი აკლია. შეამოწმე ადგილზე ან მოგვწერე.</div>');
    else h.push('<div class="seg">გზის '+fmtKm(p.total)+'-ზე</div><div class="tcard"><div class="tt">'+esc(dest.name)+'</div><div class="tm">🔋 '+Math.round(p.arrivePct)+'% · '+clock(planStart+totalSec(r)*1000)+'</div></div>');
    h.push('</div>');
    if(p.lowArrival)h.push('<div class="warn">დანიშნულებაში ბატარეა მინიმუმზე დაბალი იქნება. ერთი დამატებითი დატენვა ან უფრო ეკონომიური მგზავრობა გირჩევნია.</div>');
    h.push('<p class="lab" style="margin-top:18px">ბატარეა გზაზე</p>'+chartSvg(r));
    var o=dests[0],wp=[];p.stops.forEach(function(st){wp.push(st.s.lat+","+st.s.lon)});
    var gm="https://www.google.com/maps/dir/?api=1&travelmode=driving&origin="+o.lat+","+o.lon+"&destination="+dest.lat+","+dest.lon+(wp.length?"&waypoints="+encodeURIComponent(wp.join("|")):"");
    h.push('<div class="two" style="margin-top:14px"><button class="soft" id="savePlan">შენახვა</button><button class="soft" id="shareBtn">ბმულის გაზიარება</button></div><a class="light wide" style="margin-top:10px" href="'+gm+'" target="_blank" rel="noopener">ნავიგაცია Google Maps-ით</a>');
    h.push('<p class="hint">გამოთვლა მიახლოებითია: დრო დამოკიდებულია ამინდზე, ბატარეის ტემპერატურაზე და სადგურზე. ვერ ვამოწმებთ, მუშაობს თუ არა სადგური ამ წუთას.</p>');
    $("rBody").innerHTML=h.join("");
    $("rBody").querySelectorAll("[data-stop]").forEach(function(b){b.addEventListener("click",function(){
      var st=p.stops[parseInt(b.getAttribute("data-stop"),10)];openCharger(st.s)})});
    $("savePlan").addEventListener("click",savePlan);
    $("shareBtn").addEventListener("click",copyLink);
  }

  /* ---------- saved plans ---------- */
  function getSaved(){try{return JSON.parse(store.get("evebi_plans")||"[]")}catch(e){return []}}
  function savePlan(){
    var a=getSaved();
    a.unshift({id:Date.now(),title:dests[0].name+" → "+dests[dests.length-1].name,dests:dests,soc:S.soc,car:garage.name});
    store.set("evebi_plans",JSON.stringify(a.slice(0,20)));syncPush();toast("მარშრუტი შენახულია");
  }
  function renderSaved(){
    var a=getSaved(),box=$("savedList");
    if(!a.length){box.innerHTML='<p class="hint">ჯერ არაფერი გაქვს შენახული. მარშრუტის გათვლის შემდეგ დააჭირე „შენახვას“.</p>';return}
    box.innerHTML=a.map(function(p){return '<div class="srow"><button class="sl" data-load="'+p.id+'"><b>'+esc(p.title)+'</b><span>'+esc(p.car||"")+' · '+Math.round(p.soc)+'%</span></button><button class="x" data-del="'+p.id+'" aria-label="წაშლა">×</button></div>'}).join("");
    box.querySelectorAll("[data-load]").forEach(function(b){b.addEventListener("click",function(){
      var p=getSaved().filter(function(x){return String(x.id)===b.getAttribute("data-load")})[0];if(!p)return;
      dests=p.dests;S.soc=p.soc;saveSet();show("dest");plan()})});
    box.querySelectorAll("[data-del]").forEach(function(b){b.addEventListener("click",function(){
      store.set("evebi_plans",JSON.stringify(getSaved().filter(function(x){return String(x.id)!==b.getAttribute("data-del")})));renderSaved()})});
  }

  /* ---------- accounts and reviews (Supabase REST, no library) ---------- */
  var CFG=window.EVEBI_CFG||{},SB_ON=!!(CFG.supabaseUrl&&CFG.supabaseKey),sess=null;
  function sbLoad(){try{sess=JSON.parse(store.get("evebi_sess")||"null")}catch(e){sess=null}}
  function sbSave(){if(sess)store.set("evebi_sess",JSON.stringify(sess));else store.set("evebi_sess","")}
  function jwtPart(t){try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))}catch(e){return {}}}
  function takeAuthHash(){
    var hs=String(location.hash||"");
    if(hs.indexOf("access_token=")<0)return;
    var q=new URLSearchParams(hs.replace(/^#/,"")),at=q.get("access_token");
    if(at){var p=jwtPart(at);sess={access:at,refresh:q.get("refresh_token")||"",exp:Date.now()+(parseInt(q.get("expires_in")||"3600",10)-30)*1000,uid:p.sub||"",email:p.email||""};sbSave()}
    try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}
  }
  function sbRefresh(){
    if(!sess||!sess.refresh)return Promise.resolve(false);
    return fetch(CFG.supabaseUrl+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":CFG.supabaseKey,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:sess.refresh})})
      .then(function(r){if(!r.ok)throw new Error("rf");return r.json()}).then(function(j){
        var p=jwtPart(j.access_token);sess={access:j.access_token,refresh:j.refresh_token,exp:Date.now()+(j.expires_in-30)*1000,uid:p.sub||sess.uid,email:p.email||sess.email};sbSave();return true})
      .catch(function(){sess=null;sbSave();return false});
  }
  function sbReq(path,opt){
    opt=opt||{};
    var go=function(){
      var h=Object.assign({"apikey":CFG.supabaseKey,"Authorization":"Bearer "+((sess&&sess.access)||CFG.supabaseKey)},opt.headers||{});
      return fetch(CFG.supabaseUrl+path,{method:opt.method||"GET",headers:h,body:opt.body});
    };
    if(sess&&sess.exp<Date.now())return sbRefresh().then(go);
    return go();
  }
  function sbSignIn(email){
    var redirect=location.origin+location.pathname;
    return fetch(CFG.supabaseUrl+"/auth/v1/otp?redirect_to="+encodeURIComponent(redirect),{method:"POST",headers:{"apikey":CFG.supabaseKey,"Content-Type":"application/json"},body:JSON.stringify({email:email,create_user:true})})
      .then(function(r){if(!r.ok)throw new Error("otp")});
  }
  function ago(iso){
    if(!iso)return "";var d=(Date.now()-new Date(iso).getTime())/86400000;
    if(d<1)return "დღეს";if(d<2)return "გუშინ";if(d<31)return Math.floor(d)+" დღის წინ";if(d<365)return Math.floor(d/30)+" თვის წინ";return "ერთ წელზე მეტი ხნის წინ";
  }
  var STATUS={worked:"იმუშავა",failed:"არ იმუშავა",partial:"ნაწილობრივ იმუშავა"};
  function stars(n){var s="";for(var i=1;i<=5;i++)s+=i<=Math.round(n)?"★":"☆";return s}
  function renderReviews(s){
    var box=$("revBox");if(!box)return;
    if(!SB_ON){
      var cur=ratingGet(s.id);
      box.innerHTML='<p class="lab">შენი შეფასება</p><div class="stars" id="stars">'+[1,2,3,4,5].map(function(n){return '<button class="star'+(n<=cur?' on':'')+'" data-star="'+n+'" aria-label="'+n+' ვარსკვლავი">★</button>'}).join("")+'</div><p class="hint" style="margin-top:6px">საერთო შეფასებები მალე დაემატება. ახლა ეს მხოლოდ შენს მოწყობილობაზე ინახება.</p>';
      box.querySelectorAll(".star").forEach(function(b){b.addEventListener("click",function(){var n=parseInt(b.getAttribute("data-star"),10);ratingSet(s.id,n);box.querySelectorAll(".star").forEach(function(x){x.classList.toggle("on",parseInt(x.getAttribute("data-star"),10)<=n)})})});
      return;
    }
    box.innerHTML='<p class="hint">შეფასებები იტვირთება…</p>';
    var sid=encodeURIComponent(s.id);
    Promise.all([
      sbReq("/rest/v1/station_stats?station_id=eq."+sid+"&select=*").then(function(r){return r.ok?r.json():[]}).catch(function(){return []}),
      sbReq("/rest/v1/reviews?station_id=eq."+sid+"&order=updated_at.desc&limit=8&select=rating,status,comment,updated_at").then(function(r){return r.ok?r.json():[]}).catch(function(){return []})
    ]).then(function(res){
      var st=res[0][0],list=res[1],h=[];
      if(st&&(st.rating_count>0||st.worked>0||st.failed_30d>0)){
        h.push('<div class="revsum">'+(st.rating_count>0?'<b>'+stars(st.avg_rating)+' '+st.avg_rating+'</b> <span>('+st.rating_count+')</span>':'')+
          (st.last_worked?'<div class="ok2">ბოლოს იმუშავა: '+ago(st.last_worked)+'</div>':'')+
          (st.failed_30d>0?'<div class="bad2">ბოლო 30 დღეში „არ იმუშავა“: '+st.failed_30d+'</div>':'')+'</div>');
      }else h.push('<p class="hint" style="margin-top:0">ამ სადგურზე ჯერ შეფასება არ არის. იყავი პირველი.</p>');
      list.filter(function(x){return x.comment||x.status}).forEach(function(x){
        h.push('<div class="rev"><div class="rh">'+(x.rating?'<span class="rs">'+stars(x.rating)+'</span>':'')+(x.status?'<span class="rt '+x.status+'">'+STATUS[x.status]+'</span>':'')+'<span class="rd">'+ago(x.updated_at)+'</span></div>'+(x.comment?'<p>'+esc(x.comment)+'</p>':'')+'</div>');
      });
      h.push('<div class="revform" id="revForm"></div>');
      box.innerHTML=h.join("");
      renderReviewForm(s);
    });
  }
  function renderReviewForm(s){
    var f=$("revForm");if(!f)return;
    if(!sess){
      f.innerHTML='<p class="lab">დატოვე შეფასება</p><p class="hint" style="margin-top:0">შესასვლელად ჩაწერე ელფოსტა. გამოგიგზავნით ბმულს, პაროლი არ გჭირდება.</p><div class="f"><input id="revEmail" type="email" placeholder="ელფოსტა" autocomplete="email"></div><button class="light wide" id="revLogin">ბმულის გამოგზავნა</button><p class="hint" id="revMsg"></p>';
      $("revLogin").addEventListener("click",function(){
        var em=$("revEmail").value.trim();if(!/^\S+@\S+\.\S+$/.test(em)){$("revMsg").textContent="ჩაწერე სწორი ელფოსტა.";return}
        $("revLogin").disabled=true;
        sbSignIn(em).then(function(){$("revMsg").textContent="გამოგიგზავნეთ ბმული. გახსენი ელფოსტა და დააჭირე ბმულს, შემდეგ დაბრუნდი აქ."}).catch(function(){$("revMsg").textContent="ვერ გავაგზავნეთ. სცადე ცოტა ხანში."}).then(function(){$("revLogin").disabled=false});
      });
      return;
    }
    var st="",rt=0;
    f.innerHTML='<p class="lab">დატოვე შეფასება</p><div class="seg3" id="stSel"><button data-s="worked">იმუშავა</button><button data-s="partial">ნაწილობრივ</button><button data-s="failed">არ იმუშავა</button></div>'+
      '<div class="stars" id="rStars">'+[1,2,3,4,5].map(function(n){return '<button class="star" data-star="'+n+'" aria-label="'+n+' ვარსკვლავი">★</button>'}).join("")+'</div>'+
      '<div class="f" style="margin-top:8px"><textarea id="revText" maxlength="500" rows="3" placeholder="კომენტარი (არასავალდებულო)"></textarea></div>'+
      '<button class="light wide" id="revSend">გაგზავნა</button><p class="hint" id="revMsg"></p><button class="lnk" id="revOut">გასვლა ('+esc(sess.email||"")+')</button>';
    $("stSel").querySelectorAll("button").forEach(function(b){b.addEventListener("click",function(){st=b.getAttribute("data-s");$("stSel").querySelectorAll("button").forEach(function(x){x.classList.toggle("on",x===b)})})});
    $("rStars").querySelectorAll(".star").forEach(function(b){b.addEventListener("click",function(){rt=parseInt(b.getAttribute("data-star"),10);$("rStars").querySelectorAll(".star").forEach(function(x){x.classList.toggle("on",parseInt(x.getAttribute("data-star"),10)<=rt)})})});
    $("revOut").addEventListener("click",function(){sess=null;sbSave();renderReviewForm(s)});
    $("revSend").addEventListener("click",function(){
      var txt=$("revText").value.trim();
      if(!rt&&!st&&!txt){$("revMsg").textContent="აირჩიე ვარსკვლავები, სტატუსი ან დაწერე კომენტარი.";return}
      $("revSend").disabled=true;
      var body={station_id:s.id,rating:rt||null,status:st||null,comment:txt||null,updated_at:new Date().toISOString()};
      sbReq("/rest/v1/reviews?on_conflict=station_id,user_id",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(body)})
        .then(function(r){if(!r.ok)throw new Error("rv"+r.status);toast("მადლობა! შეფასება შენახულია");renderReviews(s)})
        .catch(function(){$("revMsg").textContent="ვერ შევინახეთ. თუ ხელახლა შეგვიდიხარ, სცადე გასვლა და ისევ შესვლა.";$("revSend").disabled=false});
    });
  }

  /* ---------- sync saved data to the user's account ---------- */
  var syncT=null;
  function localBundle(){return {garage:garage,S:S,places:getPlaces(),plans:getSaved()}}
  function syncPush(){
    if(!SB_ON||!sess||!sess.uid)return;
    clearTimeout(syncT);
    syncT=setTimeout(function(){
      sbReq("/rest/v1/user_data?on_conflict=user_id",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
        body:JSON.stringify({user_id:sess.uid,data:localBundle(),updated_at:new Date().toISOString()})}).catch(function(){});
    },1500);
  }
  function syncPull(){
    if(!SB_ON||!sess)return;
    sbReq("/rest/v1/user_data?select=data&limit=1").then(function(r){return r.ok?r.json():[]}).then(function(a){
      var d=a[0]&&a[0].data;
      if(d&&d.garage&&d.garage.saved&&!garage.saved){
        garage=Object.assign(garage,d.garage);if(d.S)S=Object.assign(S,d.S);
        store.set("evebi_garage",JSON.stringify(garage));store.set("evebi_set",JSON.stringify(S));
        if(d.places)store.set("evebi_places",JSON.stringify(d.places));
        if(d.plans)store.set("evebi_plans",JSON.stringify(d.plans));
        applyGarageFilter();renderCarBoxes();
        if($("v-car").classList.contains("on")){viewStack=["home"];show("home",false)}
        toast("შენი მანქანა და პარამეტრები აღდგა");
      }else if(garage.saved){syncPush()}
    }).catch(function(){});
  }
  function renderAccount(){
    var b=$("accBox");
    if(!SB_ON){b.innerHTML='<p class="hint" style="margin-top:0">ანგარიშები მალე დაემატება. მაშინ შენი მანქანა, მისამართები და შეფასებები ყველა მოწყობილობაზე შენახული იქნება.</p>';return}
    if(sess){
      b.innerHTML='<div class="list info"><div class="irow"><span>ელფოსტა</span><b>'+esc(sess.email||"")+'</b></div></div><p class="hint">შენი მანქანა, პარამეტრები, მისამართები და შენახული მარშრუტები ინახება ანგარიშზე და ყველა მოწყობილობაზე გამოჩნდება.</p><button class="soft wide" id="accOut">გასვლა</button>';
      $("accOut").addEventListener("click",function(){sess=null;sbSave();renderAccount()});
      return;
    }
    b.innerHTML='<p class="hint" style="margin-top:0">შესასვლელად ჩაწერე ელფოსტა. გამოგიგზავნით ბმულს, პაროლი არ გჭირდება. შენი მანქანა და შეფასებები ანგარიშზე შეინახება.</p><div class="f"><input id="accEmail" type="email" placeholder="ელფოსტა" autocomplete="email"></div><button class="light wide" id="accGo">ბმულის გამოგზავნა</button><p class="hint" id="accMsg"></p>';
    $("accGo").addEventListener("click",function(){
      var em=$("accEmail").value.trim();if(!/^\S+@\S+\.\S+$/.test(em)){$("accMsg").textContent="ჩაწერე სწორი ელფოსტა.";return}
      $("accGo").disabled=true;
      sbSignIn(em).then(function(){$("accMsg").textContent="გამოგიგზავნეთ ბმული. გახსენი ელფოსტა და დააჭირე ბმულს."}).catch(function(){$("accMsg").textContent="ვერ გავაგზავნეთ. სცადე ცოტა ხანში."}).then(function(){$("accGo").disabled=false});
    });
  }

  /* ---------- charger detail ---------- */
  function ratingGet(id){try{return parseInt((JSON.parse(store.get("evebi_rate")||"{}"))[id]||0,10)}catch(e){return 0}}
  function ratingSet(id,v){var o={};try{o=JSON.parse(store.get("evebi_rate")||"{}")}catch(e){}o[id]=v;store.set("evebi_rate",JSON.stringify(o))}
  function openCharger(s){
    $("cTitle").textContent=s.name;
    var tags=Object.keys(s.conns).map(function(c){return '<span class="tag'+(DC[c]?' fast':'')+'">'+CONN[c]+'</span>'}).join("")||'<span class="tag">კონექტორი მითითებული არ არის</span>';
    var rows=[];
    if(s.operator&&s.operator!==s.name)rows.push(['კომპანია',s.operator]);
    rows.push(['სიმძლავრე',s.power?s.power+' კვტ':'მითითებული არ არის']);
    if(s.cap)rows.push(['ადგილები',s.cap]);
    rows.push(['საათები',s.hours||'მითითებული არ არის']);
    if(s.addr)rows.push(['მისამართი',s.addr]);
    if(s.fee)rows.push(['გადახდა',s.fee==="yes"?"ფასიანია":s.fee==="no"?"უფასოა":s.fee]);
    if(s.partner){if(s.price)rows.push(['ფასი',s.price+' ლარი/კვტსთ']);if(s.pay)rows.push(['როგორ დავიწყო',s.pay]);if(s.phone)rows.push(['ტელეფონი',s.phone])}
    var mail="mailto:contact@evebi.ge?subject="+encodeURIComponent("რუკის შესწორება: "+s.name)+"&body="+encodeURIComponent("სადგური: "+s.name+"\nკოორდინატები: "+s.lat.toFixed(5)+", "+s.lon.toFixed(5)+"\nრა უნდა შეიცვალოს: ");
    $("cBody").innerHTML=(s.partner?'<div class="badge">ოფიციალური მონაცემი</div>':'')+
      '<div class="tags">'+tags+'</div>'+
      '<button class="light wide" id="addPlan">+ მარშრუტში დამატება</button>'+
      '<div class="list info">'+rows.map(function(r){return '<div class="irow"><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>'}).join("")+'</div>'+
      '<p class="lab" style="margin-top:18px">შეფასებები</p><div id="revBox"></div>'+
      '<div class="two" style="margin-top:14px"><a class="soft" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+s.lat+','+s.lon+'">Google Maps</a><a class="soft" href="'+mail+'">შეცდომაა?</a></div>';
    $("addPlan").addEventListener("click",function(){
      var p={name:s.name,lat:s.lat,lon:s.lon};
      if(dests.length===2&&!dests[1])dests[1]=p;
      else dests.splice(dests.length-1,0,p);
      toast("დაემატა მარშრუტში");viewStack=["home"];show("dest");
    });
    renderReviews(s);
    if(map.panTo)map.panTo([s.lat,s.lon]);
    show("charger");
  }

  /* ---------- start ---------- */
  loadState();loadCars();init();loadPartners();renderCarBoxes();applyGarageFilter();
  sbLoad();takeAuthHash();syncPull();
  var sharedTrip=readShare();
  if(sharedTrip){
    if(garage.saved)applyShare(sharedTrip);
    else{pendingShare=sharedTrip;show("car",false);toast("ჯერ აირჩიე შენი მანქანა")}
  } else if(!garage.saved)show("car",false);
})();
