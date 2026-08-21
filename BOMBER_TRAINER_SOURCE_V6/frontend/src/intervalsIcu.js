// Intervals.icu client + sincronització.
// FIX 2026-08-21: strict metrics + deterministic matching/dedup + resilient deletion.
// FIX 2026-08-21b: do not retry rate-limit responses and do not PATCH unchanged activities.
// FIX 2026-08-21c: PocketBase batch writes/deletes to avoid request storms.
const KEY_STORAGE = 'bt_intervals_icu_api_key';
const BATCH_SIZE = 50;
export function getIntervalsApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setIntervalsApiKey(value) { const key = String(value || '').trim(); if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE); }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(action, params = {}) {
  const key = getIntervalsApiKey(); if (!key) throw new Error('Falta la clau API personal d’Intervals.icu.');
  const query = new URLSearchParams({ action, ...params, _ts: String(Date.now()) }); let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`/api/intervals?${query.toString()}`, { headers: { 'x-intervals-api-key': key, 'Cache-Control': 'no-cache' }, cache: 'no-store' });
    const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
    if (response.ok) return data;
    lastError = new Error(data?.error || `Intervals.icu ha retornat ${response.status}.`);
    lastError.status = response.status;
    if (response.status === 429) throw lastError;
    if (![500,502,503,504].includes(response.status) || attempt === 3) throw lastError;
    await sleep(Math.max(Number(response.headers.get('retry-after') || 0) * 1000, 1500 * (attempt + 1)));
  }
  throw lastError || new Error('No s’ha pogut contactar amb Intervals.icu.');
}
export async function testIntervalsConnection() { const data = await request('athlete'); return { id:data?.id, name:data?.name || data?.firstname || 'Compte connectat' }; }
function dateChunks(days) { const end=new Date(); const start=new Date(end.getTime()-days*86400000); const chunks=[]; for(let cursor=start;cursor<=end;){const chunkEnd=new Date(Math.min(cursor.getTime()+364*86400000,end.getTime()));chunks.push({oldest:cursor.toISOString().slice(0,10),newest:chunkEnd.toISOString().slice(0,10)});cursor=new Date(chunkEnd.getTime()+86400000);} return chunks; }
async function fetchChunkResilient(chunk,onProgress,label=''){try{return{rows:await request('activities',chunk),failedRanges:[]};}catch(error){if(Number(error?.status)===429)return{rows:[],failedRanges:[{...chunk,error:error?.message||'Límit de peticions assolit'}]};const from=new Date(`${chunk.oldest}T00:00:00Z`).getTime();const to=new Date(`${chunk.newest}T00:00:00Z`).getTime();const days=Math.round((to-from)/86400000)+1;if(days<=31)return{rows:[],failedRanges:[{...chunk,error:error?.message||'Error desconegut'}]};const middle=new Date(from+Math.floor((days-1)/2)*86400000);const left={oldest:chunk.oldest,newest:middle.toISOString().slice(0,10)};const rightStart=new Date(middle.getTime()+86400000);const right={oldest:rightStart.toISOString().slice(0,10),newest:chunk.newest};onProgress?.(`${label}: reintentant rang petit`);const[a,b]=await Promise.all([fetchChunkResilient(left,onProgress,label),fetchChunkResilient(right,onProgress,label)]);return{rows:[...a.rows,...b.rows],failedRanges:[...a.failedRanges,...b.failedRanges]};}}
export async function getRecentIntervalsActivities(days=3650,onProgress){const all=[];const seen=new Set();const failedRanges=[];const chunks=dateChunks(days);for(let i=0;i<chunks.length;i+=1){onProgress?.(`Sincronitzant historial… bloc ${i+1}/${chunks.length}`);const result=await fetchChunkResilient(chunks[i],onProgress,`bloc ${i+1}/${chunks.length}`);for(const activity of Array.isArray(result.rows)?result.rows:[]){const id=String(activity?.id??'').trim();const fallback=`${activity?.start_date_local||''}|${activity?.name||''}|${activity?.type||''}`;const key=id?`id:${id}`:`fb:${fallback}`;if(!seen.has(key)){seen.add(key);all.push(activity);}}failedRanges.push(...result.failedRanges);if(i<chunks.length-1)await sleep(500);}return{activities:all,failedRanges};}
export async function getActivityStreams(activityId){return request('streams',{id:activityId});}
const firstValue=(...values)=>values.find(v=>v!==undefined&&v!==null&&v!=='');
function positiveNumber(...values){for(const v of values){if(v===undefined||v===null||v==='')continue;const n=Number(v);if(Number.isFinite(n)&&n>0)return n;}return null;}
function extractDurationSeconds(activity){return positiveNumber(activity?.moving_time,activity?.movingTime,activity?.elapsed_time,activity?.elapsedTime);}
function extractDistanceMeters(activity){return positiveNumber(activity?.icu_distance,activity?.distance,activity?.distance_meters,activity?.distanceMeters);}
function activityDateKey(activity){return String(firstValue(activity?.start_date_local,activity?.startDateLocal,activity?.start_date)||'').slice(0,10);}
function activityIdKey(activity){const id=activity?.id==null?'':String(activity.id).trim();return id||null;}
function activityStartKey(activity){return String(firstValue(activity?.start_date_local,activity?.startDateLocal,activity?.start_date)||'').slice(0,16);}
function activityNameKey(activity){return String(firstValue(activity?.name,activity?.activity_name,activity?.title)||'').trim().toLowerCase();}
function activityTypeKey(activity){return String(firstValue(activity?.type,activity?.activity_type,activity?.sport_type)||'').trim().toLowerCase();}
function wearableIdKey(w){const id=w?.activityId==null?'':String(w.activityId).trim();return id||null;}
function wearableStartKey(w,date){return String(w?.startDateLocal||date||'').slice(0,16);}
function wearableNameKey(w){return String(w?.name||'').trim().toLowerCase();}
function wearableTypeKey(w){return String(w?.activityType||'').trim().toLowerCase();}
function parseWearable(raw){if(!raw)return{};if(typeof raw==='string'){try{return JSON.parse(raw)||{};}catch(_){return{};}}return raw||{};}
function buildWearable(activity,existingWearable={}){const durationSeconds=extractDurationSeconds(activity);const distanceMeters=extractDistanceMeters(activity);const rawId=firstValue(activity?.id,existingWearable?.activityId);const activityId=rawId==null?null:String(rawId).trim()||null;return{...existingWearable,source:'intervals.icu',activityId,activityType:firstValue(activity?.type,activity?.activity_type,activity?.sport_type,existingWearable?.activityType)||null,name:firstValue(activity?.name,activity?.activity_name,activity?.title,existingWearable?.name)||null,startDateLocal:firstValue(activity?.start_date_local,activity?.startDateLocal,activity?.start_date,existingWearable?.startDateLocal)||null,durationSeconds:durationSeconds||null,distanceMeters:distanceMeters||null,distanceKm:distanceMeters?distanceMeters/1000:null,icuDistanceMeters:positiveNumber(activity?.icu_distance),averageSpeed:positiveNumber(activity?.average_speed,activity?.averageSpeed),heartRate:{average:positiveNumber(activity?.average_heartrate,activity?.averageHeartRate,activity?.average_hr,activity?.avg_hr),max:positiveNumber(activity?.max_heartrate,activity?.maxHeartRate,activity?.max_hr),min:positiveNumber(activity?.min_heartrate,activity?.minHeartRate,activity?.min_hr)},calories:positiveNumber(activity?.calories),trainingLoad:positiveNumber(activity?.icu_training_load,activity?.training_load,activity?.trainingLoad,activity?.hr_load,activity?.power_load,activity?.pace_load),streamTypes:firstValue(activity?.stream_types,activity?.streamTypes,existingWearable?.streamTypes)||[],syncedAt:new Date().toISOString()};}
function needsWearableUpdate(existing,next){if(!existing)return true;const keys=['activityId','activityType','name','startDateLocal','durationSeconds','distanceMeters','distanceKm','icuDistanceMeters','averageSpeed','calories','trainingLoad'];for(const key of keys){if(String(existing?.[key]??'')!==String(next?.[key]??''))return true;}for(const key of ['average','max','min']){if(String(existing?.heartRate?.[key]??'')!==String(next?.heartRate?.[key]??''))return true;}return false;}

