import assert from "node:assert/strict";
import test from "node:test";
import { drainMediaDeletionQueue } from "../workers/media-cleanup.js";
import { TestD1 } from "./helpers/d1.js";

test('two cleanup workers atomically claim an object once and never delete active media',async()=>{
 const db=new TestD1();try{
 db.exec("INSERT INTO users(id,status,created_at,updated_at)VALUES('u','active',1,1);INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,state,created_at)VALUES('active','u','active.png','gallery','image/png',1,'active',1);INSERT INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)VALUES('once.png','op',1,1),('active.png','op',1,1)");
 const deleted=[],env={DB:db,MEDIA_CLEANUP_ENABLED:'true',MEDIA:{async delete(key){deleted.push(key);}}};await Promise.all([drainMediaDeletionQueue(env,100),drainMediaDeletionQueue(env,100)]);assert.deepEqual(deleted,['once.png']);assert.equal((await db.prepare("SELECT state FROM social_media WHERE id='active'").first()).state,'active');
 }finally{db.close();}
});
test('fixture cleanup scope leaves unrelated queued objects untouched',async()=>{
 const db=new TestD1();try{db.exec("INSERT INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)VALUES('this-test','op',1,1),('unrelated','other',1,1)");const deleted=[];await drainMediaDeletionQueue({DB:db,MEDIA_CLEANUP_ENABLED:'true',MEDIA:{delete:async key=>deleted.push(key)}},100,{objectKeys:['this-test']});assert.deepEqual(deleted,['this-test']);assert.equal((await db.prepare("SELECT completed_at FROM media_deletion_queue WHERE object_key='unrelated'").first()).completed_at,null);}finally{db.close();}
});

test("media cleanup deletes due objects, records completion, and leaves future work", async () => {
  const database = new TestD1();
  database.exec(`
    INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES ('cleanup-owner','Cleanup','active',1,1);
    INSERT INTO social_media(id,owner_user_id,object_key,purpose,content_type,byte_size,state,created_at)
    VALUES ('cleanup-media','cleanup-owner','due.webp','gallery','image/webp',10,'pending_deletion',1);
    INSERT INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)
    VALUES ('due.webp','op',99,1),('future.webp','op',200,1);
  `);
  const deleted = [];
  const result = await drainMediaDeletionQueue({
    DB: database,
    MEDIA_CLEANUP_ENABLED: 'true',
    MEDIA: { delete: async (key) => deleted.push(key) },
  }, 100);
  assert.deepEqual(result, { selected: 1, completed: 1, failed: 0, exhausted: 0 });
  assert.deepEqual(deleted, ["due.webp"]);
  assert.equal(database.database.prepare(
    "SELECT completed_at FROM media_deletion_queue WHERE object_key='due.webp'",
  ).get().completed_at, 100);
  assert.equal(database.database.prepare(
    "SELECT completed_at FROM media_deletion_queue WHERE object_key='future.webp'",
  ).get().completed_at, null);
  assert.equal(database.database.prepare(
    "SELECT COUNT(*) count FROM social_media WHERE object_key='due.webp'",
  ).get().count, 0);
  database.close();
});

test("media cleanup backs off failed objects without logging or exposing their content", async () => {
  const database = new TestD1();
  database.exec(`
    INSERT INTO media_deletion_queue(object_key,operation_id,next_attempt_at,created_at)
    VALUES ('failure.webp','op',99,1);
  `);
  const result = await drainMediaDeletionQueue({
    DB: database,
    MEDIA_CLEANUP_ENABLED: 'true',
    MEDIA: { delete: async () => { throw new Error("sensitive provider detail"); } },
  }, 100);
  assert.deepEqual(result, { selected: 1, completed: 0, failed: 1, exhausted: 0 });
  const row = database.database.prepare(
    "SELECT attempts,next_attempt_at,last_error_code FROM media_deletion_queue WHERE object_key='failure.webp'",
  ).get();
  assert.equal(row.attempts, 1);
  assert.ok(row.next_attempt_at > 100);
  assert.equal(row.last_error_code, "r2_delete_failed");
  database.close();
});

test("media cleanup surfaces exhausted retries without logging object identifiers", async () => {
  const database = new TestD1();
  database.exec(`
    INSERT INTO media_deletion_queue(object_key,operation_id,attempts,next_attempt_at,created_at,last_error_code)
    VALUES ('exhausted-private.webp','op',10,1,1,'r2_delete_failed');
  `);
  const result = await drainMediaDeletionQueue({
    DB: database,
    MEDIA_CLEANUP_ENABLED: 'true',
    MEDIA: { delete: async () => { throw new Error("must not run"); } },
  }, 100);
  assert.deepEqual(result, { selected: 0, completed: 0, failed: 0, exhausted: 1 });
  database.close();
});
