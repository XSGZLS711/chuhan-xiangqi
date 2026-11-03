import assert from 'node:assert/strict';
// node tests/online.test.mjs <base-url> [--game [--poll|--d1] [--minutes=30] [--every=12]] [--legacy=<D1 room id>]
const args=process.argv.slice(2),option=(name)=>args.find(a=>a===`--${name}`||a.startsWith(`--${name}=`))?.split('=')[1]??(args.includes(`--${name}`)?'':undefined);
const base=args.find(a=>!a.startsWith('--'))||'http://localhost:3000',wsBase=base.replace(/^http/,'ws');
// Short clocks, D1 rooms on demand and the usage count are only on a local server.
const local=['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
let passed=0,skipped=0;
const ok=(name,condition)=>{assert.ok(condition,name);passed++;console.log('✓ '+name);};
const skip=(name,why)=>{skipped++;console.log(`- ${name}（跳过：${why}）`);};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function client(cookie=''){
 const jar=new Map(cookie.split(';').map(c=>c.trim()).filter(Boolean).map(c=>{const i=c.indexOf('=');return [c.slice(0,i),c.slice(i+1)];}));
 return {get cookie(){return [...jar].map(([k,v])=>k+'='+v).join('; ');},async request(method,payload){
  const r=await fetch(base+'/api/game'+(method==='GET'&&payload?'?room='+payload:''),{method,headers:{...(this.cookie?{cookie:this.cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:base,'Sec-Fetch-Site':'same-origin'}:{})},...(method==='POST'?{body:JSON.stringify(payload)}:{})});
  // Hosting may refresh its own cookies independently of the player's identity.
  for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
  return {status:r.status,data:await r.json(),headers:r.headers};
 }};
}
const red=client(),black=client(),watcher=client();
const session=await red.request('GET');ok('初始化匿名身份',session.status===200&&red.cookie.length>40);ok('身份 Cookie 禁止脚本读取',session.headers.get('set-cookie')?.includes('HttpOnly'));
let result=await red.request('POST',{action:'create',name:'联机测试红方',clockMinutes:0});assert.equal(result.status,200,JSON.stringify(result.data));let state=result.data;const id=state.id;
ok('创建持久化好友棋室',state.you==='red'&&state.players.black===null);
ok('未泄露座位身份凭证',!JSON.stringify(state).includes('secret')&&!('id'in state.players.red));
let viewed=await black.request('GET',id);ok('邀请链接可从独立身份打开',viewed.status===200&&viewed.data.id===id&&viewed.data.you===null);
result=await black.request('POST',{action:'join',room:id,version:state.version,name:'联机测试黑方'});assert.equal(result.status,200,JSON.stringify(result.data));state=result.data;ok('好友加入执黑，双方开始',state.you==='black'&&state.players.black.name==='联机测试黑方');
viewed=await red.request('GET',id);ok('红方收到入座同步',viewed.data.players.black.name==='联机测试黑方'&&viewed.data.you==='red');
const send=async(who,action,extra={})=>{const r=await who.request('POST',{action,room:id,version:state.version,...extra});if(r.status===200)state=r.data;return r;};
result=await send(black,'move',{from:27,to:36});ok('服务器阻止越回合落子',result.status===400);
result=await send(red,'move',{from:54,to:45});ok('红方合法落子已存储',result.status===200&&state.history.length===1&&state.board[45]?.kind==='p');
viewed=await black.request('GET',id);ok('对手看到同一棋盘',viewed.data.board[45]?.side==='red'&&viewed.data.turn==='black');
result=await send(black,'move',{from:27,to:36});ok('黑方合法落子',result.status===200&&state.history.length===2);
result=await send(red,'undo');ok('红方无需同意撤回黑方一步',result.status===200&&state.history.length===1&&state.turn==='black');
result=await send(black,'undo');ok('黑方无需同意撤回红方一步',result.status===200&&state.history.length===0&&state.turn==='red');
viewed=await watcher.request('GET',id);ok('第三人只能观战',viewed.data.you===null&&viewed.data.players.black!==null);
result=await send(watcher,'move',{from:54,to:45});ok('服务器拒绝观战者落子',result.status===403);
result=await send(watcher,'undo');ok('服务器拒绝观战者悔棋',result.status===403);
result=await send(watcher,'join',{name:'第三人'});ok('已占座位不能被抢占',result.status===409);
result=await red.request('POST',{action:'move',room:id,version:0,from:54,to:45});ok('过期版本请求不会覆盖新棋局',result.status===409);
const concurrent=await Promise.all([red.request('POST',{action:'move',room:id,version:state.version,from:54,to:45}),red.request('POST',{action:'move',room:id,version:state.version,from:56,to:47})]);ok('同时落子只接受一步',concurrent.filter(r=>r.status===200).length===1&&concurrent.filter(r=>r.status===409).length===1);state=concurrent.find(r=>r.status===200).data;
viewed=await client(red.cookie).request('GET',id);ok('刷新后恢复座位和棋局',viewed.data.you==='red'&&viewed.data.history.length===1);
result=await send(black,'chat',{text:'测试消息：好棋！'});ok('聊天发送并持久化',result.status===200&&state.chat.at(-1).text==='测试消息：好棋！');
viewed=await red.request('GET',id);ok('聊天对手同步',viewed.data.chat.at(-1).side==='black');
result=await send(red,'offer-draw');ok('提和进入待回应状态',result.status===200&&state.offer.kind==='draw');
result=await send(black,'respond',{accept:false});ok('对方可拒绝提和',result.status===200&&state.offer===null&&state.result===null);
await send(black,'offer-draw');result=await send(red,'respond',{accept:true});ok('双方同意才结束为和棋',result.status===200&&state.result.winner==='draw');
result=await send(black,'undo');ok('终局后仍可悔棋恢复',result.status===200&&state.result===null&&state.history.length===0);
result=await send(red,'resign');ok('认输判对手获胜',result.status===200&&state.result.winner==='black');
await send(red,'offer-rematch');result=await send(black,'respond',{accept:true});ok('再来一局交换先后手',result.status===200&&state.you==='red'&&state.round===2&&state.history.length===0);
viewed=await red.request('GET',id);ok('原红方收到换边状态',viewed.data.you==='black');
result=await send(red,'name',{name:'更名后的棋友'});ok('称呼修改同步',result.status===200&&state.players.black.name==='更名后的棋友');
const attack=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',cookie:red.cookie,origin:'https://unrelated.example'},body:JSON.stringify({action:'resign',room:id,version:state.version})});ok('跨站操作被拒绝',attack.status===403);
const bad=await red.request('GET','invalid');ok('错误邀请链接给出明确错误',bad.status===404&&bad.data.error.includes('链接'));
const account=await fetch(base+'/api/me',{headers:{cookie:red.cookie}});const status=await account.json();ok('匿名棋友没有账号，账号接口不缓存',account.status===200&&status.user===null&&typeof status.google==='boolean'&&account.headers.get('cache-control')?.includes('no-store'));
const forcedOut=await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie:red.cookie,origin:'https://unrelated.example'}});ok('跨站请求不能让人退出登录',forcedOut.status===403);
const forcedDelete=await fetch(base+'/api/me',{method:'DELETE',headers:{cookie:red.cookie,origin:base,'Sec-Fetch-Site':'same-origin'}});ok('未登录不能删除账号',forcedDelete.status===401);
const away=await fetch(base+'/api/auth/google?return='+encodeURIComponent('//unrelated.example/'),{redirect:'manual'});const back=await fetch(base+'/api/auth/google/callback?state=forged&code=x',{redirect:'manual',headers:{cookie:(away.headers.get('set-cookie')??'').split(';')[0]}});ok('登录回跳只回本站，伪造的 state 被拒绝',away.status===302&&back.status===302&&back.headers.get('location')==='/?login=failed');
viewed=await red.request('GET',id);ok('账号接口不影响原有座位',viewed.data.you==='black');
ok('新棋室放在 Durable Object（24 位房间号），以上旧标签页的走法照常可用',/^[a-f0-9]{24}$/.test(id));
const firstRoom=id;
// ── Rooms in a Durable Object: sockets, versions, alarms, the polling fallback, D1 rooms ──
const until=async(test,ms=5000)=>{const end=Date.now()+ms;while(!test()){if(Date.now()>end)throw new Error('等待超时');await sleep(10);}};
/** A raw socket to a room, its messages kept in arrival order. */
function socket(who,room,{v,origin=base}={}){
 const ws=new WebSocket(wsBase+'/api/game/ws?room='+room+(v===undefined?'':'&v='+v),{headers:{cookie:who.cookie,...(origin?{Origin:origin}:{})}});
 const inbox=[];let cursor=0,wake=()=>{};
 ws.onmessage=(e)=>{const m=JSON.parse(e.data);m.at=performance.now();inbox.push(m);wake();};
 const opened=new Promise((resolve)=>{ws.onopen=()=>resolve(true);ws.onerror=ws.onclose=()=>{resolve(false);wake();};});
 return {opened,inbox,close:()=>ws.close(),
  send(message){ws.send(JSON.stringify(message));return performance.now();},
  /** The next message after the last one taken that `test` accepts. */
  async next(test=()=>true,ms=5000){const end=Date.now()+ms;for(;;){while(cursor<inbox.length){const m=inbox[cursor++];if(test(m))return m;}if(Date.now()>end)throw new Error('没有等到消息');await new Promise(r=>{wake=r;setTimeout(r,Math.max(0,end-Date.now()));});}}};
}
let sequence=0;
const act=(s,action,version,extra={})=>{const request=`t${++sequence}-${Date.now()}`;s.send({t:'act',request,action,version,...extra});return request;};
const ackOf=(request)=>(m)=>m.t==='ack'&&m.request===request;
const roomAt=(version)=>(m)=>m.t==='room'&&m.room.version===version;
const players=async(...list)=>{for(const who of list)await who.request('GET');return list;};

