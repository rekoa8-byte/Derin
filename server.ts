import express from "express";
import path from "path";
import fs from "fs";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, setLogLevel, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

try {
  setLogLevel("error");
} catch (_) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Firestore for cross-container and multi-device cloud persistence
  let firestoreDb: any = null;
  let storeDocRef: any = null;
  try {
    const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const dbId = (firebaseConfig && (firebaseConfig as any).firestoreDatabaseId) || undefined;
    try {
      firestoreDb = initializeFirestore(fbApp, {
        experimentalForceLongPolling: true
      }, dbId);
    } catch (_) {
      firestoreDb = dbId ? getFirestore(fbApp, dbId) : getFirestore(fbApp);
    }
    storeDocRef = doc(firestoreDb, "store", "main");
    console.log("[Firebase] Connected to Firestore database:", dbId || "default");
  } catch (fbErr) {
    console.warn("[Firebase] Could not initialize Firestore:", fbErr);
  }

  // SECURITY SHIELD: Protect backend source files and database files
  app.disable("x-powered-by");

  // Prevent downloading private backend server code and raw local database
  const SENSITIVE_SERVER_FILES = [
    /^\/server\.(ts|js|cjs|mjs)$/i,
    /^\/\.env/i,
    /^\/\.git/i,
    /^\/data(\/|$)/i,
    /^\/skills(\/|$)/i,
    /^\/scripts(\/|$)/i,
    /\.(bak|old|sql|sqlite|db|log|sh|ini|conf)$/i
  ];

  app.use((req, res, next) => {
    const p = (req.path || "").toLowerCase();
    for (const pattern of SENSITIVE_SERVER_FILES) {
      if (pattern.test(p)) {
        return res.status(403).json({ error: "Access Denied: Protected system file." });
      }
    }
    next();
  });

  // Universal CORS middleware for seamless cross-device, mobile, iPad & proxy access
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, If-None-Match");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Gzip / Brotli compression: dramatically reduces payload size (from 900KB to ~70KB) for instant loading on 3G/4G/mobile data
  app.use(compression({
    filter: (req, res) => {
      // Do not compress Server-Sent Events to allow instant unbuffered streaming
      if (req.headers.accept?.includes("text/event-stream") || req.path === "/api/events") {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024
  }));

  // JSON Body Parser with 50MB limit to handle product photos & media
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // File storage paths
  const DATA_DIR = path.join(process.cwd(), "data");
  const DATA_FILE = path.join(DATA_DIR, "store_data.json");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Seed default data if store_data.json does not exist
  function getInitialSeedData() {
    return {
      shopName: 'فرۆشگا',
      shopLogo: '/rebaz-rmt-logo.jpg',
      lastUpdated: Date.now(),
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
          video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
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
          video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
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
          video: ''
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
          video: ''
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
          video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
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
          video: ''
        }
      ],
      orders: []
    };
  }

  function readStoreData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.orders)) {
          parsed.orders = [];
        }
        if (!Array.isArray(parsed.products)) {
          parsed.products = [];
        }
        if (!parsed.shopName || typeof parsed.shopName !== "string") {
          parsed.shopName = "فرۆشگا";
        }
        return parsed;
      }
    } catch (e) {
      console.error("Error reading store_data.json:", e);
    }
    const seed = getInitialSeedData();
    // Save to local file ONLY, never push blank seed to Firestore during cold boot
    writeStoreData(seed, false);
    return seed;
  }

  function writeStoreData(data: any, syncToFirestore: boolean = true) {
    try {
      const now = Date.now();
      if (!data.lastUpdated || syncToFirestore) {
        data.lastUpdated = now;
      }
      const tmpFile = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tmpFile, DATA_FILE);

      // Only push to cloud Firestore on real user modifications, not cold-boot disk initialization
      if (syncToFirestore && storeDocRef) {
        setDoc(storeDocRef, data, { merge: true }).catch(err => {
          console.warn("[Firebase] Background push to Firestore warning:", err);
        });
      }

      return data.lastUpdated;
    } catch (e) {
      console.error("Error writing store_data.json:", e);
      return null;
    }
  }

  // Pre-seed local data on boot (without overwriting Firestore)
  let currentStoreData = readStoreData();

  // Initialize and listen to Firestore Cloud Database in real time
  if (storeDocRef) {
    // Initial fetch to sync cloud state without ever overwriting with empty seed
    getDoc(storeDocRef).then((snap) => {
      if (snap.exists()) {
        const cloudData = snap.data() as any;
        if (cloudData && Array.isArray(cloudData.products) && cloudData.products.length > 0) {
          console.log("[Firebase] Successfully restored existing store data from cloud Firestore.");
          currentStoreData = { ...currentStoreData, ...cloudData };
          // Save cloud data to local disk, do NOT push back to Firestore
          writeStoreData(currentStoreData, false);
          broadcastDataUpdate(currentStoreData, currentStoreData.lastUpdated || Date.now());
        }
      } else {
        // Document genuinely does not exist in Firestore yet: seed it once safely
        console.log("[Firebase] Initializing empty Firestore store document with initial seed...");
        setDoc(storeDocRef, currentStoreData, { merge: true }).catch(err => {
          console.warn("[Firebase] Seeding to Firestore warning:", err);
        });
      }
    }).catch(err => {
      console.warn("[Firebase] Initial Firestore check error:", err);
    });

    // Real-time Firestore listener across all instances and devices
    onSnapshot(storeDocRef, (snap) => {
      if (snap.exists()) {
        const cloudData = snap.data() as any;
        if (cloudData && Array.isArray(cloudData.products) && cloudData.products.length > 0) {
          const currentLocal = readStoreData();
          if (!cloudData.lastUpdated || cloudData.lastUpdated >= (currentLocal.lastUpdated || 0)) {
            const merged = { ...currentLocal, ...cloudData };
            writeStoreData(merged, false);
            broadcastDataUpdate(merged, merged.lastUpdated || Date.now());
          }
        }
      }
    }, (err) => {
      console.warn("[Firebase] Firestore onSnapshot stream warning:", err);
    });
  }

  // Active Server-Sent Events (SSE) connections for zero-latency multi-device sync
  const sseClients = new Set<express.Response>();

  function broadcastDataUpdate(updatedData: any, lastUpdated: number) {
    const payload = JSON.stringify({
      type: "sync",
      lastUpdated,
      data: updatedData
    });
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
        (client as any).flush?.();
      } catch (e) {
        sseClients.delete(client);
      }
    }
  }

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Real-time SSE stream endpoint for all connected devices
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders?.();

    sseClients.add(res);

    // Send initial snapshot immediately
    const current = readStoreData();
    res.write(`data: ${JSON.stringify({ type: "init", lastUpdated: current.lastUpdated || Date.now(), data: current })}\n\n`);
    (res as any).flush?.();

    const keepAlive = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
        (res as any).flush?.();
      } catch (e) {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 8000);

    req.on("close", () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // GET store data (compressed, with smart 304 Not Modified support for slow connections)
  app.get("/api/data", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    const data = readStoreData();
    const lastUpdated = data.lastUpdated || 0;
    const etag = `W/"${lastUpdated}"`;
    res.setHeader("ETag", etag);

    const clientEtag = req.headers["if-none-match"];
    if (clientEtag && (clientEtag === etag || clientEtag === String(lastUpdated))) {
      return res.status(304).end();
    }

    res.json({
      success: true,
      lastUpdated,
      data
    });
  });

  // POST new orders directly (atomic, fast, zero-delay persistence)
  app.post("/api/orders", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const { order, orders } = req.body;
      const incomingOrders = Array.isArray(orders) ? orders : (order ? [order] : []);
      if (incomingOrders.length === 0) {
        return res.status(400).json({ success: false, error: "No orders provided" });
      }

      const store = readStoreData();
      if (!Array.isArray(store.orders)) {
        store.orders = [];
      }

      const addedOrders = [];
      for (const ord of incomingOrders) {
        if (!ord) continue;
        const normalized = {
          ...ord,
          id: ord.id || Date.now() + Math.floor(Math.random() * 1000),
          status: ord.status || 'pending',
          date: ord.date || new Date().toISOString().slice(0, 10),
          timestamp: ord.timestamp || Date.now(),
          deleted: false,
          adminDeleted: false,
          userDeleted: false,
          adminSeen: false,
          userSeen: false
        };
        const existingIdx = store.orders.findIndex((o: any) => o.id === normalized.id);
        if (existingIdx >= 0) {
          store.orders[existingIdx] = normalized;
        } else {
          store.orders.unshift(normalized);
        }
        addedOrders.push(normalized);
      }

      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Order API] Successfully recorded ${addedOrders.length} order(s). Broadcasted to ${sseClients.size} clients.`);
      return res.json({ success: true, count: addedOrders.length, orders: addedOrders, lastUpdated });
    } catch (e: any) {
      console.error("[Order API Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // PATCH order status or visibility
  app.patch("/api/orders/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const orderId = Number(req.params.id) || req.params.id;
      const updates = req.body;
      const store = readStoreData();
      if (!Array.isArray(store.orders)) store.orders = [];

      const idx = store.orders.findIndex((o: any) => o.id == orderId);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      store.orders[idx] = { ...store.orders[idx], ...updates };
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      return res.json({ success: true, order: store.orders[idx], lastUpdated });
    } catch (e: any) {
      console.error("[Order Patch Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // DELETE all orders / Reset orders to empty array
  app.delete("/api/orders", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const store = readStoreData();
      const count = Array.isArray(store.orders) ? store.orders.length : 0;
      store.orders = [];
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Order API] All orders reset/cleared (${count} removed). Broadcasted to ${sseClients.size} clients.`);
      return res.json({ success: true, clearedCount: count, orders: [], lastUpdated });
    } catch (e: any) {
      console.error("[Order Reset Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST clear orders
  app.post("/api/orders/clear", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const store = readStoreData();
      const count = Array.isArray(store.orders) ? store.orders.length : 0;
      store.orders = [];
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Order API] All orders cleared (${count} removed). Broadcasted to ${sseClients.size} clients.`);
      return res.json({ success: true, clearedCount: count, orders: [], lastUpdated });
    } catch (e: any) {
      console.error("[Order Clear Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // DELETE order
  app.delete("/api/orders/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const orderId = Number(req.params.id) || req.params.id;
      const store = readStoreData();
      if (!Array.isArray(store.orders)) store.orders = [];

      const initialLen = store.orders.length;
      store.orders = store.orders.filter((o: any) => o.id != orderId);
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      return res.json({ success: true, deletedCount: initialLen - store.orders.length, lastUpdated });
    } catch (e: any) {
      console.error("[Order Delete Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST new product
  app.post("/api/products", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const product = req.body;
      if (!product || !product.name || !product.price) {
        return res.status(400).json({ success: false, error: "Invalid product data" });
      }
      const store = readStoreData();
      if (!Array.isArray(store.products)) store.products = [];

      const newProd = {
        ...product,
        id: Number(product.id) || Date.now(),
        likes: typeof product.likes === 'number' ? product.likes : 0
      };
      
      const existingIdx = store.products.findIndex((p: any) => p.id == newProd.id);
      if (existingIdx >= 0) {
        store.products[existingIdx] = { ...store.products[existingIdx], ...newProd };
      } else {
        store.products.unshift(newProd);
      }

      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Product API] Saved product '${newProd.name}' (id: ${newProd.id}). Total products: ${store.products.length}`);
      return res.json({ success: true, product: newProd, lastUpdated });
    } catch (e: any) {
      console.error("[Product Add Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // PUT update product
  app.put("/api/products/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const prodId = Number(req.params.id) || req.params.id;
      const updatedData = req.body;
      const store = readStoreData();
      if (!Array.isArray(store.products)) store.products = [];

      const idx = store.products.findIndex((p: any) => p.id == prodId);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: "Product not found" });
      }

      store.products[idx] = { ...store.products[idx], ...updatedData, id: prodId };
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Product API] Updated product '${store.products[idx].name}' (id: ${prodId})`);
      return res.json({ success: true, product: store.products[idx], lastUpdated });
    } catch (e: any) {
      console.error("[Product Update Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // DELETE product
  app.delete("/api/products/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const prodId = Number(req.params.id) || req.params.id;
      const store = readStoreData();
      if (!Array.isArray(store.products)) store.products = [];

      store.products = store.products.filter((p: any) => p.id != prodId);
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Product API] Deleted product id: ${prodId}`);
      return res.json({ success: true, lastUpdated });
    } catch (e: any) {
      console.error("[Product Delete Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST like product
  app.post("/api/products/:id/like", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const prodId = Number(req.params.id) || req.params.id;
      const store = readStoreData();
      if (!Array.isArray(store.products)) store.products = [];

      const prod = store.products.find((p: any) => p.id == prodId);
      if (!prod) {
        return res.status(404).json({ success: false, error: "Product not found" });
      }

      prod.likes = (typeof prod.likes === 'number' ? prod.likes : 0) + 1;
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Product Like] Product id ${prodId} liked. New likes: ${prod.likes}`);
      return res.json({ success: true, likes: prod.likes, lastUpdated });
    } catch (e: any) {
      console.error("[Product Like Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST unlike product
  app.post("/api/products/:id/unlike", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const prodId = Number(req.params.id) || req.params.id;
      const store = readStoreData();
      if (!Array.isArray(store.products)) store.products = [];

      const prod = store.products.find((p: any) => p.id == prodId);
      if (!prod) {
        return res.status(404).json({ success: false, error: "Product not found" });
      }

      prod.likes = Math.max(0, (typeof prod.likes === 'number' ? prod.likes : 1) - 1);
      const lastUpdated = writeStoreData(store);
      broadcastDataUpdate(store, lastUpdated);
      console.log(`[Product Unlike] Product id ${prodId} unliked. New likes: ${prod.likes}`);
      return res.json({ success: true, likes: prod.likes, lastUpdated });
    } catch (e: any) {
      console.error("[Product Unlike Error]:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST store data with smart order merging and instant broadcast
  app.post("/api/data", (req, res) => {
    const incoming = req.body;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ error: "Invalid data payload" });
    }

    const current = readStoreData();

    // Preserve all orders safely: merge existing with incoming unless explicitly resetting
    let mergedOrders: any[] = [];
    if (incoming.clearOrders === true || incoming.resetOrders === true) {
      mergedOrders = [];
    } else {
      const existingOrders = Array.isArray(current.orders) ? current.orders : [];
      const incomingOrders = Array.isArray(incoming.orders) ? incoming.orders : [];
      const orderMap = new Map();
      for (const ord of existingOrders) {
        if (ord && ord.id) orderMap.set(ord.id, ord);
      }
      for (const ord of incomingOrders) {
        if (ord && ord.id) {
          if (orderMap.has(ord.id)) {
            orderMap.set(ord.id, { ...orderMap.get(ord.id), ...ord });
          } else {
            orderMap.set(ord.id, ord);
          }
        }
      }
      mergedOrders = Array.from(orderMap.values()).sort((a: any, b: any) => (b.timestamp || b.id || 0) - (a.timestamp || a.id || 0));
    }

    const mergedData = {
      ...current,
      ...incoming,
      orders: mergedOrders,
      products: (Array.isArray(incoming.products) && (incoming.products.length > 0 || incoming.allowEmptyProducts === true)) ? incoming.products : current.products,
      categories: (Array.isArray(incoming.categories) && incoming.categories.length > 0) ? incoming.categories : current.categories,
      cities: (Array.isArray(incoming.cities) && incoming.cities.length > 0) ? incoming.cities : current.cities,
      promoCodes: Array.isArray(incoming.promoCodes) ? incoming.promoCodes : current.promoCodes,
      contactInfo: (incoming.contactInfo && typeof incoming.contactInfo === 'object') ? { ...(current.contactInfo || {}), ...incoming.contactInfo } : (current.contactInfo || {}),
      shopLogo: (incoming.shopLogo && typeof incoming.shopLogo === 'string' && incoming.shopLogo.trim() && incoming.shopLogo !== '/rebaz-logo.jpg') ? incoming.shopLogo : (current.shopLogo || '/derin-logo.svg'),
      shopName: (incoming.shopName && typeof incoming.shopName === 'string' && incoming.shopName.trim()) ? incoming.shopName.trim() : (current.shopName || 'فرۆشگا')
    };

    const lastUpdated = writeStoreData(mergedData);
    if (!lastUpdated) {
      return res.status(500).json({ error: "Failed to persist data" });
    }
    broadcastDataUpdate(mergedData, lastUpdated);
    console.log(`[Store Sync] Broadcasted update to ${sseClients.size} clients at ${new Date(lastUpdated).toISOString()}`);
    res.json({ success: true, lastUpdated, data: mergedData });
  });

  // GET sync updates since a given timestamp
  app.get("/api/sync", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const since = parseInt(req.query.since as string) || 0;
    const current = readStoreData();
    const storeUpdated = current.lastUpdated || 0;
    if (storeUpdated > since) {
      return res.json({ hasUpdates: true, lastUpdated: storeUpdated, data: current });
    }
    res.json({ hasUpdates: false, lastUpdated: storeUpdated });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "3d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=259200, immutable");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Optimize keep-alive timeouts for mobile networks (prevents dropped connection resets)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer();