async function sendBatch(pb,operations,onProgress,label='Actualitzant dades') {
  if (!operations.length) return {count:0,batch:true};
  let count=0;
  for(let start=0;start<operations.length;start+=BATCH_SIZE){
    const slice=operations.slice(start,start+BATCH_SIZE);
    onProgress?.(`${label}… ${Math.min(start+BATCH_SIZE,operations.length)}/${operations.length}`);
    try{
      const batch=pb.createBatch();
      for(const op of slice){
        const collection=batch.collection(op.collection||'bt_sessions');
        if(op.method==='create') collection.create(op.body);
        else if(op.method==='update') collection.update(op.id,op.body);
        else if(op.method==='delete') collection.delete(op.id);
      }
      await batch.send();
      count+=slice.length;
    }catch(error){
      const status=Number(error?.status||error?.response?.code||0);
      // If the Cloud instance doesn't allow batch, or one transaction fails,
      // fall back only for this slice. This preserves compatibility without
      // sacrificing batching on instances where it is enabled.
      if(status===429) throw error;
      for(const op of slice){
        if(op.method==='create') await pb.collection(op.collection||'bt_sessions').create(op.body);
        else if(op.method==='update') await pb.collection(op.collection||'bt_sessions').update(op.id,op.body);
        else if(op.method==='delete') await pb.collection(op.collection||'bt_sessions').delete(op.id);
        count+=1;
      }
    }
  }
  pb.clearRequestCache?.();
  return {count,batch:true};
}

