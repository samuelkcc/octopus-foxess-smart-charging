let priceChartInst = null;
let globalFoxSN = "";
let lastDispatchesStr = "[]";
let scheduleToDelete = -1;
let globalFoxToken = "";
let globalGasUrl = "";
let octoRefreshInterval = 60;
let octoCountdown = 60;
let foxRefreshInterval = 600;
let foxCountdown = 600;
let refreshTimerId = null;

const CREDENTIAL_STORAGE_KEY = 'encryptedCredentialsV1';
const CREDENTIAL_DB_NAME = 'octopusFoxessSecureStorage';
const REQUEST_TIMEOUT_MS = 15000;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showToast(message) {
    const toast = document.getElementById('app-toast-notification');
    const messageElement = document.getElementById('toast-message');
    if (!toast || !messageElement) return;
    messageElement.textContent = message;
    toast.style.display = 'block';
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 30000);
}

async function fetchJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function openCredentialDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CREDENTIAL_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('keys');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getCredentialKey() {
    const database = await openCredentialDatabase();
    const existingKey = await new Promise((resolve, reject) => {
        const request = database.transaction('keys').objectStore('keys').get('credential-key');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    if (existingKey) {
        database.close();
        return existingKey;
    }

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise((resolve, reject) => {
        const request = database.transaction('keys', 'readwrite').objectStore('keys').put(key, 'credential-key');
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
    });
    database.close();
    return key;
}

async function saveCredentials(credentials) {
    try {
        const key = await getCredentialKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode(JSON.stringify(credentials));
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
        const encode = bytes => btoa(String.fromCharCode(...bytes));
        localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify({ iv: encode(iv), data: encode(ciphertext) }));
        sessionStorage.removeItem('sessionCredentials');
    } catch (error) {
        console.warn('Encrypted persistent storage unavailable; using session-only storage.', error);
        sessionStorage.setItem('sessionCredentials', JSON.stringify(credentials));
    }
    ['octoAcc', 'octoApi', 'foxSn', 'foxToken', 'gasUrl'].forEach(key => localStorage.removeItem(key));
}

async function loadCredentials() {
    const sessionCredentials = sessionStorage.getItem('sessionCredentials');
    if (sessionCredentials) return JSON.parse(sessionCredentials);
    const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (!stored) return null;
    try {
        const payload = JSON.parse(stored);
        const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
        const key = await getCredentialKey();
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(payload.iv) }, key, decode(payload.data));
        return JSON.parse(new TextDecoder().decode(plaintext));
    } catch (error) {
        console.warn('Unable to decrypt saved credentials.', error);
        localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
        return null;
    }
}

let autoConnectTimer = null;
let autoConnectCountdown = 10;

function startAutoConnect() {
    const btn = document.getElementById('btn');
    const btnText = document.getElementById('btn-text');
    const timerUI = document.getElementById('auto-connect-timer');
    const timerSec = document.getElementById('auto-connect-sec');
    
    btnText.textContent = "Cancel Auto-Connect";
    btn.style.backgroundColor = ""; 
    timerUI.style.display = "block";
    
    autoConnectCountdown = 10;
    timerSec.textContent = autoConnectCountdown;
    timerUI.style.setProperty('--progress', '100%');
    
    autoConnectTimer = setInterval(() => {
        autoConnectCountdown--;
        timerSec.textContent = autoConnectCountdown;
        timerUI.style.setProperty('--progress', `${(autoConnectCountdown / 10) * 100}%`);
        
        if (autoConnectCountdown <= 0) {
            clearInterval(autoConnectTimer);
            autoConnectTimer = null;
            btnText.textContent = "CONNECT";
            btn.style.backgroundColor = ""; 
            timerUI.style.display = "none";
            initDashboard();
        }
    }, 1000);
}

function handleConnectClick() {
    if (autoConnectTimer) {
        clearInterval(autoConnectTimer);
        autoConnectTimer = null;
        const btn = document.getElementById('btn');
        const btnText = document.getElementById('btn-text');
        const timerUI = document.getElementById('auto-connect-timer');
        
        btnText.textContent = "CONNECT";
        btn.style.backgroundColor = ""; 
        timerUI.style.display = "none";
    } else {
        initDashboard();
    }
}

function toggleDrawer(idToOpen) {
    const target = document.getElementById(idToOpen);
    const backdrop = document.getElementById('drawer-backdrop');
    const alternativeId = idToOpen === 'why-use-panel' ? 'setup-guide-panel' : 'why-use-panel';
    const alternative = document.getElementById(alternativeId);

    alternative.classList.remove('open');
    
    if (target.classList.contains('open')) {
        target.classList.remove('open');
        backdrop.classList.remove('visible');
    } else {
        target.classList.add('open');
        // Only trigger the backdrop filter if the screen width is narrow
        if (window.innerWidth <= 1650) {
            backdrop.classList.add('visible');
        } else {
            backdrop.classList.remove('visible');
        }
    }
}

function toggleAppMenu() {
    const panel = document.getElementById('app-menu-panel');
    const backdrop = document.getElementById('drawer-backdrop');
    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        backdrop.classList.remove('visible');
    } else {
        closeAllDrawers(); // Close others first
        panel.classList.add('open');
        backdrop.classList.add('visible');
    }
}

function closeAllDrawers() {
    document.getElementById('why-use-panel')?.classList.remove('open');
    document.getElementById('setup-guide-panel')?.classList.remove('open');
    document.getElementById('app-menu-panel')?.classList.remove('open');
    document.getElementById('drawer-backdrop')?.classList.remove('visible');
}

function forceOctoRefresh() { if (octoCountdown > 2) window.nextOctoTime = Date.now() + 1000; }
function forceFoxRefresh() { if (foxCountdown > 2) window.nextFoxTime = Date.now() + 1000; }
let localWorkModeState = "Unknown";

function applyOctoInterval() {
    const val = parseInt(document.getElementById('octo-interval-input').value);
    if (isNaN(val) || val < 10) return;
    
    const commitOctoValue = () => {
        octoRefreshInterval = val; window.nextOctoTime = Date.now() + (val * 1000);
        const btn = document.getElementById('btn-apply-octo');
        if (btn) {
            btn.textContent = "✅"; btn.style.background = "#10b981";
            setTimeout(() => { btn.textContent = "Apply"; btn.style.background = "var(--accent)"; }, 2000);
        }
        updateCircleTimer('octo-timer', octoCountdown, octoRefreshInterval);
    };

    if (val < 60) {
        const modal = document.getElementById('octo-warning-modal');
        modal.style.display = 'flex';
        document.getElementById('cancel-octo-btn').onclick = () => { 
            modal.style.display = 'none'; 
            document.getElementById('octo-interval-input').value = 60;
        };
        document.getElementById('confirm-octo-btn').onclick = () => { modal.style.display = 'none'; commitOctoValue(); };
    } else {
        commitOctoValue();
    }
}

function applyFoxInterval() {
    const val = parseInt(document.getElementById('fox-interval-input').value);
    if (isNaN(val) || val < 10) return;
    
    const commitFoxValue = () => {
        foxRefreshInterval = val; window.nextFoxTime = Date.now() + (val * 1000);
        const btn = document.getElementById('btn-apply-fox');
        if (btn) {
            btn.textContent = "✅"; btn.style.background = "#10b981";
            setTimeout(() => { btn.textContent = "Apply"; btn.style.background = "var(--accent)"; }, 2000);
        }
        updateCircleTimer('fox-timer', foxCountdown, foxRefreshInterval);
    };

    if (val < 600) {
        const modal = document.getElementById('fox-warning-modal');
        modal.style.display = 'flex';
        document.getElementById('cancel-fox-btn').onclick = () => { 
            modal.style.display = 'none'; 
            document.getElementById('fox-interval-input').value = 600;
        };
        document.getElementById('confirm-fox-btn').onclick = () => { modal.style.display = 'none'; commitFoxValue(); };
    } else {
        commitFoxValue();
    }
}

function updateCircleTimer(id, current, max) {
    const percentage = Math.max(0, (current / max) * 100);
    
    // Aggressively disable the transition on reset to prevent backward animation
        if (percentage >= 100) {
            document.body.classList.add('no-timer-transition');
            void document.body.offsetHeight; // Force browser reflow to apply instant snap instantly
        } else {
            document.body.classList.remove('no-timer-transition');
        }
    
    // Update API badges
    const badgeId = id.replace('-timer', '-api-badge');
    const badgeEl = document.getElementById(badgeId);
    if (badgeEl) badgeEl.style.setProperty('--progress', `${percentage}%`);
    
    // Sync global CSS variables for the automation block borders
    if (id === 'octo-timer') {
        document.documentElement.style.setProperty('--octo-progress', `${percentage}%`);
    } else if (id === 'fox-timer') {
        document.documentElement.style.setProperty('--fox-progress', `${percentage}%`);
    }
}
let isCurrentlyUpdatingMode = false;

