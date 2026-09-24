import { db, doc, onSnapshot, setDoc, getDoc } from './firebase.js';

export const STORAGE_KEY = 'arishop_data_v7';
export const STORAGE_MIRROR_KEY = 'arishop_data_v7_mirror';

// Sample video for testing and demonstration
export const SAMPLE_TECH_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
export const SAMPLE_WATCH_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4';

// Kurdistan & Iraq Cities with standard delivery fees (IQD)
export const DEFAULT_CITIES = [
    { id: 'sulaymaniyah', nameKu: 'سلێمانی', nameAr: 'السليمانية', nameEn: 'Sulaymaniyah', fee: 3000 },
    { id: 'erbil', nameKu: 'هەولێر', nameAr: 'أربيل', nameEn: 'Erbil', fee: 4000 },
    { id: 'duhok', nameKu: 'دهۆک', nameAr: 'دهوك', nameEn: 'Duhok', fee: 5000 },
    { id: 'kirkuk', nameKu: 'کەرکووک', nameAr: 'كركوك', nameEn: 'Kirkuk', fee: 4000 },
    { id: 'halabja', nameKu: 'هەڵەبجە', nameAr: 'حلبجة', nameEn: 'Halabja', fee: 3000 },
    { id: 'kalar', nameKu: 'گەرمیان / کەلار', nameAr: 'كلار / كرميان', nameEn: 'Kalar / Garmian', fee: 4000 },
    { id: 'zakho', nameKu: 'زاخۆ', nameAr: 'زاخو', nameEn: 'Zakho', fee: 5000 },
    { id: 'other', nameKu: 'شارەکانی تر', nameAr: 'باقي المحافظات', nameEn: 'Other Cities', fee: 5000 }
];
export const CITIES = DEFAULT_CITIES;

export const DEFAULT_PROMO_CODES = [
    { code: 'REBAZ10', type: 'percent', value: 10, label: '10% Discount' },
    { code: 'REBAZ20', type: 'percent', value: 20, label: '20% Discount' },
    { code: 'NEW2026', type: 'percent', value: 15, label: '15% Discount' },
    { code: 'FREE', type: 'free_delivery', value: 100, label: 'Free Delivery' },
    { code: 'BEPARAME', type: 'free_delivery', value: 100, label: 'Free Delivery' }
];

let lastKnownServerTimestamp = 0;
let syncTimeoutId = null;

