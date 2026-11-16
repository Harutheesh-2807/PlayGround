import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fcbd1);
scene.fog = new THREE.Fog(0x9fcbd1, 120, 470);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 700);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// Software and integrated GPUs benefit greatly from a modest render resolution.
renderer.setPixelRatio(Math.min(devicePixelRatio, 0.55));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.id = 'world';
viewport.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe4f6ff, 0x788375, 2.15));
const sun = new THREE.DirectionalLight(0xffedcf, 3.0);
sun.position.set(-45, 70, -5); sun.castShadow = false;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -65; sun.shadow.camera.right = 65; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
scene.add(sun);
const materialCache=new Map();
const mat = (color, roughness=.8, metalness=0) => {
  const key=`${color}:${roughness}:${metalness}`;
  if(!materialCache.has(key))materialCache.set(key,new THREE.MeshLambertMaterial({color}));
  return materialCache.get(key);
};
const grassMat=mat(0x8eae88), sidewalkMat=mat(0xc5c4b8), roadMat=mat(0x3c4548), lineMat=mat(0xe3e2d4), limeMat=mat(0xdaf26d), blueMat=mat(0x59d9ec,.4,.15);
const boxGeo=new THREE.BoxGeometry(1,1,1), cylGeo=new THREE.CylinderGeometry(.5,.5,1,12), sphereGeo=new THREE.SphereGeometry(1,12,8);
const staticBatches=new Map(), dynamicBatches=new Map(), cylinderGeometries=new Map(), batchDummy=new THREE.Object3D();
function queueStatic(geometry,material,x,y,z,sx=1,sy=1,sz=1){
  let batch=staticBatches.get(geometry.uuid+material.uuid);
  if(!batch){batch={geometry,material,transforms:[]};staticBatches.set(geometry.uuid+material.uuid,batch)}
  batch.transforms.push([x,y,z,sx,sy,sz]);
}
function flushStaticBatches(){
  for(const {geometry,material,transforms} of staticBatches.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
    mesh.castShadow=false;mesh.receiveShadow=false;
    transforms.forEach(([x,y,z,sx,sy,sz],i)=>{batchDummy.position.set(x,y,z);batchDummy.scale.set(sx,sy,sz);batchDummy.updateMatrix();mesh.setMatrixAt(i,batchDummy.matrix)});
    mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);
  }
  staticBatches.clear();
}
function queueDynamic(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1){
  const key=`${parent.uuid}:${geometry.uuid}:${material.uuid}`;
  let batch=dynamicBatches.get(key);
  if(!batch){batch={parent,geometry,material,transforms:[]};dynamicBatches.set(key,batch)}
  batch.transforms.push([x,y,z,sx,sy,sz]);
}
function flushDynamicBatches(){
  for(const {parent,geometry,material,transforms} of dynamicBatches.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
    mesh.castShadow=false;mesh.receiveShadow=false;
    transforms.forEach(([x,y,z,sx,sy,sz],i)=>{batchDummy.position.set(x,y,z);batchDummy.scale.set(sx,sy,sz);batchDummy.updateMatrix();mesh.setMatrixAt(i,batchDummy.matrix)});
    mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);
  }
  dynamicBatches.clear();
}
function box(parent,material,x,y,z,sx,sy,sz){
  if(parent===scene){queueStatic(boxGeo,material,x,y,z,sx,sy,sz);return null}
  queueDynamic(parent,boxGeo,material,x,y,z,sx,sy,sz);return null
}
function cylinder(parent,material,x,y,z,r,h,segments=12){
  const key=`${r}:${h}:${segments}`;
  if(!cylinderGeometries.has(key))cylinderGeometries.set(key,new THREE.CylinderGeometry(r,r,h,segments));
  const geometry=cylinderGeometries.get(key);
  if(parent===scene){queueStatic(geometry,material,x,y,z);return null}
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m
}