// API limit tracker
function incrementFoxApi() {
    const today = new Date().toISOString().split('T')[0];
    let apiData = JSON.parse(localStorage.getItem('foxApiTracker') || '{"date": "", "count": 0}');
    if (apiData.date !== today) { apiData = { date: today, count: 1 }; } 
    else { apiData.count += 1; }
    localStorage.setItem('foxApiTracker', JSON.stringify(apiData));
    const counterSpan = document.getElementById('fox-api-counter');
    if(counterSpan) counterSpan.textContent = apiData.count;
}

function openLicenseModal(isFirstLoad) {
    const btnContainer = document.getElementById('license-modal-buttons');
    if (isFirstLoad) {
        btnContainer.innerHTML = `<button onclick="acceptLicense()" style="background: #10b981; width: auto; padding: 0.75rem 2rem; font-size: 1rem;">I Accept & Continue</button>`;
    } else {
        btnContainer.innerHTML = `<button onclick="document.getElementById('license-modal').style.display='none'" class="btn-clear" style="width: auto; padding: 0.6rem 2rem;">Close Window</button>`;
    }
    document.getElementById('license-modal').style.display = 'flex';
}

function acceptLicense() {
    localStorage.setItem('licenseAccepted', 'true');
    document.getElementById('license-modal').style.display = 'none';
}

function updateThemeButtons(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.innerHTML = theme === 'dark' ? '☀️ Light Mode' : '🌗 Dark Mode';
    });
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButtons(newTheme);
    
    // Force Chart to immediately redraw to reflect new theme colors
    window.lastChartState = null;
    if (window.dailyMaxPrice !== undefined && window.dailyMinPrice !== undefined) {
        drawPriceChart(window.dailyMaxPrice, window.dailyMinPrice, window.currentDispatches || []);
    }
}

// On Load init
document.addEventListener("DOMContentLoaded", async () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButtons(savedTheme);
    if (!localStorage.getItem('licenseAccepted')) {
        openLicenseModal(true);
    }
    const today = new Date().toISOString().split('T')[0];
    let apiData = JSON.parse(localStorage.getItem('foxApiTracker') || '{"date": "", "count": 0}');
    if (apiData.date !== today) apiData.count = 0;
    const counterSpan = document.getElementById('fox-api-counter');
    if(counterSpan) counterSpan.textContent = apiData.count;

    const legacyCredentials = localStorage.getItem('octoApi') ? {
        acc: localStorage.getItem('octoAcc') || '',
        api: localStorage.getItem('octoApi') || '',
        foxSN: localStorage.getItem('foxSn') || '',
        foxToken: localStorage.getItem('foxToken') || '',
        gasUrl: localStorage.getItem('gasUrl') || ''
    } : null;
    if (legacyCredentials) await saveCredentials(legacyCredentials);

    const credentials = legacyCredentials || await loadCredentials();
    const hasCreds = Boolean(credentials?.acc && credentials?.api);
    if (credentials) {
        document.getElementById('acc').value = credentials.acc || '';
        document.getElementById('api').value = credentials.api || '';
        document.getElementById('fox-sn').value = credentials.foxSN || '';
        document.getElementById('fox-token').value = credentials.foxToken || '';
        document.getElementById('gas-url').value = credentials.gasUrl || '';
    }

    if (hasCreds) {
        startAutoConnect();
    }

    // Master Clock Ticker - Drives real-time evaluation
    setInterval(() => {
        const now = new Date();
        
        // Kiosk Auto-Refresh: Hard reload the page daily at 03:00:00 to clear browser memory leaks
        if (now.getHours() === 3 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            window.location.reload(true);
        }
        const clockEl = document.getElementById('real-time-clock');
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        
        // If we are exactly 30 seconds past a scheduled boundary, force refresh device status
        if (window.activeFoxGroups && window.activeFoxGroups.length > 0 && now.getSeconds() === 30) {
            const h = now.getHours(), m = now.getMinutes();
            const isBoundary = window.activeFoxGroups.some(g => 
                (g.startHour === h && g.startMinute === m) || (g.endHour === h && g.endMinute === m)
            );
            if (isBoundary && typeof fetchCurrentWorkMode === 'function') {
                fetchCurrentWorkMode(true); // Bypass cache on schedule boundary
            }
        }
    }, 1000);
});

async function clearCredentials() {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise(resolve => {
        const request = indexedDB.deleteDatabase(CREDENTIAL_DB_NAME);
        request.onsuccess = resolve;
        request.onerror = resolve;
        request.onblocked = resolve;
    });
    document.querySelectorAll('input').forEach(input => input.value = '');
    document.getElementById('wipe-modal').style.display = 'none';
    location.reload(); 
}

let pendingImportContent = "";

function showExportModal() {
    document.getElementById('export-pass-1').value = '';
    document.getElementById('export-pass-2').value = '';
    document.getElementById('export-error').style.display = 'none';
    document.getElementById('export-modal').style.display = 'flex';
}

function executeExport() {
    const pass1 = document.getElementById('export-pass-1').value;
    const pass2 = document.getElementById('export-pass-2').value;
    const errDiv = document.getElementById('export-error');
    
    if (!pass1) { errDiv.textContent = 'Password cannot be empty!'; errDiv.style.display = 'block'; return; }
    if (pass1 !== pass2) { errDiv.textContent = 'Passwords do not match!'; errDiv.style.display = 'block'; return; }

    const config = {
        acc: document.getElementById('acc').value,
        api: document.getElementById('api').value,
        foxSN: document.getElementById('fox-sn').value,
        foxToken: document.getElementById('fox-token').value,
        gasUrl: document.getElementById('gas-url').value
    };

    // Encrypt object
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(config), pass1).toString();
    
    // Generate filename
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `App_Config_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.enc`;

    // Trigger download
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    document.getElementById('export-modal').style.display = 'none';
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingImportContent = e.target.result;
        document.getElementById('import-pass').value = '';
        document.getElementById('import-error').style.display = 'none';
        document.getElementById('import-modal').style.display = 'flex';
    };
    reader.readAsText(file);
}

async function executeImport() {
    const pass = document.getElementById('import-pass').value;
    const errDiv = document.getElementById('import-error');
    
    try {
        const decrypted = CryptoJS.AES.decrypt(pendingImportContent, pass).toString(CryptoJS.enc.Utf8);
        if (!decrypted) throw new Error("Wrong password");
        
        const config = JSON.parse(decrypted);
        
        // Populate Inputs
        document.getElementById('acc').value = config.acc || '';
        document.getElementById('api').value = config.api || '';
        document.getElementById('fox-sn').value = config.foxSN || '';
        document.getElementById('fox-token').value = config.foxToken || '';
        document.getElementById('gas-url').value = config.gasUrl || '';
        
        await saveCredentials(config);

        document.getElementById('import-modal').style.display = 'none';
        document.getElementById('import-file').value = ''; // reset file input
        initDashboard();
    } catch (e) {
        errDiv.style.display = 'block';
    }
}

