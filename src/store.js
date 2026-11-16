import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=process.env.DATA_DIR || path.join(process.cwd(),'data');
fs.mkdirSync(dir,{recursive:true});
export const db=new DatabaseSync(path.join(dir,'seega.db'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,passhash TEXT,provider TEXT,provider_id TEXT,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '🦁',coins INTEGER NOT NULL DEFAULT 2500,gems INTEGER NOT NULL DEFAULT 75,wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,xp INTEGER NOT NULL DEFAULT 0,inventory TEXT NOT NULL DEFAULT '["classic"]',equipped TEXT NOT NULL DEFAULT 'classic',daily_claim INTEGER NOT NULL DEFAULT 0,settings TEXT NOT NULL DEFAULT '{}',created INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS provider_unique ON users(provider,provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS friendships(a TEXT NOT NULL,b TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,PRIMARY KEY(a,b));
CREATE TABLE IF NOT EXISTS dms(id TEXT PRIMARY KEY,sender TEXT NOT NULL,receiver TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS dms_people ON dms(sender,receiver,created);`);
const uuid=()=>crypto.randomUUID();
const decode=u=>u?{...u,inventory:JSON.parse(u.inventory||'[]'),settings:JSON.parse(u.settings||'{}')}:null;
export const getUser=id=>decode(db.prepare('SELECT * FROM users WHERE id=?').get(id));
export const getByEmail=email=>decode(db.prepare('SELECT * FROM users WHERE email=?').get(email));
export const getByProvider=(provider,pid)=>decode(db.prepare('SELECT * FROM users WHERE provider=? AND provider_id=?').get(provider,pid));
export function createUser({email=null,passhash=null,name='ضيف',provider='guest',providerId=null,avatar='🦁'}){
 const id=uuid();db.prepare('INSERT INTO users(id,email,passhash,provider,provider_id,name,avatar,created) VALUES(?,?,?,?,?,?,?,?)').run(id,email,passhash,provider,providerId,name,avatar,Date.now());return getUser(id);
}
export function linkProvider(id,provider,pid){db.prepare('UPDATE users SET provider=?,provider_id=? WHERE id=?').run(provider,pid,id);return getUser(id);}
export function updateUser(id,patch){
 const fields=['name','avatar','coins','gems','wins','losses','draws','xp','inventory','equipped','daily_claim','settings'];
 const pairs=Object.entries(patch).filter(([k])=>fields.includes(k));if(!pairs.length)return getUser(id);
 const vals=pairs.map(([k,v])=>(k==='inventory'||k==='settings')?JSON.stringify(v):v);
 db.prepare('UPDATE users SET '+pairs.map(([k])=>k+'=?').join(',')+' WHERE id=?').run(...vals,id);return getUser(id);
}
export function spend(id,currency,amount){if(!['coins','gems'].includes(currency)||!Number.isInteger(amount)||amount<1)throw Error('رصيد غير صحيح');
 const r=db.prepare(`UPDATE users SET ${currency}=${currency}-? WHERE id=? AND ${currency}>=?`).run(amount,id,amount);return r.changes>0;
}
export function addWallet(id,{coins=0,gems=0,xp=0,wins=0,losses=0,draws=0}={}){
 db.prepare('UPDATE users SET coins=MAX(0,coins+?),gems=MAX(0,gems+?),xp=xp+?,wins=wins+?,losses=losses+?,draws=draws+? WHERE id=?').run(coins,gems,xp,wins,losses,draws,id);return getUser(id);
}
export function leaderboards(){return db.prepare('SELECT id,name,avatar,wins,losses,xp,coins FROM users WHERE provider != ? ORDER BY wins DESC,xp DESC LIMIT 25').all('guest');}
export function searchUsers(q,exclude){return db.prepare('SELECT id,name,avatar,wins,xp FROM users WHERE id!=? AND name LIKE ? ORDER BY wins DESC LIMIT 12').all(exclude,'%'+q+'%');}
export function requestFriend(a,b){if(a===b||!getUser(b))return false;
 const existing=db.prepare('SELECT 1 FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)').get(a,b,b,a);
 if(existing)return false;db.prepare('INSERT INTO friendships(a,b,status,created) VALUES(?,?,?,?)').run(a,b,'pending',Date.now());return true;
}
export function acceptFriend(receiver,sender){return db.prepare("UPDATE friendships SET status='accepted' WHERE a=? AND b=? AND status='pending'").run(sender,receiver).changes>0;}
export function listFriends(id){const rows=db.prepare('SELECT * FROM friendships WHERE a=? OR b=? ORDER BY created DESC').all(id,id);return rows.map(r=>({status:r.status,incoming:r.b===id,user:getUser(r.a===id?r.b:r.a)}));}
export function sendDm(sender,receiver,body){const m={id:uuid(),sender,receiver,body,created:Date.now()};db.prepare('INSERT INTO dms(id,sender,receiver,body,created) VALUES(?,?,?,?,?)').run(m.id,m.sender,m.receiver,m.body,m.created);return m;}
export function dms(a,b){return db.prepare('SELECT * FROM dms WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY created DESC LIMIT 60').all(a,b,b,a).reverse();}
export const publicUser=u=>u&&({id:u.id,name:u.name,avatar:u.avatar,coins:u.coins,gems:u.gems,wins:u.wins,losses:u.losses,draws:u.draws,xp:u.xp,level:Math.floor(u.xp/500)+1,inventory:u.inventory,equipped:u.equipped,daily_claim:u.daily_claim,settings:u.settings,guest:u.provider==='guest',email:u.email});