const [r1,b1,w1]=await players(client(),client(),client());
let made=await r1.request('POST',{action:'create',name:'红方',clockMinutes:0});const live=made.data.id;
const rs=socket(r1,live),bs=socket(b1,live);
ok('双方经 WebSocket 连上 Durable Object 棋室',(await rs.opened)&&(await bs.opened));
let m=await rs.next(roomAt(0));
ok('连上就收到棋室，紧凑格式：只有着法，不带每一步的局面',m.room.you==='red'&&Array.isArray(m.room.moves)&&!('board'in m.room)&&!('history'in m.room));
await bs.next(roomAt(0));
let request=act(bs,'join',0,{name:'黑方'});m=await bs.next(ackOf(request));ok('好友经 WebSocket 入座',m.status===200);
m=await rs.next(roomAt(1));ok('红方即时收到入座和对方在线',m.room.players.black.name==='黑方'&&m.room.players.black.online&&m.room.you==='red');
let version=1;const latency=[];
for(const [i,[from,to]] of [[70,67],[19,22],[88,69],[1,20],[54,45],[27,36]].entries()){
 const [me,other]=i%2?[bs,rs]:[rs,bs];const sent=performance.now();request=act(me,'move',version,{from,to});
 latency.push((await other.next(roomAt(version+1))).at-sent);assert.equal((await me.next(ackOf(request))).status,200);version++;
}
ok(`双方互相走棋 6 步，对手 ${Math.round(Math.min(...latency))}–${Math.round(Math.max(...latency))} ms 收到（要求低于 200 ms）`,Math.max(...latency)<200);
const httpRequest=`http-${Date.now()}`,body={action:'move',room:live,version,from:56,to:47,request:httpRequest};
const first=await r1.request('POST',body),second=await r1.request('POST',body);
ok('经 HTTP 重发同一请求也只走一步',first.status===200&&second.status===200&&second.data.version===version+1&&second.data.history.length===7);version++;
await bs.next(roomAt(version));
const twice=`dup-${Date.now()}`;
for(let n=0;n<2;n++)bs.send({t:'act',request:twice,action:'move',version,from:29,to:38});
const acks=[await bs.next(ackOf(twice)),await bs.next(ackOf(twice))];
viewed=await r1.request('GET',live);
ok('同一请求号连发两次只走一步，两次都答复成功',acks.every(a=>a.status===200)&&viewed.data.version===version+1&&viewed.data.history.length===8);version++;
request=act(rs,'move',version-1,{from:58,to:49});m=await rs.next(ackOf(request));
ok('过期版本被拒绝（409），拒绝前先补发当前棋室',m.status===409&&m.code==='room-changed'&&rs.inbox[rs.inbox.indexOf(m)-1].t==='room'&&rs.inbox[rs.inbox.indexOf(m)-1].room.version===version);
bs.close();m=await rs.next((x)=>x.t==='presence'&&x.players.black.online===false);ok('对方断开，在线状态随连接马上变成离线',!!m);
const known=version;
request=act(rs,'move',version,{from:58,to:49});await rs.next(ackOf(request));version++;
request=act(rs,'chat',version,{text:'断线期间的消息'});await rs.next(ackOf(request));version++;
const rejoined=socket(b1,live,{v:known});await rejoined.opened;m=await rejoined.next();
ok('断线重连时带上已知版本，服务端补发其间的着法和聊天',m.t==='room'&&m.room.version===version&&m.room.moves.length===9&&m.room.chat.at(-1).text==='断线期间的消息'&&m.room.you==='black');
ok('重连后红方看到黑方重新在线',!!(await rs.next((x)=>x.t==='presence'&&x.players.black.online)));
const current=socket(b1,live,{v:version});await current.opened;m=await current.next();
ok('已是最新版本时只补在线状态，不重发棋局',m.t==='presence'&&m.version===version);current.close();
const spectator=socket(w1,live);await spectator.opened;m=await spectator.next((x)=>x.t==='room');
request=act(spectator,'move',version,{from:7,to:24});const refused=await spectator.next(ackOf(request));
ok('观战者也能连上，但经 WebSocket 落子被拒绝',m.room.you===null&&refused.status===403);spectator.close();
const foreign=socket(r1,live,{origin:'https://unrelated.example'}),bare=socket(r1,live,{origin:''}),wrongId=socket(r1,'0'.repeat(20));
ok('跨站页面、没有 Origin 的请求都打不开 WebSocket，D1 房间号也不开',!(await foreign.opened)&&!(await bare.opened)&&!(await wrongId.opened));
const holding=r1.request('GET',live+'&since='+version);await sleep(300);
let sent=performance.now();request=act(rejoined,'move',version,{from:7,to:24});
const polled=await holding,pollMs=performance.now()-sent;
ok(`挂起的 HTTP 轮询在对方落子后 ${Math.round(pollMs)} ms 返回，旧标签页照常同步`,polled.status===200&&polled.data.version===version+1&&polled.data.history.length===10&&pollMs<1000);version++;
rs.close();rejoined.close();

