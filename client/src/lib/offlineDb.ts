import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface IMSOfflineSchema extends DBSchema {
  cache: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<IMSOfflineSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<IMSOfflineSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<IMSOfflineSchema>("ims-offline-v1", 1, {
      upgrade(database) {
        database.createObjectStore("cache");
      },
    });
  }
  return dbPromise;
}

const QUEUE_KEY = "mutation-queue";
const PATIENTS_LIST_PREFIX = "patients:list:";
const PATIENT_DETAIL_PREFIX = "patient:";
const APPTS_TODAY_KEY = "appointments:today";

export type QueuedMutation = {
  path: string;
  method: string;
  body: string;
  token: string | null;
  createdAt: number;
};

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("cache", value, key);
}

export async function cacheGet(key: string): Promise<unknown | undefined> {
  const db = await getDb();
  return db.get("cache", key);
}

export async function cachePatientsList(urlKey: string, payload: unknown): Promise<void> {
  await cacheSet(PATIENTS_LIST_PREFIX + urlKey, payload);
  const keys = ((await cacheGet("patients:list-keys")) as string[] | undefined) ?? [];
  const k = PATIENTS_LIST_PREFIX + urlKey;
  if (!keys.includes(k)) {
    keys.push(k);
    while (keys.length > 50) keys.shift();
    await cacheSet("patients:list-keys", keys);
  }
}

export async function getAnyPatientsListCache(): Promise<unknown | null> {
  const keys = (await cacheGet("patients:list-keys")) as string[] | undefined;
  if (!keys?.length) return null;
  const last = keys[keys.length - 1];
  const v = await cacheGet(last);
  return v ?? null;
}

export async function cachePatientDetail(id: number, payload: unknown): Promise<void> {
  await cacheSet(PATIENT_DETAIL_PREFIX + id, payload);
}

export async function cacheAppointmentsToday(payload: unknown): Promise<void> {
  await cacheSet(APPTS_TODAY_KEY, payload);
}

export async function getCachedPatientDetail(id: number): Promise<unknown | null> {
  const v = await cacheGet(PATIENT_DETAIL_PREFIX + id);
  return v ?? null;
}

export async function getCachedAppointmentsToday(): Promise<unknown | null> {
  const v = await cacheGet(APPTS_TODAY_KEY);
  return v ?? null;
}

export async function getMutationQueue(): Promise<QueuedMutation[]> {
  const db = await getDb();
  return ((await db.get("cache", QUEUE_KEY)) as QueuedMutation[] | undefined) ?? [];
}

export async function setMutationQueue(items: QueuedMutation[]): Promise<void> {
  const db = await getDb();
  await db.put("cache", items, QUEUE_KEY);
}

export function patientsListCacheKey(searchParams: string): string {
  return searchParams || "default";
}

/** Resolve cached patient list for a full /api/patients?... URL */
export async function getPatientsListFromPath(fullPath: string): Promise<unknown | null> {
  const q = fullPath.includes("?") ? fullPath.split("?")[1]! : "default";
  const direct = await cacheGet(PATIENTS_LIST_PREFIX + q);
  if (direct != null) return direct;
  return getAnyPatientsListCache();
}
