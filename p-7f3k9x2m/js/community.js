(function(){
  var chips=document.querySelectorAll('.chip'),qs=document.querySelectorAll('.q');
  chips.forEach(function(c){c.addEventListener('click',function(){
    chips.forEach(function(x){x.classList.remove('on')});c.classList.add('on');
    var f=c.getAttribute('data-f');
    qs.forEach(function(q){q.hidden=(f!=='all'&&q.getAttribute('data-c')!==f)});
  })});
  var form=document.getElementById('ask');
  if(form)form.addEventListener('submit',function(e){
    e.preventDefault();
    var v=document.getElementById('q').value.trim();
    if(!v)return;
    location.href='mailto:contact@evebi.ge?subject='+encodeURIComponent('კითხვა ელექტრომობილზე')+'&body='+encodeURIComponent(v);
  });
})();