async function initDashboard(isAutoRefresh = false, retryCount = 1) {
    const acc = document.getElementById('acc').value.trim();
    const api = document.getElementById('api').value.trim();
    globalFoxSN = document.getElementById('fox-sn').value.trim();
    globalFoxToken = document.getElementById('fox-token').value.trim();
    globalGasUrl = document.getElementById('gas-url').value.trim();
    
    const btn = document.getElementById('btn');
    const errorDiv = document.getElementById('error');

    if (!isAutoRefresh) {
        errorDiv.style.display = 'none';
        if (!acc || !api) { showError('Please provide Octopus API credentials.'); return; }
        btn.textContent = 'Fetching Data...';
        btn.disabled = true;
        
        // Show Dimmed Loading Overlay
        const loader = document.getElementById('loading-overlay');
        loader.style.display = 'flex';
        
        // Fallback: auto-close loading overlay after 5 seconds
        setTimeout(() => { 
            if (loader.style.display === 'flex') {
                loader.style.display = 'none';
                btn.textContent = 'Refresh Now';
                btn.disabled = false;
            }
        }, 5000);
    }

    try {
        const GRAPHQL_URL = 'https://api.octopus.energy/v1/graphql/';

        // 1. Octopus Auth (with automatic retry for API cold-starts)
        let authData;
        for (let attempt = 1; attempt <= 2; attempt++) {
            authData = await fetchJson(GRAPHQL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `mutation { obtainKrakenToken(input: { APIKey: ${JSON.stringify(api)} }) { token } }` })
            });
            if(!authData.errors) break; 
            if(attempt === 2) throw new Error("Invalid Octopus API Key or API offline");
        }

        // 2. Fetch GraphQL Data
        const gqlData = await fetchJson(GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authData.data.obtainKrakenToken.token },
            body: JSON.stringify({ 
                query: `query getGoData($acc: String!) { 
                    registeredKrakenflexDevice(accountNumber: $acc) { provider vehicleMake vehicleModel chargePointMake chargePointModel status }
                    vehicleChargingPreferences(accountNumber: $acc) { weekdayTargetTime weekdayTargetSoc }
                    plannedDispatches(accountNumber: $acc) { startDt endDt }
                }`,
                variables: { acc: acc }
            })
        });
        const device = gqlData.data?.registeredKrakenflexDevice;
        const prefs = gqlData.data?.vehicleChargingPreferences;
        const dispatches = gqlData.data?.plannedDispatches || [];
        window.currentDispatches = dispatches;

        // Save valid credentials
        if (!isAutoRefresh) {
            await saveCredentials({ acc, api, foxSN: globalFoxSN, foxToken: globalFoxToken, gasUrl: globalGasUrl });
        }

        // 3. Fetch exact rates from REST API
        let tariffCode = 'Data unavailable'; 
        let minRate = 0;
        let maxRate = 0;

        try {
            const accData = await fetchJson(`https://api.octopus.energy/v1/accounts/${encodeURIComponent(acc)}/`, {
                headers: { 'Authorization': 'Basic ' + btoa(api + ':') }
            });
            const meterPoint = accData.properties?.[0]?.electricity_meter_points?.[0];
            const agreement = meterPoint?.agreements?.find(a => !a.valid_to || new Date(a.valid_to) > new Date());
            
            if (agreement) {
                tariffCode = agreement.tariff_code;
                const productCode = tariffCode.split('-').slice(2, -1).join('-'); 
                const ratesData = await fetchJson(`https://api.octopus.energy/v1/products/${encodeURIComponent(productCode)}/electricity-tariffs/${encodeURIComponent(tariffCode)}/standard-unit-rates/`);
                
                if (ratesData?.results?.length > 0) {
                    window.todayRates = ratesData.results;
                    const sorted = [...ratesData.results].sort((a,b) => a.value_inc_vat - b.value_inc_vat);
                    minRate = parseFloat(sorted[0].value_inc_vat.toFixed(2));
                    maxRate = parseFloat(sorted[sorted.length-1].value_inc_vat.toFixed(2));
                }
            }
        } catch (err) { console.warn("Failed exact rate fetch", err); }

        window.dailyMinPrice = minRate;
        window.dailyMaxPrice = maxRate;

        // --- FIXED PRICING LOGIC ---
        // Look up the exact live price based on current time
        const nowTime = new Date().getTime();
        let livePrice = null;
        let isOffPeak = false;
        let activeDispatch = false;

        if (window.todayRates) {
            const currentBlock = window.todayRates.find(r => {
                const start = new Date(r.valid_from).getTime();
                const end = new Date(r.valid_to).getTime();
                return nowTime >= start && nowTime < end;
            });
            if (currentBlock) {
                livePrice = parseFloat(currentBlock.value_inc_vat.toFixed(2));
                // Determine 'off-peak' status using robust timestamp comparisons
                activeDispatch = dispatches.some(d => {
                    const start = new Date(d.startDt).getTime();
                    const end = new Date(d.endDt).getTime();
                    return nowTime >= start && nowTime < end;
                });
                
                // Override with lowest daily off-peak price if inside a smart dispatch window
                if (activeDispatch) {
                    livePrice = minRate;
                }
                
                isOffPeak = (livePrice <= minRate + 0.1) || activeDispatch; 
            }
        }
        window.currentLivePrice = livePrice;

        // --- UI RENDERING ---
        if (!isAutoRefresh) {
            document.getElementById('loading-overlay').style.display = 'none';
        }
        document.getElementById('login-layout').style.display = 'none';
        document.getElementById('dashboard').classList.add('visible');

        const octoBadge = document.getElementById('octo-api-badge');
        const octoText = document.getElementById('octo-api-text');
        if (octoText) octoText.textContent = "🟢 API CONNECTED";
        if (octoBadge) octoBadge.className = "badge off-peak countdown-border";

        let priceLabel = "🔴 STANDARD RATE";
        let badgeClass = "peak";
        if (activeDispatch) {
            priceLabel = "⚡ SMART DISPATCH";
            badgeClass = "live";
        } else if (isOffPeak) {
            priceLabel = "🟢 OFF-PEAK ACTIVE";
            badgeClass = "off-peak";
        }
        const displayPrice = livePrice !== null ? livePrice + 'p' : '--p';

        document.getElementById('ui-pricing').innerHTML = `
            <div class="badge ${badgeClass}" style="margin-bottom: 0.5rem;">${priceLabel}</div>
            <div class="current-price">${displayPrice}</div>
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">Per kWh (Live Import Rate)</div>
            <div style="display: inline-block; padding: 0.25rem 0.75rem; background: var(--off-peak-bg); color: #059669; border-radius: 6px; font-size: 0.85rem; font-weight: 700; border: 1px solid #6ee7b7;">
                Lowest Daily Off-Peak: ${minRate}p
            </div>
        `;

        document.getElementById('ui-account-details').innerHTML = `
            <li><span class="label">Account Number</span> <span class="val">${escapeHtml(acc)}</span></li>
            <li><span class="label">Linked Device</span> <span class="val" style="color: var(--accent);">${escapeHtml(device?.provider ? device.provider.toUpperCase() : 'NONE DETECTED')}</span></li>
            <li><span class="label">Active Tariff Code</span> <span class="val" style="font-size: 0.8rem; font-family: monospace;">${escapeHtml(tariffCode)}</span></li>
        `;

        if (device) {
            document.getElementById('ui-device-status').textContent = device.status || 'UNKNOWN';
            document.getElementById('ui-device-status').className = `badge ${device.status === 'LIVE' ? 'live' : 'neutral'}`;
            document.getElementById('ui-device-prefs').innerHTML = `
                <li><span class="label">EV Info</span> <span class="val">${escapeHtml(device.vehicleMake || '')} ${escapeHtml(device.vehicleModel || 'Unknown')}</span></li>
                <li><span class="label">Charge Point</span> <span class="val">${escapeHtml(device.chargePointMake || '')} ${escapeHtml(device.chargePointModel || 'Unknown')}</span></li>
                <li><span class="label">Target Time</span> <span class="val">${escapeHtml(prefs?.weekdayTargetTime || 'N/A')}</span></li>
                <li><span class="label">Charge Limit</span> <span class="val">${escapeHtml(prefs?.weekdayTargetSoc ? prefs.weekdayTargetSoc + '%' : 'N/A')}</span></li>
            `;
        }

        drawPriceChart(maxRate, minRate, dispatches);
        
        const dispatchHtml = dispatches.length ? 
            dispatches.map(d => `<div style="padding: 0.5rem 0.75rem; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 8px; margin-bottom: 0.5rem; color: #0369a1; font-size: 0.9rem; font-weight: 600;">⚡ ${new Date(d.startDt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(d.endDt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>`).join('') 
            : '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 1rem 0;">No smart dispatches scheduled right now.</div>';
        
        document.getElementById('ui-dispatches-list').innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-main);">📅 Schedule created</h4>
            </div>
            ${dispatchHtml}
        `;

        if (!isAutoRefresh) {
            loadAutomations(minRate, maxRate);
            startAutoRefreshTimer();
            if (globalFoxSN && globalGasUrl) {
                await fetchFoxSchedules(); 
                await fetchCurrentWorkMode(); 
                
                // Smart Startup Sync: Pass true to enable strict remote configuration verification
                if (hasEnabledLocalAutomation()) {
                    await evaluateLocalAutomations(null, true); 
                    await fetchFoxSchedules(); 
                }
            }
        }

    } catch (err) {
        if ((err.message === 'Load failed' || err.message === 'Failed to fetch') && retryCount > 0) {
            console.warn("Network error caught, retrying automatically...");
            setTimeout(() => initDashboard(isAutoRefresh, retryCount - 1), 1500);
            return;
        }
        if (!isAutoRefresh) {
            document.getElementById('loading-overlay').style.display = 'none';
            showError(err.message);
        }
    } finally {
        if (!isAutoRefresh) { btn.textContent = 'Refresh Now'; btn.disabled = false; }
    }
}

function startAutoRefreshTimer() {
    window.nextOctoTime = Date.now() + (octoRefreshInterval * 1000);
    window.nextFoxTime = Date.now() + (foxRefreshInterval * 1000);

    if (refreshTimerId !== null) clearInterval(refreshTimerId);
    refreshTimerId = setInterval(() => {
        const now = Date.now();
        
        // 1. Octopus Logic Loop
        octoCountdown = Math.max(0, Math.ceil((window.nextOctoTime - now) / 1000));
        updateCircleTimer('octo-timer', octoCountdown, octoRefreshInterval);
        
        if (now >= window.nextOctoTime) {
            window.nextOctoTime = now + (octoRefreshInterval * 1000);
            initDashboard(true).then(() => {
                const currentDispatchesStr = JSON.stringify(window.currentDispatches || []);
                if (currentDispatchesStr !== lastDispatchesStr) {
                    lastDispatchesStr = currentDispatchesStr;
                    if (document.getElementById('toggle-auto-dispatch')?.checked) {
                        evaluateLocalAutomations(); 
                    }
                }
                if (document.getElementById('toggle-weekly-force')?.checked) {
                    evaluateLocalAutomations(null, true);
                }
                updateCircleTimer('octo-timer', octoCountdown, octoRefreshInterval);
            });
        }

        // 2. FoxESS Logic Loop
        if (globalFoxSN) {
            foxCountdown = Math.max(0, Math.ceil((window.nextFoxTime - now) / 1000));
            updateCircleTimer('fox-timer', foxCountdown, foxRefreshInterval);
            
            if (now >= window.nextFoxTime) {
                window.nextFoxTime = now + (foxRefreshInterval * 1000);
                fetchFoxSchedules().then(() => {
                    if (hasEnabledLocalAutomation()) {
                        evaluateLocalAutomations(null, true);
                    }
                });
            }
        }
    }, 1000);
}

// ==========================================
// AUTOMATIONS CONTROLLER
// ==========================================

function getFoxHeaders(apiPath) {
    const timestamp = Date.now().toString();
    const signString = `${apiPath}\\r\\n${globalFoxToken}\\r\\n${timestamp}`;
    return {
        'Content-Type': 'application/json',
        'token': globalFoxToken,
        'timestamp': timestamp,
        'signature': CryptoJS.MD5(signString).toString(),
        'lang': 'en'
    };
}

async function fetchCurrentWorkMode(forceModeUpdate = false) {
    if (!globalGasUrl || !globalFoxSN) return null;
    const path = '/op/v0/device/setting/get';
    const realPath = '/op/v0/device/real/query';
    try {
        const payload = { url: `https://www.foxesscloud.com${path}`, headers: getFoxHeaders(path), body: { sn: globalFoxSN, key: "WorkMode" } };
        const socPayload = { url: `https://www.foxesscloud.com${realPath}`, headers: getFoxHeaders(realPath), body: { sn: globalFoxSN, variables: ["SoC", "pvPower", "loadsPower", "batTemperature", "ambientTemperation"] } };
        
        let data = { errno: -1 };
        const nowMs = Date.now();
        
        // 🛡️ API QUOTA SAVER: Cache WorkMode for 10 minutes. Saves 50% API calls!
        if (forceModeUpdate || !window.lastModeFetchTime || (nowMs - window.lastModeFetchTime > 600000)) {
            incrementFoxApi(); // Count mode call
            data = await fetchJson(globalGasUrl, { method: 'POST', body: JSON.stringify(payload) });
            if (data.errno === 0) {
                window.lastModeFetchTime = nowMs;
                window.cachedModeValue = data.result?.value;
            }
        } else {
            data = { errno: 0, result: { value: window.cachedModeValue } };
        }

        incrementFoxApi(); // Always count telemetry call
        const socData = await fetchJson(globalGasUrl, { method: 'POST', body: JSON.stringify(socPayload) });
        
        let batterySoc = null;
        if (socData.errno === 0 && socData.result && socData.result[0] && socData.result[0].datas) {
            const d = socData.result[0].datas;
            const findVal = (name) => d.find(v => v.variable === name)?.value ?? '--';
            batterySoc = findVal('SoC');
            
            document.getElementById('live-telemetry-panel').innerHTML = `
                <div>☀️ <strong>PV Power:</strong> ${escapeHtml(findVal('pvPower'))} kW</div>
                <div>🏠 <strong>Load:</strong> ${escapeHtml(findVal('loadsPower'))} kW</div>
                <div>🔋 <strong>Bat Temp:</strong> ${escapeHtml(findVal('batTemperature'))} °C</div>
                <div>🌡️ <strong>Env Temp:</strong> ${escapeHtml(findVal('ambientTemperation'))} °C</div>
            `;
            
            // Auto-Resume Logic
            const autoResumeEnabled = document.getElementById('toggle-auto-resume')?.checked;
            if (autoResumeEnabled && batterySoc !== '--') {
                if (window.activeFoxGroups && window.activeFoxGroups.length > 0) {
                    const resumeNow = new Date();
                    const nowMins = resumeNow.getHours() * 60 + resumeNow.getMinutes();
                    const dispatchActiveNow = (window.currentDispatches || []).some(dispatch => {
                        const start = new Date(dispatch.startDt);
                        const end = new Date(dispatch.endDt);
                        return start <= resumeNow && end > resumeNow;
                    });
                    const activeSch = window.activeFoxGroups.find(g => {
                        let eMins = g.endHour * 60 + g.endMinute;
                        if (eMins === 0 || (g.endHour === 23 && g.endMinute === 59)) eMins = 1440;
                        const sources = getAutomationSourcesForGroup(g, resumeNow);
                        const autoResumeSource = getAutoResumeSource(sources, dispatchActiveNow);
                        g.__autoResumeSource = autoResumeSource;
                        return !dispatchActiveNow && (g.startHour * 60 + g.startMinute) <= nowMins && eMins > nowMins && g.workMode === 'ForceCharge' && autoResumeSource;
                    });
                    
                    if (activeSch && !isCurrentlyUpdatingMode && !window.autoResumeInProgress) {
                        // Dynamically read the SOC limit assigned to THIS specific block
                        const activeSocLimit = activeSch.extraParam?.fdSoc || activeSch.fdSoc || parseInt(document.getElementById('target-soc-limit')?.value || 80);
                        if (parseInt(batterySoc) >= activeSocLimit) {
                            console.log(`Target SOC (${activeSocLimit}%) reached. Auto-resuming Self-Use...`);
                            const source = activeSch.__autoResumeSource;
                            const until = getAutoResumeUntil(source, activeSch, resumeNow);
                            window.fulfilledSchedule = { source, until: until.getTime() };
                            window.autoResumeInProgress = true;
                            Promise.resolve(evaluateLocalAutomations(null, true))
                                .catch(error => showToast(`Auto-resume schedule update failed: ${error.message}`))
                                .finally(() => { window.autoResumeInProgress = false; });
                        }
                    }
                }
            }
        }
        
        if (data.errno === 0 && data.result) {
            localWorkModeState = data.result.value || "Unknown";
            
            // Check if we are currently inside an active scheduled time block (Only override if API returned a blank/generic state)
            if (localWorkModeState === "Unknown" || !localWorkModeState) {
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                if (window.activeFoxGroups && window.activeFoxGroups.length > 0) {
                    const activeSch = window.activeFoxGroups.find(g => {
                        const startMins = g.startHour * 60 + g.startMinute;
                        const endMins = g.endHour * 60 + g.endMinute;
                        return currentMins >= startMins && currentMins < endMins;
                    });
                    if (activeSch) localWorkModeState = activeSch.workMode;
                }
            }
            
            updateModeBadge(localWorkModeState, batterySoc);
            const fbBadge = document.getElementById('fox-api-badge');
            const fbText = document.getElementById('fox-api-text');
            if (fbText) fbText.textContent = "🟢 API CONNECTED";
            if (fbBadge) fbBadge.className = "badge off-peak countdown-border";
            return localWorkModeState;
        }
    } catch (e) { console.warn("Fox API Error", e); }
    return null;
}

