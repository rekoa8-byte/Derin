import { LANGUAGES } from './translations.js';
import { autoTranslateCategory, getTranslatedCategoryName } from './categoryTranslator.js';
import { 
    loadData, 
    saveData, 
    saveLocalOnly,
    startAutoSync, 
    safeStorage, 
    CITIES, 
    DEFAULT_PROMO_CODES,
    postOrderToServer,
    updateOrderOnServer,
    deleteOrderFromServer,
    clearOrdersOnServerAndCloud,
    addProductToServer,
    updateProductOnServer,
    deleteProductFromServer,
    likeProductOnServer,
    unlikeProductOnServer
} from './data.js';

export function compressImageFile(file, maxWidth = 1000, maxHeight = 1000, quality = 0.82) {
    return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            return resolve('');
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => resolve(e.target.result);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

export function shareStoreLink() {
    const url = window.location.href.split('#')[0];
    if (navigator.share) {
        navigator.share({
            title: data.shopName || 'Derin__Collection',
            text: 'سەردانی فرۆشگاکەمان بکەن بۆ بینینی کاڵاکان و داواکاری کردن:',
            url: url
        }).catch(() => {
            copyUrlToClipboard(url);
        });
    } else {
        copyUrlToClipboard(url);
    }
}

function copyUrlToClipboard(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            toast('لینکی فرۆشگا بە سەرکەوتوویی کۆپیکرا! ئێستا دەتوانی بۆ هەرکەسێکی بنێریت', 'success');
        }).catch(() => {
            fallbackCopy(url);
        });
    } else {
        fallbackCopy(url);
    }
}

function fallbackCopy(url) {
    try {
        const temp = document.createElement('input');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        toast('لینکی فرۆشگا بە سەرکەوتوویی کۆپیکرا!', 'success');
    } catch (_) {
        prompt('لینکی فرۆشگا کۆپی بکە:', url);
    }
}

let data = loadData();
if (!data.contactInfo) {
    data.contactInfo = {};
}
if (!data.contactInfo.telegram) data.contactInfo.telegram = 'https://t.me/rebazshop';
if (!data.contactInfo.snapchat) data.contactInfo.snapchat = 'https://www.snapchat.com/add/rebazshop';
if (!data.contactInfo.tiktok) data.contactInfo.tiktok = 'https://www.tiktok.com/@rebazshop';

let appliedCartPromo = null;
let appliedSingleOrderPromo = null;

export function handleRemoteDataUpdate(incomingData) {
    if (!incomingData) return;
    try {
        // Sync admin password from cloud if updated remotely
        if (incomingData.adminPassword && incomingData.adminPassword !== adminPassword) {
            adminPassword = incomingData.adminPassword;
            safeStorage.setItem('arishop_admin_password', adminPassword);
        }

        // Check if new orders arrived to alert admin with sound chime and popup alert
        if (data && Array.isArray(data.orders) && incomingData && Array.isArray(incomingData.orders)) {
            const prevIds = new Set(data.orders.map(o => o.id));
            const newOrders = incomingData.orders.filter(o => !prevIds.has(o.id));
            if (newOrders.length > 0 && currentRole === 'admin') {
                playOrderNotificationChime();
                const first = newOrders[0];
                const sender = first.customerName ? ` لەلایەن «${first.customerName}»` : '';
                toast(`داواکارییەکی نوێ${sender} گەیشت! 🔔`, 'success');
            }
        }

        // Alert admin when customer likes a product
        if (data && Array.isArray(data.products) && incomingData && Array.isArray(incomingData.products) && currentRole === 'admin') {
            const prevLikesMap = new Map(data.products.map(p => [p.id, p.likes || 0]));
            for (const p of incomingData.products) {
                const prevLike = prevLikesMap.get(p.id) || 0;
                if ((p.likes || 0) > prevLike) {
                    toast(`کڕیارێک لایکی کاڵای «${p.name}» کرد! ❤️`, 'info');
                    break;
                }
            }
        }

        data = incomingData;
        if (!data.contactInfo) {
            data.contactInfo = {};
        }
        if (!data.contactInfo.telegram) data.contactInfo.telegram = 'https://t.me/rebazshop';
        if (!data.contactInfo.snapchat) data.contactInfo.snapchat = 'https://www.snapchat.com/add/rebazshop';
        if (!data.contactInfo.tiktok) data.contactInfo.tiktok = 'https://www.tiktok.com/@rebazshop';

        updateShopNameDisplay();
        renderProducts();
        renderCategoryScroll();
        populateCategorySelect();
        renderCategoryListEdit();
        if (currentRole === 'admin') {
            renderOrders();
            renderPromoCodesList();
            renderCityDeliveryList();
            populateContactFields();
            updateSoundUI();
        }
        renderMyOrders();
        renderUserContactAndOrders();
        updateOrderBadges();

        // If video modal is open, refresh like count live
        const videoModal = document.getElementById('videoModal');
        if (videoModal && videoModal.classList.contains('open') && window._activeVideoProductId) {
            updateVideoModalLikeBtn(window._activeVideoProductId);
        }
    } catch (syncErr) {
        console.warn('[Remote Sync] Background update handled cleanly:', syncErr);
    }
}
let currentLang = safeStorage.getItem('arishop_lang') || 'ku'; // default to Kurdish as requested
let currentTheme = safeStorage.getItem('arishop_theme') || 'light';

// Inspect URL params or hash for admin entry override
function detectInitialRole() {
    let role = safeStorage.getItem('arishop_current_role');
    if (typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        if (hash.includes('admin') || search.includes('role=admin')) {
            role = 'admin';
            safeStorage.setItem('arishop_current_role', 'admin');
        }
    }
    return role || 'user';
}

let currentRole = detectInitialRole();
let currentFilter = 'all';
let currentSearch = '';
let cart = [];
try {
    cart = JSON.parse(safeStorage.getItem('arishop_cart') || '[]');
    if (!Array.isArray(cart)) cart = [];
} catch (_) {
    cart = [];
}
let userInfo = null;
try {
    userInfo = JSON.parse(safeStorage.getItem('arishop_user_info') || 'null');
} catch (_) {
    userInfo = null;
}

// Admin credentials - prioritized from cloud data, then persistent storage, then default
let adminUsername = (data && data.adminUsername) || safeStorage.getItem('arishop_admin_username') || 'Farhang';
let adminPassword = (data && data.adminPassword) || safeStorage.getItem('arishop_admin_password') || 'Farhang123$';

if (!safeStorage.getItem('arishop_admin_username') || adminUsername === 'admin') {
    adminUsername = 'Farhang';
    safeStorage.setItem('arishop_admin_username', adminUsername);
}
if (!safeStorage.getItem('arishop_admin_password') || adminPassword === 'admin123') {
    adminPassword = 'Farhang123$';
    safeStorage.setItem('arishop_admin_password', adminPassword);
}

// Temporary video holder during Add/Edit
let addVideoData = '';
let editVideoData = '';

export function getTranslation() {
    return LANGUAGES[currentLang] || LANGUAGES.ku;
}

export function t(key) {
    const tr = getTranslation();
    return tr[key] || key;
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let failedLoginAttempts = 0;
let lockoutExpiryTime = 0;

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function formatPrice(p) {
    return Number(p || 0).toLocaleString('en-US') + ' IQD';
}

function getCategory(id) {
    return data.categories.find(c => c.id === id);
}

function getCategoryName(id) {
    const c = getCategory(id);
    if (!c) return 'Unknown';
    return getTranslatedCategoryName(c, currentLang);
}

function getCategoryIcon(id) {
    const c = getCategory(id);
    return c ? c.icon : '📦';
}

function getProduct(id) {
    return data.products.find(p => p.id === Number(id));
}

function getProductName(id) {
    const p = getProduct(id);
    return p ? p.name : 'Unknown';
}

// ==========================================
//  UI & LOCALIZATION
// ==========================================
export function setLanguage(lang) {
    currentLang = lang;
    safeStorage.setItem('arishop_lang', lang);
    const langSelect = document.getElementById('langSelect');
    if (langSelect && langSelect.value !== lang) {
        langSelect.value = lang;
    }
    const currentLangLabel = document.getElementById('currentLangLabel');
    if (currentLangLabel) {
        const labels = { 'ku': 'کوردی', 'ar': 'العربية', 'en': 'English' };
        currentLangLabel.textContent = labels[lang] || 'کوردی';
    }
    document.querySelectorAll('.lang-option, .nb-lang-btn').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === lang);
        if (opt.classList.contains('nb-lang-btn')) opt.setAttribute('aria-pressed', opt.dataset.lang === lang ? 'true' : 'false');
    });
    document.querySelectorAll('.lang-selector button').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
    });
    document.body.dir = (lang === 'ar' || lang === 'ku') ? 'rtl' : 'ltr';

    updateUI();
    renderProducts();
    renderOrders();
    renderCategoryScroll();
    renderCategoryListEdit();
    populateCategorySelect();
    updateShopNameDisplay();
    populateContactFields();
    renderCart();
    renderUserContactAndOrders();
    renderMyOrders();
}

export function toggleLangMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('langDropdownMenu');
    if (menu) {
        const isHidden = menu.style.display === 'none' || menu.style.display === '';
        menu.style.display = isHidden ? 'flex' : 'none';
    }
}

export function closeLangMenu() {
    const menu = document.getElementById('langDropdownMenu');
    if (menu) menu.style.display = 'none';
}

export function selectLanguage(lang) {
    closeLangMenu();
    setLanguage(lang);
}

// Ensure immediate availability on window.shopApp
window.shopApp = window.shopApp || {};
window.shopApp.toggleLangMenu = toggleLangMenu;
window.shopApp.closeLangMenu = closeLangMenu;
window.shopApp.selectLanguage = selectLanguage;

if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        const container = document.getElementById('langDropdownContainer');
        if (container && !container.contains(e.target)) {
            closeLangMenu();
        }
    });
}

export function toggleTheme() {
    const html = document.documentElement;
    const isLight = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
    currentTheme = isLight ? 'dark' : 'light';
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    safeStorage.setItem('arishop_theme', currentTheme);
}

function loadTheme() {
    const saved = safeStorage.getItem('arishop_theme') || 'light';
    currentTheme = saved;
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = t(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder !== undefined) el.placeholder = val;
        } else {
            el.textContent = val;
        }
    });

    const searchInput = document.querySelector('#searchInput');
    if (searchInput) searchInput.placeholder = t('searchPlaceholder');

    const newCatInput = document.querySelector('#newCatName');
    if (newCatInput) newCatInput.placeholder = t('catNamePlaceholder');

    document.querySelectorAll('#orderStatus option, #prodStockStatus option, #editStockStatus option').forEach(opt => {
        const key = opt.dataset.i18n;
        if (key) opt.textContent = t(key);
    });

    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fas fa-shopping-cart" style="color:var(--accent);"></i> ${t('orderTitle')}`;
    }
    const editModalTitle = document.querySelector('#editModal .modal-header h2');
    if (editModalTitle) {
        editModalTitle.innerHTML = `<i class="fas fa-edit" style="color:var(--accent);"></i> ${t('editTitle')}`;
    }
    const userInfoModalTitle = document.querySelector('#userInfoModal .modal-header h2');
    if (userInfoModalTitle) {
        userInfoModalTitle.innerHTML = `<i class="fas fa-user-edit" style="color:var(--accent);"></i> ${t('userInfoTitle')}`;
    }
    const logoutBtnSpan = document.querySelector('#logoutBtn span');
    if (logoutBtnSpan) logoutBtnSpan.textContent = t('logoutBtn');

    updateShopNameDisplay();
}

function updateShopNameDisplay() {
    const name = data.shopName || 'Derin__Collection';
    // Header brand: first word bold, the rest as the script tagline (e.g. "Derin" + "Collection")
    const nameParts = String(name).split(/[_\s]+/).filter(Boolean);
    const brandMain = nameParts[0] || String(name);
    const brandSub = nameParts.slice(1).join(' ');
    const shopNameDisplay = document.getElementById('shopNameDisplay');
    if (shopNameDisplay) shopNameDisplay.textContent = brandMain;
    const shopTaglineDisplay = document.getElementById('shopTaglineDisplay');
    if (shopTaglineDisplay) {
        shopTaglineDisplay.textContent = brandSub;
        shopTaglineDisplay.style.display = brandSub ? '' : 'none';
    }
    const categoriesTitle = document.getElementById('categoriesTitle');
    if (categoriesTitle) categoriesTitle.textContent = `${t('categoriesTitle')} ${nameParts.join(' ') || name}`;
    const shopNameInput = document.getElementById('shopNameInput');
    if (shopNameInput) shopNameInput.value = name;
    const loginTitle = document.getElementById('loginTitle');
    if (loginTitle) loginTitle.textContent = name;
    const modalLoginTitle = document.getElementById('modalLoginTitle');
    if (modalLoginTitle) modalLoginTitle.textContent = name;
    document.title = name || 'Derin__Collection';

    const logoSrc = data.shopLogo || '/derin-logo.svg';
    document.querySelectorAll('.brand-logo-img, .login-brand-logo-img, #settingsLogoPreview').forEach(img => {
        if (img) img.src = logoSrc;
    });

    // Update dynamic Favicon and Apple Touch Icon so Add to Home Screen always uses the Shop Logo!
    updateFaviconAndAppleTouchIcon(logoSrc);

    // The admin top logo (circled by user) is permanently fixed and never overwritten by shop logo changes
    const fixedAdminLogo = document.getElementById('fixedAdminLogoImg');
    if (fixedAdminLogo) {
        fixedAdminLogo.src = '/rebaz-rmt-logo.jpg';
    }
}

export function updateFaviconAndAppleTouchIcon(src) {
    if (!src) src = '/derin-logo.svg';
    const appFavicon = document.getElementById('appFavicon');
    if (appFavicon) appFavicon.href = src;

    const appleTouchIcon = document.getElementById('appAppleTouchIcon');
    if (appleTouchIcon) appleTouchIcon.href = src;

    // For iOS Safari "Add to Home Screen", convert SVG to crisp PNG canvas dataURL
    if (src.endsWith('.svg') || src.startsWith('data:image/svg+xml')) {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 192;
                    canvas.height = 192;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 192, 192);
                    ctx.drawImage(img, 0, 0, 192, 192);
                    const pngUrl = canvas.toDataURL('image/png');
                    if (appleTouchIcon) appleTouchIcon.href = pngUrl;
                } catch (_) {}
            };
            img.src = src;
        } catch (_) {}
    }
}

