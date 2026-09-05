import {Board,Side,Move,Result,initialBoard,legalMove,moveBoard,opposite,notation,inCheck,outcome,sideLabel} from './xiangqi';
export type Player={id:string;name:string};
export type Room={id:string;board:Board;turn:Side;players:{red:Player;black:Player|null};history:Move[];result:Result|null;offer:{kind:'draw'|'rematch';side:Side}|null;clockMinutes:number;clocks:{red:number;black:number};turnAt:number;quiet:number;round:number;note:string;chat:{side:Side;text:string;at:number}[];createdAt:number};
export type PublicRoom=Omit<Room,'players'> & {players:{red:{name:string;online:boolean};black:{name:string;online:boolean}|null};you:Side|null;version:number;serverNow:number};
export class GameError extends Error{constructor(message:string,public status=400){super(message)}}
export function newRoom(id:string,player:Player,clockMinutes:number,now:number):Room{return {id,board:initialBoard(),turn:'red',players:{red:player,black:null},history:[],result:null,offer:null,clockMinutes,clocks:{red:clockMinutes*60000,black:clockMinutes*60000},turnAt:now,quiet:0,round:1,note:'棋桌已备好，等待好友入座',chat:[],createdAt:now};}
export function playerSide(r:Room,id:string):Side|null{return r.players.red.id===id?'red':r.players.black?.id===id?'black':null;}
export function expireClock(r:Room,now:number):boolean{if(r.clockMinutes&&r.players.black&&!r.result&&now-r.turnAt>=r.clocks[r.turn]){r.clocks[r.turn]=0;r.result={winner:opposite(r.turn),reason:'超时'};r.offer=null;return true;}return false;}
export function applyAction(r:Room,id:string,a:Record<string,unknown>,now:number):void{
 const side=playerSide(r,id);const type=a.action;
 if(type==='join'){if(side)return;if(r.players.black)throw new GameError('棋桌已坐满，你可以观战。',409);r.players.black={id,name:cleanName(a.name)};r.turnAt=now;r.note='好友已入座，红方先行';return;}
 if(!side)throw new GameError('你正在观战，只有对局双方可以操作。',403);
 if(type==='name'){r.players[side]!.name=cleanName(a.name);return;}
 if(type==='chat'){const text=String(a.text??'').trim().slice(0,120);if(!text)throw new GameError('请输入消息。');const last=r.chat.filter(m=>m.side===side).at(-1);if(last&&now-last.at<1000)throw new GameError('发送太快，请稍等片刻。',429);r.chat=[...r.chat,{side,text,at:now}].slice(-60);return;}
 if(!r.players.black)throw new GameError('请等待好友入座。');
 if(type==='undo'){
  if(!r.history.length){if(r.result){r.result=null;r.offer=null;r.turnAt=now;r.clocks={red:r.clockMinutes*60000,black:r.clockMinutes*60000};r.note=sideLabel(side)+'撤回终局，继续对弈';return;}throw new GameError('还没有可以悔回的棋。');}
  const m=r.history.pop()!;r.board=m.before;r.turn=m.side;r.clocks=m.clocks;r.quiet=m.quietBefore;r.result=null;r.offer=null;r.turnAt=now;r.note=sideLabel(side)+'悔了一步 · '+m.text;return;
 }
 if(type==='offer-rematch'){r.offer={kind:'rematch',side};r.note=sideLabel(side)+'邀请重新开局';return;}
 if(type==='cancel-offer'){if(!r.offer||r.offer.side!==side)throw new GameError('没有可撤回的邀请。');r.offer=null;return;}
 if(type==='respond'){
  if(!r.offer||r.offer.side===side)throw new GameError('没有等待你回应的请求。');
  if(a.accept!==true){r.note=sideLabel(side)+'婉拒了'+(r.offer.kind==='draw'?'提和':'重开');r.offer=null;return;}
  if(r.offer.kind==='draw'){if(r.result)throw new GameError('对局已结束。');r.result={winner:'draw',reason:'双方同意和棋'};r.note='握手言和';}
  else{const red=r.players.red;r.players.red=r.players.black;r.players.black=red;r.board=initialBoard();r.history=[];r.result=null;r.turn='red';r.quiet=0;r.round++;r.clocks={red:r.clockMinutes*60000,black:r.clockMinutes*60000};r.turnAt=now;r.note='交换先后手，新一局开始';}
  r.offer=null;return;
 }
 if(r.result)throw new GameError('本局已结束，可以悔棋或再来一局。');
 if(type==='resign'){r.result={winner:opposite(side),reason:sideLabel(side)+'认输'};r.offer=null;r.note=sideLabel(side)+'认输';return;}
 if(type==='offer-draw'){if(r.offer)throw new GameError('请先处理当前邀请。');r.offer={kind:'draw',side};return;}
 if(type==='move'){
  if(r.turn!==side)throw new GameError('还没轮到你落子。');
  const from=a.from as number,to=a.to as number;
  if(!legalMove(r.board,from,to,side))throw new GameError('这一步不符合走棋规则，或会使己方被将军。');
  const clocks={...r.clocks};if(r.clockMinutes)r.clocks[side]=Math.max(0,r.clocks[side]-(now-r.turnAt));
  const next=moveBoard(r.board,from,to),turn=opposite(side),text=notation(r.board,from,to),captured=r.board[to];
  r.history.push({from,to,text,side,captured,check:inCheck(next,turn),before:r.board,clocks,quietBefore:r.quiet});
  r.board=next;r.turn=turn;r.turnAt=now;r.quiet=captured?0:r.quiet+1;r.result=outcome(next,turn,r.history,r.quiet);r.offer=null;r.note=text+(inCheck(next,turn)?' · 将军':'');return;
 }
 throw new GameError('未知操作。');
}
export function cleanName(v:unknown):string{return String(v??'棋友').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16)||'棋友';}
