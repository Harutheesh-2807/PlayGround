(() => {
  const canvas = document.querySelector('#scene');
  const ctx = canvas.getContext('2d');
  const mapCanvas = document.querySelector('#mapCanvas');
  const map = mapCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const destinations = ['MARKET STREET', 'OLD TOWN', 'HARBOR BRIDGE', 'WATERFRONT'];
  const stopNames = ['Market Street', 'Old Town', 'Harbor Bridge', 'Waterfront'];
  const stops = [420, 1160, 1480, 1090];
  const keys = new Set();
  const state = { started:false, paused:false, speed:0, steer:0, lane:0, distance:0, stopDistance:420, stopIndex:0, passengers:12, rating:4.8, comfort:92, trip:0, time:0, steeringInput:0, speedInput:0, brakeInput:0, camera:false, sound:true, last:performance.now(), elapsed:0, traffic:[], celebration:0, completed:false };
  let width=0, height=0, dpr=1;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const seeded=(n)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};

  function resize(){
    const r=canvas.getBoundingClientRect(); if(!r.width||!r.height)return;
    dpr=Math.min(devicePixelRatio||1,2); width=r.width; height=r.height;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    drawMap();
  }
  function roadCenter(z){return width*.5 + Math.sin((state.distance+z)*.00042)*Math.min(width*.05,48);}
  function proj(x,z){
    const t=1/(1+Math.max(0,z)/110);
    const horizon=height*.355;
    const y=horizon+(height*.61)*Math.pow(t,.92);
    const scale=width*(.013+ .32*Math.pow(t,1.22));
    return {x:roadCenter(z)+(x-state.lane*1.65)*scale,y,t,scale};
  }
  function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function rectPoly(x1,z1,x2,z2,fill){poly([proj(x1,z1),proj(x2,z1),proj(x2,z2),proj(x1,z2)],fill)}
  function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}

  function drawScene(){
    if(!width||!height)return;
    ctx.clearRect(0,0,width,height);
    const horizon=height*.355;
    const sky=ctx.createLinearGradient(0,0,0,horizon+30);sky.addColorStop(0,'#83bdcf');sky.addColorStop(.62,'#b9d8d8');sky.addColorStop(1,'#e6ddbd');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    // warm sunlight and fine haze
    const sunX=width*.76,sunY=height*.17,sunR=Math.min(width,height)*.052;
    const glow=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,sunR*2.7);glow.addColorStop(0,'#fff8d8b8');glow.addColorStop(1,'#fff8d800');ctx.fillStyle=glow;ctx.fillRect(sunX-sunR*3,sunY-sunR*3,sunR*6,sunR*6);
    ctx.fillStyle='#fff4c9';ctx.beginPath();ctx.arc(sunX,sunY,sunR*.54,0,Math.PI*2);ctx.fill();
    drawCloud(width*.15,height*.15,.8);drawCloud(width*.48,height*.11,.55);drawCloud(width*.9,height*.22,.65);
    // distant tree-lined skyline
    ctx.fillStyle='#7fa398';ctx.fillRect(0,horizon-12,width,28);
    for(let i=0;i<34;i++){
      const x=(i/34)*width, rnd=seeded(i+5), bw=width*(.012+rnd*.026), bh=height*(.035+rnd*.095);
      ctx.fillStyle=['#a1b7a5','#829e91','#b3c0aa','#829c8c'][i%4];ctx.fillRect(x,horizon-bh,bw,bh+8);
      if(bw>width*.02){ctx.fillStyle='#d9dfc2aa';for(let j=0;j<3;j++)ctx.fillRect(x+bw*(.2+j*.24),horizon-bh*.76,bw*.1,Math.max(2,bh*.12))}
    }
    ctx.fillStyle='#788d79';ctx.fillRect(0,horizon+8,width,height-horizon);
    // buildings & roadside trees placed consistently in world space
    for(let i=17;i>=0;i--){
      const z=80+i*70-((state.distance*.7)%70); if(z<12)continue;
      for(const side of [-1,1]){
        const idx=i*2+(side>0?1:0), rnd=seeded(idx+11), x=side*(8.1+rnd*2.2), p=proj(x,z), p2=proj(x+side*(2.5+rnd),z), fac=p.t;
        const bw=Math.max(2,Math.abs(p2.x-p.x)), bh=Math.max(4,height*(.07+rnd*.12)*fac), y=p.y-bh;
        const colors=side<0?['#c98e6b','#e2c29a','#b89c7c','#dcaa7e']:['#b98663','#d4c3a0','#a4a78a','#d2a27d'];
        ctx.fillStyle=colors[idx%4];ctx.fillRect(p.x-bw/2,y,bw,bh);
        ctx.fillStyle='#4c6658';ctx.fillRect(p.x-bw/2-2,y-3,bw+4,Math.max(3,fac*7));
        ctx.fillStyle='#f0dfa9';const rows=Math.max(1,Math.floor(bh/14));
        for(let row=0;row<rows;row++)for(let col=0;col<2;col++)ctx.fillRect(p.x-bw*.31+col*bw*.4,y+6+row*11,Math.max(1,bw*.14),Math.max(2,fac*4));
        if(i%3===0){const tp=proj(side*6.8,z-13),tr=Math.max(3,fac*13);ctx.fillStyle='#604b34';ctx.fillRect(tp.x-tr*.13,tp.y-tr*.6,tr*.26,tr*.9);ctx.fillStyle=['#527b55','#63895b','#78945f'][i%3];ctx.beginPath();ctx.arc(tp.x,tp.y-tr,tr,0,Math.PI*2);ctx.fill()}
      }
    }
    // sidewalk, curb, asphalt trapezoids
    for(let z=850;z>0;z-=55){const z2=z-55;const idx=Math.floor((z+state.distance*.65)/55);rectPoly(-11,z,11,z2,idx%2?'#b7b19c':'#bcb59f');rectPoly(-7.3,z,7.3,z2,idx%2?'#4d5150':'#505453');rectPoly(-8.1,z,-7.3,z2,idx%2?'#e1ddc9':'#d3d0be');rectPoly(7.3,z,8.1,z2,idx%2?'#e1ddc9':'#d3d0be');}
    // road markings dashed lines
    for(let line of [-1,1])for(let n=0;n<13;n++){
      let z=(n*43-(state.distance*1.8)%43);if(z<2)z+=43;
      const p1=proj(line*2.45,z),p2=proj(line*2.45,Math.max(0,z-19));
      ctx.strokeStyle='#eee8c9';ctx.lineWidth=Math.max(.7,p1.t*4.5);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    }
    // crosswalk near the approaching stop
    if(state.stopDistance<260&&state.stopDistance>0){const z=state.stopDistance;for(let i=-3;i<=3;i++)rectPoly(i*1.12-.33,z,i*1.12+.33,z-9,'#e8e4d1')}
    // traffic and stop signage
    drawTraffic();drawStopSign();
    // subtle windshield reflections
    const glint=ctx.createLinearGradient(0,0,width*.5,height*.75);glint.addColorStop(0,'#fff2dc16');glint.addColorStop(.35,'#ffffff00');glint.addColorStop(1,'#ffffff0a');ctx.fillStyle=glint;ctx.fillRect(0,0,width,height*.78);
    if(state.camera){ctx.fillStyle='#121b1830';ctx.fillRect(0,0,width,height*.76)}
  }
  function drawCloud(x,y,s){ctx.fillStyle='#eff4eab0';ctx.beginPath();ctx.ellipse(x,y,28*s,8*s,0,0,Math.PI*2);ctx.ellipse(x-15*s,y+1*s,12*s,6*s,0,0,Math.PI*2);ctx.ellipse(x+12*s,y-4*s,15*s,8*s,0,0,Math.PI*2);ctx.fill()}
  function drawTraffic(){
    state.traffic.forEach(car=>{
      car.z-=state.speed/3.6*.62*(1+car.pace)*.016;
      if(car.z<5){car.z=620+Math.random()*450;car.lane=car.lane===-1?1:-1;car.color=['#d7c3a2','#526b69','#b9795e','#d1d5ca'][Math.floor(Math.random()*4)]}
      const p=proj(car.lane*2.45,car.z), fac=p.t, w=Math.max(2,fac*width*.085), h=Math.max(3,fac*height*.105), x=p.x-w/2,y=p.y-h;
      if(y>height*.83)return;
      roundedRect(x,y,w,h,Math.max(1,fac*4),car.color);ctx.fillStyle='#343b36';ctx.fillRect(x+w*.12,y+h*.38,w*.76,h*.28);
      ctx.fillStyle='#a7c7c0';ctx.fillRect(x+w*.18,y+h*.12,w*.64,h*.22);
      ctx.fillStyle='#f3d87c';ctx.fillRect(x+w*.08,y+h*.79,w*.18,h*.1);ctx.fillRect(x+w*.74,y+h*.79,w*.18,h*.1);
      car.screenX=x+w/2;car.screenY=y+h;
    });
  }
  function drawStopSign(){
    if(state.stopDistance<0||state.stopDistance>680)return;
    const z=state.stopDistance;const p=proj(8.15,z), fac=p.t, pole=Math.max(2,fac*height*.17), sign=Math.max(7,fac*width*.065);
    ctx.strokeStyle='#58634f';ctx.lineWidth=Math.max(1,fac*3);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-pole);ctx.stroke();
    ctx.fillStyle='#243b31';ctx.fillRect(p.x-sign/2,p.y-pole-sign*.58,sign,sign*.55);
    ctx.fillStyle='#e6f4ce';ctx.textAlign='center';ctx.font=`${Math.max(4,fac*8)}px monospace`;ctx.fillText('BUS',p.x,p.y-pole-sign*.27);
    ctx.fillStyle='#d8eab2';ctx.fillRect(p.x-sign*.3,p.y-pole-sign*.12,sign*.6,sign*.06);
  }
  function drawMap(){
    const w=mapCanvas.width,h=mapCanvas.height;map.clearRect(0,0,w,h);map.fillStyle='#1b2b26';map.fillRect(0,0,w,h);
    map.strokeStyle='#42554a';map.lineWidth=1;for(let x=8;x<w;x+=17){map.beginPath();map.moveTo(x,0);map.lineTo(x,h);map.stroke()}for(let y=8;y<h;y+=17){map.beginPath();map.moveTo(0,y);map.lineTo(w,y);map.stroke()}
    map.strokeStyle='#c9e883';map.lineWidth=2;map.beginPath();map.moveTo(30,72);map.bezierCurveTo(41,58,50,59,50,44);map.bezierCurveTo(52,30,77,34,81,12);map.stroke();
    map.fillStyle='#edf6da';[[30,72],[50,44],[81,12]].forEach(([x,y])=>{map.beginPath();map.arc(x,y,2,0,Math.PI*2);map.fill()});
    const t=clamp(state.trip/4800,0,1);map.fillStyle='#e2f178';map.beginPath();map.arc(30+t*51,72-t*60,3,0,Math.PI*2);map.fill();
  }
  function updateHud(){
    $('speedValue').textContent=Math.round(state.speed);$('needle').style.transform=`rotate(${-130+state.speed*2.2}deg)`;
    $('gearValue').textContent=state.speed<1?'N':state.speed<22?'1':state.speed<42?'2':'3';
    $('passengers').textContent=state.passengers;$('ratingValue').textContent=state.rating.toFixed(1);$('comfortValue').textContent=`${Math.round(state.comfort)}%`;$('comfortFill').style.width=`${state.comfort}%`;
    $('tripDistance').textContent=(state.trip/1000).toFixed(1).padStart(5,'0');$('stopDistance').textContent=Math.max(0,Math.round(state.stopDistance));
    $('distanceFill').style.width=`${clamp(100-state.stopDistance/Math.max(1,stops[state.stopIndex]||1000)*100,0,100)}%`;
    $('progressFill').style.width=`${clamp(state.trip/4800*100,0,100)}%`;
    $('steeringWheel').style.transform=`translateX(-50%) rotate(${state.lane*9}deg)`;
    const stopping=state.stopDistance<170;
    $('warningBanner').classList.toggle('show',stopping&&state.stopDistance>8&&state.speed>18);
    $('waypoint').style.opacity=state.stopDistance>0?'1':'0';$('waypoint').style.top=`${clamp(23+(420-state.stopDistance)*.055,23,48)}%`;
    $('dashDestination').textContent=destinations[state.stopIndex]||'ROUTE COMPLETE';
    $('dashStatus').textContent=state.started?(state.paused?'SERVICE PAUSED':state.speed>3?'IN MOTION · DRIVE SAFELY':'DOORS CLOSED · READY'):'DOORS CLOSED · READY';
    $('driveState').textContent=!state.started?'IGNITION OFF':state.paused?'PAUSED':state.speed>3?'CRUISING':'ENGINE ON';
    const mins=Math.floor(state.elapsed/18);$('timeDisplay').textContent=`08:${String((42+mins)%60).padStart(2,'0')}`;
    drawMap();
  }
  function stopComplete(){
    state.stopIndex++;state.passengers=Math.min(48,state.passengers+4);state.rating=Math.min(5,state.rating+.05);state.comfort=Math.min(100,state.comfort+3);state.celebration=2.7;
    $('stopOverlay').classList.remove('hidden');$('objective-count');
    const count=document.querySelector('.objective-count');if(count)count.innerHTML=`${String(Math.min(state.stopIndex+1,4)).padStart(2,'0')} <i>/ 04</i>`;
    const stopIndex=Math.min(state.stopIndex,3);document.querySelector('.next-stop-card b').textContent=stopNames[stopIndex];document.querySelector('.objective-card b').textContent=state.stopIndex>=4?'Route completed':'Pick up passengers';document.querySelector('.objective-card small').textContent=state.stopIndex>=4?'Waterfront · Final stop':`Stop at ${stopNames[stopIndex]}`;
    document.querySelectorAll('.stop-name').forEach((el,i)=>el.classList.toggle('active',i===state.stopIndex+1));
    if(state.stopIndex>=4){state.completed=true;document.querySelector('.stop-card b').textContent='ROUTE COMPLETE';document.querySelector('.stop-card>span:not(.stop-check)').textContent='Waterfront';document.querySelector('.stop-card small').textContent='Excellent driving · Shift bonus earned!';}
    setTimeout(()=>$('stopOverlay').classList.add('hidden'),2400);
  }
  function update(dt){
    if(!state.started||state.paused)return;
    state.elapsed+=dt;
    const accelerating=state.speedInput||keys.has('arrowup')||keys.has('w');
    const braking=state.brakeInput||keys.has('arrowdown')||keys.has('s');
    const steerLeft=state.steeringInput<0||keys.has('arrowleft')||keys.has('a');
    const steerRight=state.steeringInput>0||keys.has('arrowright')||keys.has('d');
    const desired=accelerating?1:0;
    if(desired)state.speed=Math.min(68,state.speed+18*dt);else state.speed=Math.max(0,state.speed-(braking?35:6.5)*dt);
    if(braking)state.speed=Math.max(0,state.speed-26*dt);
    const steer=(steerRight?1:0)-(steerLeft?1:0);state.steer=lerp(state.steer,steer,.13);state.lane=clamp(state.lane+state.steer*dt*(.75+state.speed/27),-3.5,3.5);
    state.lane=lerp(state.lane,0,dt*.025);
    if(Math.abs(state.lane)>2.7&&state.speed>25){state.comfort=Math.max(52,state.comfort-.3*dt);state.rating=Math.max(3.2,state.rating-.002*dt)}
    if(state.speed>50){state.rating=Math.max(3.2,state.rating-.055*dt);state.comfort=Math.max(50,state.comfort-.13*dt)}
    else if(state.speed<48&&Math.abs(state.lane)<1.9){state.comfort=Math.min(100,state.comfort+.045*dt)}
    const meters=state.speed/3.6*dt*1.65;state.trip+=meters;state.distance+=meters;state.stopDistance-=meters;
    // Traffic gives way; a close approach gently penalizes comfort instead of trapping the player.
    for(const car of state.traffic){if(car.screenX!=null&&car.z<36&&car.z>4&&Math.abs(car.lane*2.45-state.lane*1.65)<1.1){state.speed=Math.max(0,state.speed-12*dt);state.comfort=Math.max(60,state.comfort-.7*dt)}}
    if(state.stopDistance<=0&&state.stopIndex<4){
      if(state.speed<7){state.speed=0;state.stopDistance=0;stopComplete();if(state.stopIndex<4)state.stopDistance=stops[state.stopIndex]||1000;}
      else if(state.stopDistance< -65){state.stopDistance=stops[state.stopIndex]||1000;state.rating=Math.max(3,state.rating-.2);state.comfort=Math.max(45,state.comfort-6);}
    }
    if(state.celebration>0)state.celebration-=dt;
  }
  function frame(now){const dt=Math.min(.05,(now-state.last)/1000);state.last=now;update(dt);drawScene();updateHud();requestAnimationFrame(frame)}
  function setPaused(p){if(!state.started)return;state.paused=p;$('pausedOverlay').classList.toggle('hidden',!p);$('pauseBtn').textContent=p?'▶':'Ⅱ'}
  function start(){if(state.started){setPaused(false);return}state.started=true;state.speed=0;$('startOverlay').classList.add('hidden');$('driveState').textContent='ENGINE ON';}
  document.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();keys.add(key);if(key==='p'||key==='escape')setPaused(!state.paused);if(key==='enter'&&!state.started)start()});
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  $('startBtn').addEventListener('click',start);$('resumeBtn').addEventListener('click',()=>setPaused(false));$('pauseBtn').addEventListener('click',()=>state.started?setPaused(!state.paused):start());
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').style.color=state.sound?'':'#c96d5d';$('soundBtn').textContent=state.sound?'♪':'×'});
  $('cameraBtn').addEventListener('click',()=>{state.camera=!state.camera;$('cameraBtn').innerHTML=state.camera?'▣ &nbsp; WIDE VIEW':'▣ &nbsp; CAB VIEW';document.querySelector('.view-subtitle').textContent=state.camera?'CITY CENTER · EXTERIOR ASSIST':'CITY CENTER · NORTHBOUND'});
  document.querySelectorAll('[data-control]').forEach(btn=>{
    const control=btn.dataset.control;const down=e=>{e.preventDefault();if(control==='left')state.steeringInput=-1;if(control==='right')state.steeringInput=1;if(control==='accelerate')state.speedInput=1;if(control==='brake')state.brakeInput=1};const up=e=>{e.preventDefault();if(control==='left'&&state.steeringInput<0||control==='right'&&state.steeringInput>0)state.steeringInput=0;if(control==='accelerate')state.speedInput=0;if(control==='brake')state.brakeInput=0};btn.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,up));
  });
  window.addEventListener('resize',resize);state.traffic=Array.from({length:6},(_,i)=>({z:160+i*145,lane:i%2?1:-1,pace:Math.random()*.35,color:['#d7c3a2','#526b69','#b9795e','#d1d5ca'][i%4]}));
  resize();requestAnimationFrame(frame);
})();