function updateModeBadge(mode, soc = null) {
    const modeBadge = document.getElementById('current-work-mode');
    let text = mode;
    if (mode === 'SelfUse') text = 'SELF-USE';
    else if (mode === 'ForceCharge') text = 'FORCED CHARGE';
    
    if (soc !== null) text += ` | ${soc}%`;
    modeBadge.textContent = text;
    
    if (mode === 'ForceCharge') modeBadge.className = 'badge live';
    else if (mode === 'SelfUse') modeBadge.className = 'badge peak';
    else modeBadge.className = 'badge neutral';
}

window.activeFoxGroups = [];

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

function scheduleFingerprint(groups) {
    return (groups || [])
        .filter(group => group.enable !== 0)
        .map(group => {
            const defaultSoc = group.workMode === 'ForceCharge' ? 100 : (group.workMode === 'ForceDischarge' ? 11 : '');
            return [
                group.startHour,
                group.startMinute,
                group.endHour,
                group.endMinute,
                group.workMode,
                group.extraParam?.fdSoc ?? group.fdSoc ?? defaultSoc
            ].join(':');
        })
        .sort()
        .join('|');
}

async function fetchFoxSchedules({ expectedGroups = null, attempts = 1 } = {}) {
    if (!globalGasUrl || !globalFoxSN) return [];
    const path = '/op/v3/device/scheduler/get';
    const expectedFingerprint = expectedGroups ? scheduleFingerprint(expectedGroups) : null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const payload = { url: `https://www.foxesscloud.com${path}`, headers: getFoxHeaders(path), body: { deviceSN: globalFoxSN } };
            incrementFoxApi();
            const data = await fetchJson(globalGasUrl, { method: 'POST', body: JSON.stringify(payload) });
        
            const container = document.getElementById('fox-active-schedules');
            if (data.errno === 0 && data.result && data.result.groups) {
                window.activeFoxGroups = data.result.groups.filter(group => group.enable !== 0);
            if (window.activeFoxGroups.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 0.5rem 0;">No schedules currently set.</div>';
            } else {
                container.innerHTML = window.activeFoxGroups.map((g, i) => {
                    let originLabel = g.workMode === 'ForceCharge' ? 'FORCED CHARGE' : (g.workMode === 'ForceDischarge' ? 'FORCE DISCHARGE' : (g.workMode === 'SelfUse' ? 'SELF-USE' : g.workMode));
                    let detailLabel = "";
                    let badgeColor = g.workMode === 'ForceDischarge' ? '#ef4444' : "var(--fox-orange)";

                    if (g.workMode === 'ForceCharge') {
                        let isDispatch = false;
                        const gStartMins = g.startHour * 60 + g.startMinute;
                        let gEndMins = g.endHour * 60 + g.endMinute;
                        if (gEndMins === 0) gEndMins = 1440;
                        
                        if (window.currentDispatches) {
                            isDispatch = window.currentDispatches.some(d => {
                                const dsMins = new Date(d.startDt).getHours() * 60 + new Date(d.startDt).getMinutes();
                                let deMins = new Date(d.endDt).getHours() * 60 + new Date(d.endDt).getMinutes();
                                if (deMins === 0 && new Date(d.endDt) > new Date(d.startDt)) deMins = 1440;
                                return Math.max(gStartMins, dsMins) < Math.min(gEndMins, deMins);
                            });
                        }
                        
                        const sources = getAutomationSourcesForGroup(g, new Date());
                        const sourceLabels = [];
                        if (sources.includes('weekly')) sourceLabels.push('📅 Weekly Schedule');
                        if (sources.includes('dispatch') || (isDispatch && !sources.includes('weekly'))) sourceLabels.push('⚡ Smart Dispatch');
                        if (sources.includes('price') && !sources.includes('weekly')) sourceLabels.push('🎯 Target Price');
                        const subText = sourceLabels.join(' + ') || '⚙️ Manual Schedule';
                        const soc = g.fdSoc || g.extraParam?.fdSoc || 100;
                        
                        detailLabel = `<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: normal; margin-left: 4px;">(${subText} | Max SOC: ${soc}%)</span>`;
                    } else if (g.workMode === 'ForceDischarge') {
                        const soc = g.fdSoc || g.extraParam?.fdSoc || 11;
                        detailLabel = `<span style="color: #ef4444; font-size: 0.8rem; font-weight: 600; margin-left: 4px;">(📤 Export Mode | Min SOC: ${soc}%)</span>`;
                    }

                    const borderStyle = i === window.activeFoxGroups.length - 1 ? 'none' : '1px solid var(--border)';
                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 0.5rem 0; border-bottom: ${borderStyle};">
                        <span style="font-weight: 600; color: var(--text-main);">
                            <span style="color: ${badgeColor};">${originLabel}</span> | 
                            ${String(g.startHour).padStart(2,'0')}:${String(g.startMinute).padStart(2,'0')} - ${String(g.endHour).padStart(2,'0')}:${String(g.endMinute).padStart(2,'0')}
                            ${detailLabel}
                        </span>
                        <button onclick="deleteFoxSchedule(${i})" style="width: auto; padding: 0.3rem 0.8rem; background: #ef4444; border-radius: 4px; font-size: 0.75rem;">Delete</button>
                    </div>
                `}).join('');
            }
            } else {
                container.innerHTML = 'Failed to load schedules.';
            }

            const schedulesMatch = expectedFingerprint === null || scheduleFingerprint(window.activeFoxGroups) === expectedFingerprint;
            if (schedulesMatch || attempt === attempts) {
                await fetchCurrentWorkMode(true);
                return window.activeFoxGroups;
            }
        } catch (e) {
            console.warn(`Fetch Schedule Error (attempt ${attempt}/${attempts})`, e);
            if (attempt === attempts) return window.activeFoxGroups;
        }

        await wait(1000 * attempt);
    }

    return window.activeFoxGroups;
}

function closeModal() {
    document.getElementById('custom-modal').style.display = 'none';
}

function deleteFoxSchedule(index) {
    scheduleToDelete = index;
    document.getElementById('custom-modal').style.display = 'flex';
    
    document.getElementById('confirm-delete-btn').onclick = async () => {
        const btn = document.getElementById('confirm-delete-btn');
        btn.textContent = 'Deleting...';
        btn.disabled = true;
        
        const remainingGroups = window.activeFoxGroups.filter((_, index) => index !== scheduleToDelete);
        try {
            await pushGroupsToFoxESS(remainingGroups);
            closeModal();
        } catch (error) {
            showToast(`Schedule deletion failed: ${error.message}`);
        } finally {
            btn.textContent = 'Delete';
            btn.disabled = false;
        }
    };
}

function prepareFoxSchedulePayload(groups) {
    const activeGroups = (groups || []).filter(group => group.enable !== 0).slice(0, 5).map(group => ({ ...group, enable: 1 }));
    const droppedCount = Math.max(0, (groups || []).filter(group => group.enable !== 0).length - activeGroups.length);
    const paddedGroups = [...activeGroups];
    while (paddedGroups.length < 5) {
        paddedGroups.push({
            startHour: 0,
            startMinute: 0,
            endHour: 0,
            endMinute: 0,
            workMode: 'SelfUse',
            enable: 0
        });
    }
    return { activeGroups, paddedGroups, droppedCount };
}

function getWeeklyForceConfig() {
    return {
        enabled: document.getElementById('toggle-weekly-force')?.checked === true,
        startTime: document.getElementById('weekly-force-start')?.value || '',
        endTime: document.getElementById('weekly-force-end')?.value || '',
        days: Array.from(document.querySelectorAll('input[name="weekly-force-day"]:checked')).map(input => Number(input.value))
    };
}

function getWeeklyForcedChargePeriods(config, now = new Date()) {
    const selectedDays = Array.isArray(config?.days) ? config.days : [];
    const isTime = value => /^\d{2}:\d{2}$/.test(value || '');
    if (!config?.enabled || !isTime(config.startTime) || !isTime(config.endTime)) return [];

    const [startHour, startMinute] = config.startTime.split(':').map(Number);
    const [endHour, endMinute] = config.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (startMinutes === endMinutes) return [];

    const currentDay = now.getDay();
    const previousDay = (currentDay + 6) % 7;
    const makePeriod = (sHour, sMinute, eHour, eMinute) => ({
        startHour: sHour,
        startMinute: sMinute,
        endHour: eHour,
        endMinute: eMinute,
        workMode: 'ForceCharge',
        extraParam: { schSource: 'weekly', fdSoc: 100 }
    });

    if (startMinutes < endMinutes) {
        return selectedDays.includes(currentDay) ? [makePeriod(startHour, startMinute, endHour, endMinute)] : [];
    }

    // FoxESS schedules do not understand weekdays or overnight ranges. Split an
    // overnight rule into today's carry-over and tonight's period explicitly.
    const periods = [];
    if (endMinutes > 0 && selectedDays.includes(previousDay)) periods.push(makePeriod(0, 0, endHour, endMinute));
    if (selectedDays.includes(currentDay)) periods.push(makePeriod(startHour, startMinute, 23, 59));
    return periods;
}

function getAutomationSourcesForGroup(group, now = new Date()) {
    const sources = new Set();
    const addSource = source => String(source || '').split('+').filter(Boolean).forEach(value => sources.add(value));
    addSource(group?.extraParam?.schSource || group?.schSource);

    const groupStart = group.startHour * 60 + group.startMinute;
    let groupEnd = group.endHour * 60 + group.endMinute;
    if (groupEnd === 0 || (group.endHour === 23 && group.endMinute === 59)) groupEnd = 1440;
    const overlaps = (start, end) => Math.max(groupStart, start) < Math.min(groupEnd, end);

    (window.lastAutomationGroups || []).forEach(localGroup => {
        if (localGroup.workMode !== group.workMode) return;
        const start = localGroup.startHour * 60 + localGroup.startMinute;
        let end = localGroup.endHour * 60 + localGroup.endMinute;
        if (end === 0 || (localGroup.endHour === 23 && localGroup.endMinute === 59)) end = 1440;
        if (overlaps(start, end)) addSource(localGroup.extraParam?.schSource || localGroup.schSource);
    });

    getWeeklyForcedChargePeriods(getWeeklyForceConfig(), now).forEach(period => {
        const start = period.startHour * 60 + period.startMinute;
        let end = period.endHour * 60 + period.endMinute;
        if (period.endHour === 23 && period.endMinute === 59) end = 1440;
        if (overlaps(start, end)) sources.add('weekly');
    });

    (window.currentDispatches || []).forEach(dispatch => {
        const startDate = new Date(dispatch.startDt);
        const endDate = new Date(dispatch.endDt);
        const start = startDate.getHours() * 60 + startDate.getMinutes();
        let end = endDate.getHours() * 60 + endDate.getMinutes();
        if (end === 0 && endDate > startDate) end = 1440;
        if (overlaps(start, end)) sources.add('dispatch');
    });

    return ['weekly', 'dispatch', 'price', 'export'].filter(source => sources.has(source));
}

function getAutoResumeSource(sources, dispatchActiveNow = false) {
    if (dispatchActiveNow) return null;
    if (sources.includes('weekly')) return 'weekly';
    if (sources.includes('price')) return 'price';
    return null;
}

function getAutoResumeUntil(source, group, now = new Date(), weeklyConfig = null) {
    if (source === 'weekly') {
        const config = weeklyConfig || getWeeklyForceConfig();
        const [startHour, startMinute] = config.startTime.split(':').map(Number);
        const [endHour, endMinute] = config.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const until = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
        if (startMinutes > endMinutes && nowMinutes >= startMinutes) until.setDate(until.getDate() + 1);
        return until;
    }

    let endMinutes = group.endHour * 60 + group.endMinute;
    const until = new Date(now.getFullYear(), now.getMonth(), now.getDate(), group.endHour, group.endMinute);
    if (endMinutes === 0 || (group.endHour === 23 && group.endMinute === 59)) until.setHours(24, 0, 0, 0);
    if (until <= now) until.setDate(until.getDate() + 1);
    return until;
}

function isScheduleMinuteSuppressed(fulfilledSchedule, ruleSource, minuteTime) {
    return Boolean(
        fulfilledSchedule &&
        fulfilledSchedule.source === ruleSource &&
        minuteTime < fulfilledSchedule.until
    );
}

function buildScheduleGroupsFromTimeline(timeline, minSoc, fdPwr) {
    const groups = [];
    let currentBlock = null;

    for (let i = 0; i <= 1440; i++) {
        const state = i < 1440 ? timeline[i] : null;

        if (!currentBlock && state) {
            currentBlock = { start: i, workMode: state.workMode, finalFdSoc: state.finalFdSoc, source: state.source };
        } else if (currentBlock && (!state || state.workMode !== currentBlock.workMode || state.finalFdSoc !== currentBlock.finalFdSoc)) {
            groups.push({
                startHour: Math.floor(currentBlock.start / 60),
                startMinute: currentBlock.start % 60,
                endHour: i === 1440 ? 23 : Math.floor(i / 60),
                endMinute: i === 1440 ? 59 : i % 60,
                workMode: currentBlock.workMode,
                extraParam: {
                    minSocOnGrid: minSoc,
                    fdPwr,
                    fdSoc: currentBlock.finalFdSoc,
                    schSource: currentBlock.source
                }
            });
            currentBlock = state
                ? { start: i, workMode: state.workMode, finalFdSoc: state.finalFdSoc, source: state.source }
                : null;
        }
    }

    return groups;
}

async function pushGroupsToFoxESS(groups, maxAttempts = 3) {
    isCurrentlyUpdatingMode = true;
    const path = '/op/v3/device/scheduler/enable';
    const { activeGroups, paddedGroups, droppedCount } = prepareFoxSchedulePayload(groups);
    if (droppedCount > 0) {
        showToast(`FoxESS supports five active scheduler periods. The earliest five were applied; ${droppedCount} later period${droppedCount === 1 ? '' : 's'} could not be sent.`);
    }

    try {
        const payload = {
            url: `https://www.foxesscloud.com${path}`,
            headers: getFoxHeaders(path),
            body: { deviceSN: globalFoxSN, isDefault: false, groups: paddedGroups }
        };

        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                incrementFoxApi();
                const data = await fetchJson(globalGasUrl, { method: 'POST', body: JSON.stringify(payload) });
                if (data.errno !== 0) throw new Error(data.msg || `FoxESS API error ${data.errno}`);

                const refreshedGroups = await fetchFoxSchedules({ expectedGroups: activeGroups, attempts: 4 });
                if (scheduleFingerprint(refreshedGroups) !== scheduleFingerprint(activeGroups)) {
                    throw new Error('FoxESS did not confirm the updated schedules');
                }
                window.v3SyncRetryCount = 0;
                return { groups: activeGroups, droppedCount };
            } catch (error) {
                lastError = error;
                window.v3SyncRetryCount = attempt;
                console.warn(`FoxESS schedule sync failed (attempt ${attempt}/${maxAttempts})`, error);
                if (attempt < maxAttempts) await wait(2000 * attempt);
            }
        }

        window.v3SyncRetryCount = 0;
        throw lastError || new Error('FoxESS schedule synchronization failed');
    } finally {
        isCurrentlyUpdatingMode = false;
    }
}