// ==========================================
//  PRODUCTS & RENDERING
// ==========================================
export function renderProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    let filtered = [...data.products];

    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.categoryId === currentFilter);
    }
    if (currentSearch.trim()) {
        const q = currentSearch.trim().toLowerCase();
        filtered = filtered.filter(p =>
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    }
    filtered.sort((a, b) => b.id - a.id);

    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = filtered.length + ' ' + t('navProducts').toLowerCase();

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><h3>${t('noProducts')}</h3></div>`;
        return;
    }

    const isAdmin = currentRole === 'admin';
    const likedList = getLikedProducts();

    grid.innerHTML = filtered.map(p => {
        const hasDiscount = p.discount && p.discount > 0;
        const finalPrice = hasDiscount ? p.price * (1 - p.discount / 100) : p.price;
        const discountText = hasDiscount ? `-${p.discount}%` : '';
        const catName = getCategoryName(p.categoryId);
        const catIcon = getCategoryIcon(p.categoryId);
        const inCart = cart.find(item => item.productId === p.id);
        const isLiked = likedList.includes(p.id);
        const likesCount = typeof p.likes === 'number' ? p.likes : 0;

        let statusLabel = t('stockIn');
        if (p.stockStatus === 'out-of-stock') statusLabel = t('stockOut');
        else if (p.stockStatus === 'soon') statusLabel = t('stockSoon');

        let actionsHtml = '';
        if (isAdmin) {
            actionsHtml = `
                <button class="btn-edit" onclick="window.shopApp.openEditModal(${p.id})"><i class="fas fa-edit"></i> ${t('editTitle')}</button>
                <button class="btn-delete" onclick="window.shopApp.deleteProduct(${p.id})" title="${t('deleteConfirm')}"><i class="fas fa-trash-alt"></i></button>
            `;
        } else {
            actionsHtml = `
                <button class="btn-cart ${inCart ? 'in-cart' : ''}" onclick="window.shopApp.toggleCart(${p.id})" title="${inCart ? t('cartInBtn') : t('cartAddBtn')}">
                    <i class="fas ${inCart ? 'fa-check' : 'fa-cart-plus'}"></i>
                    <span>${inCart ? t('cartInBtn') : t('cartAddBtn')}</span>
                </button>
                <button class="btn-order" onclick="window.shopApp.openOrderModal(${p.id})" title="${t('orderBtn')}">
                    <i class="fas fa-shopping-cart"></i>
                    <span>${t('orderBtn')}</span>
                </button>
            `;
        }

        // HAS VIDEO BUTTON: "(کلیك بکە بۆ بینینی ڤیدیۆ)"
        const hasVideo = Boolean(p.video && p.video.trim() !== '');
        let videoBtnHtml = '';
        let videoBadgeHtml = '';

        if (hasVideo) {
            videoBadgeHtml = `
                <span class="badge-video" onclick="event.stopPropagation(); window.shopApp.openVideoModal(${p.id});" title="${t('watchVideoBtn')}">
                    <i class="fas fa-play"></i> ${t('hasVideoBadge')}
                </span>
            `;
            videoBtnHtml = `
                <button type="button" class="btn-watch-video" onclick="window.shopApp.openVideoModal(${p.id})">
                    <i class="fas fa-play-circle"></i>
                    <span>${t('watchVideoBtn')}</span>
                </button>
            `;
        }

        return `
            <div class="product-card" data-id="${p.id}">
                <div class="img-wrap" onclick="${hasVideo ? `window.shopApp.openVideoModal(${p.id})` : ''}" style="${hasVideo ? 'cursor:pointer;' : ''}">
                    ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />` : `<i class="fas fa-image placeholder-icon"></i>`}
                    ${videoBadgeHtml}
                    <span class="badge-stock status-${p.stockStatus || 'in-stock'}">${statusLabel}</span>
                    ${hasDiscount ? `<span class="badge-discount">${discountText}</span>` : ''}
                    <button type="button" class="badge-like-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); window.shopApp.toggleLike(${p.id});" title="${isLiked ? 'لابردنی لایک' : 'حەزم لێیەتی / لایک'}">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                        ${likesCount > 0 ? `<span class="like-count">${likesCount}</span>` : ''}
                    </button>
                </div>
                <div class="card-body">
                    <div class="card-meta-row">
                        <div class="category">${catIcon} ${catName}</div>
                        <span class="desire-chip" title="${likesCount} ${t('likeDesire')}">
                            <i class="fas fa-heart"></i> ${likesCount}
                        </span>
                    </div>
                    <h3>${p.name}</h3>
                    <div class="price">
                        ${hasDiscount ? `<span class="price-old">${formatPrice(p.price)}</span>` : ''}
                        ${formatPrice(Math.round(finalPrice))}
                    </div>
                    <div class="actions">
                        ${actionsHtml}
                    </div>
                    ${videoBtnHtml}
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
//  LIKE / WISHLIST / DESIRE SYSTEM
// ==========================================
export function getLikedProducts() {
    try {
        const raw = safeStorage.getItem('arishop_liked_products');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveLikedProducts(likedList) {
    try {
        safeStorage.setItem('arishop_liked_products', JSON.stringify(likedList));
    } catch {}
}

export function toggleLike(productId) {
    const p = getProduct(productId);
    if (!p) return;

    let likedList = getLikedProducts();
    const isLiked = likedList.includes(productId);

    if (isLiked) {
        likedList = likedList.filter(id => id !== productId);
        p.likes = Math.max(0, (typeof p.likes === 'number' ? p.likes : 1) - 1);
        saveLikedProducts(likedList);
        saveLocalOnly(data);
        unlikeProductOnServer(productId);
        toast(t('unlikedToast') || 'لایک لابرا', 'info');
    } else {
        likedList.push(productId);
        p.likes = (typeof p.likes === 'number' ? p.likes : 0) + 1;
        saveLikedProducts(likedList);
        saveLocalOnly(data);
        likeProductOnServer(productId);
        toast(t('likedToast') || 'بەدڵت بوو! ❤️', 'success');
    }

    renderProducts();
    const modal = document.getElementById('videoModal');
    if (modal && modal.classList.contains('open')) {
        updateVideoModalLikeBtn(productId);
    }
}

export function updateVideoModalLikeBtn(productId) {
    const p = getProduct(productId);
    if (!p) return;
    const likedList = getLikedProducts();
    const isLiked = likedList.includes(productId);
    const countEl = document.getElementById('videoModalLikeCount');
    const iconEl = document.getElementById('videoModalLikeIcon');
    const btnEl = document.getElementById('videoModalLikeBtn');
    if (countEl) countEl.textContent = p.likes || 0;
    if (iconEl) iconEl.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
    if (btnEl) btnEl.classList.toggle('liked', isLiked);
}

// ==========================================
//  VIDEO MODAL (SCREENSHOT / IMG_2228.jpeg STYLE)
// ==========================================
export function openVideoModal(productId) {
    const p = getProduct(productId);
    if (!p) return toast('Product not found', 'error');

    const modal = document.getElementById('videoModal');
    const player = document.getElementById('modalVideoPlayer');
    const source = document.getElementById('modalVideoSource');
    const titleEl = document.getElementById('videoModalProductTitle');
    const priceEl = document.getElementById('videoModalProductPrice');
    const descEl = document.getElementById('videoModalProductDesc');
    const actionsEl = document.getElementById('videoModalActions');

    if (!p.video || p.video.trim() === '') {
        toast(t('noVideoFound') || 'No video for this product', 'error');
        return;
    }

    titleEl.textContent = p.name;
    const hasDiscount = p.discount && p.discount > 0;
    const finalPrice = hasDiscount ? p.price * (1 - p.discount / 100) : p.price;
    priceEl.innerHTML = `${hasDiscount ? `<span style="text-decoration:line-through;font-size:0.85rem;color:var(--text-muted);margin-right:6px;">${formatPrice(p.price)}</span>` : ''} <span style="color:var(--accent);font-weight:700;font-size:1.15rem;">${formatPrice(Math.round(finalPrice))}</span>`;
    descEl.textContent = p.description || '';

    // Action buttons inside video modal (Order, Add to Cart, Like)
    const inCart = cart.find(item => item.productId === p.id);
    const likedList = getLikedProducts();
    const isLiked = likedList.includes(p.id);

    actionsEl.innerHTML = `
        <button type="button" class="btn-primary" onclick="window.shopApp.closeVideoModal(); window.shopApp.openOrderModal(${p.id});">
            <i class="fas fa-shopping-cart"></i> ${t('orderBtn')}
        </button>
        <button type="button" class="btn-cart ${inCart ? 'in-cart' : ''}" style="background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border-color);" onclick="window.shopApp.toggleCart(${p.id}); window.shopApp.updateVideoModalCartBtn(${p.id});">
            <i class="fas ${inCart ? 'fa-check' : 'fa-cart-plus'}"></i>
            <span id="videoModalCartText">${inCart ? t('cartInBtn') : t('cartAddBtn')}</span>
        </button>
        <button type="button" class="btn-like-modal ${isLiked ? 'liked' : ''}" id="videoModalLikeBtn" onclick="window.shopApp.toggleLike(${p.id});" title="${isLiked ? 'لابردنی لایک' : 'حەزم لێیەتی / لایک'}">
            <i id="videoModalLikeIcon" class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
            <span id="videoModalLikeCount">${p.likes || 0}</span>
        </button>
    `;

    // Load video
    player.pause();
    source.src = p.video;
    player.load();
    player.currentTime = 0;
    
    window._activeVideoProductId = productId;
    modal.classList.add('open');
    
    // Auto-play safely with fallback
    const playPromise = player.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {
            // Autoplay policy prevented - controls are available for the user
        });
    }
}

export function updateVideoModalCartBtn(productId) {
    const inCart = cart.find(item => item.productId === productId);
    const cartText = document.getElementById('videoModalCartText');
    if (cartText) {
        cartText.textContent = inCart ? t('cartInBtn') : t('cartAddBtn');
    }
}

export function closeVideoModal() {
    window._activeVideoProductId = null;
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('modalVideoPlayer');
    if (player) {
        player.pause();
    }
    if (modal) {
        modal.classList.remove('open');
    }
}

export function returnToHomePageFromVideo() {
    closeVideoModal();
    switchPage('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
//  CATEGORY SCROLL
// ==========================================
export function renderCategoryScroll() {
    const container = document.getElementById('categoryScroll');
    if (!container) return;

    let html = '';
    const allActive = currentFilter === 'all' ? 'active' : '';
    html += `
        <div class="cat-item ${allActive}" data-cat="all" onclick="window.shopApp.filterCategory('all')">
            <span class="cat-orb"><span class="cat-face"><span class="cat-icon">📦</span></span></span>
            <span class="cat-name">${t('allCategories')}</span>
        </div>
    `;

    data.categories.forEach(c => {
        const active = currentFilter === c.id ? 'active' : '';
        const label = getCategoryName(c.id);
        const iconOrImg = c.image
            ? `<img src="${c.image}" class="cat-img" alt="${label}" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='inline-block';" /><span class="cat-icon" style="display:none;">${c.icon || '📦'}</span>`
            : `<span class="cat-icon">${c.icon || '📦'}</span>`;
        html += `
            <div class="cat-item ${active}" data-cat="${c.id}" onclick="window.shopApp.filterCategory('${c.id}')">
                <span class="cat-orb"><span class="cat-face">${iconOrImg}</span></span>
                <span class="cat-name">${label}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

export function filterCategory(catId) {
    currentFilter = catId;
    renderCategoryScroll();
    renderProducts();
}

export function scrollCategory(dir) {
    const container = document.getElementById('categoryScroll');
    if (!container) return;
    const scrollAmount = 240;
    container.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
}

// ==========================================
//  IN-APP CONFIRMATION MODAL (SOLVES BLOCKED CONFIRM() IN IFRAMES)
// ==========================================
let pendingConfirmCallback = null;

export function showConfirmDialog({ title, message, confirmText, onConfirm }) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const actionBtn = document.getElementById('confirmModalActionBtn');

    if (!modal) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }

    if (titleEl && title) titleEl.textContent = title;
    if (msgEl && message) msgEl.textContent = message;
    if (actionBtn && confirmText) actionBtn.textContent = confirmText;

    pendingConfirmCallback = onConfirm;
    modal.classList.add('open');
}

export function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('open');
    pendingConfirmCallback = null;
}

export function executeConfirmAction() {
    const cb = pendingConfirmCallback;
    pendingConfirmCallback = null;
    closeConfirmModal();
    if (typeof cb === 'function') {
        cb();
    }
}

let selectedCatImageBase64 = '';

export async function handleCatImageFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
        const compressed = await compressImageFile(file, 400, 400, 0.85);
        selectedCatImageBase64 = compressed;
        
        const previewWrap = document.getElementById('catImagePreviewState');
        const previewImg = document.getElementById('catImagePreviewImg');
        const fileNameEl = document.getElementById('catImageFileName');
        const labelEl = document.getElementById('catImageFileLabel');
        
        if (previewImg) previewImg.src = compressed;
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (labelEl) labelEl.textContent = file.name;
        if (previewWrap) previewWrap.style.display = 'inline-flex';
    } catch (err) {
        console.error('Error loading category image:', err);
        toast('هەڵە لە بارکردنی وێنەکە', 'error');
    }
}

export function removeCatImage() {
    selectedCatImageBase64 = '';
    const fileInput = document.getElementById('newCatImageFile');
    if (fileInput) fileInput.value = '';
    const previewWrap = document.getElementById('catImagePreviewState');
    const labelEl = document.getElementById('catImageFileLabel');
    if (previewWrap) previewWrap.style.display = 'none';
    if (labelEl) labelEl.textContent = 'هیچ وێنەیەک دیاری نەکراوە';
}

export function selectCatEmoji(emoji) {
    const iconInput = document.getElementById('newCatIcon');
    if (iconInput) {
        iconInput.value = emoji;
        iconInput.focus();
    }
}

// Ensure immediate global availability for inline HTML calls
if (typeof window !== 'undefined') {
    window.shopApp = window.shopApp || {};
    window.shopApp.selectCatEmoji = selectCatEmoji;
    window.shopApp.handleCatImageFile = handleCatImageFile;
    window.shopApp.removeCatImage = removeCatImage;
    window.selectCatEmoji = selectCatEmoji;
}

export function renderCategoryListEdit() {
    const container = document.getElementById('categoryListEdit');
    if (!container) return;
    if (data.categories.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:0.9rem;">هیچ پۆلێک نییە.</span>';
        return;
    }
    container.innerHTML = data.categories.map(c => {
        const iconOrImg = c.image 
            ? `<img src="${c.image}" class="cat-chip-img" alt="" onerror="this.onerror=null;this.style.display='none';" />`
            : `<span class="cat-icon">${c.icon || '📦'}</span>`;
        return `
            <span class="category-chip">
                ${iconOrImg}
                <span>${getCategoryName(c.id)}</span>
                <button class="remove-cat" onclick="window.shopApp.deleteCategory('${c.id}')" title="Delete"><i class="fas fa-times"></i></button>
            </span>
        `;
    }).join('');
}

export function addCategory() {
    const inputEl = document.getElementById('newCatName') || document.getElementById('newCatNameKu');
    const rawInput = inputEl ? inputEl.value.trim() : '';
    const userIcon = (document.getElementById('newCatIcon') ? document.getElementById('newCatIcon').value.trim() : '');
    const image = selectedCatImageBase64 || '';
    
    if (!rawInput) return toast(t('catNameRequired') || 'تکایە ناوی پۆل بنووسە', 'error');

    // Automatic translation to Kurdish, Arabic, and English
    const translations = autoTranslateCategory(rawInput);
    const finalIcon = (userIcon && userIcon !== '📦') ? userIcon : (translations.icon || userIcon || '📦');

    const newCat = {
        id: 'cat_' + generateId(),
        name: rawInput,
        nameEn: translations.en || rawInput,
        nameAr: translations.ar || rawInput,
        nameKu: translations.ku || rawInput,
        icon: finalIcon,
        image
    };
    data.categories.push(newCat);
    saveData(data);
    renderCategoryListEdit();
    renderCategoryScroll();
    populateCategorySelect();
    renderProducts();

    if (inputEl) inputEl.value = '';
    if (document.getElementById('newCatName')) document.getElementById('newCatName').value = '';
    if (document.getElementById('newCatNameAr')) document.getElementById('newCatNameAr').value = '';
    if (document.getElementById('newCatNameKu')) document.getElementById('newCatNameKu').value = '';
    if (document.getElementById('newCatIcon')) document.getElementById('newCatIcon').value = '📦';
    removeCatImage();
    toast(t('catAdded'), 'success');
}

export function switchAddSubTab(tab) {
    const prodTab = document.getElementById('subTabAddProduct');
    const catTab = document.getElementById('subTabAddCategory');
    const btnProd = document.getElementById('tabBtnAddProduct');
    const btnCat = document.getElementById('tabBtnAddCategory');

    if (tab === 'category') {
        if (prodTab) prodTab.style.display = 'none';
        if (catTab) catTab.style.display = 'block';
        if (btnProd) btnProd.classList.remove('active');
        if (btnCat) btnCat.classList.add('active');
        renderCategoryListEdit();
    } else {
        if (prodTab) prodTab.style.display = 'block';
        if (catTab) catTab.style.display = 'none';
        if (btnProd) btnProd.classList.add('active');
        if (btnCat) btnCat.classList.remove('active');
        populateCategorySelect();
    }
}

export function switchSettingsSubTab(tab) {
    const contactTab = document.getElementById('subTabSettingsContact');
    const nameLogoTab = document.getElementById('subTabSettingsNameLogo');
    const passwordTab = document.getElementById('subTabSettingsPassword');
    const promoTab = document.getElementById('subTabSettingsPromo');
    const deliveryTab = document.getElementById('subTabSettingsDelivery');
    const soundTab = document.getElementById('subTabSettingsSound');

    const btnContact = document.getElementById('tabBtnSettingsContact');
    const btnNameLogo = document.getElementById('tabBtnSettingsNameLogo');
    const btnPassword = document.getElementById('tabBtnSettingsPassword');
    const btnPromo = document.getElementById('tabBtnSettingsPromo');
    const btnDelivery = document.getElementById('tabBtnSettingsDelivery');
    const btnSound = document.getElementById('tabBtnSettingsSound');

    if (contactTab) contactTab.style.display = tab === 'contact' ? 'block' : 'none';
    if (nameLogoTab) nameLogoTab.style.display = tab === 'namelogo' ? 'block' : 'none';
    if (passwordTab) passwordTab.style.display = tab === 'password' ? 'block' : 'none';
    if (promoTab) promoTab.style.display = tab === 'promo' ? 'block' : 'none';
    if (deliveryTab) deliveryTab.style.display = tab === 'delivery' ? 'block' : 'none';
    if (soundTab) soundTab.style.display = tab === 'sound' ? 'block' : 'none';

    if (btnContact) btnContact.classList.toggle('active', tab === 'contact');
    if (btnNameLogo) btnNameLogo.classList.toggle('active', tab === 'namelogo');
    if (btnPassword) btnPassword.classList.toggle('active', tab === 'password');
    if (btnPromo) btnPromo.classList.toggle('active', tab === 'promo');
    if (btnDelivery) btnDelivery.classList.toggle('active', tab === 'delivery');
    if (btnSound) btnSound.classList.toggle('active', tab === 'sound');

    if (tab === 'contact') populateContactFields();
    if (tab === 'namelogo') updateShopNameDisplay();
    if (tab === 'password') populateCredentialsField();
    if (tab === 'promo') renderPromoCodesList();
    if (tab === 'delivery') renderCityDeliveryList();
    if (tab === 'sound') updateSoundUI();
}

export function deleteCategory(id) {
    showConfirmDialog({
        title: 'سڕینەوەی پۆل',
        message: 'ئایا دڵنیایت لە سڕینەوەی ئەم پۆلە؟',
        confirmText: 'بەڵێ، بسڕەوە',
        onConfirm: () => {
            data.categories = data.categories.filter(c => c.id !== id);
            if (data.categories.length > 0) {
                const fallback = data.categories[0].id;
                data.products.forEach(p => { if (p.categoryId === id) p.categoryId = fallback; });
            }
            if (currentFilter === id) currentFilter = 'all';
            saveData(data);
            renderCategoryListEdit();
            renderCategoryScroll();
            populateCategorySelect();
            renderProducts();
            toast(t('catDeleted') || 'پۆلەکە سڕایەوە', 'info');
        }
    });
}

export function populateCategorySelect() {
    const sel = document.getElementById('prodCategory');
    const editSel = document.getElementById('editCategory');
    if (!sel && !editSel) return;
    const options = data.categories.map(c =>
        `<option value="${c.id}">${c.icon || '📦'} ${getCategoryName(c.id)}</option>`
    ).join('');
    if (sel) sel.innerHTML = options;
    if (editSel) editSel.innerHTML = options;
}

export function applyFilters() {
    currentSearch = document.getElementById('searchInput').value;
    renderProducts();
}

// ==========================================
//  CART & ORDERS
// ==========================================
function saveCart() {
    safeStorage.setItem('arishop_cart', JSON.stringify(cart));
    updateCartBadge();
}

export function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartBadge = document.getElementById('cartBadge');
    const bottomCartBadge = document.getElementById('bottomCartBadge');
    const searchCartBadge = document.getElementById('searchCartBadge');
    if (cartBadge) cartBadge.textContent = count;
    if (bottomCartBadge) bottomCartBadge.textContent = count;
    if (searchCartBadge) {
        searchCartBadge.textContent = count;
        searchCartBadge.style.display = 'inline-flex';
    }
}

export function toggleCart(productId) {
    const idx = cart.findIndex(item => item.productId === productId);
    if (idx !== -1) {
        cart.splice(idx, 1);
        toast(t('cartRemoved'), 'info');
    } else {
        const product = getProduct(productId);
        if (!product) return;
        if (product.stockStatus === 'out-of-stock') return toast('This product is out of stock.', 'error');
        cart.push({ productId, quantity: 1 });
        toast(t('cartAdded'), 'success');
    }
    saveCart();
    renderProducts();
    renderCart();
}

export function renderCart() {
    const container = document.getElementById('cartContent');
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-cart"></i><h3>${t('cartEmpty')}</h3></div>`;
        return;
    }
    let total = 0;
    let html = `<div style="display:flex;flex-direction:column;gap:12px;">`;
    cart.forEach((item, index) => {
        const p = getProduct(item.productId);
        if (!p) return;
        const price = p.discount ? p.price * (1 - p.discount / 100) : p.price;
        const itemTotal = price * item.quantity;
        total += itemTotal;
        html += `
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card);padding:12px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-color);flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    ${p.image ? `<img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);" />` : ''}
                    <strong>${p.name}</strong>
                </div>
                <div>${formatPrice(price)} × </div>
                <div class="cart-item-controls">
                    <button type="button" onclick="window.shopApp.cartQtyChange(${index}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button type="button" onclick="window.shopApp.cartQtyChange(${index}, 1)">+</button>
                </div>
                <div>${formatPrice(itemTotal)}</div>
                <button type="button" class="btn-danger" style="padding:2px 10px;" onclick="window.shopApp.removeFromCart(${p.id})"><i class="fas fa-times"></i></button>
            </div>
        `;
    });
    html += `
        <div style="text-align:right;font-size:1.2rem;font-weight:700;padding:12px 0;border-top:1px solid var(--border-color);">
            ${t('cartTotal')}: ${formatPrice(total)}
        </div>
        <button type="button" class="btn-primary" onclick="window.shopApp.openUserInfoModal()"><i class="fas fa-check"></i> ${t('checkoutBtn')}</button>
    </div>`;
    container.innerHTML = html;
}

export function cartQtyChange(index, delta) {
    if (index < 0 || index >= cart.length) return;
    const newQty = cart[index].quantity + delta;
    if (newQty < 1) {
        cart.splice(index, 1);
    } else {
        cart[index].quantity = newQty;
    }
    saveCart();
    renderCart();
    renderProducts();
}

export function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    saveCart();
    renderCart();
    renderProducts();
}

export function getCitiesList() {
    if (data && data.cities && Array.isArray(data.cities) && data.cities.length > 0) {
        return data.cities;
    }
    return CITIES;
}

export function populateCitySelects() {
    const userCitySelect = document.getElementById('userInfoCity');
    const orderCitySelect = document.getElementById('orderCity');
    const cities = getCitiesList();
    const options = cities.map(c => {
        const name = currentLang === 'ku' ? (c.nameKu || c.name) : (currentLang === 'ar' ? (c.nameAr || c.name) : (c.nameEn || c.name));
        return `<option value="${c.id}">${name} (+${formatPrice(c.fee)})</option>`;
    }).join('');
    if (userCitySelect) {
        const curVal = userCitySelect.value;
        userCitySelect.innerHTML = options;
        if (curVal && cities.some(c => c.id === curVal)) userCitySelect.value = curVal;
    }
    if (orderCitySelect) {
        const curVal = orderCitySelect.value;
        orderCitySelect.innerHTML = options;
        if (curVal && cities.some(c => c.id === curVal)) orderCitySelect.value = curVal;
    }
}

export function getCity(cityId) {
    const cities = getCitiesList();
    return cities.find(c => c.id === cityId) || cities[0];
}

export function getCityName(cityId) {
    const city = getCity(cityId);
    if (!city) return cityId || '';
    return currentLang === 'ku' ? (city.nameKu || city.name) : (currentLang === 'ar' ? (city.nameAr || city.name) : (city.nameEn || city.name));
}

export function renderCityDeliveryList() {
    const container = document.getElementById('cityDeliveryListContainer');
    if (!container) return;
    const cities = getCitiesList();
    
    container.innerHTML = cities.map(c => {
        const name = currentLang === 'ku' ? (c.nameKu || c.name) : (currentLang === 'ar' ? (c.nameAr || c.name) : (c.nameEn || c.name));
        const isCustom = c.isCustom || !['sulaymaniyah', 'erbil', 'duhok', 'kirkuk', 'halabja', 'kalar', 'zakho', 'other'].includes(c.id);
        return `
            <div class="city-fee-card" data-city-id="${c.id}">
                <div class="city-fee-info">
                    <span class="city-fee-name"><i class="fas fa-map-marker-alt" style="color:var(--accent);"></i> ${escapeHtml(name)}</span>
                    ${isCustom ? `<button type="button" class="btn-delete-city" onclick="window.shopApp.deleteCustomCity('${c.id}')" title="سڕینەوەی شار"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
                <div class="city-fee-input-wrap">
                    <input type="number" class="city-fee-input" id="cityFeeInput_${c.id}" value="${c.fee}" step="250" min="0" />
                    <span class="city-fee-currency">د.ع</span>
                </div>
            </div>
        `;
    }).join('');
}

