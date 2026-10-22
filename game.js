import * as THREE from './vendor/three.module.js';
import {World,TYPES,NAMES,DURATIONS,mineStep,canPlace} from './world.js';
import {PlayerPhysics} from './physics.js';
const $=id=>document.getElementById(id), canvas=$('game');
const world=new World();world.generate();
const inventory=Array(8).fill(0);let selected=0,locked=false,held=false,mine={target:null,time:0},yaw=0,pitch=-.15,grounded=false,vy=0;
const keys=new Set(),player=new THREE.Vector3(16.5,16,21.5),eye=new THREE.Vector3();
const physics=new PlayerPhysics(world,player);
let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});}catch(e){$('error').textContent='無法啟動 WebGL，請使用支援 3D 的瀏覽器。';throw e}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#bfe0f4');scene.fog=new THREE.Fog('#bfe0f4',35,80);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.05,110);camera.rotation.order='YXZ';
// A camera-space arm uses simple geometry, with no additional image assets.
const handScene=new THREE.Scene(),handCamera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.01,10);
const arm=new THREE.Group();arm.position.set(.38,-.36,-.65);arm.rotation.set(-.35,-.25,-.22);handScene.add(arm);
const skin=new THREE.MeshBasicMaterial({color:0xd9a174}),sleeve=new THREE.MeshBasicMaterial({color:0x386b60});
const forearm=new THREE.Mesh(new THREE.BoxGeometry(.18,.42,.18),skin);forearm.position.y=.12;arm.add(forearm);
const cuff=new THREE.Mesh(new THREE.BoxGeometry(.2,.25,.2),sleeve);cuff.position.y=-.19;arm.add(cuff);
let swing=0;
scene.add(new THREE.HemisphereLight(0xffffff,0x637957,2.2));const sun=new THREE.DirectionalLight(0xfff3d0,2);sun.position.set(15,30,10);scene.add(sun);
const loader=new THREE.TextureLoader(),tex={};
const files=['grass_top','grass_side','dirt','stone','sand','log_top','log_side','planks','leaves','brick',...Array.from({length:10},(_,i)=>`destroy_stage_${i}`)];
try{await Promise.all(files.map(async name=>{const t=await loader.loadAsync(`assets/textures/16px/${name}.png`);t.magFilter=t.minFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;tex[name]=t}));}catch(e){$('error').textContent='素材載入失敗，請透過啟動遊戲.cmd 開啟。';throw e}
const mats={},materialList=[];for(const name of files.filter(x=>!x.startsWith('destroy'))){mats[name]=materialList.length;materialList.push(new THREE.MeshLambertMaterial({map:tex[name]}));}
const faceNames=type=>type===1?['grass_side','grass_side','grass_top','dirt','grass_side','grass_side']:type===5?['log_side','log_side','log_top','log_top','log_side','log_side']:Array(6).fill(TYPES[type-1]);
const cube=new THREE.BoxGeometry(1,1,1),dropMaterials=TYPES.map((_,i)=>faceNames(i+1).map(n=>materialList[mats[n]]));
// Chunked exposed-face geometry keeps draw calls and edits bounded.
const chunks=new Map(),chunkSize=8;
const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
function rebuild(cx,cy,cz){const key=`${cx},${cy},${cz}`,old=chunks.get(key);if(old){scene.remove(old);old.geometry.dispose();chunks.delete(key)}const buckets=materialList.map(()=>({p:[],n:[],u:[]}));
 for(let x=cx*8;x<cx*8+8;x++)for(let y=cy*8;y<cy*8+8;y++)for(let z=cz*8;z<cz*8+8;z++){const t=world.get(x,y,z);if(!t)continue;const names=faceNames(t);dirs.forEach((d,f)=>{if(world.get(x+d[0],y+d[1],z+d[2]))return;const b=buckets[mats[names[f]]],group=cube.groups[f];for(let i=group.start;i<group.start+group.count;i++){const v=cube.index.getX(i);b.p.push(cube.attributes.position.getX(v)+x+.5,cube.attributes.position.getY(v)+y+.5,cube.attributes.position.getZ(v)+z+.5);b.n.push(...d);b.u.push(cube.attributes.uv.getX(v),cube.attributes.uv.getY(v))}})}
 const p=[],n=[],u=[],geo=new THREE.BufferGeometry();buckets.forEach((b,i)=>{const start=p.length/3;p.push(...b.p);n.push(...b.n);u.push(...b.u);if(b.p.length)geo.addGroup(start,b.p.length/3,i)});if(!p.length)return;geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,materialList);chunks.set(key,mesh);scene.add(mesh)}
