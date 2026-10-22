export function collidesAt(world,p){
 for(let x=Math.floor(p.x-.28);x<=Math.floor(p.x+.28);x++)
 for(let y=Math.floor(p.y+.001);y<=Math.floor(p.y+1.75);y++)
 for(let z=Math.floor(p.z-.28);z<=Math.floor(p.z+.28);z++)if(world.get(x,y,z))return true;
 return false;
}
export class PlayerPhysics {
 constructor(world,position){this.world=world;this.position=position;this.velocityY=0;this.jumpBuffer=0;this.coyote=0;this.grounded=false}
 supported(){return collidesAt(this.world,{...this.position,y:this.position.y-.06})}
 move(axis,amount,step=false){const p=this.position,n=Math.max(1,Math.ceil(Math.abs(amount)/.08));for(let i=0;i<n;i++){const old=p[axis];p[axis]+=amount/n;if(!collidesAt(this.world,p))continue;
  p[axis]=old;
  if(step&&axis!=='y'){
   const base=p.y;let clear=true;
   // Check the entire upward path so a low ceiling cannot be crossed.
   for(let h=.1;h<=1.1;h+=.1){p.y=base+Math.min(h,1.02);if(collidesAt(this.world,p)){clear=false;break}}
   p.y=base+1.02;p[axis]=old+amount/n;
   if(clear&&!collidesAt(this.world,p)){this.velocityY=0;continue}
   p.y=base;p[axis]=old;
  }
  return true;
 }return false}
 jump(){this.jumpBuffer=.18}
 update(dx,dz,dt){
  this.grounded=this.supported()&&this.velocityY<=0;
  this.coyote=this.grounded?.1:Math.max(0,this.coyote-dt);
  this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
  if(this.jumpBuffer>0&&this.coyote>0){this.velocityY=7.5;this.jumpBuffer=0;this.coyote=0;this.grounded=false}
  const step=this.grounded&&this.velocityY<=0;
  this.move('x',dx,step);this.move('z',dz,step);
  this.velocityY-=18*dt;
  if(this.move('y',this.velocityY*dt)){this.grounded=this.velocityY<0;this.velocityY=0}
 }
}