export function saveDeliveryFees() {
    if (!data.cities) data.cities = JSON.parse(JSON.stringify(getCitiesList()));
    let updatedCount = 0;
    data.cities.forEach(c => {
        const input = document.getElementById(`cityFeeInput_${c.id}`);
        if (input) {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val >= 0) {
                c.fee = val;
                updatedCount++;
            }
        }
    });
    saveData(data);
    populateCitySelects();
    renderCityDeliveryList();
    toast(t('deliveryFeesSaved') || 'نرخی گەیاندنی شارەکان بە سەرکەوتوویی پاشەکەوتکرا! ✅', 'success');
}

export function addCustomCity() {
    const nameInput = document.getElementById('newCityName');
    const feeInput = document.getElementById('newCityFee');
    if (!nameInput || !feeInput) return;
    const name = nameInput.value.trim();
    const fee = parseFloat(feeInput.value);

    if (!name) return toast(t('fillFields') || 'تکایە ناوی شار بنووسە', 'error');
    if (isNaN(fee) || fee < 0) return toast('تکایە تێچوویەکی دروست دیاری بکە', 'error');

    if (!data.cities) data.cities = JSON.parse(JSON.stringify(getCitiesList()));
    const cityId = 'city_' + Date.now();
    data.cities.push({
        id: cityId,
        nameKu: name,
        nameAr: name,
        nameEn: name,
        fee: fee,
        isCustom: true
    });
    saveData(data);
    populateCitySelects();
    renderCityDeliveryList();
    nameInput.value = '';
    feeInput.value = '';
    toast('شاری نوێ زیادکرا', 'success');
}

export function deleteCustomCity(cityId) {
    if (!data.cities) data.cities = JSON.parse(JSON.stringify(getCitiesList()));
    data.cities = data.cities.filter(c => c.id !== cityId);
    saveData(data);
    populateCitySelects();
    renderCityDeliveryList();
    toast('شارەکە سڕایەوە', 'info');
}

export function updateCartSummaryCard() {
    const container = document.getElementById('userInfoCostBreakdown');
    if (!container) return;
    const citySelect = document.getElementById('userInfoCity');
    const cityId = citySelect ? citySelect.value : 'sulaymaniyah';
    const cityObj = getCity(cityId);
    let deliveryFee = cityObj ? cityObj.fee : 3000;

    let subtotal = 0;
    cart.forEach(item => {
        const p = getProduct(item.productId);
        if (p) {
            const price = p.discount ? p.price * (1 - p.discount / 100) : p.price;
            subtotal += price * item.quantity;
        }
    });

    let discountAmount = 0;
    let discountLabel = '';
    if (appliedCartPromo) {
        if (appliedCartPromo.type === 'percent') {
            discountAmount = Math.round(subtotal * (appliedCartPromo.value / 100));
            discountLabel = `(${appliedCartPromo.code} - ${appliedCartPromo.value}%)`;
        } else if (appliedCartPromo.type === 'free_delivery') {
            discountAmount = deliveryFee;
            discountLabel = `(${appliedCartPromo.code} - ${t('freeDelivery') || 'گەیاندنی بێبەرامبەر'})`;
            deliveryFee = 0;
        }
    }

    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee);

    container.innerHTML = `
        <div class="summary-row">
            <span>${t('itemsSubtotal') || 'کۆی کاڵاکان'}:</span>
            <span>${formatPrice(subtotal)}</span>
        </div>
        <div class="summary-row">
            <span>${t('deliveryFeeLabel') || 'تێچووی گەیاندن'} (${getCityName(cityId)}):</span>
            <span>${deliveryFee === 0 ? `<span style="color:#10b981;font-weight:700;">${t('freeDelivery') || 'بێبەرامبەر'}</span>` : formatPrice(deliveryFee)}</span>
        </div>
        ${discountAmount > 0 ? `
            <div class="summary-row discount-highlight">
                <span><i class="fas fa-tag"></i> ${t('promoDiscount') || 'داشکاندن'} ${discountLabel}:</span>
                <span>-${formatPrice(discountAmount)}</span>
            </div>
        ` : ''}
        <div class="summary-row total-highlight">
            <span>${t('grandTotal') || 'کۆی گشتی'}:</span>
            <span class="total-val">${formatPrice(grandTotal)}</span>
        </div>
    `;
}

export function onUserInfoCityChange() {
    updateCartSummaryCard();
}

