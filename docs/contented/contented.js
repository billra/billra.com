// Head metadata initialization
document.getElementById('id-version').innerText = document.querySelector('meta[name="version"]').content;

// Core State
const ACTIVE_TAB_KEY = 'active🐱tab';
const TAB_ORDER_KEY = 'tab🐱order';
const HELP_TAB_NAME = 'contented'; // System tab constant

const tabs = new Map([['id-help', { name: HELP_TAB_NAME, dirty: false, saveTimer: null }]]);
let activeTabId = 'id-help';
let tabCounter = 0;
let uniqueID = 0;

// DOM Elements
const tabContainer = document.getElementById('tab-container');
const addTabBtn = document.getElementById('add-tab');
const workspaceDiv = document.getElementById('workspace');

// --- Initialization & Local Storage ---
function init() {
    let maxUntitled = 0;

    // 1. Get the saved order (if it exists)
    let savedOrder = [];
    try {
        savedOrder = JSON.parse(localStorage.getItem(TAB_ORDER_KEY)) || [];
    } catch (e) { }

    // 2. Build a set of all valid saved tab names from localStorage
    const storageKeys = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== ACTIVE_TAB_KEY && key !== TAB_ORDER_KEY) {
            storageKeys.add(key);
        }
    }

    // 3. Reconstruct tabs based on the saved array
    const processTabName = (name) => {
        uniqueID++;
        const id = `editor-${uniqueID}`;

        if (name.startsWith('Untitled ')) {
            const num = parseInt(name.replace('Untitled ', ''), 10);
            if (!isNaN(num) && num > maxUntitled) maxUntitled = num;
        }

        tabs.set(id, { name, dirty: false, saveTimer: null });
        createEditorDiv(id, localStorage.getItem(name));
        storageKeys.delete(name); // Mark as processed
    };

    // Load tabs in their strict saved order
    savedOrder.forEach((name) => {
        if (storageKeys.has(name)) processTabName(name);
    });

    // 4. Sweep up any un-ordered stray tabs (fallback safety)
    storageKeys.forEach((name) => processTabName(name));

    tabCounter = maxUntitled;
    renderTabBar();

    // Restore the active view
    const savedActiveName = localStorage.getItem(ACTIVE_TAB_KEY);
    const activeEntry = [...tabs.entries()].find(([_, t]) => t.name === savedActiveName);

    if (activeEntry) {
        switchTab(activeEntry[0]);
    } else if (tabs.size > 1) {
        switchTab([...tabs.keys()][1]);
    } else {
        createNewTab();
    }
}

// Helper to keep the master array synced
function saveTabOrder() {
    const order = [...tabs.values()]
        .filter(t => t.name !== HELP_TAB_NAME) // Utilizing the constant here
        .map(t => t.name);

    localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
}

// Flush any tabs that are still ticking when the window is closed
window.addEventListener('beforeunload', () => {
    tabs.forEach((tab, id) => {
        if (!tab.dirty || id === 'id-help') return;

        const div = document.getElementById(id);
        if (div) localStorage.setItem(tab.name, div.innerHTML);
    });
});

// --- Tab Management ---
function createNewTab(name = null, content = '') {
    tabCounter++;
    const tabName = name || `Untitled ${tabCounter}`;

    if ([...tabs.values()].some(t => t.name === tabName)) {
        return createNewTab(null, content);
    }

    uniqueID++;
    const id = `editor-${uniqueID}`;
    tabs.set(id, { name: tabName, dirty: false, saveTimer: null });

    createEditorDiv(id, content);
    localStorage.setItem(tabName, content);

    saveTabOrder();
    renderTabBar();
    switchTab(id);
}

function createEditorDiv(id, content) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'fill editor-div';
    div.contentEditable = 'true';
    div.spellcheck = false;
    div.innerHTML = content;

    div.addEventListener('keydown', e => {
        if (e.key !== 'F1') return;
        e.preventDefault();
        switchTab('id-help');
    });

    div.addEventListener('input', () => {
        const tab = tabs.get(id);
        if (!tab) return;

        if (!tab.dirty) {
            tab.dirty = true;
            updateTabPillUi(id);
        }

        clearTimeout(tab.saveTimer);

        tab.saveTimer = setTimeout(() => {
            localStorage.setItem(tab.name, div.innerHTML);
            tab.dirty = false;
            updateTabPillUi(id);
        }, 5000);
    });

    workspaceDiv.appendChild(div);
}

