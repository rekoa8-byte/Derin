import { initializeApp, getApps, getApp } from 'firebase/app';
import 'firebase/firestore';
import { 
    getFirestore,
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    memoryLocalCache,
    setLogLevel,
    doc, 
    onSnapshot, 
    setDoc, 
    getDoc 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress noisy internal WebChannel / RST_STREAM reconnect logs
try {
    setLogLevel('error');
} catch (_) {}

// Initialize Firebase App safely
let app;
try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (_) {
    try {
        app = initializeApp(firebaseConfig);
    } catch (err) {
        console.warn('[Firebase] App init warning:', err);
    }
}

const firestoreDatabaseId = (firebaseConfig && firebaseConfig.firestoreDatabaseId) || undefined;

// Create Firestore with offline persistent cache and experimental force long-polling.
// CRITICAL: initializeFirestore MUST be called BEFORE getFirestore so that long-polling is enforced,
// which completely prevents RST_STREAM (Code 13 INTERNAL) errors on proxy/preview networks.
function createFirestoreInstance() {
    if (!app) return null;

    // 1. Try initializeFirestore with persistentLocalCache (IndexedDB) + experimentalForceLongPolling
    try {
        return initializeFirestore(app, {
            experimentalForceLongPolling: true,
            experimentalLongPollingOptions: { timeoutSeconds: 30 },
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        }, firestoreDatabaseId);
    } catch (e1) {
        // 2. Fallback to memory cache if IndexedDB is restricted (e.g. private mode or WebViews)
        try {
            return initializeFirestore(app, {
                experimentalForceLongPolling: true,
                experimentalLongPollingOptions: { timeoutSeconds: 30 },
                localCache: memoryLocalCache()
            }, firestoreDatabaseId);
        } catch (e2) {
            // 3. Fallback to standard long-polling
            try {
                return initializeFirestore(app, {
                    experimentalForceLongPolling: true
                }, firestoreDatabaseId);
            } catch (e3) {
                // 4. If initializeFirestore was already called, retrieve existing instance
                try {
                    return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
                } catch (e4) {
                    try {
                        return getFirestore(app);
                    } catch (e5) {
                        console.warn('[Firebase] All Firestore initialization attempts failed:', e5);
                        return null;
                    }
                }
            }
        }
    }
}

export const db = createFirestoreInstance();

export { app, doc, onSnapshot, setDoc, getDoc, setLogLevel };

