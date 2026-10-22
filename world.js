export const SIZE=32;
export const TYPES=['grass','dirt','stone','sand','log','planks','leaves','brick'];
export const NAMES=['草地','泥土','石頭','沙','木頭','木板','樹葉','磚塊'];
export const DURATIONS=[.8,.8,2,.7,1.3,1,.5,2];
export class World {
 constructor(){this.cells=new Uint8Array(SIZE**3)}
 inside(x,y,z){return [x,y,z].every(v=>Number.isInteger(v)&&v>=0&&v<SIZE)}
 index(x,y,z){return x+SIZE*(z+SIZE*y)}
 get(x,y,z){return this.inside(x,y,z)?this.cells[this.index(x,y,z)]:0}
 set(x,y,z,type){if(!this.inside(x,y,z))return false;this.cells[this.index(x,y,z)]=type;return true}
 generate(){for(let x=3;x<29;x++)for(let z=3;z<29;z++){const r=Math.hypot((x-16)/1.1,z-16);if(r>11+Math.sin(x*1.7+z)*.6)continue;const top=10+(r>8?0:Math.floor((Math.sin(x*.45)+Math.cos(z*.4))*.6));const bottom= Math.max(2,Math.floor(3+r*.48));for(let y=bottom;y<=top;y++)this.set(x,y,z,y===top?(x<9?4:1):y>=top-2?2:3)}
 // Exposed stone and dirt close to the spawn point.
 for(let x=13;x<=15;x++){this.set(x,11,12,3);this.set(x,11,13,2)}
 for(const [x,z] of [[10,18],[22,18],[20,9]]){let y=31;while(y>0&&!this.get(x,y,z))y--;const ground=y;for(let h=1;h<=4;h++)this.set(x,ground+h,z,5);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=3;dy<=5;dy++)if(Math.abs(dx)+Math.abs(dz)+(dy===5?1:0)<4&&!this.get(x+dx,ground+dy,z+dz))this.set(x+dx,ground+dy,z+dz,7)}
 }
}
export function mineStep(state,target,dt,held,duration){if(!held||!target)return {target:null,time:0,done:false};const time=state.target===target?state.time+dt:dt;return {target,time,done:time>=duration}}
export function canPlace(world,x,y,z,count,overlaps){return count>0&&world.inside(x,y,z)&&!world.get(x,y,z)&&!overlaps}