// A calm, sunlit downtown built from lightweight procedural geometry.
box(scene,grassMat,0,-.24,285,240,.3,820);
box(scene,roadMat,0,-.04,285,15,.22,820);
box(scene,mat(0x555d5b),0,-.16,285,16,.12,820);
const windowMaterial=mat(0x66878d,.35,.08);
const windowInstances=new THREE.InstancedMesh(boxGeo,windowMaterial,700);
windowInstances.castShadow=false;windowInstances.receiveShadow=false;
const windowDummy=new THREE.Object3D();let windowCount=0;
scene.add(windowInstances);
for(const side of [-1,1]){
  box(scene,sidewalkMat,side*8.4,.02,285,1.8,.24,820);
  box(scene,mat(0x9bba91),side*13,.05,285,7,.2,820);
  // Repeated building blocks with warm facades and varied roof lines.
  for(let i=0;i<16;i++){
    const z=-60+i*42+(i%2)*5, h=10+(i*17%19), w=7+(i*11%8), x=side*(17+w/2);
    const colors=[0xd9c8ac,0xe1dbca,0xbecbc0,0xd7b89c,0xa9c0bd,0xe0d2bd];
    const facade=mat(colors[(i+(side>0?2:0))%colors.length]);
    box(scene,facade,x,h/2,z,w,h,18+(i%3)*3);
    box(scene,mat(0xa6a89b),x,h+.12,z,w+.4,.3,19+(i%3)*3);
    // Instanced street-facing panes keep the downtown dense and fast to render.
    for(let floor=1;floor<Math.min(5,h/3);floor++) for(let col=0;col<3;col++){
      windowDummy.position.set(side*(17.04),floor*2.7,z-5+col*5);
      windowDummy.scale.set(.07,1.25,1.45);windowDummy.updateMatrix();
      windowInstances.setMatrixAt(windowCount++,windowDummy.matrix);
    }
    if(i%3===0){box(scene,mat(0x9b927e),x,h+1.1,z,w*.55,1.8,5);}
  }
  // Trees and street lamps on the curb.
  for(let i=0;i<22;i++){
    const z=-35+i*30;
    cylinder(scene,mat(0x745a40),side*9.7,1.2,z,.2,2.4,7);
    queueStatic(sphereGeo,mat(i%2?0x527b5f:0x638866),side*9.7,3.15,z,1.05,1.35,1.05);
    if(i%2===0){cylinder(scene,mat(0x596a69),side*11.2,3,z,.075,6,8);box(scene,mat(0xe8dfb9),side*11.2,5.9,z+.35,.65,.16,.9);}
  }
}
windowInstances.count=windowCount;
windowInstances.instanceMatrix.needsUpdate=true;
// Asphalt lane markings, cross streets, and route guide lights.
for(let z=-90;z<700;z+=16){box(scene,lineMat,0,.085,z,.16,.025,4.2)}
for(const x of [-7.2,7.2])box(scene,mat(0x8e9290),x,.09,285,.12,.02,820);
for(const z of [178,338,498]){
  box(scene,mat(0x4d5657),0,.005,z,130,.18,12);
  for(let x=-56;x<60;x+=8)box(scene,lineMat,x,.11,z,.13,.025,4);
  for(let i=0;i<6;i++)box(scene,mat(0xf1edcf),-5.8+i*2.25,.1,z-8,1.5,.04,5);
}

