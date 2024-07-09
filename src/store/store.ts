import logger from 'handlers/logger';
import localforage from 'localforage';
import { useEffect, useState } from 'react';
import { persistReducer, persistStore } from 'redux-persist';
import { Signal } from 'signal-polyfill';

import { configureStore } from '@reduxjs/toolkit';

import { chunkDataSlice } from './slices/chunkDataSlice';
import { gameSlice } from './slices/gameSlice';
import { overlaySlice } from './slices/overlaySlice';
import { pixelPlacementSlice } from './slices/pixelPlacementSlice';
import { processedImagesSlice } from './slices/precessedImages';
import { effect } from './effect';
import { getStoredValue } from './getStoredData';
import { listenerMiddleware } from './storeMiddlewareCreator';

const reduxPersistedStorage = localforage.createInstance({
    name: 'picture_overlay',
    storeName: 'redux_persisted',
});

const commonPersistReducerParams = {
    serialize: false,
    deserialize: false,
    storage: reduxPersistedStorage,
};

const persistedOverlayReducer = persistReducer({ ...commonPersistReducerParams, key: 'overlay' }, overlaySlice.reducer);

export function configureAppStore() {
    return configureStore({
        reducer: {
            overlay: persistedOverlayReducer,
            game: gameSlice.reducer,
            chunkData: chunkDataSlice.reducer,
            pixelPlacement: pixelPlacementSlice.reducer,
            processedImages: processedImagesSlice.reducer,
        },
        devTools: import.meta.env.DEV,
        middleware(getDefaultMiddleware) {
            return getDefaultMiddleware().concat([listenerMiddleware.middleware]);
        },
    });
}

export const store = configureAppStore();
export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

const signalsStorage = localforage.createInstance({ name: 'picture_overlay', storeName: 'signals' });
export const isOverlayEnabledS = persistedSignal(true, 'isOverlayEnabled', (o) => o.overlayEnabled);

type StoredSignal<T> = [Signal.Computed<T>, (newValue: T) => void];

function persistedSignal<T = unknown>(initialValue: T, key: string, mapOld?: (old: RootState['overlay']) => T): StoredSignal<T> {
    const signal = new Signal.State(initialValue);
    let initialized = false;
    signalsStorage
        .getItem<T>(key)
        .then((stored) => {
            if (stored === null && mapOld) return getStoredValue(mapOld);
            return stored;
        })
        .then((stored) => {
            if (stored == null) return;
            if (!initialized) signal.set(stored);
        })
        .catch((e) => logger.log('failed to get persisted signal value', signal, e))
        .finally(() => {
            initialized = true;
        });

    const c = new Signal.Computed(() => {
        const value = signal.get();
        if (value !== initialValue && !initialized) {
            initialized = true;
            signalsStorage.setItem(key, value);
        } else if (initialized) signalsStorage.setItem(key, value);
        return value;
    });

    return [c, (newValue: T) => signal.set(newValue)];
}

export function useSignal<T>(signal: Signal.Computed<T> | StoredSignal<T>) {
    const [s, setS] = useState<T>(Array.isArray(signal) ? signal[0].get() : signal.get());
    useEffect(() => {
        return effect(() => {
            setS(Array.isArray(signal) ? signal[0].get() : signal.get());
        });
    });
    return s;
}
