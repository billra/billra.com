// ==========================================================================
// 1. STATE & DOM INITIALIZATION
// ==========================================================================

// Head metadata
document.getElementById('id-version').innerText = document.querySelector('meta[name="version"]').content;

// Core Constants & State
const ACTIVE_TAB_KEY = 'active🐱tab';
const TAB_ORDER_KEY = 'tab🐱order';
const HELP_TAB_ID = 'id-help';
const HELP_TAB_NAME = 'contented';

const tabs = new Map([[HELP_TAB_ID, { name: HELP_TAB_NAME, dirty: false, saveTimer: null }]]);
let activeTabId = HELP_TAB_ID;
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

function getUserTabIds() {
    return [...tabs.keys()].filter(id => id !== HELP_TAB_ID);
}

// ==========================================================================
// 3. BOOTSTRAP & LOCAL STORAGE MANAGEMENT
// ==========================================================================

function init() {
    let savedOrder = [];
    try {
        savedOrder = JSON.parse(localStorage.getItem(TAB_ORDER_KEY)) || [];
    } catch (e) { }

    // Build a set of all valid saved tab names from localStorage
    const storageKeys = new Set();
    Object.keys(localStorage).forEach(key => {
        if (key !== ACTIVE_TAB_KEY && key !== TAB_ORDER_KEY) {
            storageKeys.add(key);
        }
    });

    const processTabName = (name) => {
        const id = generateTabId();
        tabs.set(id, { name, dirty: false, saveTimer: null });
        createEditor(id, localStorage.getItem(name));
        storageKeys.delete(name);
    };

    // Load tabs in strict saved order, then sweep any strays
    savedOrder.forEach((name) => {
        if (storageKeys.has(name)) processTabName(name);
    });
    storageKeys.forEach((name) => processTabName(name));

    renderTabBar();

    // Restore the active view
    const savedActiveName = localStorage.getItem(ACTIVE_TAB_KEY);
    const activeEntry = [...tabs.entries()].find(([_, t]) => t.name === savedActiveName);

    if (activeEntry) switchTab(activeEntry[0]);
    else if (tabs.size > 1) switchTab([...tabs.keys()][1]);
    else createNewTab();
}

function saveTabOrder() {
    const order = [...tabs.entries()]
        .filter(([id, _]) => id !== HELP_TAB_ID)
        .map(([_, t]) => t.name);
    localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
}

// Flush dirty tabs before window closes
window.addEventListener('beforeunload', () => {
    tabs.forEach((tab, id) => {
        if (!tab.dirty || id === HELP_TAB_ID) return;
        const div = document.getElementById(id);
        if (div) localStorage.setItem(tab.name, div.innerHTML);
    });
});

// ==========================================================================
// 4. TAB MANAGEMENT & UI RENDERING
// ==========================================================================

function createNewTab(name = null, content = '') {
    const id = generateTabId();
    const tabName = name || id;

    if (isTabNameTaken(tabName)) return createNewTab(null, content);

    tabs.set(id, { name: tabName, dirty: false, saveTimer: null });
    createEditor(id, content);
    localStorage.setItem(tabName, content);

    saveTabOrder();
    renderTabBar();
    switchTab(id);
}

function switchTab(id) {
    if (!tabs.has(id)) return;

    document.getElementById(activeTabId)?.classList.remove('active');
    document.getElementById(id)?.classList.add('active');

    activeTabId = id;
    document.getElementById(id)?.focus();

    const currentTab = tabs.get(id);
    if (currentTab && id !== HELP_TAB_ID) {
        localStorage.setItem(ACTIVE_TAB_KEY, currentTab.name);
    } else {
        localStorage.removeItem(ACTIVE_TAB_KEY);
    }

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
        switchTab(remaining.length > 0 ? remaining.pop() : HELP_TAB_ID);
    }
    renderTabBar();
}

function renameTab(id) {
    if (id === HELP_TAB_ID) return;
    const tab = tabs.get(id);
    if (!tab) return;

    const newName = prompt("Enter new tab name:", tab.name)?.trim();
    if (!newName || newName === tab.name) return;

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

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tab-name';
        nameSpan.innerText = tab.name;
        if (tab.dirty) nameSpan.classList.add('dirty');

        tabEl.appendChild(nameSpan);

        tabEl.addEventListener('mousedown', e => {
            e.preventDefault();
            switchTab(id);
        });

        if (id !== HELP_TAB_ID) {
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

function createEditor(id, content) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'editor';
    div.contentEditable = 'true';
    div.spellcheck = false;
    div.innerHTML = content;

    div.addEventListener('keydown', e => {
        if (e.key !== 'F1') return;
        e.preventDefault();
        switchTab(HELP_TAB_ID);
    });

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

    editorContainer.appendChild(div);
}

function getText() {
    const activeDiv = document.getElementById(activeTabId);
    if (!activeDiv || activeTabId === HELP_TAB_ID) return '';

    const selection = window.getSelection();
    const initialRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    selection.selectAllChildren(activeDiv);
    const text = selection.toString();

    selection.removeAllRanges();
    if (initialRange) selection.addRange(initialRange);
    return text;
}

// Help Tab keyboard drop-through
document.getElementById(HELP_TAB_ID).addEventListener('keydown', e => {
    if (!e.key.match(/^[\s\S]$/)) return;
    e.preventDefault();
    const userTabs = getUserTabIds();
    if (userTabs.length > 0) switchTab(userTabs.pop());
    else createNewTab();
});

addTabBtn.addEventListener('click', () => createNewTab());

// ==========================================================================
// 6. FILESYSTEM PIPELINE (Import/Export)
// ==========================================================================

const fileHeader = '<div id="contented" style="color: white; background-color: black;">';
const fileFooter = '</div>';

window.addEventListener('keydown', event => {
    if (activeTabId === HELP_TAB_ID || !event.ctrlKey) return;

    const activeDiv = document.getElementById(activeTabId);
    const tab = tabs.get(activeTabId);
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

        const cleanName = file.name.replace(/\.[^/.]+$/, "");

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
            console.error("Failed to parse local file stream context", err);
        }
    };
    input.click();
}

// Bootstrap initialization
init();