const bus=new THREE.Group();scene.add(bus);
const busPaint=mat(0xf1d34d,.34,.12), busDark=mat(0x192a32,.4,.15), glassMat=new THREE.MeshStandardMaterial({color:0x244654,roughness:.2,metalness:.18,transparent:true,opacity:.9}), tireMat=mat(0x20292b), hubMat=mat(0xb9c4c0,.3,.55), headlightMat=new THREE.MeshBasicMaterial({color:0xfff0bc}), tailMat=new THREE.MeshBasicMaterial({color:0xff4b37});
box(bus,busDark,0,.72,0,2.48,.65,6.6);
box(bus,busPaint,0,1.7,0,2.55,1.65,6.15);
box(bus,busPaint,0,2.75,.65,2.5,.75,4.75);
box(bus,busDark,0,2.35,3.25,2.5,1.8,.12);
// Panoramic windshield and side windows.
box(bus,glassMat,0,2.7,3.33,2.2,1.05,.035);
box(bus,glassMat,0,2.12,-3.11,1.85,.78,.035);
box(bus,mat(0xe9c642),0,1.2,-3.15,.84,.16,.08);
box(bus,mat(0x17303a),0,.95,-3.16,1.28,.25,.08);
for(const side of [-1,1]){
  box(bus,glassMat,side*1.285,2.75,.25,.035,.92,1.55);
  box(bus,glassMat,side*1.285,2.75,-1.55,.035,.92,1.65);
  box(bus,mat(0x1d3037),side*1.3,1.55,-.85,.055,.15,.06);
  box(bus,mat(0xe7c344),side*1.29,1.05,.45,.035,.13,2.55);
  for(const z of [-2.25,2.15]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.3,16),tireMat);wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.3,.62,z);wheel.castShadow=true;bus.add(wheel);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.32,12),hubMat);hub.rotation.z=Math.PI/2;hub.position.set(side*1.3,.62,z);bus.add(hub);
  }
}
box(bus,mat(0xe9c642),0,.95,3.29,2.2,.22,.11);
for(const x of [-.9,.9]){box(bus,headlightMat,x,1.32,3.32,.32,.28,.05);box(bus,tailMat,x,1.45,-3.3,.25,.42,.05)}
box(bus,mat(0xf7e177),0,1.18,3.32,.72,.16,.06);
// A small route sign above the windshield.
box(bus,mat(0x183345),0,3.11,3.25,.95,.28,.08);
box(bus,mat(0xb9f1d0),0,3.12,3.3,.67,.045,.02);

const stops=[{z:110,name:'OLD TOWN',count:6},{z:270,name:'MARKET SQUARE',count:5},{z:430,name:'RIVERFRONT',count:7}];
const stopMeshes=[];
for(const [idx,s] of stops.entries()){
  // Curbside stop platform, shelter, pole, and a luminous boarding target.
  box(scene,mat(0xaaa99c),-9.65,.18,s.z,3.4,.35,17);
  box(scene,mat(0x566768,.3,.2),-10.4,1.55,s.z-1.6,.12,3.2,4.5);
  box(scene,mat(0x9eb7b2,.25,.2),-10.4,2.45,s.z-1.6,.12,.12,4.5);
  box(scene,mat(0x172b38),-9.1,1.75,s.z-7.5,.32,2.1,.35);
  box(scene,mat(0xdaf26d),-9.1,2.75,s.z-7.5,.65,.45,.25);
  // glowing waypoint ring sits in the travel lane, fading with distance.
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1,.13,8,36),new THREE.MeshBasicMaterial({color:0x6ee5ec}));ring.rotation.x=Math.PI/2;ring.position.set(0,.22,s.z);scene.add(ring);stopMeshes.push(ring);
  // Bench
  box(scene,mat(0x80684d),-9.3,.75,s.z+2.7,1.5,.12, .55);
  box(scene,mat(0x5d665f),-9.3,.45,s.z+2.7,.12,.6,.48);
  s.index=idx;
}

// A few local cars add scale and traffic awareness without blocking the route.
const traffic=[];
function makeCar(x,z,color,speed){const g=new THREE.Group();scene.add(g);box(g,mat(color,.42,.1),0,.7,0,1.7,.9,3.5);box(g,glassMat,0,1.35,-.1,1.35,.55,1.65);for(const side of [-1,1])for(const zz of [-1,1]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.16,10),tireMat);w.rotation.z=Math.PI/2;w.position.set(side*.88,.36,zz*1.1);g.add(w)}g.position.set(x,0,z);traffic.push({g,x,z,speed});}
makeCar(4.5,85,0xd47751,15);makeCar(-4.4,205,0x557c9c,19);makeCar(4.5,310,0x7d8f6e,17);makeCar(-4.5,370,0xc0ad72,14);
flushDynamicBatches();
flushStaticBatches();