export function getDefaultData() {
    return {
        shopName: 'Derin__Collection',
        shopLogo: '/derin-logo.svg',
        adminUsername: 'Farhang',
        adminPassword: 'Farhang123$',
        lastUpdated: 0,
        categories: [
            { id: 'cat1', nameEn: 'Watch', nameAr: 'ساعة', nameKu: 'سەعات', icon: '⌚' },
            { id: 'cat2', nameEn: 'Glasses', nameAr: 'نظارات', nameKu: 'عەینەك', icon: '👓' },
            { id: 'cat3', nameEn: 'Bracelet', nameAr: 'سوار', nameKu: 'دەست بەند', icon: '📿' },
            { id: 'cat4', nameEn: 'Electronics', nameAr: 'إلكترونيات', nameKu: 'ئەلیکترۆنیات', icon: '💻' },
            { id: 'cat5', nameEn: 'Other', nameAr: 'أخرى', nameKu: 'تر', icon: '🎯' }
        ],
        contactInfo: {
            address: 'Sulaymaniyah, Iraq',
            phone: '+964 770 123 4567',
            telegram: 'https://t.me/rebazshop',
            snapchat: 'https://www.snapchat.com/add/rebazshop',
            tiktok: 'https://www.tiktok.com/@rebazshop',
            website: 'https://rebazshop.com',
            hours: 'Sun–Thu: 10:00 – 22:00'
        },
        products: [
            {
                id: 1,
                name: 'لابتۆپی لینۆڤۆ IdeaPad Slim',
                categoryId: 'cat4',
                price: 780000,
                stockStatus: 'in-stock',
                discount: 10,
                description: 'هێندستنێکی مۆدێرن و کوالیتی بەرز، بە دیزاینێکی ڕەشی شیک و ئاسوودە. گونجاوە بۆ گوێگرتن لە میوزیک، یاری، فیلم و پەیوەندی و بەکارهێنانی ڕۆژانە.',
                image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80',
                video: SAMPLE_TECH_VIDEO,
                likes: 18
            },
            {
                id: 2,
                name: 'Luxury Mechanical Watch',
                categoryId: 'cat1',
                price: 450000,
                stockStatus: 'in-stock',
                discount: 15,
                description: 'Elegant stainless steel with automatic movement, sapphire glass, water resistant to 50m.',
                image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
                video: SAMPLE_WATCH_VIDEO,
                likes: 24
            },
            {
                id: 3,
                name: 'Aviator Sunglasses',
                categoryId: 'cat2',
                price: 75000,
                stockStatus: 'in-stock',
                discount: 0,
                description: 'Classic aviator style with polarized UV400 protection and ultra-light alloy frame.',
                image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80',
                video: '',
                likes: 15
            },
            {
                id: 4,
                name: 'Leather Braided Bracelet',
                categoryId: 'cat3',
                price: 25000,
                stockStatus: 'out-of-stock',
                discount: 5,
                description: 'Genuine leather with magnetic stainless steel clasp.',
                image: 'https://images.unsplash.com/photo-1611591475825-9a84279ea44f?w=600&auto=format&fit=crop&q=80',
                video: '',
                likes: 9
            },
            {
                id: 5,
                name: 'Smart Sport Watch Pro',
                categoryId: 'cat1',
                price: 350000,
                stockStatus: 'soon',
                discount: 10,
                description: 'Heart rate sensor, GPS tracking, AMOLED always-on display, and 14-day battery.',
                image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
                video: SAMPLE_WATCH_VIDEO,
                likes: 32
            },
            {
                id: 6,
                name: 'Vintage Round Glasses',
                categoryId: 'cat2',
                price: 55000,
                stockStatus: 'in-stock',
                discount: 0,
                description: 'Retro round frame with anti-reflective and blue light filter lenses.',
                image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600&auto=format&fit=crop&q=80',
                video: '',
                likes: 11
            }
        ],
        orders: [],
        promoCodes: DEFAULT_PROMO_CODES,
        cities: JSON.parse(JSON.stringify(DEFAULT_CITIES)),
        soundEnabled: true
    };
}

export function sanitizeStoreData(data) {
    if (!data || typeof data !== 'object') return getDefaultData();
    if (!data.categories || !Array.isArray(data.categories) || (data.categories.length === 0 && !data.lastUpdated)) {
        data.categories = getDefaultData().categories;
    }
    if (!data.products || !Array.isArray(data.products) || (data.products.length === 0 && !data.lastUpdated)) {
        data.products = getDefaultData().products;
    }
    if (!data.orders || !Array.isArray(data.orders)) {
        data.orders = [];
    }
    if (!data.cities || !Array.isArray(data.cities) || data.cities.length === 0) {
        data.cities = JSON.parse(JSON.stringify(DEFAULT_CITIES));
    }
    if (!data.shopName || typeof data.shopName !== 'string' || data.shopName === 'فرۆشگا' || data.shopName === 'Derin_Collection') {
        data.shopName = 'Derin__Collection';
    } else {
        data.shopName = data.shopName.trim();
    }
    if (!data.shopLogo || data.shopLogo === '/rebaz-logo.jpg') {
        data.shopLogo = '/derin-logo.svg';
    }
    if (!data.promoCodes || !Array.isArray(data.promoCodes)) {
        data.promoCodes = DEFAULT_PROMO_CODES;
    }
    if (!data.adminUsername || typeof data.adminUsername !== 'string') {
        data.adminUsername = 'Farhang';
    } else {
        data.adminUsername = data.adminUsername.trim();
    }
    if (!data.adminPassword || typeof data.adminPassword !== 'string' || data.adminPassword === 'admin123') {
        data.adminPassword = 'Farhang123$';
    }
    if (data.soundEnabled === undefined) {
        data.soundEnabled = true;
    }
    if (!data.contactInfo || typeof data.contactInfo !== 'object') {
        data.contactInfo = getDefaultData().contactInfo;
    }
    const defaultContact = getDefaultData().contactInfo;
    for (let key in defaultContact) {
        if (!data.contactInfo[key]) data.contactInfo[key] = defaultContact[key];
    }
    data.orders.forEach(o => {
        if (o.deleted === undefined) o.deleted = false;
        if (o.productImage === undefined) o.productImage = '';
        if (o.adminSeen === undefined) o.adminSeen = true;
        if (o.userSeen === undefined) o.userSeen = true;
        if (o.city === undefined) o.city = 'sulaymaniyah';
        if (o.deliveryFee === undefined) o.deliveryFee = 3000;
        if (o.discountAmount === undefined) o.discountAmount = 0;
        if (o.promoCode === undefined) o.promoCode = '';
    });
    data.products.forEach(p => {
        if (!p.stockStatus) p.stockStatus = 'in-stock';
        if (p.video === undefined) p.video = '';
        if (typeof p.likes !== 'number') {
            const seedLikes = { 1: 18, 2: 24, 3: 15, 4: 9, 5: 32, 6: 11 };
            p.likes = seedLikes[p.id] !== undefined ? seedLikes[p.id] : 8;
        }
    });
    return data;
}

