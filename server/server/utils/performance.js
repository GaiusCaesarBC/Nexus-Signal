// client/src/utils/performance.js - Performance Optimization Utilities

import { lazy } from 'react';

// ============================================
// LAZY LOADING COMPONENTS
// ============================================

// Use this to lazy load heavy components
export const lazyWithRetry = (componentImport) => {
    return lazy(() => {
        return new Promise((resolve, reject) => {
            const hasRefreshed = JSON.parse(
                window.sessionStorage.getItem('retry-lazy-refresh') || 'false'
            );

            componentImport()
                .then((component) => {
                    window.sessionStorage.setItem('retry-lazy-refresh', 'false');
                    resolve(component);
                })
                .catch((error) => {
                    if (!hasRefreshed) {
                        window.sessionStorage.setItem('retry-lazy-refresh', 'true');
                        return window.location.reload();
                    }
                    reject(error);
                });
        });
    });
};

// ============================================
// IMAGE OPTIMIZATION
// ============================================

// Lazy load images
export const lazyLoadImage = (imageElement) => {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.src;
                    image.classList.add('loaded');
                    imageObserver.unobserve(image);
                }
            });
        });

        imageObserver.observe(imageElement);
    } else {
        // Fallback for older browsers
        imageElement.src = imageElement.dataset.src;
    }
};

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

// Debounce function for search inputs, etc.
export const debounce = (func, wait = 300) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Throttle function for scroll events, etc.
export const throttle = (func, limit = 100) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

// ============================================
// LOCAL STORAGE WITH EXPIRY
// ============================================

export const setWithExpiry = (key, value, ttl) => {
    const now = new Date();
    const item = {
        value: value,
        expiry: now.getTime() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(item));
};

export const getWithExpiry = (key) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    const now = new Date();

    if (now.getTime() > item.expiry) {
        localStorage.removeItem(key);
        return null;
    }
    return item.value;
};

// ============================================
// PERFORMANCE MONITORING
// ============================================

export const measurePerformance = (name, callback) => {
    const start = performance.now();
    const result = callback();
    const end = performance.now();
    console.log(`⚡ ${name} took ${(end - start).toFixed(2)}ms`);
    return result;
};

// ============================================
// PRELOAD CRITICAL RESOURCES
// ============================================

export const preloadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};

export const preloadFont = (fontName, fontUrl) => {
    const font = new FontFace(fontName, `url(${fontUrl})`);
    return font.load().then((loadedFont) => {
        document.fonts.add(loadedFont);
    });
};

// ============================================
// MEMOIZATION HELPER
// ============================================

export const memoize = (fn) => {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
};

// ============================================
// USAGE EXAMPLES
// ============================================

/*

// 1. LAZY LOAD PAGES
import { lazyWithRetry } from './utils/performance';

const Dashboard = lazyWithRetry(() => import('./pages/DashboardPage'));
const Portfolio = lazyWithRetry(() => import('./pages/PortfolioPage'));

// Then use with Suspense:
<Suspense fallback={<LoadingSpinner />}>
    <Dashboard />
</Suspense>


// 2. DEBOUNCE SEARCH INPUT
import { debounce } from './utils/performance';

const handleSearch = debounce((query) => {
    // API call here
    searchStocks(query);
}, 300);

<input onChange={(e) => handleSearch(e.target.value)} />


// 3. THROTTLE SCROLL EVENT
import { throttle } from './utils/performance';

const handleScroll = throttle(() => {
    // Handle scroll
    console.log('Scrolling...');
}, 100);

useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
}, []);


// 4. CACHE API RESPONSES
import { setWithExpiry, getWithExpiry } from './utils/performance';

// Cache for 5 minutes (300000ms)
const fetchStockData = async (symbol) => {
    const cached = getWithExpiry(`stock_${symbol}`);
    if (cached) return cached;
    
    const data = await api.get(`/stocks/${symbol}`);
    setWithExpiry(`stock_${symbol}`, data, 300000);
    return data;
};

*/