// HUD mini-map is a stylized route plan, rendered separately for crisp UI.
const mapCanvas=document.querySelector('#map'), mapCtx=mapCanvas.getContext('2d');
function drawMap(){const c=mapCtx,w=168,h=145;c.clearRect(0,0,w,h);c.fillStyle='#182a36';c.fillRect(0,0,w,h);c.strokeStyle='#344a51';c.lineWidth=7;for(let x=14;x<w;x+=34){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}for(let y=10;y<h;y+=34){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}c.strokeStyle='#d9f36a';c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.moveTo(84,127);c.lineTo(84,15);c.stroke();c.setLineDash([]);stops.forEach((s,i)=>{const y=127-i*48;c.beginPath();c.arc(84,y,3.3,0,Math.PI*2);c.fillStyle=i<stopIdx?'#829087':i===stopIdx?'#6ee5ec':'#d9f36a';c.fill()});const y=127-(bus.position.z/160)*48;c.save();c.translate(84,Math.max(8,Math.min(136,y)));c.rotate(0);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-5);c.lineTo(4,4);c.lineTo(-4,4);c.closePath();c.fill();c.restore()}

let running=false, stopIdx=0, speed=0, steering=0, doorOpen=false, parkingBrake=false, passengers=0, boarded=false, completed=false, elapsed=0, safety=100, toastTimer=0, boardingTimer=0, hudTimer=0, mapTimer=0;
const keys=new Set(), touch=new Set();
const $=s=>document.querySelector(s);
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2500)}
function updateHud(){
  const stop=stops[Math.min(stopIdx,stops.length-1)];
  const delta=stop.z-bus.position.z, distance=Math.max(0,Math.round(delta));
  $('#speed').textContent=Math.round(speed);$('#speed-meter').style.width=`${Math.min(100,speed*2)}%`;
  $('#status-text').textContent=parkingBrake?'PARKING BRAKE':speed<1?'IDLE':'IN SERVICE';
  $('#distance').textContent=distance;$('#distance-fill').style.width=`${Math.max(0,Math.min(100,100-distance/4.2))}%`;
  $('#passengers').textContent=passengers;$('#passenger-fill').style.width=`${passengers/18*100}%`;
  $('#door-label').textContent=doorOpen?'OPEN':'CLOSED';$('#door-button').classList.toggle('active',doorOpen);
  $('#brake-label').textContent=parkingBrake?'ON':'OFF';$('#brake-button').classList.toggle('active',parkingBrake);
  $('#stop-number').textContent=`${String(Math.min(stopIdx+1,3)).padStart(2,'0')} / 03`;
  $('#stop-name').textContent=stop.name;$('#route-destination').textContent=stop.name;
  const atStop=Math.abs(delta)<13&&Math.abs(bus.position.x)<3.1;
  const approaching=delta>=0&&delta<24&&Math.abs(bus.position.x)<3.5;
  $('#stop-instruction').textContent=atStop?(speed<2?'Stop here and open the doors':'Slow down and pull in'):approaching&&speed<2?'Bus stop ahead · press E to open doors':'Follow the blue route markers';
}
function toggleDoor(){
  if(!running||completed)return;
  const stop=stops[stopIdx],near=Math.abs(bus.position.z-stop.z)<13&&Math.abs(bus.position.x)<3.1;
  if(!doorOpen){
    if(speed>2){toast('Bring the bus to a full stop first');return}
    if(!near){toast('Pull up to the marked bus stop');return}
    doorOpen=true;parkingBrake=true;speed=0;toast('Doors open · passengers boarding');
    if(!boarded){boarded=true;boardingTimer=0}
  }else{
    doorOpen=false;parkingBrake=false;toast('Doors closed · continuing route');
    if(boarded){stopIdx++;boarded=false;if(stopIdx>=stops.length){finishGame();return}setTimeout(()=>toast(`Next stop: ${stops[stopIdx].name}`),450)}
  }
  updateHud();
}
function toggleBrake(){parkingBrake=!parkingBrake;if(parkingBrake)speed=0;updateHud()}
function startGame(){running=true;$('#objective').classList.add('hidden');$('#drive-hint').classList.remove('hidden');toast('Shift started · follow the route to your first stop');}
function finishGame(){completed=true;running=false;$('#final-score').textContent=Math.max(72,Math.round(safety));$('#final-passengers').textContent=passengers;const mins=Math.floor(elapsed/60),secs=Math.floor(elapsed%60);$('#final-time').textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;$('#end-screen').classList.add('show')}
$('#start-button').addEventListener('click',startGame);$('#door-button').addEventListener('click',toggleDoor);$('#brake-button').addEventListener('click',toggleBrake);$('#restart-button').addEventListener('click',()=>location.reload());
let cameraMode=0;$('#camera-button').addEventListener('click',()=>{cameraMode=(cameraMode+1)%2;toast(cameraMode?'Cabin camera · follow the road':'Exterior camera · route view')});
const controlMap={left:'ArrowLeft',right:'ArrowRight',accelerate:'ArrowUp',brake:'ArrowDown'};
document.querySelectorAll('[data-control]').forEach(btn=>{const name=btn.dataset.control;const down=e=>{e.preventDefault();touch.add(controlMap[name]);btn.classList.add('pressed')};const up=e=>{e.preventDefault();touch.delete(controlMap[name]);btn.classList.remove('pressed')};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up)});
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if((e.key.toLowerCase()==='e')&&!e.repeat)toggleDoor();if(e.key===' '&&!e.repeat)toggleBrake();if(e.key==='Enter'&&!running)startGame()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();touch.clear()});
function input(...names){return names.some(n=>keys.has(n)||touch.has(n))}

