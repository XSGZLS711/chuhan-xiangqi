export type Side = 'red' | 'black';
export type Kind = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p';
export type Piece = { side: Side; kind: Kind; id: string };
export type Board = (Piece | null)[];
export const opposite = (s: Side): Side => s === 'red' ? 'black' : 'red';
export const sideLabel = (s: Side) => s === 'red' ? '红方' : '黑方';
export const label = (p: Piece) => ({red:{k:'帅',a:'仕',e:'相',h:'马',r:'车',c:'炮',p:'兵'},black:{k:'将',a:'士',e:'象',h:'马',r:'车',c:'炮',p:'卒'}})[p.side][p.kind];
export function initialBoard(): Board {
  const b: Board = Array(90).fill(null);
  const back: Kind[] = ['r','h','e','a','k','a','e','h','r'];
  for (const side of ['black','red'] as Side[]) {
    const row=side==='red'?9:0, cannon=side==='red'?7:2, pawn=side==='red'?6:3;
    back.forEach((kind,c)=>b[row*9+c]={side,kind,id:`${side}-${kind}-${c}`});
    [1,7].forEach(c=>b[cannon*9+c]={side,kind:'c',id:`${side}-c-${c}`});
    [0,2,4,6,8].forEach(c=>b[pawn*9+c]={side,kind:'p',id:`${side}-p-${c}`});
  } return b;
}
export function pseudoLegal(b: Board, from:number,to:number): boolean {
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>89||to<0||to>89||from===to)return false;
  const p=b[from], target=b[to]; if(!p||target?.side===p.side)return false;
  const x=from%9,y=Math.floor(from/9),X=to%9,Y=Math.floor(to/9),dx=X-x,dy=Y-y, ax=Math.abs(dx),ay=Math.abs(dy);
  const palace=X>=3&&X<=5&&(p.side==='red'?Y>=7:Y<=2);
  let between=0;
  if(dx===0||dy===0){const step=dx===0?Math.sign(dy)*9:Math.sign(dx);for(let i=from+step;i!==to;i+=step)if(b[i])between++;}
  switch(p.kind){
    case 'r':return (dx===0||dy===0)&&between===0;
    case 'c':return (dx===0||dy===0)&&between===(target?1:0);
    case 'h':return ((ax===2&&ay===1)&&!b[y*9+x+Math.sign(dx)])||((ax===1&&ay===2)&&!b[(y+Math.sign(dy))*9+x]);
    case 'e':return ax===2&&ay===2&&!b[(y+dy/2)*9+x+dx/2]&&(p.side==='red'?Y>=5:Y<=4);
    case 'a':return palace&&ax===1&&ay===1;
    case 'k':return (target?.kind==='k'&&dx===0&&between===0)||(palace&&ax+ay===1);
    case 'p':return (dx===0&&dy===(p.side==='red'?-1:1))||(dy===0&&ax===1&&(p.side==='red'?y<=4:y>=5));
  }
}
export function moveBoard(b: Board,from:number,to:number):Board{const n=b.slice();n[to]=n[from];n[from]=null;return n;}
export function inCheck(b:Board,side:Side):boolean{const king=b.findIndex(p=>p?.side===side&&p.kind==='k');return king<0||b.some((p,i)=>p&&p.side!==side&&pseudoLegal(b,i,king));}
export function legalMove(b:Board,from:number,to:number,side:Side):boolean{return b[from]?.side===side&&pseudoLegal(b,from,to)&&!inCheck(moveBoard(b,from,to),side);}
export function legalTargets(b:Board,from:number):number[]{const p=b[from];return p?Array.from({length:90},(_,i)=>i).filter(i=>legalMove(b,from,i,p.side)):[];}
export function hasLegalMove(b:Board,side:Side):boolean{return b.some((p,i)=>p?.side===side&&Array.from({length:90},(_,n)=>n).some(n=>legalMove(b,i,n,side)));}
export function positionKey(b:Board,side:Side):string{return b.map(p=>p?`${p.side[0]}${p.kind}`:'_').join('')+side;}
const cn=['零','一','二','三','四','五','六','七','八','九'];
export function notation(b:Board,from:number,to:number):string{
  const p=b[from]!;const x=from%9,y=Math.floor(from/9),X=to%9,Y=Math.floor(to/9);
  const num=(n:number)=>p.side==='red'?cn[n]:String(n),file=(c:number)=>num(p.side==='red'?9-c:c+1);
  const twins=b.map((q,i)=>({q,i})).filter(({q,i})=>q?.side===p.side&&q.kind===p.kind&&i%9===x).sort((a,z)=>p.side==='red'?a.i-z.i:z.i-a.i);
  const index=twins.findIndex(v=>v.i===from);
  const prefix=twins.length===1?label(p)+file(x):(twins.length===2?(index===0?'前':'后'):(index===0?'前':index===twins.length-1?'后':twins.length===3?'中':num(index+1)))+label(p);
  if(y===Y)return prefix+'平'+file(X);
  const direction=(p.side==='red'?Y<y:Y>y)?'进':'退';
  return prefix+direction+(['h','a','e'].includes(p.kind)?file(X):num(Math.abs(Y-y)));
}
export type Move = {from:number;to:number;text:string;side:Side;captured:Piece|null;check:boolean;before:Board;clocks:{red:number;black:number};quietBefore:number};
export type Result = {winner:Side|'draw';reason:string};
export function outcome(board:Board,turn:Side,history:Move[],quiet:number):Result|null{
  if(!hasLegalMove(board,turn))return {winner:opposite(turn),reason:inCheck(board,turn)?'将死':'困毙'};
  const key=positionKey(board,turn),matches:number[]=[];
  history.forEach((m,i)=>{if(positionKey(m.before,m.side)===key)matches.push(i);});
  if(matches.length>=2){const segment=history.slice(matches[matches.length-2]);const checking=(side:Side)=>{const own=segment.filter(m=>m.side===side);return own.length>0&&own.every(m=>m.check);};const red=checking('red'),black=checking('black');if(red!==black)return {winner:red?'black':'red',reason:'长将判负'};return {winner:'draw',reason:'三次重复局面'};}
  if(quiet>=120)return {winner:'draw',reason:'连续 60 回合未吃子'};
  return null;
}