function loadAutomations(minPrice, maxPrice) {
    const saved = JSON.parse(localStorage.getItem('foxAutomations') || '{}');
    
    // Load advanced V3 Hardware limits
    if (saved.targetSoc !== undefined) document.getElementById('target-soc-limit').value = saved.targetSoc;
    if (saved.applyLimit !== undefined) document.getElementById('toggle-soc-limit').checked = saved.applyLimit;
    if (saved.autoResume !== undefined) document.getElementById('toggle-auto-resume').checked = saved.autoResume;
    if (saved.minSoc !== undefined) document.getElementById('adv-min-soc').value = saved.minSoc;
    if (saved.fdPwr !== undefined) document.getElementById('adv-fd-pwr').value = saved.fdPwr;
    
    // Load new nested export features and dispatch SOC parameters
    if (saved.exportCheck !== undefined) document.getElementById('toggle-auto-export').checked = saved.exportCheck;
    if (saved.exportThreshold !== undefined) document.getElementById('export-threshold').value = saved.exportThreshold;
    if (saved.dispatchSocLimit !== undefined) document.getElementById('dispatch-soc-limit').value = saved.dispatchSocLimit;
    if (saved.applyDispatchLimit !== undefined) document.getElementById('toggle-dispatch-soc-limit').checked = saved.applyDispatchLimit;
    if (saved.weeklyForceCheck !== undefined) document.getElementById('toggle-weekly-force').checked = saved.weeklyForceCheck;
    if (saved.weeklyForceStart) document.getElementById('weekly-force-start').value = saved.weeklyForceStart;
    if (saved.weeklyForceEnd) document.getElementById('weekly-force-end').value = saved.weeklyForceEnd;
    if (Array.isArray(saved.weeklyForceDays)) {
        document.querySelectorAll('input[name="weekly-force-day"]').forEach(input => {
            input.checked = saved.weeklyForceDays.includes(Number(input.value));
        });
    }

    // Toggle borders on initial page load
    const blockUnified = document.getElementById('block-unified-auto');
    const autoPriceEl = document.getElementById('toggle-auto-price');
    const autoDispatchEl = document.getElementById('toggle-auto-dispatch');
    
    if (autoPriceEl) autoPriceEl.checked = saved.priceCheck || false;
    if (autoDispatchEl) autoDispatchEl.checked = saved.dispatchCheck || false;
    
    if (blockUnified) blockUnified.classList.toggle('block-countdown-octo', hasEnabledLocalAutomation());

    let thresh = saved.threshold;
    if ((!thresh || thresh === "0") && minPrice !== undefined) {
        thresh = ((maxPrice + minPrice) / 2).toFixed(2); 
    }
    const threshEl = document.getElementById('price-threshold');
    if(threshEl) threshEl.value = thresh || "";
}