if(local){
 const [r2,b2]=await players(client(),client());
 made=await r2.request('POST',{action:'create',name:'红方',clockMinutes:0.05});const timed=made.data.id;
 const watch=socket(r2,timed);await watch.opened;await watch.next(roomAt(0));
 const joined=await b2.request('POST',{action:'join',room:timed,version:0,name:'黑方'});
 const deadline=joined.data.turnAt+joined.data.clocks.red;
 m=await watch.next((x)=>x.t==='room'&&x.room.result,8000);
 ok(`没有任何请求时 alarm 照样判超时，比时限晚 ${m.room.serverNow-deadline} ms`,m.room.result.reason==='超时'&&m.room.result.winner==='black'&&m.room.serverNow>=deadline&&m.room.serverNow-deadline<1000);
 viewed=await b2.request('GET',timed);ok('超时结果已存储',viewed.data.result?.reason==='超时');watch.close();
}else skip('alarm 判超时','线上只有 10 分钟以上的时钟');

// The page's own sync code, bundled for Node, with a transport that carries the cookie.
const {build}=await import('esbuild');const root=new URL('..',import.meta.url).pathname,bundle=root+'work/online/sync.mjs';
await build({stdin:{contents:"export * from './lib/room-sync.ts';export * from './lib/xiangqi.ts';",resolveDir:root,loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:bundle,logLevel:'error'});
const lib=await import(bundle);
function transport(who,{socketPath=(path)=>path,onSend}={}){
 const counts={requests:0,sockets:0,sent:0};
 return {counts,
  fetch(path,init={}){counts.requests++;return fetch(base+path,{...init,headers:{...init.headers,cookie:who.cookie,Origin:base,'Sec-Fetch-Site':'same-origin'}});},
  socket(path){counts.requests++;counts.sockets++;const ws=new WebSocket(wsBase+socketPath(path),{headers:{cookie:who.cookie,Origin:base}});const send=ws.send.bind(ws);ws.send=(message)=>{counts.sent++;send(message);onSend?.(ws,message);};return ws;}};
}
/** A page's view of a room through `startRoomSync`. */
function page(id,t){const rooms=[],lost=[];const sync=lib.startRoomSync(id,{onRoom:(r)=>rooms.push(r),onLost:(e)=>lost.push(e)},t);return {sync,rooms,lost,get room(){return rooms.at(-1);}};}
const strip=({serverNow:_now,players:_players,...rest})=>rest;
const syncs=[];

const [r3,b3]=await players(client(),client());
let dropAck=false;const bt=transport(b3,{onSend:(ws,message)=>{if(dropAck&&message.includes('"t":"act"')){dropAck=false;ws.close();}}});
const created=await lib.createRoom('红方',0,'red',transport(r3));
const red3=page(created.id,transport(r3)),black3=page(created.id,bt);syncs.push(red3,black3);
await until(()=>black3.room);await black3.sync.send('join',{name:'黑方'});await until(()=>red3.room?.players.black);
ok('页面端同步（lib/room-sync.ts）走 WebSocket，入座成功',red3.sync.mode==='socket'&&black3.sync.mode==='socket'&&black3.room.you==='black');
let after=await red3.sync.send('move',{from:70,to:67});await until(()=>black3.room.version===after.version);
const full=(await b3.request('GET',created.id)).data;
assert.deepStrictEqual(strip(black3.room),strip(full));
ok('页面收到的棋室和旧格式逐字段相同（局面由着法重放得出）',true);
dropAck=true;const beforeDrop=black3.room.version;after=await black3.sync.send('move',{from:19,to:22});
ok('发出落子后连接断开、回执丢失：自动重连重发，这一步只走一次',after.version===beforeDrop+1&&after.history.length===2&&bt.counts.sockets>=2);
await until(()=>red3.room.version===after.version);ok('对手照常收到这一步',red3.room.history.length===2);

const [r4,b4]=await players(client(),client());
const room4=await lib.createRoom('红方',0,'red',transport(r4));
const blocked=transport(b4,{socketPath:()=>'/api/game/ws?room=blocked'});
const red4=page(room4.id,transport(r4)),black4=page(room4.id,blocked);syncs.push(red4,black4);
await until(()=>black4.room);ok('WebSocket 连不上时（公司网络、代理）退回挂起轮询',black4.sync.mode==='poll'&&blocked.counts.sockets===1);
await black4.sync.send('join',{name:'黑方'});await until(()=>red4.room?.players.black);
// Polls are spaced 1.4 s from the start of the last one; by then the next one is held.
await sleep(1600);sent=performance.now();await red4.sync.send('move',{from:70,to:67});await until(()=>black4.room.history.length===1);const pollSeen=performance.now()-sent;
await black4.sync.send('move',{from:19,to:22});await until(()=>red4.room.history.length===2);
ok(`轮询这一方 ${Math.round(pollSeen)} ms 看到对方落子，自己经 HTTP 落子对方也收到`,pollSeen<1000&&red4.room.turn==='red');

if(local){
 const [r5,b5]=await players(client(),client());
 made=await r5.request('POST',{action:'create',name:'红方',clockMinutes:0,store:'d1'});const old=made.data.id;
 const oldSocket=socket(r5,old);
 ok('（本地）仍能建 D1 棋室（20 位房间号），它不开 WebSocket',/^[a-f0-9]{20}$/.test(old)&&!(await oldSocket.opened));
 const red5=page(old,transport(r5)),black5=page(old,transport(b5));syncs.push(red5,black5);
 await until(()=>black5.room);await black5.sync.send('join',{name:'黑方'});await until(()=>red5.room?.players.black);
 await red5.sync.send('move',{from:70,to:67});await until(()=>black5.room.history.length===1);
 await black5.sync.send('move',{from:19,to:22});await until(()=>red5.room.history.length===2);
 await red5.sync.send('resign');await until(()=>black5.room.result);
 ok('旧的 D1 棋室照常下完：入座、走棋、认输都经轮询同步',red5.sync.mode==='poll'&&black5.room.result.winner==='black'&&black5.room.version===4);
}else if(option('legacy')){
 viewed=await r1.request('GET',option('legacy'));
 ok('上线前留下的 D1 棋室仍能打开',viewed.status===200&&/^[a-f0-9]{20}$/.test(viewed.data.id)&&Array.isArray(viewed.data.history));
}else skip('旧的 D1 棋室','线上不能新建 D1 棋室；用 --legacy=<上线前的房间号> 检查');
// ── The maker of a room may sit on black; the friend then takes red and moves first ──
const [r6,b6]=await players(client(),client());
ok('选边不是红也不是黑时拒绝建房',(await b6.request('POST',{action:'create',name:'黑方',clockMinutes:0,side:'green'})).status===400);
made=await b6.request('POST',{action:'create',name:'执黑的房主',clockMinutes:0,side:'black'});const sided=made.data.id;
ok('建房时选执黑：房主坐黑方，红方空着等好友',made.status===200&&made.data.you==='black'&&made.data.players.red===null&&made.data.players.black.name==='执黑的房主');
const hostSocket=socket(b6,sided),guestSocket=socket(r6,sided);await hostSocket.opened;await guestSocket.opened;
m=await guestSocket.next(roomAt(0));ok('好友打开链接看到红方空位',m.room.players.red===null&&m.room.you===null);
request=act(hostSocket,'move',0,{from:27,to:36});ok('好友入座前房主不能走',(await hostSocket.next(ackOf(request))).code==='waiting-for-friend');
request=act(guestSocket,'join',0,{name:'执红的好友'});m=await guestSocket.next(roomAt(1));await guestSocket.next(ackOf(request));
ok('好友入座执红，房主仍执黑',m.room.you==='red'&&m.room.players.red.name==='执红的好友'&&(await hostSocket.next(roomAt(1))).room.you==='black');
request=act(hostSocket,'move',1,{from:27,to:36});ok('执黑的房主不能抢先落子',(await hostSocket.next(ackOf(request))).code==='not-your-turn');
request=act(guestSocket,'move',1,{from:70,to:67});await guestSocket.next(ackOf(request));
request=act(hostSocket,'move',2,{from:19,to:22});ok('红方先走，黑方应着',(await hostSocket.next(ackOf(request))).status===200);
hostSocket.close();
const hostBack=socket(b6,sided,{v:2});await hostBack.opened;m=await hostBack.next();
ok('执黑的房主断线重连，补发其间的着法，座位还是黑方',m.t==='room'&&m.room.version===3&&m.room.moves.length===2&&m.room.you==='black');
viewed=await b6.request('GET',sided);ok('刷新（HTTP）也认得执黑的房主',viewed.data.you==='black'&&viewed.data.players.red.name==='执红的好友');
request=act(hostBack,'offer-rematch',3);await hostBack.next(ackOf(request));
request=act(guestSocket,'respond',4,{accept:true});const guestRound=await guestSocket.next(roomAt(5));await guestSocket.next(ackOf(request));
m=await hostBack.next(roomAt(5));
ok('再来一局换边：房主改执红，好友改执黑',m.room.round===2&&m.room.you==='red'&&m.room.players.red.name==='执黑的房主'&&guestRound.room.you==='black');
hostBack.close();guestSocket.close();
const [r7,b7]=await players(client(),client());
const blackRoom=await lib.createRoom('执黑的房主',0,'black',transport(b7));
const host7=page(blackRoom.id,transport(b7)),guest7=page(blackRoom.id,transport(r7));syncs.push(host7,guest7);
await until(()=>guest7.room);await guest7.sync.send('join',{name:'执红的好友'});await until(()=>host7.room?.players.red);
await guest7.sync.send('move',{from:70,to:67});await until(()=>host7.room.history.length===1);
await host7.sync.send('move',{from:19,to:22});await until(()=>guest7.room.history.length===2);
ok('页面端 createRoom 带上 side：执黑的房主和执红的好友照常对局',blackRoom.you==='black'&&host7.room.you==='black'&&guest7.room.you==='red'&&guest7.room.turn==='red');
if(local){
 const [r8,b8]=await players(client(),client());
 made=await b8.request('POST',{action:'create',name:'执黑的房主',clockMinutes:0.05,side:'black'});const timedBlack=made.data.id;
 const watchBlack=socket(b8,timedBlack);await watchBlack.opened;await watchBlack.next(roomAt(0));
 const joinedRed=await r8.request('POST',{action:'join',room:timedBlack,version:0,name:'执红的好友'});
 m=await watchBlack.next((x)=>x.t==='room'&&x.room.result,8000);
 ok('执黑开房、好友执红不走：红方超时，执黑的房主获胜',joinedRed.data.you==='red'&&m.room.result.reason==='超时'&&m.room.result.winner==='black'&&m.room.you==='black');
 watchBlack.close();
 const [r9,b9]=await players(client(),client());
 made=await b9.request('POST',{action:'create',name:'执黑的房主',clockMinutes:0,side:'black',store:'d1'});const oldBlack=made.data.id;
 const host9=page(oldBlack,transport(b9)),guest9=page(oldBlack,transport(r9));syncs.push(host9,guest9);
 await until(()=>guest9.room);await guest9.sync.send('join',{name:'执红的好友'});await until(()=>host9.room?.players.red);
 await guest9.sync.send('move',{from:70,to:67});await until(()=>host9.room.history.length===1);
 await host9.sync.send('offer-rematch');await until(()=>guest9.room.offer);await guest9.sync.send('respond',{accept:true});await until(()=>host9.room.round===2);
 ok('（本地）D1 棋室也能执黑开房：好友执红先走，再来一局换边',/^[a-f0-9]{20}$/.test(oldBlack)&&made.data.you==='black'&&host9.room.you==='red'&&guest9.room.you==='black');
}else skip('执黑开房的超时、D1 棋室','只在本地有短时钟和 D1 新房间');
for(const p of syncs)p.sync.stop();

// One timed game, for the free-plan numbers in the PR: two players, a move every 12 s.
if(option('game')!==undefined){
 const minutes=Number(option('minutes')||30),every=Number(option('every')||12)*1000;
 const kind=option('d1')!==undefined?'d1':option('poll')!==undefined?'poll':'socket';
 const usageNow=async()=>(await r1.request('GET','x&usage')).data;
 const [rg,bg]=await players(client(),client());
 const blockedPath={socketPath:()=>'/api/game/ws?room=blocked'};
 const tr=transport(rg,kind==='poll'?blockedPath:{}),tb=transport(bg,kind==='poll'?blockedPath:{});
 const start=local?await usageNow():null;
 await lib.openSession(tr);await lib.openSession(tb);
 const id=kind==='d1'?(await (await tr.fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'红方',clockMinutes:20,store:'d1'})})).json()).id:(await lib.createRoom('红方',20,'red',tr)).id;
 const redG=page(id,tr),blackG=page(id,tb);
 await until(()=>blackG.room);await blackG.sync.send('join',{name:'黑方'});await until(()=>redG.room?.players.black);
 const pick=(room)=>{
  const {board,turn}=room,opponent=lib.opposite(turn),moves=[];
  board.forEach((p,i)=>{if(p?.side===turn)for(const to of lib.legalTargets(board,i))moves.push([i,to]);});
  const seen=new Set(room.history.map((h)=>lib.positionKey(h.before,h.side)));
  const safe=moves.filter(([f,t])=>{const next=lib.moveBoard(board,f,t);return lib.hasLegalMove(next,opponent)&&!seen.has(lib.positionKey(next,opponent));});
  const captures=safe.filter(([,t])=>board[t]),pool=room.quiet>60&&captures.length?captures:safe.length?safe:moves;
  return pool[Math.floor(Math.random()*pool.length)];
 };
 const end=Date.now()+minutes*60000;let last=Date.now(),plies=0;
 console.log(`\n计时对局：${kind}，${minutes} 分钟，每 ${every/1000} 秒一步，棋室 ${id}`);
 while(Date.now()+every<=end){
  await sleep(Math.max(0,last+every-Date.now()));
  const mover=redG.room.turn==='red'?redG:blackG;const [from,to]=pick(mover.room);
  await mover.sync.send('move',{from,to});last=Date.now();plies++;
  if(mover.room.result)break;
 }
 await sleep(Math.max(0,end-Date.now()));
 redG.sync.stop();blackG.sync.stop();await sleep(500);
 const worker=tr.counts.requests+tb.counts.requests,sentMessages=tr.counts.sent+tb.counts.sent;
 console.log(`走了 ${plies} 步${redG.room.result?'，对局结束：'+redG.room.result.reason:''}；页面发出 Worker 请求 ${worker} 次（其中 WebSocket 握手 ${tr.counts.sockets+tb.counts.sockets} 次），WebSocket 消息 ${sentMessages} 条`);
 if(start){
  const done=await usageNow(),d=Object.fromEntries(Object.keys(done).map((k)=>[k,done[k]-start[k]]));d.worker--;
  const billed=d.durable+Math.ceil(d.socketMessages/20);
  const games=Math.floor(Math.min(1e5/Math.max(1,d.worker),1e5/Math.max(1,billed),1e5/Math.max(1,d.durableRowsWritten),1e5/Math.max(1,d.d1RowsWritten)));
  console.log(`服务端计数：Worker 请求 ${d.worker}；DO 调用 ${d.durable}（其中 alarm ${d.alarms}），入站消息 ${d.socketMessages} 条（折 ${Math.ceil(d.socketMessages/20)} 次），关闭 ${d.socketCloses} 次；DO 计费请求约 ${billed}；DO 写入 ${d.durableRowsWritten} 行；D1 写入 ${d.d1RowsWritten} 行`);
  console.log(`按请求和写入算，免费额度每天约够 ${games} 局（DO 时长另算）`);
  ok('计时对局的 Worker 请求数与页面发出的一致',d.worker===worker);
 }
 assert.deepStrictEqual(strip(redG.room),strip((await rg.request('GET',id)).data));
 ok(`${redG.room.history.length} 步之后，页面重放出的棋室与服务端完整格式逐字段相同`,true);
}
console.log(`\n${passed} online checks passed${skipped?`, ${skipped} skipped`:''}. Room ${firstRoom}`);
process.exit(0);
