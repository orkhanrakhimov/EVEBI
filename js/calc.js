(function(){
  var D={fuel:3.8,power:0.25,updated:"2026-10-29"};
  var $=function(id){return document.getElementById(id)};
  var fmt=function(n){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g," ")};
  var f1=function(n){return (Math.round(n*10)/10).toString()};
  function num(id){var v=parseFloat(String($(id).value).replace(",","."));return isFinite(v)&&v>=0?v:0}
  function calc(){
    var km=num("km"),pl=num("pl"),pp=num("pp"),el=num("el"),ep=num("ep");
    $("kmOut").textContent=fmt(km);
    var petrol=km/100*pl*pp, ev=km/100*el*ep;
    var max=Math.max(petrol,ev,1);
    $("petrol").textContent=fmt(petrol);$("ev").textContent=fmt(ev);
    $("petrolBar").style.width=(petrol/max*100)+"%";
    $("evBar").style.width=(ev/max*100)+"%";
    var s=petrol-ev;
    $("saveM").textContent=(s<0?"−":"")+fmt(Math.abs(s));
    $("saveY").textContent=(s<0?"−":"")+fmt(Math.abs(s)*12);
    $("p100").textContent=f1(pl*pp);$("e100").textContent=f1(el*ep);
  }
  function init(){
    ["km","pl","pp","el","ep"].forEach(function(id){$(id).addEventListener("input",calc)});
    $("pp").value=D.fuel;$("ep").value=D.power;
    calc();
    fetch("data/prices.json").then(function(r){return r.json()}).then(function(p){
      if(p.fuel_gel_per_l){$("pp").value=p.fuel_gel_per_l}
      if(p.electricity_home_gel_per_kwh){$("ep").value=p.electricity_home_gel_per_kwh}
      if(p.updated){var d=new Date(p.updated+"T00:00:00");
        var m=["იანვარი","თებერვალი","მარტი","აპრილი","მაისი","ივნისი","ივლისი","აგვისტო","სექტემბერი","ოქტომბერი","ნოემბერი","დეკემბერი"];
        $("asof").textContent="ფასები განახლდა: "+d.getDate()+" "+m[d.getMonth()]+", "+d.getFullYear()+"."}
      calc();
    }).catch(function(){});
  }
  init();
})();