function hasEnabledLocalAutomation() {
    return ['toggle-auto-price', 'toggle-auto-dispatch', 'toggle-weekly-force']
        .some(id => document.getElementById(id)?.checked === true);
}

// RUNS TO PUSH SCHEDULES VIA V3 API INSTEAD OF V0 LIVE-TOGGLE
async function evaluateLocalAutomations(btn = null, isStartup = false) {
    if (!globalFoxSN || !globalGasUrl || isCurrentlyUpdatingMode) return;
    
    if (btn) {
        btn.textContent = "Syncing...";
        btn.style.opacity = "0.7";
        btn.disabled = true;
        
        // Wipe the Auto-Resume memory lock because the user manually clicked Apply
        window.fulfilledSchedule = null;
        console.log("Manual Apply: Auto-Resume memory cleared.");
    }

    const isAutoPrice = document.documentElement.querySelector('#toggle-auto-price')?.checked;
    const isAutoDispatch = document.documentElement.querySelector('#toggle-auto-dispatch')?.checked;
    const isAutoExport = document.documentElement.querySelector('#toggle-auto-export')?.checked;
    const weeklyForce = getWeeklyForceConfig();

    if (weeklyForce.enabled && (!weeklyForce.startTime || !weeklyForce.endTime || weeklyForce.startTime === weeklyForce.endTime)) {
        showToast('Set different start and end times for the weekly forced-charge schedule.');
        if (btn) {
            btn.textContent = 'Apply Combined Automations';
            btn.style.opacity = '1';
            btn.disabled = false;
        }
        return false;
    }

    // Save configuration implicitly on run
    localStorage.setItem('foxAutomations', JSON.stringify({
        priceCheck: isAutoPrice,
        dispatchCheck: isAutoDispatch,
        exportCheck: isAutoExport,
        threshold: document.getElementById('price-threshold')?.value,
        exportThreshold: document.getElementById('export-threshold')?.value,
        targetSoc: parseInt(document.getElementById('target-soc-limit')?.value || 80),
        applyLimit: document.getElementById('toggle-soc-limit')?.checked || false,
        autoResume: document.getElementById('toggle-auto-resume')?.checked || false,
        dispatchSocLimit: parseInt(document.getElementById('dispatch-soc-limit')?.value || 80),
        applyDispatchLimit: document.getElementById('toggle-dispatch-soc-limit')?.checked || false,
        weeklyForceCheck: weeklyForce.enabled,
        weeklyForceStart: weeklyForce.startTime,
        weeklyForceEnd: weeklyForce.endTime,
        weeklyForceDays: weeklyForce.days,
        minSoc: Math.max(11, parseInt(document.getElementById('adv-min-soc')?.value || 11)),
        fdPwr: parseInt(document.getElementById('adv-fd-pwr')?.value || 5000)
    }));
    
    // Toggle borders when user clicks apply
    const blockUnified = document.getElementById('block-unified-auto');
    if (blockUnified) blockUnified.classList.toggle('block-countdown-octo', hasEnabledLocalAutomation());
    
    const now = new Date();
    
    // Apply Scheduler-V3 Hardware Limits early to embed them during timeline generation
    const applyLimit = document.getElementById('toggle-soc-limit')?.checked;
    const targetSoc = parseInt(document.getElementById('target-soc-limit')?.value || 80);
    const applyDispatchLimit = document.getElementById('toggle-dispatch-soc-limit')?.checked;
    const dispatchSocLimit = parseInt(document.getElementById('dispatch-soc-limit')?.value || 80);
    const minSoc = Math.max(11, parseInt(document.getElementById('adv-min-soc')?.value || 11));
    const fdPwr = parseInt(document.getElementById('adv-fd-pwr')?.value || 5000);

    // Create a 1440-minute timeline to resolve overlapping priorities beautifully
    let timeline = new Array(1440).fill(null);

    const fillTimeline = (startDt, endDt, mode, soc, ruleSource = null) => {
        // Round odd smart dispatch times to make them legal for the inverter hardware
        let sMins = startDt.getHours() * 60 + startDt.getMinutes();
        let eMins = endDt.getHours() * 60 + endDt.getMinutes();
        
        // Snap to 15-min boundaries for FoxESS hardware compatibility
        if (ruleSource === 'dispatch') {
            sMins = Math.floor(sMins / 15) * 15;
            eMins = Math.ceil(eMins / 15) * 15;
        }
        
        if (eMins === 0 && endDt.getTime() > startDt.getTime()) eMins = 1440; // Treat exactly midnight as 1440
        
        // Clear Auto-Resume memory after the fulfilled block has ended.
        if (window.fulfilledSchedule && now.getTime() >= window.fulfilledSchedule.until) {
            window.fulfilledSchedule = null;
        }
        
        const fill = (start, end) => {
            for (let i = start; i < end; i++) {
                // If Auto-Resume already finished this source, suppress only the
                // affected minutes. Higher-priority dispatch periods remain intact.
                if (mode === 'ForceCharge' && window.fulfilledSchedule?.source === ruleSource) {
                    const minuteTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, i).getTime();
                    if (isScheduleMinuteSuppressed(window.fulfilledSchedule, ruleSource, minuteTime)) continue;
                }
                
                // Best Practice: If a Smart Dispatch overlaps an existing Target Price block, 
                // automatically inherit the lower SOC so we don't accidentally charge the house battery to 100%
                let finalSoc = soc;
                if (ruleSource === 'dispatch' && timeline[i] && timeline[i].workMode === 'ForceCharge') {
                    finalSoc = Math.min(soc, timeline[i].finalFdSoc);
                }
                
                timeline[i] = { workMode: mode, finalFdSoc: finalSoc, source: ruleSource };
            }
        };
        
        if (sMins >= eMins && eMins !== 1440) { // Crosses midnight
            fill(sMins, 1440);
            if (eMins > 0) fill(0, eMins);
        } else {
            fill(sMins, eMins);
        }
    };

    // 1. Target Price Check (Lower priority - forms the base off-peak schedule)
    if (isAutoPrice && window.todayRates) {
        const threshold = parseFloat(document.getElementById('price-threshold').value || 0);
        const limitTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); 
        let current = null;
        const soc = applyLimit ? targetSoc : 100;
        
        [...window.todayRates]
            .filter(r => new Date(r.valid_to) > now && new Date(r.valid_from) <= limitTime && new Date(r.valid_from).getDate() === now.getDate())
            .sort((a,b) => new Date(a.valid_from) - new Date(b.valid_from))
            .forEach(r => {
                if (r.value_inc_vat <= threshold) {
                    if (!current) current = { start: new Date(r.valid_from), end: new Date(r.valid_to) };
                    else if (current.end.getTime() === new Date(r.valid_from).getTime()) current.end = new Date(r.valid_to);
                    else {
                        if(current.end > now) fillTimeline(current.start, current.end, "ForceCharge", soc, "price");
                        current = { start: new Date(r.valid_from), end: new Date(r.valid_to) };
                    }
                }
            });
        if (current && current.end > now) fillTimeline(current.start, current.end, "ForceCharge", soc, "price");
    }

    // Weekly forced charge runs even when Octopus tariff data is unavailable.
    const weeklyPeriods = getWeeklyForcedChargePeriods(weeklyForce, now);
    weeklyPeriods.forEach(weeklyPeriod => {
        fillTimeline(
            new Date(now.getFullYear(), now.getMonth(), now.getDate(), weeklyPeriod.startHour, weeklyPeriod.startMinute),
            new Date(now.getFullYear(), now.getMonth(), now.getDate(), weeklyPeriod.endHour, weeklyPeriod.endMinute),
            weeklyPeriod.workMode,
            weeklyPeriod.extraParam.fdSoc,
            weeklyPeriod.extraParam.schSource
        );
    });

    // 3. Dispatch Check (Higher priority - overrides target-price and weekly charge blocks)
    if (isAutoDispatch && window.currentDispatches) {
        const soc = applyDispatchLimit ? dispatchSocLimit : 100;
        window.currentDispatches.forEach(d => {
            const s = new Date(d.startDt); const e = new Date(d.endDt);
            if(e > now && s.getDate() === now.getDate()) fillTimeline(s, e, "ForceCharge", soc, "dispatch");
        });
    }

    // 4. Price Export Feature (Highest priority - overwrites any charge blocks)
    if (isAutoPrice && isAutoExport && window.todayRates) {
        const expThreshold = parseFloat(document.getElementById('export-threshold').value || 99);
        const limitTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        let currentExp = null;

        [...window.todayRates]
            .filter(r => new Date(r.valid_to) > now && new Date(r.valid_from) <= limitTime && new Date(r.valid_from).getDate() === now.getDate())
            .sort((a,b) => new Date(a.valid_from) - new Date(b.valid_from))
            .forEach(r => {
                if (r.value_inc_vat >= expThreshold) {
                    if (!currentExp) currentExp = { start: new Date(r.valid_from), end: new Date(r.valid_to) };
                    else if (currentExp.end.getTime() === new Date(r.valid_from).getTime()) currentExp.end = new Date(r.valid_to);
                    else {
                        if(currentExp.end > now) fillTimeline(currentExp.start, currentExp.end, "ForceDischarge", 11, "export");
                        currentExp = { start: new Date(r.valid_from), end: new Date(r.valid_to) };
                    }
                }
            });
        if (currentExp && currentExp.end > now) fillTimeline(currentExp.start, currentExp.end, "ForceDischarge", 11, "export");
    }

    // Reconstruct continuous groups. FoxESS merges adjacent periods when mode
    // and SOC match, even if the app's internal source label is different.
    const groups = buildScheduleGroupsFromTimeline(timeline, minSoc, fdPwr);

    // Keep source information locally because FoxESS strips unknown metadata and
    // may merge adjacent periods with identical mode/SOC values.
    window.lastAutomationGroups = groups.map(group => ({ ...group, extraParam: { ...group.extraParam } }));

    // If running on startup, check if schedules already match to avoid redundant API hits
    if (isStartup && window.activeFoxGroups) {
        // Include fdSoc in stringification to ensure hardware limits match
        const mapGroup = g => `${g.startHour}:${g.startMinute}-${g.endHour}:${g.endMinute}-${g.workMode}-${g.extraParam?.fdSoc || 100}`;
        const localStr = prepareFoxSchedulePayload(groups).activeGroups.map(mapGroup).sort().join('|');
        const remoteStr = window.activeFoxGroups.filter(g => g.enable !== 0).map(mapGroup).sort().join('|');
        if (localStr === remoteStr) {
            console.log("Startup Check: Local automations match inverter schedules perfectly. Skipping sync.");
            return;
        }
    }

    try {
        await pushGroupsToFoxESS(groups);
    } catch (error) {
        showToast(`Automation schedules were not applied: ${error.message}`);
        if (btn) {
            btn.textContent = '❌ Apply Failed';
            btn.style.background = '#ef4444';
            btn.style.opacity = '1';
            btn.disabled = false;
        }
        return false;
    }
    
    // Provide brief success feedback on the buttons
    const btnUnified = document.getElementById('btn-save-unified');
    if (btnUnified) { 
        btnUnified.textContent = "✅ Applied Automations"; 
        setTimeout(() => { 
            btnUnified.textContent = "Apply Combined Automations"; 
            btnUnified.disabled = false; 
            btnUnified.style.opacity = "1"; 
            btnUnified.style.background = "#94a3b8"; 
        }, 2500); 
    }
    
    // Fetch current work mode 1 minute (60000ms) after applying new schedules (bypass cache)
    setTimeout(() => fetchCurrentWorkMode(true), 60000);
    return true;
}

