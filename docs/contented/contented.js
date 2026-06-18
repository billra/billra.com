// ==========================================================================
// 1. STATE & DOM INITIALIZATION
// ==========================================================================

// Core Constants & State
const ACTIVE_TAB_KEY = 'active🐱tab';
const TAB_ORDER_KEY = 'tab🐱order';
const SYSTEM_TAB_NAME = 'contented';

const tabs = new Map();
let activeTabId = null;
let previousTabId = null; // Remembers last user tab for F1/Escape toggling
let systemTabId = null;
let uniqueID = 0;

// DOM Elements
const tabContainer = document.getElementById('tab-container');
const addTabBtn = document.getElementById('add-tab');
const editorContainer = document.getElementById('editor-container');

// ==========================================================================
// 2. UTILITY HELPERS
// ==========================================================================

function generateTabId() {
    uniqueID++;
    return `tab-${uniqueID}`;
}

function isTabNameTaken(name) {
    return [...tabs.values()].some(t => t.name.toLowerCase() === name.toLowerCase());
}

function isSystemName(name) {
    return name.toLowerCase() === SYSTEM_TAB_NAME.toLowerCase();
}

function getUserTabIds() {
    return [...tabs.keys()].filter(id => id !== systemTabId);
}

// ==========================================================================
// 3. BOOTSTRAP & LOCAL STORAGE MANAGEMENT
// ==========================================================================

function init() {
    // 1. Initialize the System Tab (Always leftmost, index 0)
    systemTabId = generateTabId();
    const template = document.getElementById('system-tab-template');

    // Grab the version from the meta tag
    const appVersion = document.querySelector('meta[name="version"]')?.content || '1.0';

    // Inject the version into the template HTML
    const sysContent = template ? template.innerHTML.replace('{{VERSION}}', appVersion) : `<h1>${SYSTEM_TAB_NAME}</h1>`;

    tabs.set(systemTabId, { name: SYSTEM_TAB_NAME, dirty: false, readonly: true, saveTimer: null, savedRange: null });
    createEditor(systemTabId, sysContent, true);

    // 2. Load User Tabs
    let savedOrder = [];
    try { savedOrder = JSON.parse(localStorage.getItem(TAB_ORDER_KEY)) || []; } catch (e) { }

    const storageKeys = new Set();
    Object.keys(localStorage).forEach(key => {
        if (key !== ACTIVE_TAB_KEY && key !== TAB_ORDER_KEY) storageKeys.add(key);
    });

    const processTabName = (name) => {
        const id = generateTabId();
        tabs.set(id, { name, dirty: false, readonly: false, saveTimer: null, savedRange: null });
        createEditor(id, localStorage.getItem(name), false);
        storageKeys.delete(name);
    };

    savedOrder.forEach((name) => { if (storageKeys.has(name)) processTabName(name); });
    storageKeys.forEach((name) => processTabName(name));

    renderTabBar();

    // 3. Restore Active View (Default to System Tab on first visit)
    const savedActiveName = localStorage.getItem(ACTIVE_TAB_KEY);
    const activeEntry = [...tabs.entries()].find(([_, t]) => t.name === savedActiveName);

    if (activeEntry) switchTab(activeEntry[0]);
    else switchTab(systemTabId);
}

function saveTabOrder() {
    const order = [...tabs.entries()]
        .filter(([id, _]) => id !== systemTabId)
        .map(([_, t]) => t.name);
    localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
}

// Flush dirty tabs before window closes
window.addEventListener('beforeunload', () => {
    tabs.forEach((tab, id) => {
        if (!tab.dirty || tab.readonly) return;
        const div = document.getElementById(id);
        if (div) localStorage.setItem(tab.name, div.innerHTML);
    });
});

// ==========================================================================
// 4. TAB MANAGEMENT & UI RENDERING
// ==========================================================================

function createNewTab(name = null, content = '') {
    const id = generateTabId();
    let tabName = name || id;

    if (isSystemName(tabName)) tabName += '-user';
    if (isTabNameTaken(tabName)) return createNewTab(null, content);

    tabs.set(id, { name: tabName, dirty: false, readonly: false, saveTimer: null, savedRange: null });
    createEditor(id, content, false);
    localStorage.setItem(tabName, content);

    saveTabOrder();
    renderTabBar();
    switchTab(id);
}