export function applyCartPromoCode() {
    const input = document.getElementById('userInfoPromo');
    const status = document.getElementById('userInfoPromoStatus');
    if (!input) return;
    const rawCode = input.value.trim().toUpperCase();
    if (!rawCode) {
        appliedCartPromo = null;
        if (status) status.style.display = 'none';
        updateCartSummaryCard();
        return;
    }
    const promos = data.promoCodes && data.promoCodes.length ? data.promoCodes : DEFAULT_PROMO_CODES;
    const found = promos.find(p => p.code.toUpperCase() === rawCode);
    if (found) {
        appliedCartPromo = found;
        if (status) {
            status.style.display = 'block';
            status.style.color = '#10b981';
            status.innerHTML = `<i class="fas fa-check-circle"></i> ${t('promoApplied') || 'کۆدی داشکاندن چالاک کرا!'}`;
        }
        toast(t('promoApplied') || 'کۆدی داشکاندن چالاک کرا!', 'success');
    } else {
        appliedCartPromo = null;
        if (status) {
            status.style.display = 'block';
            status.style.color = '#ef4444';
            status.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${t('promoInvalid') || 'کۆدی داشکاندن نادروستە'}`;
        }
        toast(t('promoInvalid') || 'کۆدی داشکاندن نادروستە', 'error');
    }
    updateCartSummaryCard();
}

export function openUserInfoModal() {
    if (cart.length === 0) return toast(t('cartEmpty'), 'error');
    populateCitySelects();
    appliedCartPromo = null;
    const nameInput = document.getElementById('userInfoName');
    const phoneInput = document.getElementById('userInfoPhone');
    const addrInput = document.getElementById('userInfoAddress');
    const promoInput = document.getElementById('userInfoPromo');
    const promoStatus = document.getElementById('userInfoPromoStatus');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (addrInput) addrInput.value = '';
    if (promoInput) promoInput.value = '';
    if (promoStatus) promoStatus.style.display = 'none';

    updateCartSummaryCard();
    document.getElementById('userInfoModal').classList.add('open');
}

export function closeUserInfoModal() {
    document.getElementById('userInfoModal').classList.remove('open');
}

export function cleanPhoneForWhatsApp(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('00964')) cleaned = cleaned.replace(/^00964/, '964');
    else if (cleaned.startsWith('0')) cleaned = '964' + cleaned.slice(1);
    else if (!cleaned.startsWith('964') && cleaned.length >= 10) cleaned = '964' + cleaned;
    return cleaned;
}

export function generateCustomerWhatsAppOrderUrl(orderSummary) {
    const shopPhone = (data.contactInfo && data.contactInfo.phone) ? data.contactInfo.phone : '0770 123 4567';
    const cleanShopPhone = cleanPhoneForWhatsApp(shopPhone);
    const storeTitle = data.shopName || 'Derin__Collection';
    const text = 
`سڵاو ${storeTitle}،
من داواکارییەکی نوێم لە وێبسایتەکەتان تۆمارکرد:

📋 ژمارەی داواکاری: #${orderSummary.orderId}
👤 کڕیار: ${orderSummary.customerName}
📞 مۆبایل: ${orderSummary.phone}
📍 شار: ${orderSummary.cityName}
🏠 ناونیشان: ${orderSummary.address}

📦 کاڵاکان:
${orderSummary.itemsText}

💰 کۆی کاڵاکان: ${formatPrice(orderSummary.subtotal)}
🚚 گەیاندن: ${orderSummary.deliveryFee === 0 ? 'بێبەرامبەر (Free)' : formatPrice(orderSummary.deliveryFee)}
${orderSummary.discountAmount > 0 ? `🏷️ داشکاندن: -${formatPrice(orderSummary.discountAmount)} (${orderSummary.promoCode})\n` : ''}💵 کۆی گشتی: ${formatPrice(orderSummary.grandTotal)}

سوپاس بۆ خزمەتگوزاریتان!`;

    return `https://wa.me/${cleanShopPhone}?text=${encodeURIComponent(text)}`;
}

export function openOrderSuccessModal(orderSummary) {
    const modal = document.getElementById('orderSuccessModal');
    const summaryBox = document.getElementById('orderSuccessSummaryBox');
    const whatsappBtn = document.getElementById('orderSuccessWhatsAppBtn');
    if (!modal) return;

    window._lastSuccessOrder = orderSummary;

    if (summaryBox) {
        summaryBox.innerHTML = `
            <div style="font-weight:700; margin-bottom:6px; color:var(--text-primary);"><i class="fas fa-receipt"></i> #${orderSummary.orderId}</div>
            <div style="color:var(--text-secondary); margin-bottom:4px;">👤 ${escapeHtml(orderSummary.customerName)} | 📞 ${escapeHtml(orderSummary.phone)}</div>
            <div style="color:var(--text-secondary); margin-bottom:4px;">📍 ${escapeHtml(orderSummary.cityName)} - ${escapeHtml(orderSummary.address)}</div>
            <div style="margin-top:6px; font-weight:700; color:var(--accent); font-size:1.05rem;">💵 ${t('grandTotal') || 'کۆی گشتی'}: ${formatPrice(orderSummary.grandTotal)}</div>
        `;
    }

    if (whatsappBtn) {
        whatsappBtn.href = generateCustomerWhatsAppOrderUrl(orderSummary);
    }

    modal.style.display = 'flex';
    modal.classList.add('open');
}

export function closeOrderSuccessModal() {
    const modal = document.getElementById('orderSuccessModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
    }
}

export function submitCheckout(customerName, phone, address, cityId = 'sulaymaniyah') {
    if (cart.length === 0) return toast(t('cartEmpty'), 'error');

    const cityObj = getCity(cityId);
    let deliveryFee = cityObj ? cityObj.fee : 3000;
    const cityName = getCityName(cityId);

    let subtotal = 0;
    let itemsTextArr = [];
    cart.forEach(item => {
        const p = getProduct(item.productId);
        if (p) {
            const price = p.discount ? p.price * (1 - p.discount / 100) : p.price;
            subtotal += price * item.quantity;
            itemsTextArr.push(`• ${p.name} × ${item.quantity} (${formatPrice(price * item.quantity)})`);
        }
    });

    let discountAmount = 0;
    let promoCodeName = '';
    if (appliedCartPromo) {
        promoCodeName = appliedCartPromo.code;
        if (appliedCartPromo.type === 'percent') {
            discountAmount = Math.round(subtotal * (appliedCartPromo.value / 100));
        } else if (appliedCartPromo.type === 'free_delivery') {
            discountAmount = deliveryFee;
            deliveryFee = 0;
        }
    }
    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee);
    const primaryOrderId = generateId();

    const newOrdersList = [];
    cart.forEach((item, index) => {
        const p = getProduct(item.productId);
        if (!p) return;
        const order = {
            id: index === 0 ? primaryOrderId : generateId(),
            productId: item.productId,
            customerName: escapeHtml(customerName),
            phone: escapeHtml(phone),
            city: cityId,
            address: escapeHtml(address),
            quantity: item.quantity,
            status: 'pending',
            date: new Date().toISOString().slice(0, 10),
            deleted: false,
            productImage: p.image || '',
            adminSeen: false,
            userSeen: false,
            deliveryFee: index === 0 ? deliveryFee : 0,
            discountAmount: index === 0 ? discountAmount : 0,
            promoCode: promoCodeName,
            grandTotal: index === 0 ? grandTotal : 0
        };
        data.orders.push(order);
        newOrdersList.push(order);
    });

    saveLocalOnly(data);
    postOrderToServer(newOrdersList);
    cart = [];
    saveCart();
    renderProducts();
    renderOrders();
    renderCart();
    renderMyOrders();
    updateOrderBadges();
    closeUserInfoModal();

    // Trigger sound alert
    playOrderNotificationChime();

    // Show order success dialog with WhatsApp quick dispatch
    openOrderSuccessModal({
        orderId: primaryOrderId,
        customerName,
        phone,
        cityId,
        cityName,
        address,
        itemsText: itemsTextArr.join('\n'),
        subtotal,
        deliveryFee,
        discountAmount,
        promoCode: promoCodeName,
        grandTotal
    });

    toast(t('orderPlaced'), 'success');
}

export function updateOrderModalCalculations() {
    const container = document.getElementById('orderSummaryBreakdown');
    if (!container) return;
    const productId = parseInt(document.getElementById('orderProductId').value);
    const p = getProduct(productId);
    if (!p) return;
    const qty = parseInt(document.getElementById('orderQty').value) || 1;
    const unitPrice = p.discount ? p.price * (1 - p.discount / 100) : p.price;
    const subtotal = unitPrice * qty;

    const citySelect = document.getElementById('orderCity');
    const cityId = citySelect ? citySelect.value : 'sulaymaniyah';
    const cityObj = getCity(cityId);
    let deliveryFee = cityObj ? cityObj.fee : 3000;

    let discountAmount = 0;
    let discountLabel = '';
    if (appliedSingleOrderPromo) {
        if (appliedSingleOrderPromo.type === 'percent') {
            discountAmount = Math.round(subtotal * (appliedSingleOrderPromo.value / 100));
            discountLabel = `(${appliedSingleOrderPromo.code} - ${appliedSingleOrderPromo.value}%)`;
        } else if (appliedSingleOrderPromo.type === 'free_delivery') {
            discountAmount = deliveryFee;
            discountLabel = `(${appliedSingleOrderPromo.code} - ${t('freeDelivery') || 'گەیاندنی بێبەرامبەر'})`;
            deliveryFee = 0;
        }
    }

    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee);

    container.innerHTML = `
        <div class="summary-row">
            <span>${t('itemsSubtotal') || 'کۆی کاڵا'}:</span>
            <span>${formatPrice(subtotal)}</span>
        </div>
        <div class="summary-row">
            <span>${t('deliveryFeeLabel') || 'تێچووی گەیاندن'} (${getCityName(cityId)}):</span>
            <span>${deliveryFee === 0 ? `<span style="color:#10b981;font-weight:700;">${t('freeDelivery') || 'بێبەرامبەر'}</span>` : formatPrice(deliveryFee)}</span>
        </div>
        ${discountAmount > 0 ? `
            <div class="summary-row discount-highlight">
                <span><i class="fas fa-tag"></i> ${t('promoDiscount') || 'داشکاندن'} ${discountLabel}:</span>
                <span>-${formatPrice(discountAmount)}</span>
            </div>
        ` : ''}
        <div class="summary-row total-highlight">
            <span>${t('grandTotal') || 'کۆی گشتی'}:</span>
            <span class="total-val">${formatPrice(grandTotal)}</span>
        </div>
    `;
}

export function onOrderCityChange() {
    updateOrderModalCalculations();
}