// ==========================================
// MANUAL SCHEDULER (V3)
// ==========================================
async function setV3Schedule(mode) {
    const errorDiv = document.getElementById('fox-error');
    const successDiv = document.getElementById('fox-success');
    errorDiv.style.display = 'none'; successDiv.style.display = 'none';

    if (!globalGasUrl || !globalFoxSN) { 
        errorDiv.textContent = "Load dashboard with Fox credentials first."; 
        errorDiv.style.display = 'block'; 
        return; 
    }
    
    const startVal = document.getElementById('v3-start').value.split(':');
    const endVal = document.getElementById('v3-end').value.split(':');
    
    if(startVal.length !== 2 || endVal.length !== 2) {
        errorDiv.textContent = "Select valid start and end times."; errorDiv.style.display = 'block'; return;
    }

    const path = '/op/v3/device/scheduler/enable';
    try {
        const payload = {
            url: `https://www.foxesscloud.com${path}`,
            headers: getFoxHeaders(path),
            body: {
                deviceSN: globalFoxSN, isDefault: false,
                groups: [{
                    startHour: parseInt(startVal[0], 10), startMinute: parseInt(startVal[1], 10),
                    endHour: parseInt(endVal[0], 10), endMinute: parseInt(endVal[1], 10),
                    workMode: mode
                }]
            }
        };
        incrementFoxApi();
        const data = await fetchJson(globalGasUrl, { method: 'POST', body: JSON.stringify(payload) });
        
        if (data.errno !== 0) throw new Error(data.msg || `API Error: ${data.errno}`);
        
        const refreshedGroups = await fetchFoxSchedules({
            expectedGroups: payload.body.groups,
            attempts: 4
        }); // Wait for FoxESS propagation before redrawing the list
        if (scheduleFingerprint(refreshedGroups) !== scheduleFingerprint(payload.body.groups)) {
            throw new Error('FoxESS did not confirm the manual schedule');
        }
        successDiv.innerHTML = `✅ <strong>Success!</strong> Forced ${escapeHtml(mode)} from ${escapeHtml(document.getElementById('v3-start').value)} to ${escapeHtml(document.getElementById('v3-end').value)}`;
        successDiv.style.display = 'block';
        setTimeout(() => fetchCurrentWorkMode(true), 3000); // Verify device mode via API after 3 seconds
    } catch (err) {
        errorDiv.textContent = `Scheduler Failed: ${err.message}`; errorDiv.style.display = 'block';
    }
}

