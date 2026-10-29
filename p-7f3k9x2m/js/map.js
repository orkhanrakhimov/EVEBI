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
  var map=L.map("map",{zoomControl:true,preferCanvas:true}).setView([42.0,43.7],7);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{
    attribution:"&copy; OpenStreetMap, &copy; CARTO",subdomains:"abcd",maxZoom:19}).addTo(map);
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
    var mail="mailto:contact@evebi.ge?subject="+encodeURIComponent("რუკის შესწორება: "+s.name)+"&body="+encodeURIComponent("სადგური: "+s.name+"\nკოორდინატები: "+s.lat.toFixed(5)+", "+s.lon.toFixed(5)+"\nრა უნდა შეიცვალოს: ");
    return '<div class="pop"><h4>'+esc(s.name)+'</h4>'+rows.map(function(r){return '<div class="row">'+r+'</div>'}).join("")+tags+
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
      var icon=L.divIcon({className:"",html:'<div class="dot'+(s.fast?' fast':'')+'"></div>',iconSize:[14,14],iconAnchor:[7,7]});
      var m=L.marker([s.lat,s.lon],{icon:icon,title:s.name});
      m.bindPopup(function(){return popup(s)});
      markers.push(m);
    });
    cluster.addLayers(markers);
    $("status").textContent=stations.length?("ნაჩვენებია "+n+" სადგური "+stations.length+"-დან"):$("status").textContent;
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
  function setStations(els){
    var seen={};
    stations=els.map(parseStation).filter(function(s){if(!s||seen[s.id])return false;seen[s.id]=1;return true});
    render();
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
  var garage={name:"",range:300,conn:"",res:15};
  function loadGarage(){try{var g=JSON.parse(store.get("evebi_garage")||"null");if(g)garage=Object.assign(garage,g)}catch(e){}}
  function fillGarage(){$("gName").value=garage.name||"";$("gRange").value=garage.saved?garage.range:"";$("gConn").value=garage.conn||"";$("gRes").value=garage.res}
  function carLine(){
    $("carLine").textContent=garage.saved?("მანქანა: "+(garage.name||"ჩემი მანქანა")+", დიაპაზონი "+garage.range+" კმ"+(garage.conn?", "+CONN[garage.conn]:"")):"მანქანა არ არის შენახული: ვიყენებთ 300 კმ-ს. დაამატე „ჩემი გარაჟი“ ჩანართში.";
  }
  $("saveGarage").addEventListener("click",function(){
    var r=parseFloat($("gRange").value),res=parseFloat($("gRes").value);
    if(!(r>=50&&r<=1000)){$("gMsg").textContent="ჩაწერე დიაპაზონი 50-დან 1000 კმ-მდე.";return}
    garage={name:$("gName").value.trim(),range:r,conn:$("gConn").value,res:(res>=5&&res<=40)?res:15,saved:true};
    store.set("evebi_garage",JSON.stringify(garage));
    $("gMsg").textContent="შენახულია.";
    carLine();applyGarageFilter();
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

  /* ---------- route ---------- */
  var names=Object.keys(CITIES);
  [$("from"),$("to")].forEach(function(sel,i){names.forEach(function(n){var o=document.createElement("option");o.value=n;o.textContent=n;sel.appendChild(o)});sel.value=i===0?"თბილისი":"ბათუმი"});

  function hav(a,b){var R=6371,dLa=(b[0]-a[0])*Math.PI/180,dLo=(b[1]-a[1])*Math.PI/180;
    var x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return 2*R*Math.asin(Math.sqrt(x))}

  /* planStops: pure function, exported for tests.
     pts: [[lat,lon],...] route; cands: stations; range km; res fraction.
     First leg starts from a full battery. After each charge we assume 80%. */
  function planStops(pts,cands,range,res){
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
    near.sort(function(a,b){return a.along-b.along});
    var firstLeg=range*(1-res),nextLeg=range*(0.8-res);
    if(nextLeg<=20)nextLeg=20;
    var pos=0,leg=firstLeg,stops=[],gap=null;
    if(total<=leg)return {total:total,stops:[],gap:null,firstLeg:firstLeg,nextLeg:nextLeg};
    var guard=0;
    while(total-pos>leg&&guard++<20){
      var pick=null;
      near.forEach(function(n){if(n.along>pos+1&&n.along<=pos+leg&&(!pick||n.along>pick.along))pick=n});
      if(!pick){gap={from:pos,to:Math.min(pos+leg,total)};break}
      stops.push(pick);pos=pick.along;leg=nextLeg;
    }
    return {total:total,stops:stops,gap:gap,firstLeg:firstLeg,nextLeg:nextLeg};
  }
  window.__planStops=planStops;

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
  function renderRoute(coords,plan,dur){
    var out=$("routeOut"),h=[];
    var hrs=dur?Math.floor(dur/3600):0,min=dur?Math.round((dur%3600)/60):0;
    h.push('<p class="sum">'+fmtKm(plan.total)+(dur?', დაახლოებით '+(hrs?hrs+' სთ ':'')+min+' წთ':'')+'</p>');
    h.push('<p class="sub">'+(plan.stops.length?plan.stops.length+' დატენვის გაჩერება':'დატენვის გარეშე')+'. დაშვება: პირველი მონაკვეთი სრული ბატარეით, შემდეგ დატენვა 80%-მდე და '+Math.round(garage.res)+'% მარაგი.</p>');
    if(!plan.stops.length&&!plan.gap)h.push('<div class="ok">ეს გზა ერთი დატენვით გაგივლია '+fmtKm(plan.firstLeg)+'-მდე უსაფრთხო მანძილით.</div>');
    if(plan.stops.length){
      h.push('<ul class="stops">'+plan.stops.map(function(st,i){
        return '<li data-i="'+i+'"><span class="n">'+(i+1)+'</span><div><b>'+esc(st.s.name)+'</b><span>გზის '+fmtKm(st.along)+'-ზე'+(st.off>0.3?', გზიდან '+st.off.toFixed(1)+' კმ-ზე':'')+(st.s.fast?', სწრაფი':'')+'</span></div></li>';
      }).join("")+'</ul>');
    }
    if(plan.gap)h.push('<div class="warn">გზის '+fmtKm(plan.gap.from)+'–'+fmtKm(plan.gap.to)+' მონაკვეთზე შენი კონექტორისთვის სადგური ვერ ვიპოვეთ. ეს შეიძლება ნიშნავდეს, რომ რუკაზე მონაცემი აკლია. შეამოწმე სადგური ადგილზე ან მოგვწერე.</div>');
    h.push('<p class="hint">სადგურების მონაცემი OpenStreetMap-იდანაა და შეიძლება არასრული იყოს. ვერ ვამოწმებთ, მუშაობს თუ არა სადგური ამ წუთას.</p>');
    out.innerHTML=h.join("");
    out.querySelectorAll(".stops li").forEach(function(li){li.addEventListener("click",function(){
      var st=plan.stops[parseInt(li.getAttribute("data-i"),10)];map.setView([st.s.lat,st.s.lon],13)})});
  }
  $("goRoute").addEventListener("click",function(){
    var a=CITIES[$("from").value],b=CITIES[$("to").value];
    if(!a||!b||$("from").value===$("to").value){$("routeOut").innerHTML='<div class="warn">აირჩიე ორი სხვადასხვა ადგილი.</div>';return}
    var btn=$("goRoute");btn.disabled=true;btn.textContent="მარშრუტი ითვლება…";
    var url="https://router.project-osrm.org/route/v1/driving/"+a[1]+","+a[0]+";"+b[1]+","+b[0]+"?overview=full&geometries=geojson";
    fetch(url).then(function(r){if(!r.ok)throw new Error("route");return r.json()}).then(function(j){
      var rt=j.routes&&j.routes[0];if(!rt)throw new Error("noroute");
      var pts=rt.geometry.coordinates.map(function(c){return [c[1],c[0]]});
      var cands=stations.filter(function(s){return !garage.conn||!s.known||s.conns[garage.conn]});
      var range=garage.saved?garage.range:300,res=(garage.res||15)/100;
      var plan=planStops(pts,cands,range,res);
      showRoute(pts,plan,rt.duration);renderRoute(pts,plan,rt.duration);
      if(window.innerWidth<=820)$("map").scrollIntoView({behavior:"smooth"});
    }).catch(function(){
      $("routeOut").innerHTML='<div class="warn">მარშრუტის გამოთვლა ვერ მოხერხდა. სცადე ცოტა ხანში.</div>';
    }).then(function(){btn.disabled=false;btn.textContent="გამოთვალე მარშრუტი"});
  });

  loadGarage();fillGarage();carLine();init();applyGarageFilter();
})();