export function applySingleOrderPromo() {
    const input = document.getElementById('orderPromo');
    const status = document.getElementById('orderPromoStatus');
    if (!input) return;
    const rawCode = input.value.trim().toUpperCase();
    if (!rawCode) {
        appliedSingleOrderPromo = null;
        if (status) status.style.display = 'none';
        updateOrderModalCalculations();
        return;
    }
    const promos = data.promoCodes && data.promoCodes.length ? data.promoCodes : DEFAULT_PROMO_CODES;
    const found = promos.find(p => p.code.toUpperCase() === rawCode);
    if (found) {
        appliedSingleOrderPromo = found;
        if (status) {
            status.style.display = 'block';
            status.style.color = '#10b981';
            status.innerHTML = `<i class="fas fa-check-circle"></i> ${t('promoApplied') || 'کۆدی داشکاندن چالاک کرا!'}`;
        }
        toast(t('promoApplied') || 'کۆدی داشکاندن چالاک کرا!', 'success');
    } else {
        appliedSingleOrderPromo = null;
        if (status) {
            status.style.display = 'block';
            status.style.color = '#ef4444';
            status.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${t('promoInvalid') || 'کۆدی داشکاندن نادروستە'}`;
        }
        toast(t('promoInvalid') || 'کۆدی داشکاندن نادروستە', 'error');
    }
    updateOrderModalCalculations();
}

export function openOrderModal(productId) {
    const p = getProduct(productId);
    if (!p) return toast('Product not found', 'error');
    populateCitySelects();
    appliedSingleOrderPromo = null;

    document.getElementById('orderProductId').value = p.id;
    document.getElementById('orderProductName').value = p.name + ' (' + formatPrice(p.price) + ')';
    document.getElementById('orderCustomerName').value = '';
    document.getElementById('orderPhone').value = '';
    if (document.getElementById('orderAddress')) document.getElementById('orderAddress').value = '';
    if (document.getElementById('orderPromo')) document.getElementById('orderPromo').value = '';
    if (document.getElementById('orderPromoStatus')) document.getElementById('orderPromoStatus').style.display = 'none';
    document.getElementById('orderQty').value = 1;
    
    // Status selection: HIDDEN for regular customers as requested
    const statusGroup = document.getElementById('orderStatusGroup');
    if (statusGroup) {
        statusGroup.style.display = currentRole === 'admin' ? 'block' : 'none';
    }
    const statusSelect = document.getElementById('orderStatus');
    if (statusSelect) {
        statusSelect.value = 'pending';
    }

    document.getElementById('modalTitle').innerHTML =
        `<i class="fas fa-shopping-cart" style="color:var(--accent);"></i> ${t('orderTitle')}: ${p.name}`;
    
    updateOrderModalCalculations();
    document.getElementById('orderModal').classList.add('open');
}

export function closeModal() {
    document.getElementById('orderModal').classList.remove('open');
}

export function submitSingleOrder(e) {
    e.preventDefault();
    const productId = parseInt(document.getElementById('orderProductId').value);
    const rawCustomerName = document.getElementById('orderCustomerName').value.trim();
    const rawPhone = document.getElementById('orderPhone').value.trim();
    const rawAddress = document.getElementById('orderAddress') ? document.getElementById('orderAddress').value.trim() : '';
    const cityId = document.getElementById('orderCity') ? document.getElementById('orderCity').value : 'sulaymaniyah';
    const qty = parseInt(document.getElementById('orderQty').value) || 1;

    // Regular users cannot choose status, always 'pending'
    const status = currentRole === 'admin' ? (document.getElementById('orderStatus')?.value || 'pending') : 'pending';

    if (!rawCustomerName || !rawPhone || !qty || qty < 1) return toast(t('fillFields'), 'error');
    const product = getProduct(productId);
    if (!product) return toast('Product not found.', 'error');
    if (product.stockStatus === 'out-of-stock') return toast('This product is out of stock.', 'error');

    const customerName = escapeHtml(rawCustomerName);
    const phone = escapeHtml(rawPhone);
    const address = escapeHtml(rawAddress);
    const cityObj = getCity(cityId);
    let deliveryFee = cityObj ? cityObj.fee : 3000;
    const cityName = getCityName(cityId);

    const unitPrice = product.discount ? product.price * (1 - product.discount / 100) : product.price;
    const subtotal = unitPrice * qty;

    let discountAmount = 0;
    let promoCodeName = '';
    if (appliedSingleOrderPromo) {
        promoCodeName = appliedSingleOrderPromo.code;
        if (appliedSingleOrderPromo.type === 'percent') {
            discountAmount = Math.round(subtotal * (appliedSingleOrderPromo.value / 100));
        } else if (appliedSingleOrderPromo.type === 'free_delivery') {
            discountAmount = deliveryFee;
            deliveryFee = 0;
        }
    }
    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee);
    const orderId = generateId();

    const order = {
        id: orderId,
        productId,
        customerName,
        phone,
        city: cityId,
        address,
        quantity: qty,
        status,
        date: new Date().toISOString().slice(0, 10),
        deleted: false,
        productImage: product.image || '',
        adminSeen: false,
        userSeen: false,
        deliveryFee,
        discountAmount,
        promoCode: promoCodeName,
        grandTotal
    };
    data.orders.push(order);
    saveLocalOnly(data);
    postOrderToServer(order);
    renderProducts();
    renderOrders();
    renderMyOrders();
    updateOrderBadges();
    closeModal();

    // Audio notification
    playOrderNotificationChime();

    // Show order success dialog with WhatsApp quick dispatch
    openOrderSuccessModal({
        orderId,
        customerName,
        phone,
        cityId,
        cityName,
        address,
        itemsText: `• ${product.name} × ${qty} (${formatPrice(subtotal)})`,
        subtotal,
        deliveryFee,
        discountAmount,
        promoCode: promoCodeName,
        grandTotal
    });

    toast(t('orderPlaced'), 'success');
}

export function updateOrderBadges() {
    // Only show badge when customer submits new order(s) that admin has not viewed yet
    const newAdminOrders = data.orders.filter(o => !o.adminDeleted && !o.deleted && o.adminSeen === false);
    const adminCount = newAdminOrders.length;

    const orderBadge = document.getElementById('orderBadge');
    if (orderBadge) {
        if (adminCount > 0) {
            orderBadge.textContent = adminCount;
            orderBadge.style.display = 'inline-flex';
        } else {
            orderBadge.textContent = '';
            orderBadge.style.display = 'none';
        }
    }

    const bottomOrderBadge = document.getElementById('bottomOrderBadge');
    if (bottomOrderBadge) {
        if (adminCount > 0) {
            bottomOrderBadge.textContent = adminCount;
            bottomOrderBadge.style.display = 'inline-flex';
        } else {
            bottomOrderBadge.textContent = '';
            bottomOrderBadge.style.display = 'none';
        }
    }

    // Customer "My Orders" badge for unread customer orders
    const newUserOrders = data.orders.filter(o => !o.userDeleted && o.userSeen === false);
    const userCount = newUserOrders.length;

    const myOrdersBadge = document.getElementById('myOrdersBadge');
    if (myOrdersBadge) {
        if (userCount > 0) {
            myOrdersBadge.textContent = userCount;
            myOrdersBadge.style.display = 'inline-flex';
        } else {
            myOrdersBadge.textContent = '';
            myOrdersBadge.style.display = 'none';
        }
    }

    const bottomMyOrdersBadge = document.getElementById('bottomMyOrdersBadge');
    if (bottomMyOrdersBadge) {
        if (userCount > 0) {
            bottomMyOrdersBadge.textContent = userCount;
            bottomMyOrdersBadge.style.display = 'inline-flex';
        } else {
            bottomMyOrdersBadge.textContent = '';
            bottomMyOrdersBadge.style.display = 'none';
        }
    }
}

export function markOrdersAsSeen() {
    let changed = false;
    data.orders.forEach(o => {
        if (!o.adminDeleted && !o.deleted && o.adminSeen === false) {
            o.adminSeen = true;
            changed = true;
        }
    });
    if (changed) {
        saveData(data);
    }
    updateOrderBadges();
}

export function markUserOrdersAsSeen() {
    let changed = false;
    data.orders.forEach(o => {
        if (!o.userDeleted && o.userSeen === false) {
            o.userSeen = true;
            changed = true;
        }
    });
    if (changed) {
        saveLocalOnly(data);
    }
    updateOrderBadges();
}

export function playOrderNotificationChime() {
    if (data.soundEnabled === false) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;
        // 4-tone crystal clear modern pleasant chime (D5, F#5, A5, D6)
        const notes = [587.33, 739.99, 880.00, 1174.66];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.09);
            gain.gain.setValueAtTime(0, now + i * 0.09);
            gain.gain.linearRampToValueAtTime(0.22, now + i * 0.09 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.09);
            osc.stop(now + i * 0.09 + 0.36);
        });
    } catch (e) {
        console.warn('Audio notice error:', e);
    }
}

export function toggleSound() {
    data.soundEnabled = data.soundEnabled !== false ? false : true;
    saveData(data);
    updateSoundUI();
    if (data.soundEnabled) {
        playOrderNotificationChime();
        toast(t('soundEnabled') || 'دەنگ چالاکە', 'success');
    } else {
        toast(t('soundDisabled') || 'دەنگ ناچالاکە', 'info');
    }
}

export function testSound() {
    playOrderNotificationChime();
    toast(t('testSound') || 'تاقیکردنەوەی دەنگ', 'info');
}

export function updateSoundUI() {
    const isEnabled = data.soundEnabled !== false;
    
    // Admin orders toolbar button
    const adminSoundBtn = document.getElementById('adminSoundToggleBtn');
    if (adminSoundBtn) {
        adminSoundBtn.innerHTML = isEnabled 
            ? `<i class="fas fa-volume-up"></i> <span>${t('soundEnabled') || 'دەنگ چالاکە'}</span>`
            : `<i class="fas fa-volume-mute" style="color:#ef4444;"></i> <span>${t('soundDisabled') || 'دەنگ ناچالاکە'}</span>`;
        adminSoundBtn.classList.toggle('active', isEnabled);
    }

    // Settings sound subtab toggle button
    const settingsSoundToggleBtn = document.getElementById('settingsSoundToggleBtn');
    if (settingsSoundToggleBtn) {
        settingsSoundToggleBtn.innerHTML = isEnabled
            ? `<i class="fas fa-bell"></i> ${t('soundEnabled') || 'دەنگ چالاکە'}`
            : `<i class="fas fa-bell-slash"></i> ${t('soundDisabled') || 'دەنگ ناچالاکە'}`;
        settingsSoundToggleBtn.className = isEnabled ? 'btn-primary' : 'btn-secondary';
    }

    const soundStatusText = document.getElementById('soundStatusText');
    if (soundStatusText) {
        soundStatusText.textContent = isEnabled 
            ? (t('soundActiveDesc') || 'کاتی گەیشتنی هەر داواکارییەکی نوێ زەنگ لێدەدات')
            : (t('soundMutedDesc') || 'دەنگ کز کراوە');
    }
}

export function getWhatsAppCustomerChatLink(order) {
    const cleanCustomerPhone = cleanPhoneForWhatsApp(order.phone);
    const pname = getProductName(order.productId);
    const storeTitle = data.shopName || 'Derin__Collection';
    const msg = `سڵاو بەڕێز ${order.customerName}،
پەیوەندیتان پێوە دەکەین لە فرۆشگای ${storeTitle} سەبارەت بە داواکاری #${order.id} (${pname}).
ئایا کاتەکەتان گونجاوە بۆ گەیاندن؟`;
    return `https://wa.me/${cleanCustomerPhone}?text=${encodeURIComponent(msg)}`;
}

export function renderInvoiceContent(order) {
    if (!order) return '';
    const p = getProduct(order.productId);
    const pname = p ? p.name : getProductName(order.productId);
    const unitPrice = p ? (p.discount ? p.price * (1 - p.discount / 100) : p.price) : 0;
    const subtotal = unitPrice * (order.quantity || 1);
    const delFee = order.deliveryFee !== undefined ? order.deliveryFee : 3000;
    const disc = order.discountAmount || 0;
    const grand = order.grandTotal || (subtotal + delFee - disc);
    const cityName = getCityName(order.city || 'sulaymaniyah');

    const shopLogo = data.shopLogo || '/rebaz-logo.jpg';
    const shopName = data.shopName || 'Derin__Collection';
    const shopPhone = (data.contactInfo && data.contactInfo.phone) ? data.contactInfo.phone : '0770 123 4567';
    const shopAddress = (data.contactInfo && data.contactInfo.address) ? data.contactInfo.address : 'سلێمانی - عێراق';

    return `
        <div class="invoice-container">
            <div class="invoice-header">
                <div class="invoice-brand">
                    <img src="${shopLogo}" alt="${shopName}" class="invoice-logo-img" />
                    <div>
                        <div class="invoice-brand-title">${escapeHtml(shopName)}</div>
                        <div class="invoice-brand-sub">${escapeHtml(shopAddress)} | ${escapeHtml(shopPhone)}</div>
                    </div>
                </div>
                <div class="invoice-meta">
                    <div><strong>${t('invoiceNumber') || 'ژمارەی پسوولە'}:</strong> #${order.id}</div>
                    <div><strong>${t('invoiceDate') || 'بەروار'}:</strong> ${order.date}</div>
                    <div><strong>${t('invoiceStatus') || 'دۆخ'}:</strong> ${order.status === 'accepted' ? 'پەسەندکراو (Accepted)' : 'چاوەڕوان (Pending)'}</div>
                </div>
            </div>

            <div class="invoice-customer-card">
                <div style="font-weight:700; color:#0f172a; margin-bottom:4px;"><i class="fas fa-user-tag"></i> ${t('customerInfo') || 'زانیاری کڕیار'}:</div>
                <div class="invoice-customer-grid">
                    <div><strong>${t('customerNameLabel') || 'ناوی کڕیار'}:</strong> ${escapeHtml(order.customerName)}</div>
                    <div><strong>${t('phoneLabel') || 'مۆبایل'}:</strong> ${escapeHtml(order.phone)}</div>
                    <div><strong>${t('cityLabel') || 'شار'}:</strong> ${escapeHtml(cityName)}</div>
                    <div><strong>${t('addressLabel') || 'ناونیشان'}:</strong> ${escapeHtml(order.address || '—')}</div>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width:40px;">#</th>
                        <th>${t('invoiceItem') || 'کاڵا'}</th>
                        <th style="width:80px; text-align:center;">${t('quantity') || 'ژمارە'}</th>
                        <th style="width:120px;">${t('unitPrice') || 'نرخی یەکە'}</th>
                        <th style="width:130px;">${t('totalPrice') || 'کۆی نرخ'}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>
                            <strong>${escapeHtml(pname)}</strong>
                        </td>
                        <td style="text-align:center;">${order.quantity}</td>
                        <td>${formatPrice(unitPrice)}</td>
                        <td style="font-weight:700;">${formatPrice(subtotal)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="invoice-totals">
                <div class="tot-row">
                    <span>${t('itemsSubtotal') || 'کۆی کاڵاکان'}:</span>
                    <span>${formatPrice(subtotal)}</span>
                </div>
                <div class="tot-row">
                    <span>${t('deliveryFeeLabel') || 'تێچووی گەیاندن'}:</span>
                    <span>${delFee === 0 ? (t('freeDelivery') || 'بێبەرامبەر') : formatPrice(delFee)}</span>
                </div>
                ${disc > 0 ? `
                <div class="tot-row" style="color:#10b981; font-weight:600;">
                    <span>${t('promoDiscount') || 'داشکاندن'} (${escapeHtml(order.promoCode || '')}):</span>
                    <span>-${formatPrice(disc)}</span>
                </div>
                ` : ''}
                <div class="tot-row grand">
                    <span>${t('grandTotal') || 'کۆی گشتی'}:</span>
                    <span>${formatPrice(grand)}</span>
                </div>
            </div>

            <div class="invoice-footer">
                ${t('invoiceThankYou') || 'سوپاس بۆ کڕینەکەتان لە فرۆشگاکەمان! بۆ هەر پرسیارێک پەیوەندیمان پێوە بکەن.'}
            </div>
        </div>
    `;
}

export function openInvoiceModal(orderId) {
    const order = data.orders.find(o => o.id === Number(orderId));
    if (!order) return toast('Order not found', 'error');
    const modal = document.getElementById('invoiceModal');
    const area = document.getElementById('invoicePrintArea');
    if (!modal || !area) return;
    area.innerHTML = renderInvoiceContent(order);
    modal.style.display = 'flex';
    modal.classList.add('open');
}

export function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
    }
}

export function printInvoiceHtml(contentHtml, docTitle = 'Invoice') {
    if (!contentHtml) return;

    const fullHtml = `<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(docTitle)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            direction: rtl;
            padding: 16px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .invoice-container {
            background: #ffffff;
            color: #1e293b;
            padding: 22px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            margin: 0 auto 24px auto;
            max-width: 760px;
            box-shadow: none;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 14px;
            margin-bottom: 16px;
        }
        .invoice-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .invoice-logo-img {
            width: 56px;
            height: 56px;
            border-radius: 8px;
            object-fit: cover;
            border: 1px solid #cbd5e1;
        }
        .invoice-brand-title {
            font-size: 1.3rem;
            font-weight: 800;
            color: #0f172a;
        }
        .invoice-brand-sub {
            font-size: 0.85rem;
            color: #64748b;
            margin-top: 2px;
        }
        .invoice-meta {
            text-align: left;
            font-size: 0.88rem;
            color: #475569;
            line-height: 1.6;
        }
        .invoice-meta strong {
            color: #0f172a;
        }
        .invoice-customer-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 16px;
            font-size: 0.9rem;
        }
        .invoice-customer-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 16px;
            margin-top: 6px;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 0.92rem;
        }
        .invoice-table th {
            background: #f1f5f9;
            color: #334155;
            padding: 10px 12px;
            text-align: right;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
        }
        .invoice-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
            text-align: right;
        }
        .invoice-totals {
            max-width: 340px;
            margin-right: auto;
            margin-left: 0;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 0.92rem;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .invoice-totals .tot-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #475569;
        }
        .invoice-totals .tot-row.grand {
            font-weight: 800;
            color: #0f172a;
            font-size: 1.1rem;
            border-top: 1.5px solid #cbd5e1;
            padding-top: 8px;
            margin-top: 4px;
        }
        .invoice-footer {
            text-align: center;
            margin-top: 22px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            font-size: 0.85rem;
            color: #64748b;
        }
        .invoice-page-break {
            page-break-after: always;
            break-after: page;
            margin-bottom: 30px;
        }
        @media print {
            body { padding: 0; }
            .invoice-container {
                border: 1px solid #cbd5e1;
                box-shadow: none;
                padding: 14px;
                margin-bottom: 0;
            }
        }
    </style>
</head>
<body>
    ${contentHtml}
</body>
</html>`;

    const modal = document.getElementById('invoiceModal');
    const area = document.getElementById('invoicePrintArea');
    if (modal && area) {
        area.innerHTML = contentHtml;
        modal.style.display = 'flex';
        modal.classList.add('open');
    }

    triggerPrintInvoice();
}

export function openPrintWindow(contentHtml, docTitle = 'Invoice') {
    const printHtml = `<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(docTitle)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            direction: rtl;
            padding: 16px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-toolbar {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 20px;
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        .print-btn {
            background: #FF5E00;
            color: #ffffff;
            border: none;
            padding: 10px 24px;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .invoice-container {
            background: #ffffff;
            color: #1e293b;
            padding: 22px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            margin: 0 auto;
            max-width: 740px;
        }
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 14px;
            margin-bottom: 16px;
        }
        .invoice-brand { display: flex; align-items: center; gap: 12px; }
        .invoice-logo-img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; }
        .invoice-brand-title { font-size: 1.3rem; font-weight: 800; color: #0f172a; }
        .invoice-brand-sub { font-size: 0.85rem; color: #64748b; margin-top: 2px; }
        .invoice-meta { text-align: left; font-size: 0.88rem; color: #475569; line-height: 1.6; }
        .invoice-meta strong { color: #0f172a; }
        .invoice-customer-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 0.9rem; }
        .invoice-customer-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; margin-top: 6px; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.92rem; }
        .invoice-table th { background: #f1f5f9; color: #334155; padding: 10px 12px; text-align: right; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
        .invoice-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; text-align: right; }
        .invoice-totals { max-width: 340px; margin-right: auto; margin-left: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 0.92rem; display: flex; flex-direction: column; gap: 6px; }
        .invoice-totals .tot-row { display: flex; justify-content: space-between; align-items: center; color: #475569; }
        .invoice-totals .tot-row.grand { font-weight: 800; color: #0f172a; font-size: 1.1rem; border-top: 1.5px solid #cbd5e1; padding-top: 8px; margin-top: 4px; }
        .invoice-footer { text-align: center; margin-top: 22px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 0.85rem; color: #64748b; }
        @media print {
            .no-print, .print-toolbar { display: none !important; }
            body { padding: 0; }
            .invoice-container { border: 1px solid #cbd5e1; box-shadow: none; padding: 14px; margin: 0; max-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <button type="button" class="print-btn" onclick="window.print()"><i class="fas fa-print"></i> ئێستا چاپ بکە (Print)</button>
        <button type="button" class="print-btn" style="background:#64748b;" onclick="window.close()"><i class="fas fa-times"></i> داخستن</button>
    </div>
    ${contentHtml}
    <script>
        window.addEventListener('load', function() {
            setTimeout(function() {
                try { window.print(); } catch(_) {}
            }, 300);
        });
    </script>
</body>
</html>`;

    let opened = false;
    try {
        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(printHtml);
            printWin.document.close();
            opened = true;
        }
    } catch (_) {}

    if (!opened) {
        try {
            const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            const win = window.open(blobUrl, '_blank');
            if (win) opened = true;
        } catch (_) {}
    }

    if (!opened) {
        window.print();
    }
}

export function triggerPrintInvoice() {
    const modal = document.getElementById('invoiceModal');
    const area = document.getElementById('invoicePrintArea');
    if (!area || !area.innerHTML.trim()) {
        toast('هیچ پسوولەیەک نییە بۆ چاپکردن', 'error');
        return;
    }

    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('open');
    }

    // Try direct native print first if top level
    let directWorked = false;
    try {
        if (window.self === window.top && typeof window.print === 'function') {
            window.print();
            directWorked = true;
        }
    } catch (_) {}

    if (!directWorked) {
        openPrintWindow(area.innerHTML, 'پسوولەی داواکاری');
    }
}