// Multi-tier persistent storage engine protecting against Safari Private Browsing, iframe restrictions, WebView sandboxes, and quota limits
const memoryFallback = {};
export const safeStorage = {
    getItem(key) {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const val = window.localStorage.getItem(key);
                if (val !== null && val !== undefined) return val;
            }
        } catch (_) {}
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                const val = window.sessionStorage.getItem(key);
                if (val !== null && val !== undefined) return val;
            }
        } catch (_) {}
        try {
            if (typeof document !== 'undefined' && document.cookie) {
                const escaped = key.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1');
                const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
                if (match) return decodeURIComponent(match[1]);
            }
        } catch (_) {}
        return memoryFallback[key] !== undefined ? memoryFallback[key] : null;
    },
    setItem(key, value) {
        const strVal = String(value);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, strVal);
            }
        } catch (_) {}
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem(key, strVal);
            }
        } catch (_) {}
        try {
            if (typeof document !== 'undefined') {
                // 1 year persistent cookie with SameSite=Lax
                document.cookie = `${key}=${encodeURIComponent(strVal)}; max-age=31536000; path=/; SameSite=Lax`;
            }
        } catch (_) {}
        memoryFallback[key] = strVal;
    },
    removeItem(key) {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (_) {}
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.removeItem(key);
            }
        } catch (_) {}
        try {
            if (typeof document !== 'undefined') {
                document.cookie = `${key}=; max-age=0; path=/; SameSite=Lax`;
            }
        } catch (_) {}
        delete memoryFallback[key];
    }
};

export function loadData() {
    try {
        let raw = safeStorage.getItem(STORAGE_KEY);
        if (!raw) {
            raw = safeStorage.getItem(STORAGE_MIRROR_KEY);
        }
        if (!raw && typeof sessionStorage !== 'undefined') {
            try {
                raw = sessionStorage.getItem(STORAGE_KEY);
            } catch (_) {}
        }
        if (!raw) return getDefaultData();
        const parsed = JSON.parse(raw);
        return sanitizeStoreData(parsed);
    } catch (e) {
        console.warn('Error loading primary storage, checking fallback:', e);
        try {
            const fallback = safeStorage.getItem(STORAGE_MIRROR_KEY);
            if (fallback) return sanitizeStoreData(JSON.parse(fallback));
        } catch (_) {}
        return getDefaultData();
    }
}

export function saveLocalOnly(data) {
    try {
        const payload = JSON.stringify(data);
        safeStorage.setItem(STORAGE_KEY, payload);
        safeStorage.setItem(STORAGE_MIRROR_KEY, payload);
        if (typeof sessionStorage !== 'undefined') {
            try {
                sessionStorage.setItem(STORAGE_KEY, payload);
            } catch (_) {}
        }
        return true;
    } catch (e) {
        console.warn('Local storage error:', e);
        return false;
    }
}

// Robust fetch helper with timeout to avoid hanging on slow mobile connections (3G/4G/Korek/Asiacell)
export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Persistent Offline Queue: saves orders and changes when internet drops, auto-flushes on reconnect
const OFFLINE_QUEUE_KEY = 'arishop_offline_queue_v1';

