import {Board,Side,Move,Result,initialBoard,legalMove,moveBoard,opposite,notation,inCheck,outcome} from './xiangqi';
import {AppError,type ErrorCode} from './errors';
import {NAME,REASON} from './tokens';
export type Player={id:string;name:string};
/** The last thing that happened, as data, so each viewer reads it in their own language. Rooms
 * saved before the English interface hold a plain Chinese string instead; see `noteText`. */
export type RoomNote=
 |{key:'table-ready'}|{key:'friend-joined'}|{key:'draw-agreed'}|{key:'swapped'}
 |{key:'undo-ended';side:Side}|{key:'rematch-invited';side:Side}|{key:'resigned';side:Side}
 |{key:'declined';side:Side;offer:'draw'|'rematch'}
 |{key:'undone';side:Side;from:number;to:number;text:string}
 |{key:'move';from:number;to:number;text:string;check:boolean};
export type Room={id:string;board:Board;turn:Side;players:{red:Player;black:Player|null};history:Move[];result:Result|null;offer:{kind:'draw'|'rematch';side:Side}|null;clockMinutes:number;clocks:{red:number;black:number};turnAt:number;quiet:number;round:number;note:string|RoomNote;chat:{side:Side;text:string;at:number}[];createdAt:number};
export type PublicRoom=Omit<Room,'players'> & {players:{red:{name:string;online:boolean};black:{name:string;online:boolean}|null};you:Side|null;version:number;serverNow:number};
export class GameError extends AppError{constructor(code:ErrorCode,public status=400){super(code)}}
export function newRoom(id:string,player:Player,clockMinutes:number,now:number):Room{return {id,board:initialBoard(),turn:'red',players:{red:player,black:null},history:[],result:null,offer:null,clockMinutes,clocks:{red:clockMinutes*60000,black:clockMinutes*60000},turnAt:now,quiet:0,round:1,note:{key:'table-ready'},chat:[],createdAt:now};}
export function playerSide(r:Room,id:string):Side|null{return r.players.red.id===id?'red':r.players.black?.id===id?'black':null;}
export function clockDeadline(r:Room):number{return r.clockMinutes&&r.players.black&&!r.result?r.turnAt+r.clocks[r.turn]:Infinity;}
export function expireClock(r:Room,now:number):boolean{if(now>=clockDeadline(r)){r.clocks[r.turn]=0;r.result={winner:opposite(r.turn),reason:REASON.timeout};r.offer=null;return true;}return false;}
export function applyAction(r:Room,id:string,a:Record<string,unknown>,now:number):void{
 const side=playerSide(r,id);const type=a.action;
 if(type==='join'){if(side)return;if(r.players.black)throw new GameError('room-full',409);r.players.black={id,name:cleanName(a.name)};r.turnAt=now;r.note={key:'friend-joined'};return;}
 if(!side)throw new GameError('spectator',403);
 if(type==='name'){r.players[side]!.name=cleanName(a.name);return;}
 if(type==='chat'){const text=String(a.text??'').trim().slice(0,120);if(!text)throw new GameError('chat-empty');const last=r.chat.filter(m=>m.side===side).at(-1);if(last&&now-last.at<1000)throw new GameError('chat-too-fast',429);r.chat=[...r.chat,{side,text,at:now}].slice(-60);return;}
 if(!r.players.black)throw new GameError('waiting-for-friend');
 if(type==='undo'){
  if(!r.history.length){if(r.result){r.result=null;r.offer=null;r.turnAt=now;r.clocks={red:r.clockMinutes*60000,black:r.clockMinutes*60000};r.note={key:'undo-ended',side};return;}throw new GameError('nothing-to-undo');}
  const m=r.history.pop()!;r.board=m.before;r.turn=m.side;r.clocks=m.clocks;r.quiet=m.quietBefore;r.result=null;r.offer=null;r.turnAt=now;r.note={key:'undone',side,from:m.from,to:m.to,text:m.text};return;
 }
 if(type==='offer-rematch'){r.offer={kind:'rematch',side};r.note={key:'rematch-invited',side};return;}
 if(type==='cancel-offer'){if(!r.offer||r.offer.side!==side)throw new GameError('no-offer-to-cancel');r.offer=null;return;}
 if(type==='respond'){
  if(!r.offer||r.offer.side===side)throw new GameError('no-offer-to-answer');
  if(a.accept!==true){r.note={key:'declined',side,offer:r.offer.kind};r.offer=null;return;}
  if(r.offer.kind==='draw'){if(r.result)throw new GameError('game-over');r.result={winner:'draw',reason:REASON.agreed};r.note={key:'draw-agreed'};}
  else{const red=r.players.red;r.players.red=r.players.black;r.players.black=red;r.board=initialBoard();r.history=[];r.result=null;r.turn='red';r.quiet=0;r.round++;r.clocks={red:r.clockMinutes*60000,black:r.clockMinutes*60000};r.turnAt=now;r.note={key:'swapped'};}
  r.offer=null;return;
 }
 if(r.result)throw new GameError('game-finished');
 if(type==='resign'){r.result={winner:opposite(side),reason:REASON.resigned[side]};r.offer=null;r.note={key:'resigned',side};return;}
 if(type==='offer-draw'){if(r.offer)throw new GameError('offer-pending');r.offer={kind:'draw',side};return;}
 if(type==='move'){
  if(r.turn!==side)throw new GameError('not-your-turn');
  const from=a.from as number,to=a.to as number;
  if(!legalMove(r.board,from,to,side))throw new GameError('illegal-move');
  const clocks={...r.clocks};if(r.clockMinutes)r.clocks[side]=Math.max(0,r.clocks[side]-(now-r.turnAt));
  const next=moveBoard(r.board,from,to),turn=opposite(side),text=notation(r.board,from,to),captured=r.board[to];
  r.history.push({from,to,text,side,captured,check:inCheck(next,turn),before:r.board,clocks,quietBefore:r.quiet});
  r.board=next;r.turn=turn;r.turnAt=now;r.quiet=captured?0:r.quiet+1;r.result=outcome(next,turn,r.history,r.quiet);r.offer=null;r.note={key:'move',from,to,text,check:inCheck(next,turn)};return;
 }
 throw new GameError('unknown-action');
}
export function cleanName(v:unknown):string{return String(v??NAME.player).replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16)||NAME.player;}