export async function downloadInvoicePdf() {
    const area = document.getElementById('invoicePrintArea');
    if (!area || !area.innerHTML.trim()) {
        toast('هیچ پسوولەیەک نییە بۆ داگرتن', 'error');
        return;
    }
    toast('پەڕەی PDF ئامادە دەکرێت... ⏳', 'info');

    const orderIdMatch = area.innerHTML.match(/#(\d+)/);
    const orderNum = orderIdMatch ? orderIdMatch[1] : Date.now();

    if (!window.html2pdf) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = () => resolve(window.html2pdf);
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (_) {
            console.warn('Could not load html2pdf from CDN, falling back to print');
        }
    }

    if (window.html2pdf) {
        const opt = {
            margin: [8, 8, 8, 8],
            filename: `Invoice-${orderNum}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true,
                backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(area).save().then(() => {
            toast('پسوولەکە وەک PDF بە سەرکەوتوویی داگیرا 📄✅', 'success');
        }).catch(err => {
            console.error('PDF error:', err);
            toast('هەڵەیەک ڕوویدا لە دروستکردنی PDF، پەڕەی چاپ دەکرێتەوە', 'warning');
            triggerPrintInvoice();
        });
    } else {
        triggerPrintInvoice();
    }
}

export function directPrintOrder(orderId) {
    const order = data.orders.find(o => o.id === Number(orderId));
    if (!order) return toast('داواکاری نەدۆزرایەوە', 'error');
    
    openInvoiceModal(order.id);
    
    setTimeout(() => {
        if (typeof window.print === 'function') {
            try {
                window.print();
            } catch (err) {
                console.warn('Direct print error:', err);
            }
        }
    }, 100);
}

export function printAllInvoices() {
    const visibleOrders = data.orders.filter(o => !o.adminDeleted && !o.deleted);
    if (visibleOrders.length === 0) return toast(t('noOrdersToPrint') || 'هیچ داواکارییەک نییە بۆ چاپکردن', 'info');

    const allInvoicesHtml = visibleOrders.map(o => `
        <div class="invoice-page-break">
            ${renderInvoiceContent(o)}
        </div>
    `).join('');

    const area = document.getElementById('invoicePrintArea');
    const modal = document.getElementById('invoiceModal');
    if (area && modal) {
        area.innerHTML = allInvoicesHtml;
        modal.style.display = 'flex';
        modal.classList.add('open');
    }

    setTimeout(() => {
        if (typeof window.print === 'function') {
            try {
                window.print();
            } catch (err) {
                console.warn('Print all error:', err);
            }
        }
    }, 100);
}

export function printCurrentSuccessOrder() {
    if (window._lastSuccessOrder) {
        const order = data.orders.find(o => o.id === window._lastSuccessOrder.orderId) || window._lastSuccessOrder;
        const invoiceHtml = renderInvoiceContent(order);
        printInvoiceHtml(invoiceHtml, `پسوولەی داواکاری #${order.id}`);
    } else {
        triggerPrintInvoice();
    }
}

export function renderPromoCodesList() {
    const container = document.getElementById('promoCodesListContainer');
    if (!container) return;
    const promos = data.promoCodes && data.promoCodes.length ? data.promoCodes : DEFAULT_PROMO_CODES;
    if (promos.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); padding:10px;">هیچ کۆدێکی داشکاندن نییە.</div>';
        return;
    }
    container.innerHTML = promos.map(p => {
        const valText = p.type === 'percent' ? `${p.value}%` : (t('freeDelivery') || 'گەیاندنی بێبەرامبەر');
        return `
            <div class="promo-code-card">
                <div>
                    <span class="promo-code-badge">${escapeHtml(p.code)}</span>
                    <strong style="margin:0 8px;">${valText}</strong>
                    <span style="color:var(--text-secondary); font-size:0.85rem;">(${escapeHtml(p.labelKu || p.labelEn || '')})</span>
                </div>
                <button type="button" class="btn-danger" style="padding:4px 10px; font-size:0.8rem;" onclick="window.shopApp.deletePromoCode('${escapeHtml(p.code)}')"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    }).join('');
}

export function addPromoCode() {
    const codeInput = document.getElementById('newPromoCode');
    const typeSelect = document.getElementById('newPromoType');
    const valInput = document.getElementById('newPromoValue');
    const labelInput = document.getElementById('newPromoLabel');
    if (!codeInput) return;

    const code = codeInput.value.trim().toUpperCase();
    const type = typeSelect ? typeSelect.value : 'percent';
    const value = valInput ? parseInt(valInput.value) || 10 : 10;
    const label = labelInput ? labelInput.value.trim() : '';

    if (!code) return toast('تکایە کۆد بنووسە', 'error');
    if (!data.promoCodes) data.promoCodes = [...DEFAULT_PROMO_CODES];

    if (data.promoCodes.some(p => p.code.toUpperCase() === code)) {
        return toast('ئەم کۆدە پێشتر هەیە', 'error');
    }

    data.promoCodes.push({
        code,
        type,
        value,
        labelKu: label || code,
        labelAr: label || code,
        labelEn: label || code
    });

    saveData(data);
    renderPromoCodesList();
    codeInput.value = '';
    if (labelInput) labelInput.value = '';
    toast('کۆدی داشکاندن زیادکرا', 'success');
}

export function deletePromoCode(code) {
    if (!data.promoCodes) data.promoCodes = [...DEFAULT_PROMO_CODES];
    data.promoCodes = data.promoCodes.filter(p => p.code.toUpperCase() !== code.toUpperCase());
    saveData(data);
    renderPromoCodesList();
    toast('کۆدی داشکاندن سڕایەوە', 'info');
}

export function renderOrders() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    // Admin only sees orders that haven't been deleted by admin
    const visibleOrders = data.orders.filter(o => !o.adminDeleted && !o.deleted);
    const count = visibleOrders.length;
    
    const countEl = document.getElementById('orderCount');
    if (countEl) countEl.textContent = count + ' ' + t('navOrders').toLowerCase();

    updateOrderBadges();
    updateSoundUI();

    if (count === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>${t('noOrders')}</h3></div>`;
        return;
    }
    const sorted = [...visibleOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = sorted.map(o => {
        const p = getProduct(o.productId);
        const pname = p ? p.name : getProductName(o.productId);
        const unitPrice = p ? (p.discount ? p.price * (1 - p.discount / 100) : p.price) : 0;
        const subtotal = unitPrice * o.quantity;
        const delFee = o.deliveryFee !== undefined ? o.deliveryFee : 3000;
        const disc = o.discountAmount || 0;
        const grand = o.grandTotal || (subtotal + delFee - disc);
        const cityName = getCityName(o.city || 'sulaymaniyah');

        const statusCls = o.status || 'pending';
        const statusLabel = t('status' + statusCls.charAt(0).toUpperCase() + statusCls.slice(1)) || statusCls;
        const isAccepted = o.status === 'accepted';
        const imgHtml = o.productImage ? `<img src="${o.productImage}" class="order-card-thumb" alt="${escapeHtml(pname)}" />` : `<div class="order-card-thumb-placeholder"><i class="fas fa-box"></i></div>`;
        
        return `
            <div class="order-card-refined ${statusCls}">
                <!-- TOP HEADER: Customer Identity, Phone, City, Status & Date -->
                <div class="order-card-top">
                    <div class="order-customer-meta">
                        <span class="order-chip-id">#${o.id}</span>
                        <span class="order-chip-customer"><i class="fas fa-user"></i> ${escapeHtml(o.customerName)}</span>
                        <a href="tel:${escapeHtml(o.phone)}" class="order-chip-phone"><i class="fas fa-phone-alt"></i> ${escapeHtml(o.phone)}</a>
                        <span class="order-chip-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(cityName)}${o.address ? ` • ${escapeHtml(o.address)}` : ''}</span>
                    </div>
                    <div class="order-status-date-wrap">
                        <span class="order-status ${statusCls}">${statusLabel}</span>
                        <span class="order-date-pill"><i class="far fa-calendar-alt"></i> ${o.date}</span>
                    </div>
                </div>

                <!-- PRODUCT ROW: Thumbnail, Title, Unit Price & Quantity -->
                <div class="order-product-details">
                    ${imgHtml}
                    <div class="order-product-info">
                        <div class="order-product-title">${escapeHtml(pname)}</div>
                        <div class="order-product-sub">
                            <span class="order-unit-price">${formatPrice(unitPrice)}</span>
                            <span class="order-qty-pill">${o.quantity} دانە</span>
                        </div>
                    </div>
                </div>

                <!-- 3-COLUMN FINANCIAL SUMMARY STRIP (Matches IMG_2397.jpeg) -->
                <div class="order-financial-strip">
                    <div class="fin-badge subtotal-box">
                        <span class="fin-badge-label">کۆی نرخی کاڵاکان</span>
                        <span class="fin-badge-val">${formatPrice(subtotal)}</span>
                    </div>
                    <div class="fin-badge delivery-box">
                        <span class="fin-badge-label">🚚 تێچووی گەیاندن (دیلیڤەری)</span>
                        <span class="fin-badge-val">${delFee === 0 ? 'بێبەرامبەر' : formatPrice(delFee)}</span>
                    </div>
                    <div class="fin-badge grand total-box">
                        <span class="fin-badge-label">کۆی گشتی (لەگەڵ گەیاندن)</span>
                        <span class="fin-badge-val">${formatPrice(grand)}</span>
                    </div>
                </div>

                <!-- ACTIONS BAR -->
                <div class="order-card-bottom">
                    <div class="order-actions-left">
                        <a href="${getWhatsAppCustomerChatLink(o)}" target="_blank" class="btn-order-action whatsapp" title="وتووێژ لە واتسئاپ لەگەڵ کڕیار">
                            <i class="fab fa-whatsapp"></i> <span>واتسئاپ</span>
                        </a>
                        <button type="button" class="btn-order-action invoice" onclick="window.shopApp.openInvoiceModal(${o.id})" title="پسوولەی داواکاری">
                            <i class="fas fa-file-invoice"></i> <span>پسوولە</span>
                        </button>
                    </div>
                    <div class="order-actions-right">
                        ${!isAccepted ? `
                        <button type="button" class="btn-order-action accept" onclick="window.shopApp.acceptOrder(${o.id})">
                            <i class="fas fa-check-circle"></i> <span>${t('acceptOrder')}</span>
                        </button>
                        ` : `
                        <span class="order-accepted-badge"><i class="fas fa-check-double"></i> پەسەندکراوە</span>
                        `}
                        <button type="button" class="btn-order-action delete" onclick="window.shopApp.deleteOrder(${o.id})" title="${t('deleteOrderConfirm')}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

export function acceptOrder(orderId) {
    const order = data.orders.find(o => o.id === orderId);
    if (!order) return;
    order.status = 'accepted';
    order.adminSeen = true;
    saveData(data);
    updateOrderOnServer(orderId, { status: 'accepted', adminSeen: true });
    renderOrders();
    renderMyOrders();
    updateOrderBadges();
    toast(t('orderAccepted'), 'success');
}

export function deleteOrder(orderId) {
    if (currentRole !== 'admin') {
        toast('تەنها بەڕێوەبەر دەتوانێت داواکاری بسڕێتەوە', 'error');
        return;
    }
    showConfirmDialog({
        title: 'سڕینەوەی داواکاری',
        message: 'ئایا دڵنیایت لە سڕینەوەی ئەم داواکارییە لە لیستی بەڕێوەبەر؟ (داواکارییەکە لای کڕیار هەر دەمێنێتەوە)',
        confirmText: 'بەڵێ، بسڕەوە',
        onConfirm: () => {
            const ord = data.orders.find(o => o.id === Number(orderId));
            if (ord) {
                ord.adminDeleted = true;
                ord.adminSeen = true;
            }
            saveData(data);
            updateOrderOnServer(orderId, { adminDeleted: true, adminSeen: true });
            renderOrders();
            renderMyOrders();
            updateOrderBadges();
            toast(t('deleteOrderSuccess') || 'داواکارییەکە لە لیستی بەڕێوەبەر سڕایەوە', 'success');
        }
    });
}

export function clearAllOrdersPrompt() {
    if (currentRole !== 'admin') {
        toast('تەنها بەڕێوەبەر دەتوانێت داواکارییەکان سفر بکاتەوە', 'error');
        return;
    }
    showConfirmDialog({
        title: t('resetOrdersBtn') || 'سفرکردنەوەی داواکارییەکان',
        message: t('resetOrdersConfirm') || 'ئایا دڵنیایت لە سفرکردنەوە و سڕینەوەی هەموو داواکارییەکان؟ ئەم کردارە ناگەڕێتەوە.',
        confirmText: 'بەڵێ، هەمووی سفر بکەوە',
        onConfirm: () => {
            clearAllOrders();
        }
    });
}

export async function clearAllOrders() {
    data.orders = [];
    data.lastUpdated = Date.now();
    saveLocalOnly(data);
    await clearOrdersOnServerAndCloud();
    renderOrders();
    renderMyOrders();
    updateOrderBadges();
    toast(t('ordersResetSuccess') || 'هەموو داواکارییەکان بەسەرکەوتوویی سفر کرانەوە! 🗑️', 'success');
}

export function maskPhoneNumber(phone) {
    if (!phone) return '';
    return '•••••••••••';
}

export function togglePhoneMask() {
    // Eye icon removed as per user request: phone number remains permanently hidden/masked
}

export function renderMyOrders() {
    const container = document.getElementById('userOrdersDisplay');
    // USER REQUEST: Customer's "My Orders" keeps showing orders even when deleted by admin
    const userOrders = data.orders.filter(o => !o.userDeleted);

    updateOrderBadges();

    if (!container) return;

    if (userOrders.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>${t('noOrders')}</h3></div>`;
        return;
    }
    const sorted = [...userOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sorted.map(o => {
        const p = getProduct(o.productId);
        const pname = p ? p.name : getProductName(o.productId);
        const unitPrice = p ? (p.discount ? p.price * (1 - p.discount / 100) : p.price) : 0;
        const subtotal = unitPrice * o.quantity;
        const delFee = o.deliveryFee !== undefined ? o.deliveryFee : 3000;
        const disc = o.discountAmount || 0;
        const grand = o.grandTotal || (subtotal + delFee - disc);
        const cityName = getCityName(o.city || 'sulaymaniyah');

        const statusCls = o.status || 'pending';
        const statusLabel = t('status' + statusCls.charAt(0).toUpperCase() + statusCls.slice(1)) || statusCls;
        const addressInfo = o.address ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">📍 ${escapeHtml(cityName)} - ${escapeHtml(o.address)}</div>` : `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">📍 ${escapeHtml(cityName)}</div>`;
        const maskedPhone = maskPhoneNumber(o.phone);
        const phoneInfo = o.phone ? `
            <div class="user-order-phone-row" title="${t('phoneProtected')}">
                <i class="fas fa-shield-alt phone-shield-icon"></i>
                <span class="phone-masked-text">${escapeHtml(maskedPhone)}</span>
            </div>` : '';
        const imgHtml = o.productImage ? `<img src="${o.productImage}" class="product-image-thumb" />` : '';
        const customerNameInfo = o.customerName ? `<div style="font-weight:700; color:var(--text-primary); margin-bottom:2px;"><i class="fas fa-user" style="color:var(--accent); font-size:0.8rem; margin-right:4px;"></i> ${escapeHtml(o.customerName)}</div>` : '';
        
        const customerOrderSummary = {
            orderId: o.id,
            customerName: o.customerName,
            phone: o.phone,
            cityName,
            address: o.address || '',
            itemsText: `• ${pname} × ${o.quantity}`,
            subtotal,
            deliveryFee: delFee,
            discountAmount: disc,
            promoCode: o.promoCode || '',
            grandTotal: grand
        };

        return `
            <div class="my-order-item">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;">
                    ${imgHtml}
                    <div>
                        ${customerNameInfo}
                        <div style="font-weight:600;">${escapeHtml(pname)} × ${o.quantity}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);"><i class="fas fa-calendar-alt"></i> ${o.date}</div>
                        ${phoneInfo}
                        ${addressInfo}
                        <div style="font-size:0.82rem; margin-top:2px; font-weight:700; color:var(--accent);">💵 ${formatPrice(grand)}</div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <span class="order-status ${statusCls}">${statusLabel}</span>
                </div>
            </div>
        `;
    }).join('');
}

export function renderUserContactAndOrders() {
    const container = document.getElementById('userContactDisplay');
    if (!container) return;
    const info = data.contactInfo || {};

    // Format social links
    const telegramUrl = info.telegram ? (info.telegram.startsWith('http') ? info.telegram : `https://t.me/${info.telegram.replace('@', '')}`) : 'https://t.me/rebazshop';
    const telegramDisplay = info.telegram ? (info.telegram.startsWith('http') ? info.telegram.replace(/^https?:\/\/(t\.me\/)?/, '@') : (info.telegram.startsWith('@') ? info.telegram : '@' + info.telegram)) : '@rebazshop';

    const snapchatUrl = info.snapchat ? (info.snapchat.startsWith('http') ? info.snapchat : `https://www.snapchat.com/add/${info.snapchat}`) : 'https://www.snapchat.com/add/rebazshop';
    const snapchatDisplay = info.snapchat ? info.snapchat.replace(/^https?:\/\/(www\.)?snapchat\.com\/add\//, '') : 'rebazshop';

    const tiktokUrl = info.tiktok ? (info.tiktok.startsWith('http') ? info.tiktok : `https://www.tiktok.com/@${info.tiktok.replace('@', '')}`) : 'https://www.tiktok.com/@rebazshop';
    const tiktokDisplay = info.tiktok ? (info.tiktok.startsWith('http') ? info.tiktok.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '@') : (info.tiktok.startsWith('@') ? info.tiktok : '@' + info.tiktok)) : '@rebazshop';

    const websiteUrl = info.website ? (info.website.startsWith('http') ? info.website : `https://${info.website}`) : 'https://rebazshop.com';
    const websiteDisplay = info.website || t('defaultWebsite');

    container.innerHTML = `
        <div class="contact-card contact-address">
            <i class="fas fa-map-marker-alt"></i>
            <h4>${t('addressLabel')}</h4>
            <p>${info.address || t('defaultAddress')}</p>
        </div>
        <div class="contact-card contact-phone">
            <i class="fas fa-phone"></i>
            <h4>${t('phoneLabel')}</h4>
            <p><a href="tel:${info.phone || t('defaultPhone')}">${info.phone || t('defaultPhone')}</a></p>
        </div>
        <div class="contact-card contact-telegram">
            <i class="fab fa-telegram"></i>
            <h4>${t('telegramLabel')}</h4>
            <p><a href="${telegramUrl}" target="_blank" rel="noopener noreferrer">${telegramDisplay}</a></p>
        </div>
        <div class="contact-card contact-snapchat">
            <i class="fab fa-snapchat"></i>
            <h4>${t('snapchatLabel')}</h4>
            <p><a href="${snapchatUrl}" target="_blank" rel="noopener noreferrer">${snapchatDisplay}</a></p>
        </div>
        <div class="contact-card contact-tiktok">
            <i class="fab fa-tiktok"></i>
            <h4>${t('tiktokLabel')}</h4>
            <p><a href="${tiktokUrl}" target="_blank" rel="noopener noreferrer">${tiktokDisplay}</a></p>
        </div>
        <div class="contact-card contact-website">
            <i class="fas fa-globe"></i>
            <h4>${t('websiteLabel')}</h4>
            <p><a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">${websiteDisplay}</a></p>
        </div>
        <div class="contact-card contact-hours">
            <i class="fas fa-clock"></i>
            <h4>${t('hoursLabel')}</h4>
            <p>${info.hours || t('defaultHours')}</p>
        </div>
    `;
}

// ==========================================
//  ADD & EDIT PRODUCT WITH VIDEO
// ==========================================
export function setAddVideoSource(url) {
    addVideoData = url;
    const previewWrap = document.getElementById('addVideoPreviewWrap');
    const previewVideo = document.getElementById('prodVideoPreview');
    if (url && url.trim()) {
        previewVideo.src = url;
        previewWrap.style.display = 'block';
    } else {
        previewVideo.src = '';
        previewWrap.style.display = 'none';
    }
}

export function clearAddVideo() {
    addVideoData = '';
    const fileInput = document.getElementById('prodVideoFile');
    const urlInput = document.getElementById('prodVideoUrl');
    const previewWrap = document.getElementById('addVideoPreviewWrap');
    const previewVideo = document.getElementById('prodVideoPreview');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (previewVideo) previewVideo.src = '';
    if (previewWrap) previewWrap.style.display = 'none';
}

export async function handleAddProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prodName').value.trim();
    const categoryId = document.getElementById('prodCategory').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const stockStatus = document.getElementById('prodStockStatus').value;
    const discount = parseFloat(document.getElementById('prodDiscount').value) || 0;
    const description = document.getElementById('prodDesc').value.trim();
    const imageFile = document.getElementById('prodImage').files[0];
    const videoUrlInput = document.getElementById('prodVideoUrl').value.trim();

    if (!name || !price || price <= 0) return toast(t('fillFields'), 'error');

    const finalVideo = videoUrlInput || addVideoData || '';

    let imageData = '';
    if (imageFile) {
        imageData = await compressImageFile(imageFile);
    }

    const product = {
        id: generateId(),
        name,
        categoryId,
        price,
        stockStatus: stockStatus || 'in-stock',
        discount,
        description,
        image: imageData || '',
        video: finalVideo,
        likes: 0
    };

    data.products.push(product);
    saveData(data);
    addProductToServer(product);
    renderProducts();
    resetAddForm();
    toast(t('productAdded'), 'success');
    switchPage('products');
}

export function resetAddForm() {
    const form = document.getElementById('addProductForm');
    if (form) form.reset();
    const imgPreview = document.getElementById('imagePreview');
    if (imgPreview) {
        imgPreview.classList.remove('visible');
        imgPreview.src = '';
    }
    clearAddVideo();
}

// Edit product
export function openEditModal(productId) {
    const p = getProduct(productId);
    if (!p) return toast('Product not found', 'error');

    document.getElementById('editProductId').value = p.id;
    document.getElementById('editName').value = p.name;
    document.getElementById('editCategory').value = p.categoryId;
    document.getElementById('editPrice').value = p.price;
    document.getElementById('editStockStatus').value = p.stockStatus || 'in-stock';
    document.getElementById('editDiscount').value = p.discount || 0;
    document.getElementById('editDesc').value = p.description || '';
    
    // Video editing
    editVideoData = p.video || '';
    const urlInput = document.getElementById('editVideoUrl');
    const fileInput = document.getElementById('editVideoFile');
    const previewWrap = document.getElementById('editVideoPreviewWrap');
    const previewVideo = document.getElementById('editVideoPreview');

    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = p.video && !p.video.startsWith('data:') && !p.video.startsWith('blob:') ? p.video : '';

    if (p.video) {
        previewVideo.src = p.video;
        previewWrap.style.display = 'block';
    } else {
        previewVideo.src = '';
        previewWrap.style.display = 'none';
    }

    document.getElementById('editModal').classList.add('open');
}

export function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
    const previewVideo = document.getElementById('editVideoPreview');
    if (previewVideo) previewVideo.src = '';
}

export function clearEditVideo() {
    editVideoData = '';
    const fileInput = document.getElementById('editVideoFile');
    const urlInput = document.getElementById('editVideoUrl');
    const previewWrap = document.getElementById('editVideoPreviewWrap');
    const previewVideo = document.getElementById('editVideoPreview');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (previewVideo) previewVideo.src = '';
    if (previewWrap) previewWrap.style.display = 'none';
}

export function handleEditProduct(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editProductId').value);
    const product = getProduct(id);
    if (!product) return toast('Product not found', 'error');

    product.name = document.getElementById('editName').value.trim();
    product.categoryId = document.getElementById('editCategory').value;
    product.price = parseFloat(document.getElementById('editPrice').value);
    product.stockStatus = document.getElementById('editStockStatus').value;
    product.discount = parseFloat(document.getElementById('editDiscount').value) || 0;
    product.description = document.getElementById('editDesc').value.trim();

    const videoUrlInput = document.getElementById('editVideoUrl').value.trim();
    product.video = videoUrlInput || editVideoData || '';

    if (!product.name || !product.price) return toast(t('fillFields'), 'error');

    saveData(data);
    updateProductOnServer(product.id, product);
    renderProducts();
    closeEditModal();
    toast(t('productUpdated'), 'success');
}

export function deleteProduct(id) {
    showConfirmDialog({
        title: 'سڕینەوەی کاڵا',
        message: 'ئایا دڵنیایت لە سڕینەوەی ئەم کاڵایە لە فرۆشگاکە؟',
        confirmText: 'بەڵێ، بسڕەوە',
        onConfirm: () => {
            data.products = data.products.filter(p => p.id !== id);
            saveData(data);
            deleteProductFromServer(id);
            renderProducts();
            renderOrders();
            renderMyOrders();
            toast(t('productDeleted') || 'کاڵاکە سڕایەوە', 'info');
        }
    });
}

// ==========================================
//  NAVIGATION & PAGES
// ==========================================
export function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    document.querySelectorAll('#desktopNav button, #bottomNav button').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
    });

    // Save active page in multi-layer persistent storage to prevent losing position on reload/switch
    safeStorage.setItem('arishop_current_page', page);

    if (page === 'orders') {
        markOrdersAsSeen();
        renderOrders();
    }
    if (page === 'products') renderProducts();
    if (page === 'add') {
        resetAddForm();
        renderCategoryListEdit();
        populateCategorySelect();
    }
    if (page === 'contact-admin') {
        switchPage('settings');
        switchSettingsSubTab('contact');
        return;
    }
    if (page === 'settings') {
        renderCategoryListEdit();
        updateShopNameDisplay();
        populateCategorySelect();
        populateContactFields();
        populateCredentialsField();
    }
    if (page === 'cart') renderCart();
    if (page === 'myorders') {
        markUserOrdersAsSeen();
        renderMyOrders();
    }
    if (page === 'contact') renderUserContactAndOrders();
}

