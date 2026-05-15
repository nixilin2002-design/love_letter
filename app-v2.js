// ══ APP V2 PATCH: envelope animation, map long-press, wish-done memory ══
(function(){
'use strict';

// ── A. Envelope animation override ──
window.openLetter=function(){
  const stage=document.getElementById('envelopeStage');
  if(!stage||stage.classList.contains('opening')||stage.classList.contains('opened'))return;
  spawnEnvBurst();
  stage.classList.add('opening');
  setTimeout(()=>{
    stage.classList.add('opened');
    setTimeout(()=>{
      const m=document.getElementById('messageText');
      if(m)m.classList.add('visible');
    },250);
  },920);

  // ✅ Fix: Use typeof guard so this never throws if storageKey() isn't defined yet
  try{
    const key = typeof storageKey === 'function' ? storageKey() : 'ltr_' + new Date().toDateString();
    localStorage.setItem(key, '1');
  }catch(e){}

  const note=document.getElementById('openedNote');
  if(note)note.style.opacity='1';
};

function spawnEnvBurst(){
  const c=document.getElementById('envBurst');if(!c)return;c.innerHTML='';
  const items=['❤','✿','♥','✦','♡','✧','❀','♥'];
  for(let i=0;i<14;i++){
    const ang=(Math.PI*2)*(i/14)+(Math.random()*.4-.2);
    const dist=70+Math.random()*70;
    const s=document.createElement('span');
    s.textContent=items[i%items.length];
    s.style.color=i%2?'var(--rose)':'var(--gold)';
    s.style.setProperty('--bx',(Math.cos(ang)*dist).toFixed(1)+'px');
    s.style.setProperty('--by',(Math.sin(ang)*dist).toFixed(1)+'px');
    s.style.setProperty('--br',(Math.random()*180-90).toFixed(0)+'deg');
    s.style.fontSize=(13+Math.random()*8).toFixed(1)+'px';
    s.style.animationDelay=(Math.random()*.18).toFixed(2)+'s';
    c.appendChild(s);
  }
}

// On load: replace sealed-overlay with envelope structure if not already
function buildEnvelopeMarkup(){
  const wrap=document.querySelector('.envelope-wrap');
  if(!wrap||document.getElementById('envelopeStage'))return;
  const card=wrap.querySelector('.card');if(!card)return;
  const oldOverlay=card.querySelector('#sealedOverlay');
  if(oldOverlay)oldOverlay.remove();
  const dateEl=card.querySelector('.card-date');
  const letterEl=card.querySelector('.card-letter');
  const sigEl=card.querySelector('.card-signature');
  // Build new stage
  const stage=document.createElement('div');
  stage.className='envelope-stage';
  stage.id='envelopeStage';
  stage.innerHTML=`
    <div class="envelope" id="envelope" onclick="openLetter()">
      <div class="env-body"></div>
      <div class="env-stamp"></div>
      <div class="env-addr">致 · 我心上的你<br>第 <span id="envNo">—</span> 封情书</div>
      <div class="env-pocket"></div>
      <div class="env-flap"></div>
      <div class="env-seal"><span class="env-seal-letter">爱</span></div>
      <div class="env-burst" id="envBurst"></div>
    </div>
    <div class="env-hint">轻触，打开今天的信</div>`;
  // Move letter content into a new card.env-letter
  const letterCard=document.createElement('div');
  letterCard.className='card env-letter';
  letterCard.id='envLetter';
  if(dateEl)letterCard.appendChild(dateEl);
  if(letterEl)letterCard.appendChild(letterEl);
  if(sigEl)letterCard.appendChild(sigEl);
  // Insert envelope (before hint) then letter
  stage.insertBefore(letterCard,stage.querySelector('.env-hint'));
  wrap.replaceChild(stage,card);
  // Set envNo
  try{
    const idx=typeof todayIdx==='function'?todayIdx():0;
    const envNo=document.getElementById('envNo');
    if(envNo)envNo.textContent=(idx+1);
  }catch(e){}
  // Restore opened state
  try{
    // ✅ Fix: same typeof guard as openLetter
    const key = typeof storageKey === 'function' ? storageKey() : 'ltr_' + new Date().toDateString();
    if(localStorage.getItem(key)){
      stage.classList.add('opened');
      const m=document.getElementById('messageText');
      if(m)m.classList.add('visible');
    }
  }catch(e){}
}

// ── B. Map long-press handler ──
function patchMapLongPress(){
  if(!window.leafletMap||window.leafletMap.__lpPatched)return;
  window.leafletMap.__lpPatched=true;
  window.leafletMap.on('contextmenu',(e)=>{
    if(e.originalEvent&&e.originalEvent.preventDefault)e.originalEvent.preventDefault();
    openPinModal(e.latlng.lat,e.latlng.lng);
  });
  if(!localStorage.getItem('mapHintShown')){
    const c=document.getElementById('map-container');
    if(c){
      const hint=document.createElement('div');
      hint.className='map-longpress-hint';
      hint.textContent='长按地图任意位置 · 添加足迹';
      c.appendChild(hint);
      setTimeout(()=>hint.remove(),4500);
      localStorage.setItem('mapHintShown','1');
    }
  }
}
// Poll for leaflet readiness
let _mapPollTries=0;
const _mapPoll=setInterval(()=>{
  if(window.leafletMap){clearInterval(_mapPoll);patchMapLongPress();}
  if(++_mapPollTries>180)clearInterval(_mapPoll);
},500);

window.openPinModal=async function(lat,lng){
  document.getElementById('pinLat').value=lat;
  document.getElementById('pinLng').value=lng;
  document.getElementById('pinCity').value='';
  document.getElementById('pinCountry').value='';
  document.getElementById('pinNote').value='';
  document.getElementById('pinDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('pinPhotoData').value='';
  const prev=document.getElementById('pinPhotoPreview');
  prev.style.display='none';prev.removeAttribute('src');
  const status=document.getElementById('pinStatus');
  status.textContent='🔍 正在识别地点…';
  document.getElementById('modalPin').classList.add('show');
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh,en`);
    const d=await r.json();
    const a=d.address||{};
    const city=a.city||a.town||a.village||a.hamlet||a.suburb||a.county||(d.display_name?d.display_name.split(',')[0]:'')||'未知地点';
    const country=a.country||'';
    document.getElementById('pinCity').value=city;
    document.getElementById('pinCountry').value=country;
    status.textContent=`📍 ${city}${country?' · '+country:''} · ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }catch(e){
    status.textContent='地点识别失败，可手动输入';
  }
};

window.handlePinPhoto=function(input){
  const f=input.files[0];if(!f)return;
  compressImage(f,800,0.78).then(d=>{
    document.getElementById('pinPhotoData').value=d;
    const img=document.getElementById('pinPhotoPreview');
    img.src=d;img.style.display='block';
  });
};

window.confirmAddPin=function(){
  const lat=parseFloat(document.getElementById('pinLat').value);
  const lng=parseFloat(document.getElementById('pinLng').value);
  const city=document.getElementById('pinCity').value.trim();
  const country=document.getElementById('pinCountry').value.trim();
  const note=document.getElementById('pinNote').value.trim();
  const date=document.getElementById('pinDate').value||new Date().toISOString().split('T')[0];
  const photo=document.getElementById('pinPhotoData').value||null;
  if(!city){document.getElementById('pinStatus').textContent='请填写地点名';return;}
  const p={city,country,note,lat,lng,date,photo};
  const places=loadPlaces();places.push(p);savePlaces(places);
  if(typeof addMarker==='function')addMarker(p);
  if(window.leafletMap)window.leafletMap.flyTo([lat,lng],10,{duration:1.2});
  if(typeof renderPlaceCards==='function')renderPlaceCards();
  if(typeof updateStats==='function')updateStats();
  closeModal('modalPin');
};

// ── C. Wish-done memory flow ──
let _doneWishIdx=null;
// ✅ Fix Bug 1: 保留原始 toggleWish 逻辑，仅在"未完成"时插入弹窗流程
// 原始函数处理"已完成→撤销"；新逻辑处理"未完成→弹窗记录回忆"
window.toggleWish=function(idx){
  const wishes=loadWishes();
  const w=wishes[idx];if(!w)return;
  if(!w.done){
    // 未完成：打开完成弹窗（带照片/地点/故事）
    openWishDoneModal(idx);
  }else{
    // 已完成→撤销：调用原始逻辑（清除 done 和 memory）
    wishes[idx].done=false;
    delete wishes[idx].memory;
    saveWishes(wishes);
    renderWishlist();
  }
};

window.openWishDoneModal=function(idx){
  _doneWishIdx=idx;
  const w=loadWishes()[idx];
  document.getElementById('doneWishTitle').textContent=w.title;
  document.getElementById('doneNote').value='';
  document.getElementById('donePlace').value='';
  document.getElementById('doneDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('donePhotoData').value='';
  const prev=document.getElementById('donePhotoPreview');
  prev.style.display='none';prev.removeAttribute('src');
  document.getElementById('doneStatus').textContent='';
  document.getElementById('modalDone').classList.add('show');
};

window.handleDonePhoto=function(input){
  const f=input.files[0];if(!f)return;
  compressImage(f,800,0.78).then(d=>{
    document.getElementById('donePhotoData').value=d;
    const img=document.getElementById('donePhotoPreview');
    img.src=d;img.style.display='block';
  });
};

window.skipWishDone=function(){
  if(_doneWishIdx==null){closeModal('modalDone');return;}
  const w=loadWishes();
  if(w[_doneWishIdx]){w[_doneWishIdx].done=true;w[_doneWishIdx].completedAt=Date.now();saveWishes(w);}
  renderWishlist();closeModal('modalDone');_doneWishIdx=null;
};

window.confirmWishDone=async function(){
  if(_doneWishIdx==null)return;
  const wishes=loadWishes();
  const w=wishes[_doneWishIdx];if(!w)return;
  const note=document.getElementById('doneNote').value.trim();
  const place=document.getElementById('donePlace').value.trim();
  const date=document.getElementById('doneDate').value||new Date().toISOString().split('T')[0];
  const photo=document.getElementById('donePhotoData').value||null;
  w.done=true;w.completedAt=Date.now();
  w.memory={note,place,date,photo};
  saveWishes(wishes);
  if(place){
    const status=document.getElementById('doneStatus');
    status.textContent='🌍 同步到足迹中...';
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1&addressdetails=1`,{headers:{'Accept-Language':'zh,en'}});
      const data=await r.json();
      if(data.length){
        const{lat,lon}=data[0];
        const country=(data[0].address&&data[0].address.country)||'';
        const placeObj={city:place,country,note:note?('· '+note.slice(0,40)):('完成 · '+w.title),lat:parseFloat(lat),lng:parseFloat(lon),date,photo,fromWish:w.title};
        const places=loadPlaces();places.push(placeObj);savePlaces(places);
        if(window.leafletMap&&typeof addMarker==='function')addMarker(placeObj);
        if(typeof updateStats==='function')updateStats();
      }
    }catch(e){}
  }
  renderWishlist();
  closeModal('modalDone');
  // ✅ Fix Bug 3: 找到对应心愿卡片的 DOM 元素作为爆炸起点
  // renderWishlist 执行后再找，确保 DOM 已更新
  const _savedIdx = _doneWishIdx;
  _doneWishIdx=null;
  setTimeout(()=>{
    if(typeof launchHeartRain==='function'){
      // 已完成的心愿会排到列表末尾，找到第一个 done 的 wish-item
      const doneItems=document.querySelectorAll('#wishList .wish-item.done');
      const originEl=doneItems.length>0?doneItems[0]:null;
      launchHeartRain(originEl);
    }
  },150);
};

// Override renderWishlist to include memory display
function patchRenderWishlist(){
  if(typeof renderWishlist!=='function'||window.__wishMemPatched)return;
  window.__wishMemPatched=true;
  const orig=window.renderWishlist;
  window.renderWishlist=function(){
    orig();
    // After render, inject memory blocks
    const wishes=loadWishes();
    const items=document.querySelectorAll('#wishList .wish-item');

    // ✅ Fix: Do NOT re-sort here. Use the same filter logic as the original
    // renderWishlist to ensure items[i] matches the correct DOM node.
    // Re-sorting here caused memory blocks to be inserted into the wrong wish card.
    const activeCat=document.querySelector('.wish-cat.active');
    let filter='all';
    if(activeCat&&activeCat.id&&activeCat.id.startsWith('cat-'))filter=activeCat.id.slice(4);
    const filtered=filter==='all'?[...wishes]:wishes.filter(w=>w.cat===filter);
    // Mirror the sort from the original renderWishlist (done items go last)
    filtered.sort((a,b)=>(a.done===b.done)?0:a.done?1:-1);

    filtered.forEach((w,i)=>{
      if(!w.memory)return;
      const item=items[i];if(!item)return;
      const content=item.querySelector('.wish-content');if(!content)return;
      // Guard: don't inject twice
      if(content.querySelector('.wish-memory-thumb,.wish-memory-note,.wish-memory-tag'))return;
      const mem=w.memory;
      const frag=document.createElement('div');
      let html='';
      if(mem.photo)html+=`<img class="wish-memory-thumb" src="${mem.photo}" alt="">`;
      if(mem.note)html+=`<div class="wish-memory-note">${escHtml(mem.note)}</div>`;
      if(mem.place)html+=`<div class="wish-memory-tag">📍 ${escHtml(mem.place)}${mem.date?' · '+mem.date:''}</div>`;
      else if(mem.date)html+=`<div class="wish-memory-tag">✓ 完成于 ${mem.date}</div>`;
      frag.innerHTML=html;
      while(frag.firstChild)content.appendChild(frag.firstChild);
    });
  };
}
function escHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// ── D. Map stats pill style ──
// No JS needed — CSS in index.html + app-v2.css handles the floating pill layout natively.
// switchPage hook kept for future use.
const _origSwitchPage=window.switchPage;
if(typeof _origSwitchPage==='function'){
  window.switchPage=function(name){
    _origSwitchPage(name);
  };
}

// ✅ Fix: Re-register SW daily notification timer every time the app opens.
// SW can be killed by browser at any time; re-sending SCHEDULE_DAILY on
// each page load ensures the timer is always active.
function reRegisterDailyNotif(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.ready.then(reg=>{
    if(reg.active){
      reg.active.postMessage({ type:'SCHEDULE_DAILY', hour:9, minute:0 });
    }
  }).catch(()=>{});
}

// Init after DOM is ready
function init(){
  buildEnvelopeMarkup();
  patchRenderWishlist();
  if(typeof renderWishlist==='function')renderWishlist();
  setTimeout(pillifyStats,400);
  reRegisterDailyNotif();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();

})();