function getOfflineQueue() {
    try {
        const raw = safeStorage.getItem(OFFLINE_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function addToOfflineQueue(item) {
    try {
        const queue = getOfflineQueue();
        queue.push({ ...item, queuedAt: Date.now() });
        safeStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (_) {}
}

export async function flushOfflineQueue() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const queue = getOfflineQueue();
    if (!queue || queue.length === 0) return;

    safeStorage.removeItem(OFFLINE_QUEUE_KEY);
    for (const item of queue) {
        try {
            if (item.type === 'orders' && item.orders) {
                await postOrderToServer(item.orders);
            } else if (item.type === 'patchOrder' && item.orderId) {
                await updateOrderOnServer(item.orderId, item.updates);
            } else if (item.type === 'deleteOrder' && item.orderId) {
                await deleteOrderFromServer(item.orderId);
            }
        } catch (e) {
            console.warn('[Offline Queue] Retrying later:', e);
            addToOfflineQueue(item);
        }
    }
}

let isSyncingToServer = false;
let hasPendingSync = false;
let latestDataToSync = null;

export async function syncToServer(data) {
    latestDataToSync = data;
    if (isSyncingToServer) {
        hasPendingSync = true;
        return true;
    }
    isSyncingToServer = true;
    hasPendingSync = false;
    updateSyncIndicator('syncing');

    try {
        const payload = {
            ...latestDataToSync,
            lastUpdated: Date.now()
        };

        // Direct Cloud Firestore synchronization: guarantees real-time broadcast across all links & devices
        if (db) {
            try {
                const storeRef = doc(db, 'store', 'main');
                setDoc(storeRef, payload, { merge: true }).catch(err => {
                    console.warn('[Firestore] Sync push warning:', err);
                });
            } catch (fsErr) {
                console.warn('[Firestore] Sync push error:', fsErr);
            }
        }

        const res = await fetchWithTimeout('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 10000);

        if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                const result = await res.json();
                if (result.lastUpdated) {
                    lastKnownServerTimestamp = result.lastUpdated;
                    if (latestDataToSync) latestDataToSync.lastUpdated = result.lastUpdated;
                    saveLocalOnly(latestDataToSync);
                }
                updateSyncIndicator('online');
                return true;
            }
        } else {
            console.warn('[Sync Error] Server rejected payload status:', res.status);
            updateSyncIndicator('error');
        }
    } catch (err) {
        console.warn('[Sync Error] Network unreachable:', err);
        updateSyncIndicator('offline');
    } finally {
        isSyncingToServer = false;
        if (hasPendingSync) {
            hasPendingSync = false;
            setTimeout(() => {
                if (latestDataToSync) syncToServer(latestDataToSync);
            }, 50);
        }
    }
    return false;
}

export function saveData(data) {
    // 1. Instant local persistence
    data.lastUpdated = Date.now();
    saveLocalOnly(data);

    // 2. Immediate push to Firestore & server so changes are instantly broadcasted to all users
    if (syncTimeoutId) clearTimeout(syncTimeoutId);
    syncTimeoutId = setTimeout(() => {
        syncToServer(data);
    }, 40);

    return true;
}

// Atomic API calls for direct instant synchronization across all devices:
export async function postOrderToServer(orderOrOrders) {
    const orders = Array.isArray(orderOrOrders) ? orderOrOrders : [orderOrOrders];
    try {
        // Direct Cloud Firestore order broadcast
        if (db) {
            try {
                const storeRef = doc(db, 'store', 'main');
                getDoc(storeRef).then(snap => {
                    const existing = snap.exists() ? snap.data() : {};
                    const currentOrders = Array.isArray(existing.orders) ? existing.orders : [];
                    const merged = [...currentOrders];
                    for (const ord of orders) {
                        if (ord && ord.id && !merged.some(x => x.id === ord.id)) {
                            merged.unshift(ord);
                        }
                    }
                    setDoc(storeRef, { orders: merged, lastUpdated: Date.now() }, { merge: true });
                }).catch(err => console.warn('[Firestore] Order update warning:', err));
            } catch (e) {
                console.warn('[Firestore] Direct order push error:', e);
            }
        }

        const res = await fetchWithTimeout('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders })
        }, 8000);

        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) {
                lastKnownServerTimestamp = result.lastUpdated;
            }
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Network issue while posting order, queuing for auto-sync:', e);
        addToOfflineQueue({ type: 'orders', orders });
        updateSyncIndicator('offline');
    }
    return null;
}

