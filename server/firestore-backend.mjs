/**
 * Transactional Firestore implementation for Seega Royale.
 * Server Admin SDK only. The public Firebase Web SDK must never import this file.
 *
 * No legacy browser balance is imported or silently converted. gameWallets
 * must be provisioned by a separate audited, idempotent migration.
 */
export function createFirestoreBackend(firestore, {FieldValue, verifyIdentity}){
 if(!firestore?.runTransaction || !FieldValue?.increment || typeof verifyIdentity!=='function')
  throw Error('Firebase Admin Firestore and trusted identity verifier required');
 const uidRef=uid=>{
  if(typeof uid!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(uid))throw Error('Invalid user id');
  return uid;
 };
 const ref=(collection,id)=>firestore.collection(collection).doc(String(id));
 const matchRef=id=>ref('gameMatches',id);
 const walletRef=uid=>ref('gameWallets',uidRef(uid));
 const activeRef=uid=>ref('gameActive',uidRef(uid));
 const queueRef=key=>ref('gameQueues',key);
 const ledgerRef=id=>ref('gameLedger',id);
 return {
  verifyIdentity,
  uniqueLedger(){return true;}, // tx.create below is an atomic unique document insert
  transaction(fn){
   return firestore.runTransaction(async native=>{
    const tx={
     async getMatch(id){const snap=await native.get(matchRef(id));return snap.exists?snap.data():null;},
     putMatch(m){native.set(matchRef(m.id),m);},
     async getWallet(uid){const snap=await native.get(walletRef(uid));return snap.exists?snap.data():null;},
     putWallet(uid,wallet){native.set(walletRef(uid),wallet);},
     async getLedger(id){const snap=await native.get(ledgerRef(id));return snap.exists?snap.data():null;},
     putLedger(id,value){native.create(ledgerRef(id),value);},
     addHouseFee(amountMinor){native.set(ref('gameHouse','fees'),{totalMinor:FieldValue.increment(amountMinor)},{merge:true});},
     async areFriends(a,b){
      if(a===b)return false;
      const pair=[uidRef(a),uidRef(b)].sort().join('__');
      const snap=await native.get(ref('friendRequests',pair));
      return snap.exists&&snap.data().status==='accepted'&&
       [snap.data().fromUid,snap.data().toUid].sort().join('__')===pair;
     },
     async getActive(uid){const snap=await native.get(activeRef(uid));return snap.exists?snap.data():null;},
     putActive(uid,matchId){native.set(activeRef(uid),{matchId});},
     deleteActive(uid){native.delete(activeRef(uid));},
     async getQueue(key){const snap=await native.get(queueRef(key));return snap.exists?snap.data():null;},
     putQueue(key,data){native.set(queueRef(key),data);},
     deleteQueue(key){native.delete(queueRef(key));}
    };
    return fn(tx);
   },{maxAttempts:5});
  }
 };
}
