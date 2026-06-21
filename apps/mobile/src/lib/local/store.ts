import { IdbSyncStore } from './idb-store';

/**
 * The app's single device-local store (IndexedDB). Screens read/write through the
 * repository, which is backed by this; the sync runner reconciles it with the
 * server. See ADR-0010.
 */
export const localStore = new IdbSyncStore();