function switchTab(id) {
    if (!tabs.has(id)) return;

    document.getElementById(activeTabId)?.classList.remove('active');
    document.getElementById(id)?.classList.add('active');

    activeTabId = id;
    document.getElementById(id)?.focus();

    const currentTab = tabs.get(id);
    if (currentTab && id !== 'id-help') {
        localStorage.setItem(ACTIVE_TAB_KEY, currentTab.name);
    } else {
        localStorage.removeItem(ACTIVE_TAB_KEY);
    }

    document.querySelectorAll('.tab-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.id === activeTabId);
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
        const remaining = [...tabs.keys()].filter(k => k !== 'id-help');
        switchTab(remaining.length > 0 ? remaining.pop() : 'id-help');
    }
    renderTabBar();
}

function renameTab(id) {
    if (id === 'id-help') return;

    const tab = tabs.get(id);
    if (!tab) return;

    const newName = prompt("Enter new tab name:", tab.name)?.trim();
    if (!newName || newName === tab.name) return;

    if ([...tabs.values()].some(t => t.name.toLowerCase() === newName.toLowerCase())) {
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

// --- Dynamic UI Rendering ---
function renderTabBar() {
    tabContainer.innerHTML = '';
    tabs.forEach((tab, id) => {
        const pill = document.createElement('div');
        pill.className = `tab-pill ${id === activeTabId ? 'active' : ''}`;
        pill.dataset.id = id;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.innerText = tab.name;
        if (tab.dirty) titleSpan.classList.add('is-dirty');

        pill.appendChild(titleSpan);

        pill.addEventListener('mousedown', e => {
            e.preventDefault();
            switchTab(id);
        });

        if (id !== 'id-help') {
            pill.addEventListener('dblclick', () => renameTab(id));

            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.innerText = 'x';
            closeBtn.addEventListener('mousedown', e => closeTab(id, e));
            pill.appendChild(closeBtn);
        }
        tabContainer.appendChild(pill);
    });
}

function updateTabPillUi(id) {
    const titleSpan = document.querySelector(`.tab-pill[data-id="${id}"] .tab-title`);
    const tab = tabs.get(id);

    if (!titleSpan || !tab) return;

    titleSpan.innerText = tab.name;
    titleSpan.classList.toggle('is-dirty', tab.dirty);
}

// --- Core Native Operations ---
function getText() {
    const activeDiv = document.getElementById(activeTabId);
    if (!activeDiv || activeTabId === 'id-help') return '';

    const selection = window.getSelection();
    const initialRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    selection.selectAllChildren(activeDiv);
    const text = selection.toString();

    selection.removeAllRanges();
    if (initialRange) selection.addRange(initialRange);
    return text;
}

// --- Filesystem Pipeline ---
const fileHeader = '<div id="contented" style="color: white; background-color: black;">';
const fileFooter = '</div>';

window.addEventListener('keydown', event => {
    if (activeTabId === 'id-help' || !event.ctrlKey) return;

    const activeDiv = document.getElementById(activeTabId);
    const tab = tabs.get(activeTabId);
    let filename = tab.name;

    if (event.key === 'S') {
        event.preventDefault();
        if (!/\.html?$/i.test(filename)) filename += '.htm';
        exportFile(filename, fileHeader + activeDiv.innerHTML + fileFooter);
    } else if (event.key === 's') {
        event.preventDefault();
        if (!/\.txt$/i.test(filename)) filename += '.txt';
        exportFile(filename, getText());
    } else if (event.key === 'o') {
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
    updateTabPillUi(activeTabId);
}

function triggerImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.htm,.html,.text';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        if ([...tabs.values()].some(t => t.name.toLowerCase() === cleanName.toLowerCase())) {
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
            updateTabPillUi(activeTabId);
        } catch (err) {
            console.error("Failed to parse local file stream context", err);
        }
    };
    input.click();
}

// Help Tab keyboard drop-through
document.getElementById('id-help').addEventListener('keydown', e => {
    if (!e.key.match(/^[\s\S]$/)) return;

    e.preventDefault();
    const userTabs = [...tabs.keys()].filter(k => k !== 'id-help');

    if (userTabs.length > 0) switchTab(userTabs.pop());
    else createNewTab();
});

addTabBtn.addEventListener('click', () => createNewTab());

// Bootstrap initialization
init();