for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++)rebuild(x,y,z);
function edit(x,y,z,type){world.set(x,y,z,type);const affected=new Set();for(const [dx,dy,dz] of [[0,0,0],...dirs]){const a=x+dx,b=y+dy,c=z+dz;if(world.inside(a,b,c))affected.add([a>>3,b>>3,c>>3].join(','))}for(const k of affected)rebuild(...k.split(',').map(Number))}
const outline=new THREE.LineSegments(new THREE.EdgesGeometry(cube),new THREE.LineBasicMaterial({color:0xf7ffda}));outline.scale.setScalar(1.006);scene.add(outline);
const crackMaterial=new THREE.MeshBasicMaterial({map:tex.destroy_stage_0,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const crack=new THREE.Mesh(cube,crackMaterial);crack.scale.setScalar(1.003);scene.add(crack);crack.visible=false;
function drawBar(){ $('hotbar').innerHTML=TYPES.map((t,i)=>`<button class="slot ${i===selected?'selected':''}" data-slot="${i}" title="${NAMES[i]}" aria-label="${NAMES[i]} ${inventory[i]} 個" aria-pressed="${i===selected}"><span class="key">${i+1}</span><img src="assets/icons/${t}.png" alt="${NAMES[i]}"><span class="count">${inventory[i]}</span></button>`).join('') }drawBar();$('hotbar').onclick=e=>{const b=e.target.closest('[data-slot]');if(b){selected=Number(b.dataset.slot);drawBar()}};
function overlap(x,y,z){return player.x+.28>x&&player.x-.28<x+1&&player.y+1.75>y&&player.y<y+1&&player.z+.28>z&&player.z-.28<z+1}
const raycaster=new THREE.Raycaster();raycaster.far=6;
const pointer=new THREE.Vector2();let pointerInside=false,rightDown=null,leftDown=null;
function pointAt(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);pointerInside=true;$('target').style.cssText=`left:${Math.min(e.clientX+14,innerWidth-80)}px;top:${e.clientY+18}px;width:auto`}
function aim(){if(!pointerInside)return null;raycaster.setFromCamera(pointer,camera);const h=raycaster.intersectObjects([...chunks.values()],false)[0];if(!h)return null;const p=h.point.clone().addScaledVector(h.face.normal,-.001);const x=Math.floor(p.x),y=Math.floor(p.y),z=Math.floor(p.z);return {x,y,z,type:world.get(x,y,z),normal:h.face.normal,key:`${x},${y},${z}`}}
let toastTime=0;function toast(text){$('toast').textContent=text;toastTime=2}
const drops=[];
function drop(x,y,z,type){const mesh=new THREE.Mesh(cube,dropMaterials[type-1]);mesh.scale.setScalar(.25);mesh.position.set(x+.5,y+.5,z+.5);scene.add(mesh);drops.push({mesh,type,v:2,age:0,picking:false})}
function place(){const a=aim();if(!a)return;const x=a.x+a.normal.x,y=a.y+a.normal.y,z=a.z+a.normal.z;if(!inventory[selected]){toast('先挖一塊，再靠近撿起來');return}if(!canPlace(world,x,y,z,inventory[selected],overlap(x,y,z))){toast('這裡不能放置方塊');return}edit(x,y,z,selected+1);inventory[selected]--;drawBar()}
canvas.addEventListener('mousedown',e=>{if(!locked)return;pointAt(e);previousMouse={x:e.clientX,y:e.clientY};if(e.button===0){leftDown={x:e.clientX,y:e.clientY,moved:false};held=true;swing=.2}if(e.button===2)rightDown={x:e.clientX,y:e.clientY,moved:false}});window.addEventListener('mouseup',e=>{if(e.button===0){leftDown=null;held=false;mine={target:null,time:0};crack.visible=false}if(e.button===2){if(locked&&rightDown&&!rightDown.moved&&e.target===canvas){pointAt(e);place();swing=.2}rightDown=null}});canvas.oncontextmenu=e=>e.preventDefault();
let hadPointerLock=false;
document.addEventListener('pointerlockchange',()=>{const hasLock=document.pointerLockElement===canvas;if(hasLock){hadPointerLock=true;locked=true;$('menu').style.display='none'}else if(hadPointerLock){hadPointerLock=false;locked=false;$('menu').style.display='grid'}$('start').textContent='繼續探索';held=false;keys.clear();mine={target:null,time:0};crack.visible=false});
function fallback(){locked=true;$('menu').style.display='none';$('start').textContent='繼續探索';canvas.focus({preventScroll:true});toast('左鍵長按拖曳轉向 · 按住不動挖掘 · 空白鍵跳躍')}
document.addEventListener('pointerlockerror',()=>{if(locked)canvas.focus({preventScroll:true})});
$('start').onclick=()=>{fallback();$('error').textContent=''};
let previousMouse=null;
canvas.addEventListener('mouseenter',()=>{previousMouse=null});
canvas.addEventListener('mousemove',e=>{pointAt(e);const dx=previousMouse?e.clientX-previousMouse.x:0,dy=previousMouse?e.clientY-previousMouse.y:0;previousMouse={x:e.clientX,y:e.clientY};if(!locked)return;const drag=leftDown||rightDown;if(drag){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){held=false;mine={target:null,time:0};crack.visible=false;yaw-=dx*.003;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.003))}}});
canvas.addEventListener('mouseleave',()=>{pointerInside=false;held=false;leftDown=rightDown=null;previousMouse=null});
canvas.addEventListener('pointerdown',()=>{if(locked)canvas.focus({preventScroll:true})});
canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&locked&&document.pointerLockElement!==canvas){locked=false;held=false;leftDown=rightDown=null;keys.clear();mine={target:null,time:0};$('menu').style.display='grid'}});
const keyCode=e=>({' ':'Space',Spacebar:'Space'}[e.key]||e.code||({w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',f:'KeyF'}[e.key?.toLowerCase()]||e.key));
document.addEventListener('keydown',e=>{if(!locked)return;const code=keyCode(e);if(['Space','KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(code))e.preventDefault();keys.add(code);if(code==='Space'&&!e.repeat)physics.jump();if(/^Digit[1-8]$/.test(code)){selected=Number(code.slice(-1))-1;drawBar()}if(code==='KeyF'&&!e.repeat){if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>toast('瀏覽器未允許全螢幕'));else document.exitFullscreen()}});
document.addEventListener('keyup',e=>keys.delete(keyCode(e)));window.addEventListener('blur',()=>{keys.clear();held=false;leftDown=rightDown=null;mine={target:null,time:0};crack.visible=false});
canvas.addEventListener('wheel',e=>{if(locked){e.preventDefault();selected=(selected+(e.deltaY>0?1:7))%8;drawBar()}},{passive:false});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();handCamera.aspect=camera.aspect;handCamera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function update(dt){if(locked){yaw+=(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*1.5;pitch=Math.max(-1.5,Math.min(1.5,pitch+(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt));const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),length=Math.hypot(f,s)||1;physics.update((-Math.sin(yaw)*f+Math.cos(yaw)*s)/length*4*dt,(-Math.cos(yaw)*f-Math.sin(yaw)*s)/length*4*dt,dt);if(player.y< -8){player.set(16.5,17,21.5);physics.velocityY=0;toast('回到小島，背包已保留')}}
 swing=Math.max(0,swing-dt);arm.rotation.x=-.35+(held?Math.sin(performance.now()*.018)*.5:Math.sin(swing*16)*.5);arm.position.y=-.36+(locked&&(keys.has('KeyW')||keys.has('KeyS'))?Math.sin(performance.now()*.012)*.015:0); camera.position.copy(player).y+=1.6;camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();eye.copy(camera.position);const a=locked?aim():null;outline.visible=!!a;if(a)outline.position.set(a.x+.5,a.y+.5,a.z+.5);$('target').textContent=a?NAMES[a.type-1]:'';
 mine=mineStep(mine,a?.key,dt,locked&&held,DURATIONS[(a?.type||1)-1]);crack.visible=!!a&&mine.time>0;if(crack.visible){crack.position.copy(outline.position);crackMaterial.map=tex[`destroy_stage_${Math.min(9,Math.floor(mine.time/DURATIONS[a.type-1]*10))}`]}
 if(mine.done&&a){edit(a.x,a.y,a.z,0);drop(a.x,a.y,a.z,a.type);mine={target:null,time:0};crack.visible=false}
 if(locked)for(let i=drops.length-1;i>=0;i--){const d=drops[i],p=d.mesh.position;d.age+=dt;d.mesh.rotation.y+=dt;const body=player.clone().add(new THREE.Vector3(0,.8,0));if(d.age>.5&&p.distanceTo(body)<1.5)d.picking=true;if(d.picking){p.lerp(body,Math.min(1,dt*12));if(p.distanceTo(body)<.2){inventory[d.type-1]++;drawBar();scene.remove(d.mesh);drops.splice(i,1);continue}}else{d.v-=12*dt;const steps=Math.max(1,Math.ceil(Math.abs(d.v*dt)/.08));for(let j=0;j<steps;j++){const next=p.y+d.v*dt/steps;let floor=-Infinity;for(let x=Math.floor(p.x-.125);x<=Math.floor(p.x+.125);x++)for(let z=Math.floor(p.z-.125);z<=Math.floor(p.z+.125);z++)for(let y=Math.floor(next-.125);y<=Math.floor(p.y-.125);y++)if(world.get(x,y,z))floor=Math.max(floor,y+1+.125);if(d.v<0&&floor>next){p.y=floor;d.v=0;break}else p.y=next}}if(p.y< -10){scene.remove(d.mesh);drops.splice(i,1)}}
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').textContent=''}
}
// Settle the player before showing the scene.
for(let i=0;i<180;i++){physics.update(0,0,1/120)}
camera.position.copy(player).y+=1.6;camera.rotation.set(pitch,yaw,0);
let last=performance.now(),frames=0,fpsTime=0;
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;update(dt);renderer.render(scene,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(handScene,handCamera);renderer.autoClear=true;frames++;fpsTime+=dt;if(fpsTime>=1){$('fps').textContent=`${Math.round(frames/fpsTime)} FPS`;frames=0;fpsTime=0}requestAnimationFrame(frame)}
$('start').disabled=false;$('start').textContent='進入小島 →';requestAnimationFrame(frame);
// Read-only diagnostics for manual verification.
window.skyIsland={world,inventory,get player(){return player.clone()},get drops(){return drops.length},get drawCalls(){return renderer.info.render.calls}};


