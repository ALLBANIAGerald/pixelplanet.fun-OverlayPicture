import { RootState } from './store';

async function getIndexedDb() {
    const dbs = await indexedDB.databases();
    if (!dbs.find((db) => db.name === 'picture_overlay')) return undefined;
    return new Promise<IDBDatabase>((resolve, reject) => {
        const openDbRequest = indexedDB.open('picture_overlay');
        openDbRequest.onsuccess = () => resolve(openDbRequest.result);
        openDbRequest.onerror = () => reject(openDbRequest.error);
    });
}

async function getDbValue(db: IDBDatabase) {
    const trans = db.transaction('redux_persisted', 'readonly');
    const objStore = trans.objectStore('redux_persisted');
    return new Promise<RootState['overlay']>((resolve, reject) => {
        const getReq = objStore.get('persist:overlay');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
    });
}

export async function getStoredValue<T = unknown>(selector: (value: Awaited<ReturnType<typeof getDbValue>>) => T) {
    try {
        const db = await getIndexedDb();
        if (!db) return undefined;
        const value = await getDbValue(db);
        return selector(value);
    } catch (error) {
        return undefined;
    }
}