function switchTab(id) {
    if (!tabs.has(id)) return;

    // Track previous user tab for the F1 toggle
    if (activeTabId && activeTabId !== systemTabId) {
        previousTabId = activeTabId;
    }

    // Save the current cursor/selection state
    if (activeTabId) {
        const activeDiv = document.getElementById(activeTabId);
        const sel = window.getSelection();

        // Only save if there's a selection and it belongs to the active editor
        if (sel.rangeCount > 0 && activeDiv && activeDiv.contains(sel.anchorNode)) {
            tabs.get(activeTabId).savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    // Swap active classes
    document.getElementById(activeTabId)?.classList.remove('active');
    document.getElementById(id)?.classList.add('active');

    activeTabId = id;
    const newActiveDiv = document.getElementById(id);
    newActiveDiv?.focus();

    // Restore the saved cursor/selection state
    const newTab = tabs.get(id);
    if (newTab && newTab.savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();             // Clear default focus selection
        sel.addRange(newTab.savedRange);   // Apply our saved range
    }

    // Update active tab key in local storage
    if (newTab && !newTab.readonly) {
        localStorage.setItem(ACTIVE_TAB_KEY, newTab.name);
    } else {
        localStorage.removeItem(ACTIVE_TAB_KEY);
    }

    // Update tab bar UI
    document.querySelectorAll('.tab').forEach(tabEl => {
        tabEl.classList.toggle('active', tabEl.dataset.id === activeTabId);
    });
}

function closeTab(id, event) {
    event.stopPropagation();
    const tab = tabs.get(id);
    const div = document.getElementById(id);

    if (div?.innerText.trim().length > 0 && !confirm(`Are you sure you want to close "${tab.name}"?`)) return;

    clearTimeout(tab.saveTimer);
    localStorage.removeItem(tab.name);
    div?.remove();
    tabs.delete(id);

    saveTabOrder();

    if (activeTabId === id) {
        const remaining = getUserTabIds();
        switchTab(remaining.length > 0 ? remaining[remaining.length - 1] : systemTabId);
    }
    renderTabBar();
}

function renameTab(id) {
    const tab = tabs.get(id);
    if (!tab || tab.readonly) return;

    const newName = prompt("Enter new tab name:", tab.name)?.trim();
    if (!newName || newName === tab.name) return;

    if (isSystemName(newName)) {
        alert(`The name "${SYSTEM_TAB_NAME}" is reserved for system documentation.`);
        return;
    }

    if (isTabNameTaken(newName)) {
        alert("A tab with this name already exists.");
        return;
    }

    const div = document.getElementById(id);
    const content = div ? div.innerHTML : localStorage.getItem(tab.name);

    localStorage.removeItem(tab.name);
    localStorage.setItem(newName, content || '');

    clearTimeout(tab.saveTimer);
    tab.dirty = false;
    tab.name = newName;

    if (activeTabId === id) localStorage.setItem(ACTIVE_TAB_KEY, newName);

    saveTabOrder();
    renderTabBar();
}

function renderTabBar() {
    tabContainer.innerHTML = '';
    tabs.forEach((tab, id) => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${id === activeTabId ? 'active' : ''}`;
        tabEl.dataset.id = id;
        if (tab.readonly) tabEl.dataset.readonly = 'true';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tab-name';
        nameSpan.innerText = tab.name;
        if (tab.dirty) nameSpan.classList.add('dirty');

        tabEl.appendChild(nameSpan);

        tabEl.addEventListener('mousedown', e => {
            e.preventDefault();
            switchTab(id);
        });

        // Only add rename and close functions to editable tabs
        if (!tab.readonly) {
            tabEl.addEventListener('dblclick', () => renameTab(id));

            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.innerText = 'x';
            closeBtn.addEventListener('mousedown', e => closeTab(id, e));
            tabEl.appendChild(closeBtn);
        }
        tabContainer.appendChild(tabEl);
    });
}

function updateTabUi(id) {
    const nameSpan = document.querySelector(`.tab[data-id="${id}"] .tab-name`);
    const tab = tabs.get(id);

    if (!nameSpan || !tab) return;
    nameSpan.innerText = tab.name;
    nameSpan.classList.toggle('dirty', tab.dirty);
}

// ==========================================================================
// 5. EDITOR OPERATIONS & EVENTS
// ==========================================================================

function createEditor(id, content, isReadonly) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'editor';
    if (isReadonly) div.classList.add('is-readonly');

    div.contentEditable = isReadonly ? 'false' : 'true';
    div.spellcheck = false;
    div.innerHTML = content;

    if (!isReadonly) {
        div.addEventListener('input', () => {
            const tab = tabs.get(id);
            if (!tab) return;

            if (!tab.dirty) {
                tab.dirty = true;
                updateTabUi(id);
            }

            clearTimeout(tab.saveTimer);

            // Auto-save logic
            tab.saveTimer = setTimeout(() => {
                localStorage.setItem(tab.name, div.innerHTML);
                tab.dirty = false;
                updateTabUi(id);
            }, 5000);
        });
    }

    editorContainer.appendChild(div);
}

function getText() {
    const activeDiv = document.getElementById(activeTabId);
    const tab = tabs.get(activeTabId);
    if (!activeDiv || !tab || tab.readonly) return '';

    const selection = window.getSelection();
    const initialRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    selection.selectAllChildren(activeDiv);
    const text = selection.toString();

    selection.removeAllRanges();
    if (initialRange) selection.addRange(initialRange);
    return text;
}

addTabBtn.addEventListener('click', () => createNewTab());

// ==========================================================================
// 6. GLOBAL SHORTCUTS & FILESYSTEM PIPELINE
// ==========================================================================

const fileHeader = '<div id="contented" style="color: white; background-color: black;">';
const fileFooter = '</div>';

window.addEventListener('keydown', event => {
    // Escape Hatch / System Toggle (F1 or Escape)
    if (event.key === 'F1' || event.key === 'Escape') {
        event.preventDefault();
        if (activeTabId === systemTabId) {
            // Attempt to return to the last used tab, or the first available user tab
            if (previousTabId && tabs.has(previousTabId)) switchTab(previousTabId);
            else {
                const userTabs = getUserTabIds();
                if (userTabs.length > 0) switchTab(userTabs[0]);
            }
        } else {
            switchTab(systemTabId);
        }
        return;
    }

    // Ignore file operations if we are on a readonly tab or not holding Ctrl
    const tab = tabs.get(activeTabId);
    if (!tab || tab.readonly || !event.ctrlKey) return;

    const activeDiv = document.getElementById(activeTabId);
    let filename = tab.name;
    const key = event.key.toLowerCase();

    if (key === 's') {
        event.preventDefault();
        if (event.shiftKey) { // HTML Export (Ctrl + Shift + S)
            if (!/\.html?$/i.test(filename)) filename += '.htm';
            exportFile(filename, fileHeader + activeDiv.innerHTML + fileFooter);
        } else {              // Text Export (Ctrl + S)
            if (!/\.txt$/i.test(filename)) filename += '.txt';
            exportFile(filename, getText());
        }
    } else if (key === 'o') {
        event.preventDefault();
        triggerImportDialog();
    }
});

function exportFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    const tab = tabs.get(activeTabId);
    if (!tab) return;

    clearTimeout(tab.saveTimer);
    tab.dirty = false;
    localStorage.setItem(tab.name, document.getElementById(activeTabId).innerHTML);
    updateTabUi(activeTabId);
}

function triggerImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.htm,.html,.text';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        let cleanName = file.name.replace(/\.[^/.]+$/, "");
        if (isSystemName(cleanName)) cleanName += '-imported';

        if (isTabNameTaken(cleanName)) {
            alert(`A tab named "${cleanName}" is already open.`);
            return;
        }

        try {
            const textContent = await file.text();
            createNewTab(cleanName, '');

            const activeDiv = document.getElementById(activeTabId);
            const currentTab = tabs.get(activeTabId);

            if (textContent.startsWith(fileHeader)) {
                activeDiv.innerHTML = textContent.slice(fileHeader.length, -fileFooter.length);
            } else {
                activeDiv.innerText = textContent;
            }

            localStorage.setItem(currentTab.name, activeDiv.innerHTML);
            currentTab.dirty = false;
            updateTabUi(activeTabId);
        } catch (err) {
            console.error("Failed to parse local file", err);
        }
    };
    input.click();
}

// Bootstrap initialization
init();