// Chart Builder
function drawPriceChart(peak, offPeak, dispatches) {
    const chartState = JSON.stringify({ peak, offPeak, dispatches });
    if (window.lastChartState === chartState && priceChartInst) return; // Skip if data hasn't changed
    window.lastChartState = chartState;
    
    if (priceChartInst) priceChartInst.destroy();
    if (!peak || !offPeak) { document.getElementById('priceChart').style.display = 'none'; return; }
    
    document.getElementById('priceChart').style.display = 'block';
    const ctx = document.getElementById('priceChart').getContext('2d');
    const labels = [], dataPoints = [];
    const now = new Date();
    
    for (let h = 0; h <= 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 24 && m > 0) break;
            labels.push(h === 24 ? '24:00' : `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
            
            const slotIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h===24?0:h, m, 0).toISOString();
            
            // Check exact API array if we have it to plot true history
            let slotPrice = peak; 
            if (window.todayRates) {
                const found = window.todayRates.find(r => slotIso >= r.valid_from && slotIso < r.valid_to);
                if (found) slotPrice = parseFloat(found.value_inc_vat.toFixed(2));
            } else {
                // Fallback dummy chart logic
                let isOffPeak = (h === 23 && m >= 30) || (h < 5) || (h === 5 && m < 30) || (h === 24);
                slotPrice = isOffPeak ? offPeak : peak;
            }
            
            // OVERRIDE: Apply off-peak rate if the 30-min slot overlaps with an Octopus smart dispatch
            const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h === 24 ? 0 : h, m, 0).getTime();
            const slotEnd = slotTime + 30 * 60 * 1000; // Slot duration is 30 mins
            
            if (dispatches && dispatches.some(d => {
                const start = new Date(d.startDt).getTime();
                const end = new Date(d.endDt).getTime();
                return (start < slotEnd && end > slotTime); // True overlap condition
            })) {
                slotPrice = offPeak;
            }
            
            dataPoints.push(slotPrice);
        }
    }

    // Generate dynamic chart colors based on current theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    priceChartInst = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: labels, 
            datasets: [{ 
                data: dataPoints, 
                borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)',
                stepped: 'after', fill: true, borderWidth: 2, pointRadius: 0 
            }] 
        },
        options: { 
            animation: false,
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' } },
            scales: { 
                x: { ticks: { maxTicksLimit: 8, color: textColor }, grid: { display: false } },
                y: { beginAtZero: true, border: { dash: [4, 4] }, ticks: { color: textColor }, grid: { color: gridColor } } 
            }
        }
    });
}

function previewScheduleTimes() {
    const isEnabled = document.getElementById('toggle-auto-price').checked;
    const threshold = parseFloat(document.getElementById('price-threshold').value || 0);
    const display = document.getElementById('price-target-times');
    
    if (!isEnabled) { display.innerHTML = ''; return; }
    if (!window.todayRates) { display.innerHTML = 'Waiting for rate data...'; return; }

    const now = new Date();
    let blocks = [];
    let current = null;

    [...window.todayRates].sort((a,b) => new Date(a.valid_from) - new Date(b.valid_from)).forEach(r => {
        if (r.value_inc_vat <= threshold) {
            if (!current) current = { start: new Date(r.valid_from), end: new Date(r.valid_to) };
            else if (current.end.getTime() === new Date(r.valid_from).getTime()) current.end = new Date(r.valid_to);
            else { blocks.push(current); current = { start: new Date(r.valid_from), end: new Date(r.valid_to) }; }
        }
    });
    if (current) blocks.push(current);

    blocks = blocks.filter(b => b.end > now).slice(0, 3); 
    if (blocks.length === 0) display.innerHTML = `No upcoming drops &le; ${threshold}p.`;
    else display.innerHTML = blocks.map(b => `🕒 ${b.start.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} - ${b.end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`).join('<br>');
}

function showError(msg) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = 'Error: ' + msg;
    errorDiv.style.display = 'block';
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function toggleScreenSaver() {
    const overlay = document.getElementById('screen-saver-overlay');
    overlay.style.display = (overlay.style.display === 'none') ? 'block' : 'none';
}

function toggleMiniViewer() {
    const hud = document.getElementById('mini-viewer-hud');
    if (hud.style.display === 'none' || !hud.style.display) {
        hud.style.display = 'block';
        updateMiniViewer();
    } else {
        hud.style.display = 'none';
    }
}

function updateMiniViewer() {
    const hudOcto = document.getElementById('hud-octo-schedules');
    const hudFox = document.getElementById('hud-fox-schedules');
    if (!hudOcto || !hudFox) return;

    // Render Octopus Dispatches
    if (window.currentDispatches && window.currentDispatches.length > 0) {
        hudOcto.innerHTML = window.currentDispatches.map(d => {
            const s = new Date(d.startDt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const e = new Date(d.endDt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            return `<div style="background: rgba(14, 165, 233, 0.2); padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid #38bdf8;">⚡ ${s} - ${e}</div>`;
        }).join('');
    } else {
        hudOcto.innerHTML = '<div style="color: #64748b; font-style: italic;">No dispatches scheduled.</div>';
    }

    // Render FoxESS Schedules
    if (window.activeFoxGroups && window.activeFoxGroups.length > 0) {
        const activeGroups = window.activeFoxGroups.filter(g => g.enable !== 0); // Hide disabled ghost slots
        if (activeGroups.length > 0) {
            hudFox.innerHTML = activeGroups.map(g => {
                const s = `${String(g.startHour).padStart(2,'0')}:${String(g.startMinute).padStart(2,'0')}`;
                const e = `${String(g.endHour).padStart(2,'0')}:${String(g.endMinute).padStart(2,'0')}`;
                let modeLabel = g.workMode === 'ForceCharge' ? 'CHG' : (g.workMode === 'ForceDischarge' ? 'DIS' : 'SLF');
                let color = g.workMode === 'ForceCharge' ? '#fb923c' : (g.workMode === 'ForceDischarge' ? '#f87171' : '#34d399');
                let bg = g.workMode === 'ForceCharge' ? 'rgba(249, 115, 22, 0.15)' : (g.workMode === 'ForceDischarge' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)');
                return `<div style="background: ${bg}; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid ${color};">
                    <span style="color: ${color}; font-weight: 600; display: inline-block; width: 35px;">${modeLabel}</span> | ${s} - ${e}
                </div>`;
            }).join('');
        } else {
            hudFox.innerHTML = '<div style="color: #64748b; font-style: italic;">No active schedules.</div>';
        }
    } else {
        hudFox.innerHTML = '<div style="color: #64748b; font-style: italic;">No active schedules.</div>';
    }
}

// Auto-update the HUD every 5 seconds if left open
setInterval(() => {
    if (document.getElementById('mini-viewer-hud')?.style.display === 'block') updateMiniViewer();
}, 5000);