export async function syncRecentIntervalsActivities({pb,owner,days=3650,typeResolver,onProgress}){
  const result=await getRecentIntervalsActivities(days,onProgress);const activities=result.activities||[];let imported=0;let updated=0;let skipped=0;
  const existingRows=await pb.collection('bt_sessions').getFullList({sort:'-created',filter:`owner = \"${owner}\"`});
  const byId=new Map();const rowsByDate=new Map();
  for(const row of existingRows){const wearable=parseWearable(row?.wearable);const record={row,wearable,sourced:wearable?.source==='intervals.icu'};const id=wearableIdKey(wearable);if(id)byId.set(id,record);const date=String(row?.date||wearable?.startDateLocal||'').slice(0,10);if(date){const list=rowsByDate.get(date)||[];list.push(record);rowsByDate.set(date,list);}}
  const consumed=new Set();const operations=[];
  for(const activity of activities){try{
    const date=activityDateKey(activity);if(!date){skipped+=1;continue;}
    const id=activityIdKey(activity);const start=activityStartKey(activity);const name=activityNameKey(activity);const type=activityTypeKey(activity);
    let existingRecord=id?byId.get(id):null;if(existingRecord&&consumed.has(existingRecord.row.id))existingRecord=null;
    const candidates=(rowsByDate.get(date)||[]).filter(r=>!consumed.has(r.row.id));
    if(!existingRecord)existingRecord=candidates.find(r=>wearableStartKey(r.wearable,r.row?.date)===start&&wearableNameKey(r.wearable)===name&&wearableTypeKey(r.wearable)===type)||null;
    if(!existingRecord&&start)existingRecord=candidates.find(r=>wearableStartKey(r.wearable,r.row?.date)===start&&wearableTypeKey(r.wearable)===type)||null;
    if(!existingRecord){const matches=candidates.filter(r=>wearableNameKey(r.wearable)===name&&wearableTypeKey(r.wearable)===type);if(matches.length===1)existingRecord=matches[0];}
    const suggestedType=typeResolver?.(activity)||null;
    if(existingRecord){
      consumed.add(existingRecord.row.id);const wearable=buildWearable(activity,existingRecord.wearable);if(id)byId.set(id,{row:existingRecord.row,wearable,sourced:true});
      const typePatch=suggestedType&&existingRecord.row.type==='manteniment'?suggestedType:null;const wearableChanged=needsWearableUpdate(existingRecord.wearable,wearable);
      if(wearableChanged||typePatch){const patch={};if(wearableChanged){patch.date=date;patch.wearable=wearable;if(wearable.durationSeconds)patch.duration=Math.round((wearable.durationSeconds/60)*10)/10;}if(typePatch)patch.type=typePatch;operations.push({method:'update',id:existingRecord.row.id,body:patch});updated+=1;}
      continue;
    }
    const wearable=buildWearable(activity);operations.push({method:'create',body:{type:suggestedType||'manteniment',date,duration:wearable.durationSeconds?Math.round((wearable.durationSeconds/60)*10)/10:0,points:0,notes:'Activitat sincronitzada des d’Intervals.icu · pendent d’associar',data:[],wearable,owner}});imported+=1;
  }catch(error){skipped+=1;console.warn('[intervalsIcu] skip',activity?.id,error?.message||error);}}
  if(operations.length) await sendBatch(pb,operations,onProgress,'Guardant activitats');
  return{imported,updated,existing:updated,skipped,total:activities.length,failedRanges:result.failedRanges};
}

function isLegacyIntervalsRow(row){const wearable=parseWearable(row?.wearable);const source=String(wearable?.source||'').toLowerCase();const activityId=String(wearable?.activityId||'').trim();const notes=String(row?.notes||'').toLowerCase();return source==='intervals.icu'||Boolean(activityId)||notes.includes('intervals.icu');}
export async function deleteAllIntervalsActivities({pb,owner,onProgress}){
  const rows=await pb.collection('bt_sessions').getFullList({filter:`owner = \"${owner}\"`});const imported=rows.filter(isLegacyIntervalsRow);if(!imported.length)return 0;
  const operations=imported.map(row=>({method:'delete',id:row.id,collection:'bt_sessions'}));
  try{const result=await sendBatch(pb,operations,onProgress,'Esborrant activitats sincronitzades');return result.count;}
  catch(error){if(Number(error?.status)===429)throw new Error('PocketBase ha assolit el límit temporal de peticions. Espera que es restableixi i torna-ho a provar.');throw error;}
}
export const __test__={buildWearable,extractDurationSeconds,extractDistanceMeters,needsWearableUpdate};