export async function updateOrderOnServer(orderId, updates) {
    try {
        const res = await fetchWithTimeout(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }, 8000);

        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Network issue updating order, queuing for auto-sync:', e);
        addToOfflineQueue({ type: 'patchOrder', orderId, updates });
        updateSyncIndicator('offline');
    }
    return null;
}

export async function deleteOrderFromServer(orderId) {
    try {
        const res = await fetchWithTimeout(`/api/orders/${orderId}`, {
            method: 'DELETE'
        }, 8000);

        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Network issue deleting order, queuing for auto-sync:', e);
        addToOfflineQueue({ type: 'deleteOrder', orderId });
        updateSyncIndicator('offline');
    }
    return null;
}

export async function clearOrdersOnServerAndCloud() {
    try {
        const now = Date.now();
        if (db) {
            try {
                const storeRef = doc(db, 'store', 'main');
                setDoc(storeRef, { orders: [], lastUpdated: now }, { merge: true }).catch(err => {
                    console.warn('[Firestore] Clear orders warning:', err);
                });
            } catch (e) {
                console.warn('[Firestore] Clear orders error:', e);
            }
        }
        const res = await fetch('/api/orders', {
            method: 'DELETE'
        });
        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Failed to clear orders on server:', e);
    }
    return null;
}

export async function addProductToServer(product) {
    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Failed to add product on server:', e);
    }
    return null;
}

export async function updateProductOnServer(prodId, product) {
    try {
        const res = await fetch(`/api/products/${prodId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Failed to update product on server:', e);
    }
    return null;
}

export async function deleteProductFromServer(prodId) {
    try {
        const res = await fetch(`/api/products/${prodId}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            updateSyncIndicator('online');
            return result;
        }
    } catch (e) {
        console.warn('Failed to delete product on server:', e);
    }
    return null;
}

export async function likeProductOnServer(prodId) {
    try {
        if (db) {
            try {
                const storeRef = doc(db, 'store', 'main');
                getDoc(storeRef).then(snap => {
                    if (snap.exists()) {
                        const d = snap.data();
                        if (Array.isArray(d.products)) {
                            const p = d.products.find(x => x.id === prodId);
                            if (p) {
                                p.likes = (typeof p.likes === 'number' ? p.likes : 0) + 1;
                                setDoc(storeRef, { products: d.products, lastUpdated: Date.now() }, { merge: true });
                            }
                        }
                    }
                }).catch(err => console.warn('[Firestore] like error:', err));
            } catch (_) {}
        }

        const res = await fetch(`/api/products/${prodId}/like`, {
            method: 'POST'
        });
        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            return result;
        }
    } catch (e) {
        console.warn('Failed to like product on server:', e);
    }
    return null;
}

export async function unlikeProductOnServer(prodId) {
    try {
        if (db) {
            try {
                const storeRef = doc(db, 'store', 'main');
                getDoc(storeRef).then(snap => {
                    if (snap.exists()) {
                        const d = snap.data();
                        if (Array.isArray(d.products)) {
                            const p = d.products.find(x => x.id === prodId);
                            if (p) {
                                p.likes = Math.max(0, (typeof p.likes === 'number' ? p.likes : 1) - 1);
                                setDoc(storeRef, { products: d.products, lastUpdated: Date.now() }, { merge: true });
                            }
                        }
                    }
                }).catch(err => console.warn('[Firestore] unlike error:', err));
            } catch (_) {}
        }

        const res = await fetch(`/api/products/${prodId}/unlike`, {
            method: 'POST'
        });
        if (res.ok) {
            const result = await res.json();
            if (result.lastUpdated) lastKnownServerTimestamp = result.lastUpdated;
            return result;
        }
    } catch (e) {
        console.warn('Failed to unlike product on server:', e);
    }
    return null;
}