// ==========================================
//  AUTH & LOGIN
// ==========================================
export function applyRoleState(role) {
    currentRole = role;
    safeStorage.setItem('arishop_current_role', role);

    const loginPage = document.getElementById('loginPage');
    if (loginPage) loginPage.style.display = 'none';

    const appContainer = document.getElementById('appContainer');
    if (appContainer) appContainer.style.display = 'block';

    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        roleBadge.textContent = role === 'admin' ? (t('adminLabel') || 'بەڕێوەبەر') : '';
        roleBadge.style.display = role === 'admin' ? 'inline-block' : 'none';
    }

    // ADMIN LOGO: Only visible when logged in as admin in the top bar
    const adminLogoWrap = document.getElementById('adminTopLogoWrap');
    if (adminLogoWrap) {
        adminLogoWrap.style.display = role === 'admin' ? 'inline-flex' : 'none';
    }

    // Admin login header button vs logout button
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    if (adminLoginBtn) {
        adminLoginBtn.style.display = role === 'admin' ? 'none' : 'inline-flex';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.style.display = role === 'admin' ? 'flex' : 'none';
    }

    const adminOnly = document.querySelectorAll('#navAddBtn, #navSettingsBtn, #bottomNavAdd, #bottomNavSettings, #navOrdersBtn, #bottomNavOrders');
    adminOnly.forEach(el => el.style.display = role === 'admin' ? '' : 'none');

    const userOnly = document.querySelectorAll('#navCartBtn, #bottomNavCart, #navMyOrdersBtn, #bottomNavMyOrders, #navContactBtn, #bottomNavContact');
    userOnly.forEach(el => el.style.display = role === 'user' ? '' : 'none');

    updateCartBadge();
    renderProducts();
    renderCategoryScroll();
    populateCategorySelect();
    renderCategoryListEdit();
    populateContactFields();
    if (role === 'admin') {
        renderOrders();
    } else {
        renderCart();
        renderMyOrders();
        renderUserContactAndOrders();
    }
    updateOrderBadges();
}

export function openAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.style.display = 'flex';
        const modalLoginTitle = document.getElementById('modalLoginTitle');
        if (modalLoginTitle) {
            modalLoginTitle.textContent = (data && data.shopName) || 'Derin__Collection';
        }
        const userInput = document.getElementById('modalAdminUsername');
        const passInput = document.getElementById('modalAdminPassword');
        if (userInput) {
            userInput.value = '';
            setTimeout(() => userInput.focus(), 80);
        }
        if (passInput) {
            passInput.value = '';
        }
    }
}

export function closeAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.style.display = 'none';
}

export function handleAdminModalLogin() {
    const now = Date.now();
    if (lockoutExpiryTime > now) {
        const sec = Math.ceil((lockoutExpiryTime - now) / 1000);
        const lockMsg = (t('rateLimitLocked') || 'Security Lock: Please wait {sec}s').replace('{sec}', sec);
        toast(lockMsg, 'error');
        return;
    }

    const userInput = document.getElementById('modalAdminUsername');
    const passInput = document.getElementById('modalAdminPassword');
    const user = userInput ? userInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!user || !pass) {
        toast(t('fillFields') || 'تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە', 'error');
        if (!user && userInput) userInput.focus();
        else if (passInput) passInput.focus();
        return;
    }

    if (user !== adminUsername || pass !== adminPassword) {
        failedLoginAttempts++;
        if (failedLoginAttempts >= 5) {
            lockoutExpiryTime = Date.now() + 30000;
            failedLoginAttempts = 0;
            toast((t('rateLimitLocked') || 'سیستەم بۆ 30 چرکە قفڵکراوە بەهۆی زۆری هەڵە').replace('{sec}', 30), 'error');
            return;
        }
        toast((t('loginError') || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە') + ` (${5 - failedLoginAttempts} هەوڵ ماوە)`, 'error');
        if (user !== adminUsername && userInput) {
            userInput.focus();
        } else if (passInput) {
            passInput.focus();
        }
        return;
    }

    failedLoginAttempts = 0;
    lockoutExpiryTime = 0;
    closeAdminLoginModal();
    applyRoleState('admin');
    const savedPage = safeStorage.getItem('arishop_current_page');
    if (savedPage && ['orders', 'add', 'settings'].includes(savedPage)) {
        switchPage(savedPage);
    } else {
        switchPage('orders');
    }
    toast('بە سەرکەوتوویی وەک بەڕێوەبەر چوویتە ژوورەوە ✅', 'success');
}

export function handleLogin() {
    const now = Date.now();
    if (lockoutExpiryTime > now) {
        const sec = Math.ceil((lockoutExpiryTime - now) / 1000);
        const lockMsg = (t('rateLimitLocked') || 'Security Lock: Please wait {sec}s').replace('{sec}', sec);
        toast(lockMsg, 'error');
        return;
    }

    const roleEl = document.querySelector('input[name="role"]:checked');
    const role = roleEl ? roleEl.value : 'admin';

    if (role === 'admin') {
        const userInput = document.getElementById('loginUsername');
        const passInput = document.getElementById('loginPassword');
        const user = userInput ? userInput.value.trim() : '';
        const pass = passInput ? passInput.value.trim() : '';

        if (!user || !pass) {
            toast(t('fillFields') || 'تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە', 'error');
            return;
        }

        if (user !== adminUsername || pass !== adminPassword) {
            failedLoginAttempts++;
            if (failedLoginAttempts >= 5) {
                lockoutExpiryTime = Date.now() + 30000;
                failedLoginAttempts = 0;
                toast((t('rateLimitLocked') || 'سیستەم بۆ 30 چرکە قفڵکراوە بەهۆی هەڵەی پاسۆرد').replace('{sec}', 30), 'error');
                return;
            }
            toast(t('loginError') + ` (${5 - failedLoginAttempts} هەوڵ ماوە)`, 'error');
            return;
        }
        failedLoginAttempts = 0;
        lockoutExpiryTime = 0;
    }

    applyRoleState(role);
    if (role === 'admin') {
        const savedPage = safeStorage.getItem('arishop_current_page');
        if (savedPage && ['orders', 'add', 'settings'].includes(savedPage)) {
            switchPage(savedPage);
        } else {
            switchPage('orders');
        }
    } else {
        switchPage('products');
    }
}

export function logout() {
    // Redundant save on exit: guarantee data is 100% saved and safe when leaving
    saveData(data);
    applyRoleState('user');
    safeStorage.setItem('arishop_current_page', 'products');
    switchPage('products');
    toast('دەرچوویت و گەڕایتەوە بۆ دۆخی کڕیار', 'info');
}

export function togglePasswordField() {
    const roleEl = document.querySelector('input[name="role"]:checked');
    const role = roleEl ? roleEl.value : 'admin';
    const group = document.getElementById('adminPasswordGroup');
    if (group) group.style.display = role === 'user' ? 'none' : 'block';
}

export function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

export function populateCredentialsField() {
    const userInput = document.getElementById('settingAdminUsername');
    if (userInput) {
        userInput.value = adminUsername || 'Farhang';
    }
}

export function changePassword() {
    const userInput = document.getElementById('settingAdminUsername');
    const currentInput = document.getElementById('currentPassword');
    const newPassInput = document.getElementById('newPassword');
    const confirmInput = document.getElementById('confirmPassword');

    const newUser = userInput ? userInput.value.trim() : '';
    const current = currentInput ? currentInput.value : '';
    const newPass = newPassInput ? newPassInput.value : '';
    const confirm = confirmInput ? confirmInput.value : '';

    if (!newUser) {
        return toast(t('usernameRequired') || 'تکایە ناوی بەکارهێنەر بنووسە', 'error');
    }

    if (current !== adminPassword) {
        return toast(t('wrongCurrentPassword'), 'error');
    }

    let passToSet = adminPassword;
    if (newPass || confirm) {
        if (newPass !== confirm) return toast(t('passwordMismatch'), 'error');
        const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!strongRegex.test(newPass)) return toast(t('passwordWeak'), 'error');
        passToSet = newPass;
    }

    adminUsername = newUser;
    adminPassword = passToSet;
    safeStorage.setItem('arishop_admin_username', adminUsername);
    safeStorage.setItem('arishop_admin_password', adminPassword);
    data.adminUsername = adminUsername;
    data.adminPassword = adminPassword;
    saveData(data);

    if (currentInput) currentInput.value = '';
    if (newPassInput) newPassInput.value = '';
    if (confirmInput) confirmInput.value = '';
    toast(t('credentialsChanged') || 'ناوی بەکارهێنەر و وشەی نهێنی بە سەرکەوتوویی نوێکرانەوە! ✅', 'success');
}