// Follow camera has a gentle spring. The second view rides at the driver's shoulder.
const cameraTarget=new THREE.Vector3(), desiredPos=new THREE.Vector3();
function animate(){requestAnimationFrame(animate);const dt=Math.min(.1,clock.getDelta());if(running&&!completed){elapsed+=dt;
  const accelerate=input('w','arrowup'), brake=input('s','arrowdown');
  if(!parkingBrake&&!doorOpen){if(accelerate)speed=Math.min(50,speed+dt*10.2);else speed=Math.max(0,speed-dt*2.4);if(brake)speed=Math.max(0,speed-dt*20)}else speed=Math.max(0,speed-dt*30);
  const steer=(input('a','arrowleft')?-1:0)+(input('d','arrowright')?1:0);steering=THREE.MathUtils.damp(steering,steer,5,dt);
  if(!parkingBrake&&!doorOpen){bus.position.x+=steering*dt*(1.15+speed*.075);bus.position.x=THREE.MathUtils.clamp(bus.position.x,-5.1,5.1);bus.position.z+=speed/3.6*dt;}
  bus.rotation.y=THREE.MathUtils.damp(bus.rotation.y,-steering*Math.min(.12,speed*.002),4,dt);
  traffic.forEach(car=>{car.z+=car.speed/3.6*dt;if(car.z<bus.position.z-35)car.z=bus.position.z+150;car.g.position.z=car.z;if(Math.abs(car.z-bus.position.z)<3.4&&Math.abs(car.x-bus.position.x)<2.8){speed=Math.max(0,speed-15);safety=Math.max(50,safety-4);car.z+=12;toast('Careful! Keep a safe distance from traffic')}});
  if(boarded&&doorOpen){boardingTimer+=dt;if(boardingTimer>1.3){const stop=stops[stopIdx];passengers=Math.min(18,passengers+stop.count);boardingTimer=-999;toast(`${stop.count} passengers on board · close doors to depart`);updateHud()}}
}
hudTimer+=dt;mapTimer+=dt;
if(hudTimer>=.1){hudTimer%=.1;updateHud()}
if(mapTimer>=.12){mapTimer%=.12;drawMap()}
  // Moving roofline reflection and glowing destination markers.
  stopMeshes.forEach((ring,i)=>{ring.material.opacity=stopIdx===i?.95:.36;ring.material.transparent=true;ring.rotation.z+=dt*.15});
  if(cameraMode===0){desiredPos.set(bus.position.x*.48,6.1,bus.position.z-12.5);cameraTarget.set(bus.position.x*.16,1.7,bus.position.z+7)}else{desiredPos.set(bus.position.x,3.75,bus.position.z-1.9);cameraTarget.set(bus.position.x,3.2,bus.position.z+18)}
  camera.position.lerp(desiredPos,1-Math.exp(-dt*2.3));camera.lookAt(cameraTarget);renderer.render(scene,camera);
}
const clock=new THREE.Clock();
updateHud();drawMap();animate();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
$('#loading').classList.add('gone');setTimeout(()=>$('#loading').remove(),700);