// Check server for newer data
export async function checkServerUpdates(onRemoteUpdate) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        updateSyncIndicator('offline');
        return;
    }

    try {
        const res = await fetchWithTimeout(`/api/sync?since=${lastKnownServerTimestamp || 0}&_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
        }, 7000);
        if (!res.ok) return;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;
        const result = await res.json();

        if (result.hasUpdates && result.data) {
            const incoming = sanitizeStoreData(result.data);
            lastKnownServerTimestamp = result.lastUpdated || incoming.lastUpdated || Date.now();
            saveLocalOnly(incoming);
            if (typeof onRemoteUpdate === 'function') {
                onRemoteUpdate(incoming);
            }
            updateSyncIndicator('online');
        } else if (result.lastUpdated) {
            lastKnownServerTimestamp = Math.max(lastKnownServerTimestamp, result.lastUpdated);
            updateSyncIndicator('online');
        }
    } catch (err) {
        // Silent catch for network hiccups
        updateSyncIndicator('offline');
    }
}

// Initial full fetch from server with smart 304 / ETag support
export async function initialServerSync(onRemoteUpdate) {
    updateSyncIndicator('syncing');
    try {
        const headers = { 'Cache-Control': 'no-cache' };
        if (lastKnownServerTimestamp) {
            headers['If-None-Match'] = `W/"${lastKnownServerTimestamp}"`;
        }

        const res = await fetchWithTimeout(`/api/data?_t=${Date.now()}`, {
            headers
        }, 8000);

        if (res.status === 304) {
            updateSyncIndicator('online');
            return loadData();
        }

        if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                const result = await res.json();
                if (result.data) {
                    const incoming = sanitizeStoreData(result.data);
                    lastKnownServerTimestamp = result.lastUpdated || incoming.lastUpdated || Date.now();
                    saveLocalOnly(incoming);
                    if (typeof onRemoteUpdate === 'function') {
                        onRemoteUpdate(incoming);
                    }
                    updateSyncIndicator('online');
                    return incoming;
                }
            }
        }
    } catch (err) {
        console.warn('Initial server sync failed, relying on local cache:', err);
        updateSyncIndicator('offline');
    }
    return null;
}

// Global SSE connection for instant real-time sync across all devices & friends
let liveEventSource = null;
let reconnectTimer = null;
let firestoreUnsubscribe = null;

export function connectFirestoreSync(onRemoteUpdate) {
    try {
        if (!db) return;
        if (firestoreUnsubscribe) {
            try { firestoreUnsubscribe(); } catch (_) {}
            firestoreUnsubscribe = null;
        }

        const storeRef = doc(db, 'store', 'main');
        firestoreUnsubscribe = onSnapshot(storeRef, (snap) => {
            if (snap.exists()) {
                const cloudData = snap.data();
                if (cloudData && typeof cloudData === 'object' && Array.isArray(cloudData.products)) {
                    const incoming = sanitizeStoreData(cloudData);
                    lastKnownServerTimestamp = incoming.lastUpdated || Date.now();
                    saveLocalOnly(incoming);
                    if (typeof onRemoteUpdate === 'function') {
                        onRemoteUpdate(incoming);
                    }
                    updateSyncIndicator('online');
                }
            } else {
                // If cloud document is empty, initialize it from local store data
                const initialData = loadData();
                setDoc(storeRef, initialData, { merge: true }).catch(err => console.warn('Init Firestore doc err:', err));
            }
        }, (err) => {
            console.warn('[Firestore Live Error]:', err);
        });
    } catch (e) {
        console.warn('Could not initialize Firestore live stream:', e);
    }
}

function connectLiveEventSource(onRemoteUpdate) {
    if (typeof window === 'undefined' || !window.EventSource) return;
    try {
        if (liveEventSource) {
            try { liveEventSource.close(); } catch (_) {}
            liveEventSource = null;
        }
        liveEventSource = new EventSource('/api/events');

        liveEventSource.onopen = () => {
            updateSyncIndicator('online');
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        liveEventSource.onmessage = (event) => {
            if (!event.data) return;
            try {
                const payload = JSON.parse(event.data);
                if (payload && payload.data) {
                    const incoming = sanitizeStoreData(payload.data);
                    lastKnownServerTimestamp = payload.lastUpdated || incoming.lastUpdated || Date.now();
                    saveLocalOnly(incoming);
                    if (typeof onRemoteUpdate === 'function') {
                        onRemoteUpdate(incoming);
                    }
                    updateSyncIndicator('online');
                }
            } catch (err) {
                console.warn('[Realtime Sync] Parse error:', err);
            }
        };

        liveEventSource.onerror = () => {
            updateSyncIndicator('syncing');
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    connectLiveEventSource(onRemoteUpdate);
                }, 1500);
            }
        };
    } catch (e) {
        console.warn('[Realtime Sync] EventSource error:', e);
    }
}

// Start continuous real-time sync via Firestore Cloud Database, SSE, background polling fallback, and focus/online listeners
export function startAutoSync(onRemoteUpdate) {
    // 1. Direct Cloud Firestore real-time synchronization (synchronizes ALL devices, URLs, and shared links)
    connectFirestoreSync(onRemoteUpdate);

    // 2. Initial snapshot from server immediately
    initialServerSync(onRemoteUpdate);

    // 3. Real-time persistent SSE stream (zero-latency push when any device changes anything)
    connectLiveEventSource(onRemoteUpdate);

    // 4. Flush any pending offline changes
    flushOfflineQueue();

    // 5. Adaptive poll timer: does not flood poor mobile connections if SSE is already live
    let pollTimer = null;
    function schedulePoll() {
        if (pollTimer) clearTimeout(pollTimer);
        const isSseOpen = liveEventSource && liveEventSource.readyState === EventSource.OPEN;
        const delay = isSseOpen ? 25000 : 5000;

        pollTimer = setTimeout(async () => {
            if (typeof document !== 'undefined' && document.hidden) {
                schedulePoll();
                return;
            }
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                schedulePoll();
                return;
            }
            await checkServerUpdates(onRemoteUpdate);
            schedulePoll();
        }, delay);
    }
    schedulePoll();

    // 6. Instant sync on tab visibility, window focus, or mobile wake
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkServerUpdates(onRemoteUpdate);
                flushOfflineQueue();
                if (!liveEventSource || liveEventSource.readyState === EventSource.CLOSED) {
                    connectLiveEventSource(onRemoteUpdate);
                }
            }
        });
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
            checkServerUpdates(onRemoteUpdate);
            flushOfflineQueue();
            if (!liveEventSource || liveEventSource.readyState === EventSource.CLOSED) {
                connectLiveEventSource(onRemoteUpdate);
            }
        });

        window.addEventListener('pageshow', () => {
            checkServerUpdates(onRemoteUpdate);
            flushOfflineQueue();
            if (!liveEventSource || liveEventSource.readyState === EventSource.CLOSED) {
                connectLiveEventSource(onRemoteUpdate);
            }
        });

        window.addEventListener('online', () => {
            updateSyncIndicator('online');
            flushOfflineQueue();
            checkServerUpdates(onRemoteUpdate);
            connectLiveEventSource(onRemoteUpdate);
        });

        window.addEventListener('offline', () => {
            updateSyncIndicator('offline');
        });
    }

    return pollTimer;
}

function updateSyncIndicator(status) {
    const badge = document.getElementById('liveSyncStatus');
    if (badge) {
        if (status === 'online') {
            badge.className = 'live-sync-badge online';
            badge.title = 'هاوکاتە / سەرهێڵ (داتاکان لەگەڵ سێرڤەر هاوکاتکراون)';
        } else if (status === 'syncing') {
            badge.className = 'live-sync-badge syncing';
            badge.title = 'لە هاوکاتکردندایە...';
        } else if (status === 'offline') {
            badge.className = 'live-sync-badge offline';
            badge.title = 'ئۆفلاین (کاشی ناوخۆ)';
        }
    }

    const banner = document.getElementById('networkStatusBanner');
    const textEl = document.getElementById('networkStatusText');
    const iconEl = document.getElementById('networkStatusIcon');

    if (banner && textEl && iconEl) {
        if (status === 'offline') {
            banner.className = 'network-status-banner offline';
            iconEl.innerHTML = '<i class="fas fa-wifi-slash"></i>';
            textEl.textContent = 'خەت پچڕاوە - دەتوانیت بەردەوام بیت لە گەڕان و سەبەتە بە شێوەی ئۆفلاین';
            banner.style.display = 'flex';
        } else if (status === 'online') {
            if (banner.classList.contains('offline')) {
                banner.className = 'network-status-banner online';
                iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
                textEl.textContent = 'خەت گەڕایەوە ✅';
                setTimeout(() => {
                    banner.style.display = 'none';
                }, 3000);
            } else {
                banner.style.display = 'none';
            }
        }
    }
}
