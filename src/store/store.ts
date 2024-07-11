import { persistStore } from 'redux-persist';

import { configureStore } from '@reduxjs/toolkit';

import { chunkDataSlice } from './slices/chunkDataSlice';
import { overlaySlice } from './slices/overlaySlice';
import { pixelPlacementSlice } from './slices/pixelPlacementSlice';
import { processedImagesSlice } from './slices/precessedImages';
import { listenerMiddleware } from './storeMiddlewareCreator';

export function configureAppStore() {
    return configureStore({
        reducer: {
            overlay: overlaySlice.reducer,
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
