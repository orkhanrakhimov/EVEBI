(function(){
  "use strict";
  var $=function(id){return document.getElementById(id)};
  var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

  var CITIES={
    "თბილისი":[41.7151,44.8271],"ბათუმი":[41.6168,41.6367],"ქუთაისი":[42.2679,42.6946],"რუსთავი":[41.5495,45.0050],
    "გორი":[41.9842,44.1089],"თელავი":[41.9198,45.4735],"გუდაური":[42.4775,44.4800],"ბორჯომი":[41.8396,43.3794],
    "ზუგდიდი":[42.5088,41.8709],"მესტია":[43.0450,42.7277],"ფოთი":[42.1462,41.6728],"ახალციხე":[41.6392,42.9825],
    "სიღნაღი":[41.6192,45.9216],"ყაზბეგი":[42.6567,44.6428],"მცხეთა":[41.8454,44.7186],"ოზურგეთი":[41.9244,42.0017]
  };
  var CONN={ccs:"CCS2",type2:"Type 2",chademo:"CHAdeMO",tesla:"Tesla",gbt:"GB/T"};
  var DC={ccs:1,chademo:1,gbt:1};

  /* ---------- map ---------- */
  var map=L.map("map",{zoomControl:false,preferCanvas:true}).setView([42.0,43.7],7);
  if(L.control&&L.control.zoom)L.control.zoom({position:"topright"}).addTo(map);
  $("grab").addEventListener("click",function(){$("panel").classList.toggle("min")});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
    attribution:"&copy; OpenStreetMap contributors",maxZoom:19,className:"dark-tiles"}).addTo(map);
  var cluster=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:50});
  map.addLayer(cluster);
  var routeLayer=L.layerGroup().addTo(map);

  /* ---------- station parsing ---------- */
  var stations=[];
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
    var known=Object.keys(conns).length>0;
    return {id:el.type+el.id,lat:lat,lon:lon,
      name:t.name||t.operator||t.brand||"დამტენი სადგური",operator:t.operator||t.brand||"",
      conns:conns,known:known,power:power,fast:fast,fee:t.fee||"",hours:t.opening_hours||"",
      cap:t.capacity||"",addr:[t["addr:street"],t["addr:housenumber"],t["addr:city"]].filter(Boolean).join(", ")};
  }
  function popup(s){
    var tags=Object.keys(s.conns).map(function(c){return '<span class="tag'+(DC[c]?' fast':'')+'">'+CONN[c]+'</span>'}).join("");
    if(!s.known)tags='<span class="tag">კონექტორი მითითებული არ არის</span>';
    var rows=[];
    if(s.operator&&s.operator!==s.name)rows.push(esc(s.operator));
    if(s.addr)rows.push(esc(s.addr));
    if(s.power)rows.push("სიმძლავრე: "+s.power+" კვტ");
    if(s.cap)rows.push("ადგილები: "+esc(s.cap));
    if(s.fee)rows.push("ფასიანია: "+esc(s.fee==="yes"?"დიახ":s.fee==="no"?"არა":s.fee));
    if(s.hours)rows.push("საათები: "+esc(s.hours));
    if(s.partner){
      if(s.price)rows.push("ფასი: "+esc(s.price)+" ლარი/კვტსთ");
      if(s.pay)rows.push("გადახდა: "+esc(s.pay));
      if(s.phone)rows.push("ტელ: "+esc(s.phone));
    }
    var mail="mailto:contact@evebi.ge?subject="+encodeURIComponent("რუკის შესწორება: "+s.name)+"&body="+encodeURIComponent("სადგური: "+s.name+"\nკოორდინატები: "+s.lat.toFixed(5)+", "+s.lon.toFixed(5)+"\nრა უნდა შეიცვალოს: ");
    return '<div class="pop"><h4>'+esc(s.name)+'</h4>'+(s.partner?'<div class="badge">ოფიციალური მონაცემი</div>':'')+rows.map(function(r){return '<div class="row">'+r+'</div>'}).join("")+tags+
      '<br><a class="rep" href="'+mail+'">შეცდომაა ან ინფორმაცია აკლია?</a></div>';
  }

  /* ---------- filters ---------- */
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
      m.bindPopup(function(){return popup(s)});
      markers.push(m);
    });
    cluster.addLayers(markers);
    $("status").textContent=stations.length?("ნაჩვენებია "+n+" სადგური "+stations.length+"-დან"+(partners.length?" (მათგან "+partners.length+" ოფიციალური)":"")):$("status").textContent;
  }

  /* ---------- load stations ---------- */
  var QUERY='[out:json][timeout:60];nwr["amenity"="charging_station"](41.0,40.0,43.7,46.8);out center tags;';
  var ENDPOINTS=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
  function loadFrom(i){
    if(i>=ENDPOINTS.length)return Promise.reject(new Error("fail"));
    return fetch(ENDPOINTS[i],{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"data="+encodeURIComponent(QUERY)})
      .then(function(r){if(!r.ok)throw new Error("http "+r.status);return r.json()})
      .catch(function(){return loadFrom(i+1)});
  }
  var partners=[],osmEls=[];
  function setStations(els){
    osmEls=els;rebuild();
  }
  function rebuild(){
    var seen={};
    var osm=osmEls.map(parseStation).filter(function(s){if(!s||seen[s.id])return false;seen[s.id]=1;return true});
    osm=osm.filter(function(s){return !partners.some(function(p){return hav([p.lat,p.lon],[s.lat,s.lon])<0.08})});
    stations=osm.concat(partners);
    render();
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

  /* ---------- garage ---------- */
  var garage={carId:"",name:"",kwh:0,cons:0,dc:0,conn:"",res:15,saved:false};
  var CARS=[];
  function rangeOf(g){return g.kwh&&g.cons?g.kwh/g.cons*100:0}
  function loadGarage(){try{var g=JSON.parse(store.get("evebi_garage")||"null");
    if(g){ if(!g.kwh&&g.range){g.kwh=Math.round(g.range*0.17);g.cons=17;g.dc=g.dc||50}
      garage=Object.assign(garage,g)}}catch(e){}}
  function fillGarage(){
    $("gCar").value=garage.carId||"";
    $("gNameWrap").hidden=garage.carId!=="other";
    $("gName").value=garage.name||"";
    $("gKwh").value=garage.kwh||"";$("gCons").value=garage.cons||"";$("gDc").value=garage.dc||"";
    $("gConn").value=garage.conn||"";$("gRes").value=garage.res;rangeOut();
  }
  function rangeOut(){
    var k=parseFloat($("gKwh").value),c=parseFloat($("gCons").value);
    $("gRangeOut").textContent=(k>0&&c>0)?("დაახლოებით "+Math.round(k/c*100)+" კმ ერთი დატენვით (რეალური მგზავრობისას)"):"";
  }
  function loadCars(){
    var sel=$("gCar");
    fetch("data/cars.json").then(function(r){return r.json()}).then(function(j){
      CARS=j.cars||[];
      CARS.forEach(function(c){var o=document.createElement("option");o.value=c.id;o.textContent=c.name;sel.appendChild(o)});
      var o=document.createElement("option");o.value="other";o.textContent="სხვა მანქანა (ხელით)";sel.appendChild(o);
      fillGarage();buildPick();
    }).catch(function(){
      var o=document.createElement("option");o.value="other";o.textContent="სხვა მანქანა (ხელით)";sel.appendChild(o);fillGarage();
    });
  }
  $("gCar").addEventListener("change",function(){
    var id=$("gCar").value;$("gNameWrap").hidden=id!=="other";
    var c=CARS.filter(function(x){return x.id===id})[0];
    if(c){$("gKwh").value=c.kwh;$("gCons").value=c.cons;$("gDc").value=c.dc;if(c.conn)$("gConn").value=c.conn;$("gName").value=c.name}
    rangeOut();
  });
  ["gKwh","gCons"].forEach(function(id){$(id).addEventListener("input",rangeOut)});
  function carLine(){
    var c=$("carCard");
    if(!garage.saved){c.hidden=true;return}
    c.hidden=false;
    c.innerHTML='<div><b>'+esc(garage.name||"ჩემი მანქანა")+'</b><span>'+garage.kwh+' კვტსთ · დაახლოებით '+Math.round(rangeOf(garage))+' კმ'+(garage.conn?' · '+CONN[garage.conn]:'')+'</span></div><button id="changeCar">შეცვლა</button>';
    $("changeCar").addEventListener("click",enterPick);
  }
  /* ---- first step: choose the car ---- */
  var pending=null;
  function showTab(t){var b=document.querySelector('.tab[data-t="'+t+'"]');if(b)b.click()}
  function enterPick(){
    $("panel").classList.add("onboard");$("panel").classList.remove("min");$("carCard").hidden=true;
    document.querySelectorAll(".tp").forEach(function(x){x.classList.remove("on")});
    $("tp-pick").classList.add("on");$("pickList").hidden=false;$("pickConn").hidden=true;
  }
  function exitPick(tab){
    $("panel").classList.remove("onboard");$("tp-pick").classList.remove("on");carLine();showTab(tab);
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
    garage={carId:pending.id,name:pending.name,kwh:pending.kwh,cons:pending.cons,dc:pending.dc,conn:$("pickGo").getAttribute("data-k"),res:15,saved:true};
    store.set("evebi_garage",JSON.stringify(garage));
    fillGarage();applyGarageFilter();exitPick("route");
  });
  $("pickOther").addEventListener("click",function(){exitPick("garage")});
  $("saveGarage").addEventListener("click",function(){
    var k=parseFloat($("gKwh").value),c=parseFloat($("gCons").value),dc=parseFloat($("gDc").value),res=parseFloat($("gRes").value);
    if(!(k>=10&&k<=200)||!(c>=8&&c<=40)){$("gMsg").textContent="აირჩიე მოდელი ან ჩაწერე ბატარეა (10–200 კვტსთ) და ხარჯი (8–40).";return}
    var id=$("gCar").value,car=CARS.filter(function(x){return x.id===id})[0];
    garage={carId:id,name:car?car.name:($("gName").value.trim()||"ჩემი მანქანა"),kwh:k,cons:c,dc:(dc>=3?dc:50),conn:$("gConn").value,res:(res>=5&&res<=40)?res:15,saved:true};
    store.set("evebi_garage",JSON.stringify(garage));
    $("gMsg").textContent="შენახულია.";
    carLine();applyGarageFilter();showTab("route");
  });
  function applyGarageFilter(){
    if(!garage.conn)return;
    activeConn={};activeConn[garage.conn]=true;
    document.querySelectorAll("#connChips .chip").forEach(function(c){c.classList.toggle("on",c.getAttribute("data-k")===garage.conn)});
    render();
  }

  /* ---------- UI: tabs & chips ---------- */
  document.querySelectorAll(".tab").forEach(function(t){t.addEventListener("click",function(){
    document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("on");x.setAttribute("aria-selected","false")});
    document.querySelectorAll(".tp").forEach(function(x){x.classList.remove("on")});
    t.classList.add("on");t.setAttribute("aria-selected","true");
    $("tp-"+t.getAttribute("data-t")).classList.add("on");
  })});
  document.querySelectorAll("#connChips .chip").forEach(function(c){c.addEventListener("click",function(){
    var k=c.getAttribute("data-k");activeConn[k]=!activeConn[k];c.classList.toggle("on",activeConn[k]);render();
  })});
  $("fastOnly").addEventListener("change",render);
  $("showUnknown").addEventListener("change",render);

  /* ---------- locate me ---------- */
  var userPos=null,meMarker=null;
  function nearestInfo(){
    if(!userPos)return;
    var best=null;
    stations.forEach(function(s){if(!passes(s))return;var d=hav(userPos,[s.lat,s.lon]);if(!best||d<best.d)best={s:s,d:d}});
    if(best)$("status").textContent="უახლოესი სადგური: "+best.s.name+", "+(best.d<10?best.d.toFixed(1):Math.round(best.d))+" კმ";
  }
  $("locate").addEventListener("click",function(){
    var b=$("locate");
    if(!navigator.geolocation){alert("ეს ბრაუზერი მდებარეობას ვერ განსაზღვრავს.");return}
    b.textContent="ვეძებთ…";
    navigator.geolocation.getCurrentPosition(function(p){
      userPos=[p.coords.latitude,p.coords.longitude];
      if(meMarker)map.removeLayer(meMarker);
      meMarker=L.marker(userPos,{icon:L.divIcon({className:"",html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
      map.setView(userPos,12);
      var f=$("from");if(!f.querySelector('option[value="__me"]')){var o=document.createElement("option");o.value="__me";o.textContent="ჩემი მდებარეობა";f.insertBefore(o,f.firstChild)}
      f.value="__me";
      nearestInfo();b.textContent="ჩემი მდებარეობა";
    },function(err){
      b.textContent="ჩემი მდებარეობა";
      $("status").textContent=err&&err.code===1?"მდებარეობაზე წვდომა დაბლოკილია. ბრაუზერის პარამეტრებში ჩართე ლოკაციის უფლება ამ საიტისთვის.":"მდებარეობის განსაზღვრა ვერ მოხერხდა. სცადე თავიდან.";
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  });

  /* ---------- route ---------- */
  var names=Object.keys(CITIES);
  [$("from"),$("to")].forEach(function(sel,i){names.forEach(function(n){var o=document.createElement("option");o.value=n;o.textContent=n;sel.appendChild(o)});sel.value=i===0?"თბილისი":"ბათუმი"});

  function hav(a,b){var R=6371,dLa=(b[0]-a[0])*Math.PI/180,dLo=(b[1]-a[1])*Math.PI/180;
    var x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return 2*R*Math.asin(Math.sqrt(x))}

  /* planTrip: pure function, exported for tests.
     pts: route [[lat,lon]]; cands: stations; car {kwh,cons(kWh/100km, already with conditions),dc};
     startPct, resPct: percent. Charges to 80% (or only as much as needed on the last stop). */
  function planTrip(pts,cands,car,startPct,resPct){
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
    var e=car.cons/100,kwh=car.kwh,reserve=kwh*resPct/100,cap=kwh*0.8;
    var soc=kwh*startPct/100,pos=0,stops=[],gap=null,low=false,guard=0;
    var res={total:total,stops:stops,gap:null,arrivePct:null,startLow:false,chargeMin:0};
    if(soc<=reserve){res.startLow=true;return res}
    while(guard++<25){
      var reach=(soc-reserve)/e;
      if(total-pos<=reach){res.arrivePct=Math.max(0,(soc-(total-pos)*e)/kwh*100);return res}
      var inR=near.filter(function(n){return n.along>pos+1&&n.along<=pos+reach});
      var fastR=inR.filter(function(n){return n.s.fast});
      var pool=fastR.length?fastR:inR,pick=null;
      pool.forEach(function(n){if(!pick||n.along>pick.along)pick=n});
      if(!pick){res.gap={from:pos,to:Math.min(pos+reach,total)};return res}
      var arrive=soc-(pick.along-pos)*e;
      var need=(total-pick.along)*e+reserve+kwh*0.03;
      var target=need<=cap?Math.max(need,arrive):Math.max(cap,arrive);
      var add=target-arrive,p,avg;
      if(pick.s.fast){p=Math.min(car.dc||50,pick.s.power||50);avg=p*0.7}
      else{p=Math.min(11,pick.s.power||7);avg=p*0.95}
      var mins=add>0.2?add/avg*60:0;
      pick.arrivePct=arrive/kwh*100;pick.targetPct=target/kwh*100;pick.addKwh=add;pick.mins=mins;pick.kw=Math.round(avg);
      res.chargeMin+=mins;stops.push(pick);soc=target;pos=pick.along;
    }
    return res;
  }
  window.__planTrip=planTrip;

  var fmtKm=function(n){return Math.round(n)+" კმ"};
  function showRoute(coords,plan,dur){
    routeLayer.clearLayers();
    var line=L.polyline(coords,{color:"#d2354a",weight:5,opacity:.95}).addTo(routeLayer);
    L.marker(coords[0],{icon:L.divIcon({className:"",html:'<div class="endm"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(routeLayer);
    L.marker(coords[coords.length-1],{icon:L.divIcon({className:"",html:'<div class="endm"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(routeLayer);
    plan.stops.forEach(function(st,i){
      var m=L.marker([st.s.lat,st.s.lon],{icon:L.divIcon({className:"",html:'<div class="stopm">'+(i+1)+'</div>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(routeLayer);
      m.bindPopup(popup(st.s));
    });
    map.fitBounds(line.getBounds(),{padding:[40,40]});
  }
  function fmtMin(m){m=Math.round(m);var h=Math.floor(m/60);return (h?h+" სთ ":"")+(m%60)+" წთ"}
  function renderRoute(coords,plan,dur){
    var out=$("routeOut"),h=[];
    var drive=dur||0,totalSec=drive+plan.chargeMin*60;
    h.push('<p class="sum">'+fmtKm(plan.total)+(dur?', გზაში '+fmtMin(drive/60)+(plan.chargeMin?' + დატენვა '+fmtMin(plan.chargeMin):''):'')+'</p>');
    if(plan.startLow){out.innerHTML=h.join("")+'<div class="warn">გასვლისას ბატარეა მარაგის ქვემოთაა. ჯერ დატენე ან შეამცირე მარაგი.</div>';return}
    h.push('<p class="sub">'+(plan.stops.length?plan.stops.length+' დატენვის გაჩერება':'დატენვის გარეშე')+(plan.arrivePct!=null?'. ჩახვალ დაახლოებით '+Math.round(plan.arrivePct)+'% ბატარეით.':'.')+'</p>');
    if(!plan.stops.length&&!plan.gap&&plan.arrivePct!=null)h.push('<div class="ok">ეს გზა ერთი დატენვით გაგივლია.</div>');
    if(plan.stops.length){
      h.push('<ul class="stops">'+plan.stops.map(function(st,i){
        var det=Math.round(st.arrivePct)+'% → '+Math.round(st.targetPct)+'%'+(st.mins?', დაახლოებით '+fmtMin(st.mins)+' ('+st.kw+' კვტ საშუალოდ)':'');
        return '<li data-i="'+i+'"><span class="n">'+(i+1)+'</span><div><b>'+esc(st.s.name)+(st.s.partner?' · ოფიციალური':'')+'</b><span>გზის '+fmtKm(st.along)+'-ზე'+(st.off>0.3?', გზიდან '+st.off.toFixed(1)+' კმ-ზე':'')+(st.s.fast?', სწრაფი':', ნელი დატენვა')+'</span><span>'+det+'</span></div></li>';
      }).join("")+'</ul>');
    }
    if(plan.gap)h.push('<div class="warn">გზის '+fmtKm(plan.gap.from)+'–'+fmtKm(plan.gap.to)+' მონაკვეთზე შენი კონექტორისთვის სადგური ვერ ვიპოვეთ. ეს შეიძლება ნიშნავდეს, რომ რუკაზე მონაცემი აკლია. შეამოწმე სადგური ადგილზე ან მოგვწერე.</div>');
    h.push('<p class="hint">გამოთვლა მიახლოებითია: დატენვის დრო დამოკიდებულია ამინდზე, ბატარეის ტემპერატურაზე და სადგურზე. სადგურების მონაცემი OpenStreetMap-იდანაა და შეიძლება არასრული იყოს. ვერ ვამოწმებთ, მუშაობს თუ არა სადგური ამ წუთას.</p>');
    out.innerHTML=h.join("");
    out.querySelectorAll(".stops li").forEach(function(li){li.addEventListener("click",function(){
      var st=plan.stops[parseInt(li.getAttribute("data-i"),10)];map.setView([st.s.lat,st.s.lon],13)})});
  }
  $("goRoute").addEventListener("click",function(){
    var a=$("from").value==="__me"?userPos:CITIES[$("from").value],b=CITIES[$("to").value];
    if(!a||!b||$("from").value===$("to").value){$("routeOut").innerHTML='<div class="warn">აირჩიე ორი სხვადასხვა ადგილი.</div>';return}
    var sp=parseFloat($("startPct").value);if(!(sp>=5&&sp<=100))sp=90;
    var btn=$("goRoute");btn.disabled=true;btn.textContent="მარშრუტი ითვლება…";
    var url="https://router.project-osrm.org/route/v1/driving/"+a[1]+","+a[0]+";"+b[1]+","+b[0]+"?overview=full&geometries=geojson";
    fetch(url).then(function(r){if(!r.ok)throw new Error("route");return r.json()}).then(function(j){
      var rt=j.routes&&j.routes[0];if(!rt)throw new Error("noroute");
      var pts=rt.geometry.coordinates.map(function(c){return [c[1],c[0]]});
      var cands=stations.filter(function(s){return !garage.conn||!s.known||s.conns[garage.conn]});
      var cond=parseFloat($("cond").value)||1;
      var car=garage.saved?{kwh:garage.kwh,cons:garage.cons*cond,dc:garage.dc}:{kwh:60,cons:17*cond,dc:100};
      var plan=planTrip(pts,cands,car,sp,garage.saved?(garage.res||15):15);
      showRoute(pts,plan,rt.duration);renderRoute(pts,plan,rt.duration);
      if(window.innerWidth<=820)$("map").scrollIntoView({behavior:"smooth"});
    }).catch(function(){
      $("routeOut").innerHTML='<div class="warn">მარშრუტის გამოთვლა ვერ მოხერხდა. სცადე ცოტა ხანში.</div>';
    }).then(function(){btn.disabled=false;btn.textContent="გამოთვალე მარშრუტი"});
  });

  loadGarage();loadCars();carLine();init();loadPartners();applyGarageFilter();
  if(garage.saved)showTab("route");else enterPick();
})();