export function updateShopName() {
    const val = document.getElementById('shopNameInput').value.trim();
    if (!val) return toast(t('fillFields'), 'error');
    data.shopName = val;
    saveData(data);
    updateShopNameDisplay();
    toast(t('shopNameUpdated'), 'success');
}

export async function changeShopLogo(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
        const compressed = await compressImageFile(file, 400, 400, 0.85);
        data.shopLogo = compressed || '/rebaz-logo.jpg';
        saveData(data);
        updateShopNameDisplay();
        toast('لۆگۆ بە سەرکەوتوویی گۆڕدرا', 'success');
    } catch (err) {
        console.error('Failed to update shop logo:', err);
    }
}

export function populateContactFields() {
    const info = data.contactInfo || {};
    const addr = document.getElementById('contactAddress');
    if (addr) addr.value = info.address || '';
    const phone = document.getElementById('contactPhone');
    if (phone) phone.value = info.phone || '';
    const telegram = document.getElementById('contactTelegram');
    if (telegram) telegram.value = info.telegram || '';
    const snapchat = document.getElementById('contactSnapchat');
    if (snapchat) snapchat.value = info.snapchat || '';
    const tiktok = document.getElementById('contactTiktok');
    if (tiktok) tiktok.value = info.tiktok || '';
    const web = document.getElementById('contactWebsite');
    if (web) web.value = info.website || '';
    const hours = document.getElementById('contactHours');
    if (hours) hours.value = info.hours || '';
}

export function saveContactInfo() {
    data.contactInfo = {
        address: document.getElementById('contactAddress')?.value.trim() || '',
        phone: document.getElementById('contactPhone')?.value.trim() || '',
        telegram: document.getElementById('contactTelegram')?.value.trim() || '',
        snapchat: document.getElementById('contactSnapchat')?.value.trim() || '',
        tiktok: document.getElementById('contactTiktok')?.value.trim() || '',
        website: document.getElementById('contactWebsite')?.value.trim() || '',
        hours: document.getElementById('contactHours')?.value.trim() || ''
    };
    saveData(data);
    toast(t('contactUpdated'), 'success');
    renderUserContactAndOrders();
}

// Backup & Restore (Includes Admin Username & Password as requested)
export function backupData() {
    try {
        const storeTitle = data.shopName || 'Derin__Collection';
        const backupPayload = {
            shopName: storeTitle,
            adminUsername: adminUsername,
            adminPassword: adminPassword,
            adminCredentialsReminder: `چوونەژوورەوەی بەڕێوەبەر - ناوی بەکارهێنەر: ${adminUsername} | وشەی نهێنی: ${adminPassword}`,
            exportDate: new Date().toLocaleString(),
            categories: data.categories,
            products: data.products,
            orders: data.orders,
            contactInfo: data.contactInfo
        };
        const dataStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast((t('backupWithPassword') || 'باکاپ دابەزێندرا! زانیارییەکانی بەڕێوەبەر لەناو فایلەکە تۆمارکرا') + ` (${adminUsername} / ${adminPassword})`, 'success');
    } catch (e) {
        toast('Backup failed: ' + e.message, 'error');
    }
}

export function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const restored = JSON.parse(e.target.result);
            if (restored.categories && restored.products) {
                data.categories = restored.categories;
                data.products = restored.products;
                data.orders = restored.orders || [];
                if (restored.shopName) data.shopName = restored.shopName;
                if (restored.contactInfo) data.contactInfo = restored.contactInfo;

                // Restore Admin Username & Password from backup
                if (restored.adminUsername) {
                    adminUsername = restored.adminUsername;
                    safeStorage.setItem('arishop_admin_username', adminUsername);
                    data.adminUsername = adminUsername;
                }
                if (restored.adminPassword) {
                    adminPassword = restored.adminPassword;
                    safeStorage.setItem('arishop_admin_password', adminPassword);
                    data.adminPassword = adminPassword;
                }

                saveData(data);
                renderProducts();
                renderOrders();
                renderCategoryListEdit();
                renderCategoryScroll();
                populateCategorySelect();
                updateShopNameDisplay();
                populateContactFields();
                populateCredentialsField();
                renderCart();
                renderMyOrders();
                renderUserContactAndOrders();
                
                toast((t('restoreWithPassword') || 'داتاکان و ناوی بەکارهێنەر و پاسۆردی بەڕێوەبەر گەڕێنرانەوە') + ` (${adminUsername} / ${adminPassword})`, 'success');
            } else {
                toast('Invalid backup file format.', 'error');
            }
        } catch (err) {
            toast('Error reading file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

export function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    el.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 300);
    }, 2800);
}

// Expose on window for inline handlers
window.shopApp = window.shopApp || {};
Object.assign(window.shopApp, {
    shareStoreLink,
    handleRemoteDataUpdate,
    setLanguage,
    toggleLangMenu,
    closeLangMenu,
    selectLanguage,
    toggleTheme,
    filterCategory,
    scrollCategory,
    openOrderModal,
    closeModal,
    openEditModal,
    closeEditModal,
    deleteProduct,
    toggleCart,
    cartQtyChange,
    removeFromCart,
    openUserInfoModal,
    closeUserInfoModal,
    onUserInfoCityChange,
    applyCartPromoCode,
    onOrderCityChange,
    applySingleOrderPromo,
    openOrderSuccessModal,
    closeOrderSuccessModal,
    openInvoiceModal,
    closeInvoiceModal,
    triggerPrintInvoice,
    downloadInvoicePdf,
    openPrintWindow,
    directPrintOrder,
    printAllInvoices,
    printCurrentSuccessOrder,
    printInvoiceHtml,
    toggleSound,
    testSound,
    addPromoCode,
    deletePromoCode,
    renderPromoCodesList,
    acceptOrder,
    deleteOrder,
    clearAllOrdersPrompt,
    clearAllOrders,
    openVideoModal,
    closeVideoModal,
    returnToHomePageFromVideo,
    updateVideoModalCartBtn,
    clearAddVideo,
    clearEditVideo,
    closeConfirmModal,
    executeConfirmAction,
    addCategory,
    deleteCategory,
    handleCatImageFile,
    removeCatImage,
    selectCatEmoji,
    switchAddSubTab,
    switchSettingsSubTab,
    renderCityDeliveryList,
    saveDeliveryFees,
    addCustomCity,
    deleteCustomCity,
    updateShopName,
    changeShopLogo,
    saveContactInfo,
    changePassword,
    populateCredentialsField,
    backupData,
    restoreData,
    logout,
    togglePassword,
    applyFilters,
    switchPage,
    updateOrderBadges,
    markOrdersAsSeen,
    markUserOrdersAsSeen,
    toggleLike,
    getLikedProducts,
    updateVideoModalLikeBtn,
    maskPhoneNumber,
    togglePhoneMask,
    openAdminLoginModal,
    closeAdminLoginModal,
    handleAdminModalLogin,
    applyRoleState
});

// ==========================================
//  INITIALIZATION
// ==========================================
export function initShop() {
    try {
        loadTheme();
        setLanguage(currentLang);

        // Event listeners
        const langDropdownBtn = document.getElementById('langDropdownBtn');
        if (langDropdownBtn) langDropdownBtn.addEventListener('click', toggleLangMenu);

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.addEventListener('click', handleLogin);

        const loginUser = document.getElementById('loginUsername');
        if (loginUser) {
            loginUser.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    const p = document.getElementById('loginPassword');
                    if (p) p.focus();
                    else handleLogin();
                }
            });
        }

        const loginPass = document.getElementById('loginPassword');
        if (loginPass) {
            loginPass.addEventListener('keypress', e => {
                if (e.key === 'Enter') handleLogin();
            });
        }

        const modalAdminUser = document.getElementById('modalAdminUsername');
        if (modalAdminUser) {
            modalAdminUser.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    const p = document.getElementById('modalAdminPassword');
                    if (p) p.focus();
                    else handleAdminModalLogin();
                }
            });
        }

        const modalAdminPass = document.getElementById('modalAdminPassword');
        if (modalAdminPass) {
            modalAdminPass.addEventListener('keypress', e => {
                if (e.key === 'Enter') handleAdminModalLogin();
            });
        }

        // Role radio change
        document.querySelectorAll('input[name="role"]').forEach(r => {
            r.addEventListener('change', togglePasswordField);
        });

        // Navigation buttons
        document.querySelectorAll('#desktopNav button, #bottomNav button').forEach(btn => {
            btn.addEventListener('click', function() {
                switchPage(this.dataset.page);
            });
        });

        // Single order form
        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.addEventListener('submit', submitSingleOrder);

        // Invoice print and PDF buttons
        const invoicePrintBtn = document.getElementById('invoicePrintActionBtn');
        if (invoicePrintBtn) {
            invoicePrintBtn.addEventListener('click', (e) => {
                e.preventDefault();
                triggerPrintInvoice();
            });
        }
        const invoicePdfBtn = document.getElementById('invoicePdfActionBtn');
        if (invoicePdfBtn) {
            invoicePdfBtn.addEventListener('click', (e) => {
                e.preventDefault();
                downloadInvoicePdf();
            });
        }

        // Cart checkout form
        const userInfoForm = document.getElementById('userInfoForm');
        if (userInfoForm) {
            userInfoForm.addEventListener('submit', e => {
                e.preventDefault();
                const name = document.getElementById('userInfoName').value.trim();
                const phone = document.getElementById('userInfoPhone').value.trim();
                const addr = document.getElementById('userInfoAddress').value.trim();
                const city = document.getElementById('userInfoCity')?.value || 'sulaymaniyah';
                if (!name || !phone || !addr) return toast(t('fillFields'), 'error');
                submitCheckout(name, phone, addr, city);
            });
        }

        // Add Product form
        const addProductForm = document.getElementById('addProductForm');
        if (addProductForm) addProductForm.addEventListener('submit', handleAddProduct);

        // Image preview for Add Product
        const prodImage = document.getElementById('prodImage');
        if (prodImage) {
            prodImage.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    const img = document.getElementById('imagePreview');
                    img.src = ev.target.result;
                    img.classList.add('visible');
                };
                reader.readAsDataURL(file);
            });
        }

        // Image selection for Category
        const catImageFile = document.getElementById('newCatImageFile');
        if (catImageFile) {
            catImageFile.addEventListener('change', handleCatImageFile);
        }

        // Video selection for Add Product (File & URL)
        const prodVideoFile = document.getElementById('prodVideoFile');
        if (prodVideoFile) {
            prodVideoFile.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    setAddVideoSource(ev.target.result);
                    document.getElementById('prodVideoUrl').value = '';
                };
                reader.readAsDataURL(file);
            });
        }
        const prodVideoUrl = document.getElementById('prodVideoUrl');
        if (prodVideoUrl) {
            prodVideoUrl.addEventListener('input', function() {
                if (this.value.trim()) {
                    setAddVideoSource(this.value.trim());
                }
            });
        }

        // Video selection for Edit Product
        const editVideoFile = document.getElementById('editVideoFile');
        if (editVideoFile) {
            editVideoFile.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    editVideoData = ev.target.result;
                    const previewWrap = document.getElementById('editVideoPreviewWrap');
                    const previewVideo = document.getElementById('editVideoPreview');
                    previewVideo.src = ev.target.result;
                    previewWrap.style.display = 'block';
                    document.getElementById('editVideoUrl').value = '';
                };
                reader.readAsDataURL(file);
            });
        }
        const editVideoUrl = document.getElementById('editVideoUrl');
        if (editVideoUrl) {
            editVideoUrl.addEventListener('input', function() {
                if (this.value.trim()) {
                    editVideoData = this.value.trim();
                    const previewWrap = document.getElementById('editVideoPreviewWrap');
                    const previewVideo = document.getElementById('editVideoPreview');
                    previewVideo.src = this.value.trim();
                    previewWrap.style.display = 'block';
                }
            });
        }

        // Edit Product form
        const editForm = document.getElementById('editForm');
        if (editForm) editForm.addEventListener('submit', handleEditProduct);

        // Modal background click dismiss
        const orderModal = document.getElementById('orderModal');
        if (orderModal) orderModal.addEventListener('click', e => { if (e.target === orderModal) closeModal(); });
        
        const editModal = document.getElementById('editModal');
        if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });
        
        const userInfoModal = document.getElementById('userInfoModal');
        if (userInfoModal) userInfoModal.addEventListener('click', e => { if (e.target === userInfoModal) closeUserInfoModal(); });

        const orderSuccessModal = document.getElementById('orderSuccessModal');
        if (orderSuccessModal) orderSuccessModal.addEventListener('click', e => { if (e.target === orderSuccessModal) closeOrderSuccessModal(); });

        const invoiceModal = document.getElementById('invoiceModal');
        if (invoiceModal) invoiceModal.addEventListener('click', e => { if (e.target === invoiceModal) closeInvoiceModal(); });

        const videoModal = document.getElementById('videoModal');
        if (videoModal) videoModal.addEventListener('click', e => { if (e.target === videoModal) closeVideoModal(); });

        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) confirmModal.addEventListener('click', e => { if (e.target === confirmModal) closeConfirmModal(); });

        const adminLoginModal = document.getElementById('adminLoginModal');
        if (adminLoginModal) {
            adminLoginModal.addEventListener('click', e => {
                if (e.target === adminLoginModal) closeAdminLoginModal();
            });
        }

        // Direct access on all devices: Open store immediately without blocking visitors
        const initialRole = detectInitialRole();
        applyRoleState(initialRole);

        // Restore active page or default based on role
        const savedPage = safeStorage.getItem('arishop_current_page') || 'products';
        const adminAllowedPages = ['products', 'orders', 'add', 'settings'];
        const userAllowedPages = ['products', 'cart', 'myorders', 'contact'];

        let targetPage = 'products';
        if (initialRole === 'admin') {
            targetPage = adminAllowedPages.includes(savedPage) ? savedPage : 'products';
        } else {
            targetPage = userAllowedPages.includes(savedPage) ? savedPage : 'products';
        }
        switchPage(targetPage);

        // Start Real-time Auto Sync across all visitors and devices
        startAutoSync((syncedData) => {
            handleRemoteDataUpdate(syncedData);
        });

        // Resume session and prevent unexpected logout when returning to tab/app
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const role = safeStorage.getItem('arishop_current_role');
                    if (role && role !== currentRole) {
                        applyRoleState(role);
                    }
                }
            });
            window.addEventListener('pageshow', () => {
                const role = safeStorage.getItem('arishop_current_role');
                if (role && role !== currentRole) {
                    applyRoleState(role);
                }
            });
        }
    } catch (err) {
        console.error('[Shop] Initialization error:', err);
    }
}

// Boot when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShop);
} else {
    initShop();
}
