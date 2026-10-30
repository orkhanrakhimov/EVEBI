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
  function saveGarage(){store.set("evebi_garage",JSON.stringify(garage))}
  function saveSet(){store.set("evebi_set",JSON.stringify(S))}
  function effKwh(g){return g.kwh*(1-(g.deg||0)/100)}
  function rangeOf(g){return g.kwh&&g.cons?effKwh(g)/g.cons*100:0}

  /* ---------- views / navigation ---------- */
  var viewStack=["home"];
  function show(v,push){
    if(push!==false&&viewStack[viewStack.length-1]!==v)viewStack.push(v);
    document.querySelectorAll(".view").forEach(function(x){x.classList.toggle("on",x.id==="v-"+v)});
    $("panel").classList.remove("min");
    var el=$("v-"+v);if(el)el.scrollTop=0;
    if(v==="car"){$("pickList").hidden=false;$("pickConn").hidden=true}
    if(v==="dest")renderDests();
    if(v==="saved")renderSaved();
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
  $("btnMenu").addEventListener("click",function(){show("settings")});

  /* ---------- car box ---------- */
  var CAR_SVG='<svg class="carsvg" viewBox="0 0 240 90" aria-hidden="true"><path d="M10 64Q12 50 42 45L74 27Q82 22 98 22H150Q166 22 176 32L196 45Q230 49 232 64V69Q232 73 226 73H14Q8 73 8 69Z" fill="#d9d6cf"/><path d="M82 30 100 27H148Q158 27 165 34L180 45H70Z" fill="#2a2c30"/><circle cx="58" cy="72" r="16" fill="#111"/><circle cx="58" cy="72" r="8" fill="#5b5f66"/><circle cx="186" cy="72" r="16" fill="#111"/><circle cx="186" cy="72" r="8" fill="#5b5f66"/></svg>';
  function sliderPct(sl){sl.style.setProperty("--p",((sl.value-5)/95*100)+"%")}
  function renderCarBoxes(){
    document.querySelectorAll("[data-box]").forEach(function(b){
      if(!garage.saved){
        b.innerHTML='<h3>მანქანა არ არის არჩეული</h3>'+CAR_SVG+'<button class="light wide" data-pick>აირჩიე მანქანა</button>';
        return;
      }
      var ro=b.classList.contains("ro");
      b.innerHTML='<div class="ch"><h3>'+esc(garage.name||"ჩემი მანქანა")+'</h3>'+(ro?'':'<button class="gear" data-go="vehicle" aria-label="მანქანის პარამეტრები"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></button>')+'</div>'+
        '<div class="cmeta">'+garage.kwh+' კვტსთ · ~'+Math.round(rangeOf(garage))+' კმ'+(garage.conn?' · '+CONN[garage.conn]:'')+'</div>'+CAR_SVG+
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

  /* ---------- car picker ---------- */
  var pending=null;
  function loadCars(){
    fetch("data/cars.json").then(function(r){return r.json()}).then(function(j){CARS=j.cars||[];buildPick()}).catch(function(){});
  }
  function buildPick(){
    var box=$("carList");box.innerHTML="";
    CARS.forEach(function(c){
      var b=document.createElement("button");b.className="car";
      b.innerHTML='<b>'+esc(c.name)+'</b><span>'+c.kwh+' კვტსთ · ~'+Math.round(c.kwh/c.cons*100)+' კმ</span>';
      b.addEventListener("click",function(){
        pending=c;$("pickName").textContent=c.name;$("pickList").hidden=true;$("pickConn").hidden=false;
        var sel=c.conn||"";document.querySelectorAll("#pickChips .chip").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-k")===sel)});
        $("pickGo").disabled=!sel;$("pickGo").setAttribute("data-k",sel);
      });
      box.appendChild(b);
    });
  }
  document.querySelectorAll("#pickChips .chip").forEach(function(ch){ch.addEventListener("click",function(){
    document.querySelectorAll("#pickChips .chip").forEach(function(x){x.classList.toggle("on",x===ch)});
    $("pickGo").setAttribute("data-k",ch.getAttribute("data-k"));$("pickGo").disabled=false;
  })});
  $("pickBack").addEventListener("click",function(){$("pickList").hidden=false;$("pickConn").hidden=true});
  $("pickGo").addEventListener("click",function(){
    if(!pending)return;
    garage={carId:pending.id,name:pending.name,kwh:pending.kwh,cons:pending.cons,dc:pending.dc,deg:0,conn:$("pickGo").getAttribute("data-k"),saved:true};
    saveGarage();applyGarageFilter();
    viewStack=["home"];show("home",false);
  });
  $("pickOther").addEventListener("click",function(){
    garage={carId:"other",name:"ჩემი მანქანა",kwh:60,cons:17,dc:100,deg:0,conn:"",saved:true};
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
    return true;
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
    render();
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
    function popular(){return POPULAR.map(function(c){return {name:c[0],lat:c[1],lon:c[2]}})}
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

  /* ---------- destinations ---------- */
  function renderDests(){
    var box=$("destRows");box.innerHTML="";
    dests.forEach(function(d,i){
      var last=i===dests.length-1,first=i===0;
      var row=document.createElement("div");row.className="drow";
      var ph=first?"საიდან":last?"სად":"გაჩერება";
      row.innerHTML='<span class="dm '+(first?"a":last?"z":"v")+'"></span><div class="sbox"><input type="search" autocomplete="off" placeholder="'+ph+'" value="'+esc(d?d.name:"")+'" aria-label="'+ph+'"><div class="sugg" hidden></div></div>'+
        (!first&&!last?'<button class="x" aria-label="წაშლა">×</button>':'');
      box.appendChild(row);
      var inp=row.querySelector("input"),lst=row.querySelector(".sugg");
      bindSearch(inp,lst,function(p){dests[i]=p;renderDests()},first);
      var rm=row.querySelector(".x");if(rm)rm.addEventListener("click",function(){dests.splice(i,1);renderDests()});
    });
    $("planMsg").innerHTML="";
  }
  $("addStop").addEventListener("click",function(){dests.splice(dests.length-1,0,null);renderDests()});
  $("planBtn").addEventListener("click",function(){plan()});

  /* ---------- trip planner (pure, exported for tests) ----------
     car: {kwh (effective), cons (kWh/100km incl. conditions), dc}
     o: {minC,minD,maxC} percents. Timeline entries are {d:km, soc:%}. */
  function planTrip(pts,cands,car,startPct,o){
    var cum=[0];for(var i=1;i<pts.length;i++)cum.push(cum[i-1]+hav(pts[i-1],pts[i]));
    var total=cum[cum.length-1];
    var near=[];
    cands.forEach(function(s){
      var best=Infinity,bi=-1;
      for(var i=0;i<pts.length;i+=1){var d=Math.abs(pts[i][0]-s.lat)+Math.abs(pts[i][1]-s.lon);if(d<best){best=d;bi=i}}
      if(bi<0)return;
      var dist=hav(pts[bi],[s.lat,s.lon]);
      if(dist<=4)near.push({s:s,along:cum[bi],off:dist});
    });
    var e=car.cons/100,kwh=car.kwh,resC=kwh*o.minC/100,resD=kwh*o.minD/100,cap=kwh*o.maxC/100;
    var soc=kwh*startPct/100,pos=0,stops=[],guard=0;
    var res={total:total,stops:stops,gap:null,arrivePct:null,startLow:false,lowArrival:false,chargeMin:0,timeline:[{d:0,soc:startPct}],cum:cum};
    if(soc<=resC){res.startLow=true;return res}
    while(guard++<25){
      if(total-pos<=(soc-resD)/e){
        var fin=Math.max(0,(soc-(total-pos)*e)/kwh*100);res.arrivePct=fin;res.timeline.push({d:total,soc:fin});return res}
      var reach=(soc-resC)/e;
      var inR=near.filter(function(n){return n.along>pos+1&&n.along<=pos+reach});
      var fastR=inR.filter(function(n){return n.s.fast});
      var pool=fastR.length?fastR:inR,pick=null;
      pool.forEach(function(n){if(!pick||n.along>pick.along)pick=n});
      if(!pick){
        if(total-pos<=reach){var f2=Math.max(0,(soc-(total-pos)*e)/kwh*100);res.arrivePct=f2;res.timeline.push({d:total,soc:f2});res.lowArrival=true;return res}
        res.gap={from:pos,to:Math.min(pos+reach,total)};return res}
      var arrive=soc-(pick.along-pos)*e;
      var need=(total-pick.along)*e+resD+kwh*0.03;
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
  function carForPlan(){
    var cond=S.cond||1;
    return garage.saved?{kwh:effKwh(garage),cons:garage.cons*cond,dc:garage.dc}:{kwh:60,cons:17*cond,dc:100};
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
      var cands=stations.filter(function(s){return !garage.conn||!s.known||s.conns[garage.conn]});
      var car=carForPlan();
      routes=j.routes.slice(0,3).map(function(rt){
        var pts=rt.geometry.coordinates.map(function(c){return [c[1],c[0]]});
        return {pts:pts,dur:rt.duration,plan:planTrip(pts,cands,car,S.soc,S)};
      });
      selRoute=0;planStart=Date.now();
      show("route");drawRoute();
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
    var resY=y(S.minC);
    return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="ბატარეის დონე გზაზე">'+grid+'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+resY+'" y2="'+resY+'" class="rl"/><path d="'+path+'" class="cl"/>'+xt+'</svg>';
  }
  function renderRoutePanel(){
    var r=routes[selRoute],p=r.plan;
    var dest=dests[dests.length-1];
    $("rTitle").textContent=dest?dest.name:"";
    $("alts").innerHTML=routes.length>1?routes.map(function(o,i){return '<button class="altb'+(i===selRoute?' on':'')+'" data-alt="'+i+'">'+fmtMin(totalSec(o)/60)+'</button>'}).join(""):"";
    $("alts").querySelectorAll("[data-alt]").forEach(function(b){b.addEventListener("click",function(){selRoute=parseInt(b.getAttribute("data-alt"),10);drawRoute()})});
    var h=[];
    if(p.startLow){$("rBody").innerHTML='<div class="warn">გასვლისას ბატარეა მინიმუმზე ნაკლებია. ჯერ დატენე ან შეამცირე მინიმუმი პარამეტრებში.</div>';return}
    var kwhUsed=Math.round(p.total*carForPlan().cons/100);
    h.push('<div class="sumcard"><div class="big">'+fmtMin(totalSec(r)/60)+'</div><div class="chipsrow"><span>🚗 '+fmtMin(r.dur/60)+'</span><span>⚡ '+fmtMin(p.chargeMin)+'</span><span>'+fmtKm(p.total)+'</span><span>'+p.stops.length+' გაჩერება</span><span>'+kwhUsed+' კვტსთ</span></div></div>');
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
    h.push('<div class="two" style="margin-top:14px"><button class="soft" id="savePlan">შენახვა</button><a class="light" href="'+gm+'" target="_blank" rel="noopener">ნავიგაცია</a></div>');
    h.push('<p class="hint">გამოთვლა მიახლოებითია: დრო დამოკიდებულია ამინდზე, ბატარეის ტემპერატურაზე და სადგურზე. ვერ ვამოწმებთ, მუშაობს თუ არა სადგური ამ წუთას.</p>');
    $("rBody").innerHTML=h.join("");
    $("rBody").querySelectorAll("[data-stop]").forEach(function(b){b.addEventListener("click",function(){
      var st=p.stops[parseInt(b.getAttribute("data-stop"),10)];openCharger(st.s)})});
    $("savePlan").addEventListener("click",savePlan);
  }

  /* ---------- saved plans ---------- */
  function getSaved(){try{return JSON.parse(store.get("evebi_plans")||"[]")}catch(e){return []}}
  function savePlan(){
    var a=getSaved();
    a.unshift({id:Date.now(),title:dests[0].name+" → "+dests[dests.length-1].name,dests:dests,soc:S.soc,car:garage.name});
    store.set("evebi_plans",JSON.stringify(a.slice(0,20)));toast("მარშრუტი შენახულია");
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
    var cur=ratingGet(s.id);
    var stars=[1,2,3,4,5].map(function(n){return '<button class="star'+(n<=cur?' on':'')+'" data-star="'+n+'" aria-label="'+n+' ვარსკვლავი">★</button>'}).join("");
    $("cBody").innerHTML=(s.partner?'<div class="badge">ოფიციალური მონაცემი</div>':'')+
      '<div class="tags">'+tags+'</div>'+
      '<button class="light wide" id="addPlan">+ მარშრუტში დამატება</button>'+
      '<div class="list info">'+rows.map(function(r){return '<div class="irow"><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>'}).join("")+'</div>'+
      '<p class="lab">შენი შეფასება</p><div class="stars" id="stars">'+stars+'</div><p class="hint" style="margin-top:6px">ახლა შეფასება მხოლოდ შენს მოწყობილობაზე ინახება. საერთო შეფასებები და „იმუშავა / არ იმუშავა“ მალე დაემატება.</p>'+
      '<div class="two" style="margin-top:14px"><a class="soft" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+s.lat+','+s.lon+'">Google Maps</a><a class="soft" href="'+mail+'">შეცდომაა?</a></div>';
    $("addPlan").addEventListener("click",function(){
      var p={name:s.name,lat:s.lat,lon:s.lon};
      if(dests.length===2&&!dests[1])dests[1]=p;
      else dests.splice(dests.length-1,0,p);
      toast("დაემატა მარშრუტში");viewStack=["home"];show("dest");
    });
    $("stars").querySelectorAll(".star").forEach(function(b){b.addEventListener("click",function(){
      var n=parseInt(b.getAttribute("data-star"),10);ratingSet(s.id,n);
      $("stars").querySelectorAll(".star").forEach(function(x){x.classList.toggle("on",parseInt(x.getAttribute("data-star"),10)<=n)})})});
    if(map.panTo)map.panTo([s.lat,s.lon]);
    show("charger");
  }

  /* ---------- start ---------- */
  loadState();loadCars();init();loadPartners();renderCarBoxes();applyGarageFilter();
  if(!garage.saved)show("car",false);
})();
