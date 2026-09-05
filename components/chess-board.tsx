'use client';
import {Board,label,Side} from '@/lib/xiangqi';
export default function ChessBoard({board,flipped=false,selected=null,targets=[],last,onSquare,checkSide=null}:{board:Board;flipped?:boolean;selected?:number|null;targets?:number[];last?:{from:number;to:number}|null;onSquare:(n:number)=>void;checkSide?:Side|null}){
 const view=(n:number)=>flipped?89-n:n;
 return <div className="board-frame"><div className="chess-board" role="group" aria-label="中国象棋棋盘">
 <svg viewBox="0 0 900 1000" aria-hidden="true" className="board-lines">
 <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="50" y="50" width="800" height="900" strokeWidth="3"/>
 {Array.from({length:10},(_,r)=><path key={'r'+r} d={`M50 ${50+r*100}H850`}/>)}
 {Array.from({length:7},(_,i)=>i+1).map(c=><path key={'c'+c} d={`M${50+c*100} 50V450 M${50+c*100} 550V950`}/>)}
 <path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950"/>
 {[19,25,64,70,27,29,31,33,35,54,56,58,60,62].map(n=>{const x=50+n%9*100,y=50+Math.floor(n/9)*100;return <g key={n}>{x>50&&<path d={`M${x-10} ${y-27}v17h-17M${x-27} ${y+10}h17v17`}/>} {x<850&&<path d={`M${x+10} ${y-27}v17h17M${x+27} ${y+10}h-17v17`}/>}</g>;})}
 </g><g className="river-type" fill="currentColor" fontSize="43" textAnchor="middle"><text x="240" y="515">楚 河</text><text x="660" y="515">漢 界</text></g></svg>
 {Array.from({length:90},(_,pos)=>{const n=view(pos),p=board[n],active=selected===n,possible=targets.includes(n);return <button key={n} onClick={()=>onSquare(n)} style={{left:`${(pos%9+.5)/9*100}%`,top:`${(Math.floor(pos/9)+.5)/10*100}%`}} className={`intersection ${active?'selected':''} ${possible?'legal-target':''} ${last?.to===n||last?.from===n?'last-move':''}`} aria-label={`${Math.floor(n/9)+1}行${n%9+1}列${p?`${p.side==='red'?'红':'黑'}${label(p)}`:'空位'}${possible?'，可走':''}`} aria-pressed={active}>
 {p?<span className={`piece ${p.side} ${p.kind==='k'&&checkSide===p.side?'checked':''}`}><span>{label(p)}</span></span>:possible?<span className="move-dot"/>:null}
 </button>;})}
 </div></div>;
}
