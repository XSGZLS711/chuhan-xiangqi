import {database} from '@/db/raw';
import {Room,PublicRoom,newRoom,playerSide,expireClock,applyAction,GameError,cleanName} from '@/lib/game';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
async function identity(req:Request){let token=req.headers.get('cookie')?.match(/(?:^|;\s*)chuhan_session=([a-f0-9]{64})(?:;|$)/)?.[1];let cookie='';if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');cookie=`chuhan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol==='https:'?'; Secure':''}`;}const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return {id:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join(''),cookie};}
function reply(data:unknown,cookie='',status=200){return Response.json(data,{status,headers:{...headers,...(cookie?{'Set-Cookie':cookie}:{})}});}
function validRoom(id:string){if(!/^[a-f0-9]{20}$/.test(id))throw new GameError('房间链接不正确，请重新复制邀请链接。',404);}
async function readRoom(id:string){validRoom(id);const db=database().withSession('first-primary');const row=await db.prepare('SELECT state, version FROM rooms WHERE id = ?').bind(id).first<{state:string;version:number}>();if(!row)throw new GameError('没有找到这间棋室，请核对邀请链接。',404);return {db,room:JSON.parse(row.state) as Room,version:row.version};}
async function publicState(room:Room,version:number,id:string):Promise<PublicRoom>{const db=database(),side=playerSide(room,id),now=Date.now();if(side)await db.prepare('INSERT INTO presence (id, seen_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET seen_at=excluded.seen_at').bind(room.id+':'+id,now).run();const online=async(pid:string)=>{const v=await db.prepare('SELECT seen_at FROM presence WHERE id = ?').bind(room.id+':'+pid).first<{seen_at:number}>();return !!v&&now-v.seen_at<18000;};const [red,black]=await Promise.all([online(room.players.red.id),room.players.black?online(room.players.black.id):Promise.resolve(false)]);return {...room,players:{red:{name:room.players.red.name,online:red},black:room.players.black?{name:room.players.black.name,online:black}:null},you:side,version,serverNow:now};}
export async function GET(req:Request){let cookie='';try{const identityValue=await identity(req);cookie=identityValue.cookie;const id=new URL(req.url).searchParams.get('room');if(!id)return reply({ready:true},cookie);let {db,room,version}=await readRoom(id);if(expireClock(room,Date.now())){const saved=await db.prepare('UPDATE rooms SET state=?, version=version+1, updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(room),Date.now(),id,version).run();if(saved.meta.changes)version++;else{const fresh=await readRoom(id);room=fresh.room;version=fresh.version;}}return reply(await publicState(room,version,identityValue.id),cookie);}catch(error){return failure(error,cookie);}}
export async function POST(req:Request){let cookie='';try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new GameError('请求来源不匹配。',403);
 if(req.headers.get('sec-fetch-site')==='cross-site')throw new GameError('请在棋室页面操作。',403);
 const raw=await req.text();if(raw.length>4096)throw new GameError('请求内容过长。',413);let a:Record<string,unknown>;try{a=JSON.parse(raw);}catch{throw new GameError('请求格式不正确。');}if(!a||typeof a!=='object'||Array.isArray(a))throw new GameError('请求格式不正确。');
 const me=await identity(req);cookie=me.cookie;const now=Date.now();
 if(a.action==='create'){
  const clock=Number(a.clockMinutes??0);if(![0,10,20,30].includes(clock))throw new GameError('请选择有效的对局时长。');
  const id=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>n.toString(16).padStart(2,'0')).join('');const room=newRoom(id,{id:me.id,name:cleanName(a.name)},clock,now);
  await database().prepare('INSERT INTO rooms (id,state,version,updated_at) VALUES (?,?,0,?)').bind(id,JSON.stringify(room),now).run();return reply(await publicState(room,0,me.id),cookie);
 }
 const id=String(a.room??'');let {db,room,version}=await readRoom(id);
 if(a.version!==version)throw new GameError('棋局刚有变化，已同步，请再试一次。',409);
 if(expireClock(room,now)){
  const saved=await db.prepare('UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(room),now,id,version).run();if(!saved.meta.changes)throw new GameError('棋局刚有变化，请稍后重试。',409);return reply(await publicState(room,version+1,me.id),cookie);
 }
 applyAction(room,me.id,a,now);
 const saved=await db.prepare('UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(room),now,id,version).run();if(!saved.meta.changes)throw new GameError('对方刚刚进行了操作，已同步，请再试一次。',409);
 return reply(await publicState(room,version+1,me.id),cookie);
 }catch(error){return failure(error,cookie);}}
function failure(error:unknown,cookie:string){if(error instanceof GameError)return reply({error:error.message},cookie,error.status);console.error('Game request failed',error instanceof Error?error.message:'Unknown error');return reply({error:'棋室暂时连接不上，请稍后重试。'},cookie,503);}
