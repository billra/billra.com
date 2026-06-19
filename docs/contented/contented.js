// === 1. STATE & DOM INITIALIZATION ==========================================

// Unique delimiters in local storage keys prevent collisions with user tab names
const ACTIVE_TAB_KEY = 'active🐱tab';
const TAB_ORDER_KEY = 'tab🐱order';
const SYSTEM_TAB_NAME = 'contented';

// The 'tabs' Map uses strictly increasing integers as keys (e.g., 1, 2, 3),
// and stores user-facing names in the value object.
const tabs = new Map();
let activeTabId = null;
let previousTabId = null; // Powers the F1/Escape rapid-toggle functionality
let systemTabId = null;
let uniqueID = 0;

// DOM Element caching
const tabContainer = document.getElementById('tab-container');
const addTabBtn = document.getElementById('add-tab');
const editorContainer = document.getElementById('editor-container');

// === 2. UTILITY HELPERS =====================================================

/**
 * Returns a strictly increasing integer. Because DOM elements will use
 * prefixes (e.g., 'edit-42', 'tab-42'), internal ID collisions are impossible,
 * decoupling browser rendering from user input.
 * @returns {number}
 */
function generateTabId() {
    return ++uniqueID;
}

function isTabNameTaken(name) {
    return [...tabs.values()].some(t => t.name.toLowerCase() === name.toLowerCase());
}

/**
 * Ensures a requested user-facing tab name is unique, appending
 * a sequential counter (e.g., "notes-2") if collisions exist.
 */
function getUniqueTabName(requestedName) {
    if (!isTabNameTaken(requestedName)) return requestedName;

    let counter = 2;
    while (isTabNameTaken(`${requestedName}-${counter}`)) {
        counter++;
    }

    return `${requestedName}-${counter}`;
}

/**
 * Guardrail to ensure users cannot overwrite or spoof the documentation tab.
 */
function isSystemName(name) {
    return name.toLowerCase() === SYSTEM_TAB_NAME.toLowerCase();
}

function getUserTabIds() {
    return [...tabs.keys()].filter(id => id !== systemTabId);
}

// === 3. BOOTSTRAP & LOCAL STORAGE MANAGEMENT ================================

/**
 * Analyzes local storage to restore previous session state, user tabs,
 * and injects the system documentation tab as the first element.
 */
function init() {
    // 1. Initialize the System Tab (Always leftmost, index 0)
    systemTabId = generateTabId();
    const template = document.getElementById('system-tab-template');

    // Extract version dynamically from HTML meta tag to keep JS decoupled
    const appVersion = document.querySelector('meta[name="version"]')?.content || '1.0';
    const sysContent = template ? template.innerHTML.replace('{{VERSION}}', appVersion) : `<h1>${SYSTEM_TAB_NAME}</h1>`;

    tabs.set(systemTabId, { name: SYSTEM_TAB_NAME, dirty: false, readonly: true, saveTimer: null, savedRange: null });
    createEditor(systemTabId, sysContent, true);

    // 2. Load User Tabs safely (failsafe against corrupted JSON)
    let savedOrder = [];
    try {
        savedOrder = JSON.parse(localStorage.getItem(TAB_ORDER_KEY)) || [];
    } catch (e) {
        console.warn("Tab order data corrupted, falling back to unordered load.");
    }

    // Filter out our internal keys so we only treat user data as tabs
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

    // Restore tabs in their exact previous visual order
    savedOrder.forEach((name) => { if (storageKeys.has(name)) processTabName(name); });
    storageKeys.forEach((name) => processTabName(name));

    renderTabBar();

    // 3. Restore Active View (Default to System Tab on first-ever visit)
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

/**
 * Centralized save routine to prevent duplicated local storage logic
 * and ensure UI state (dirty flags, timers) is always reset consistently.
 * @param {number} id - The internal Map integer ID.
 * @param {string|null} [contentOverride=null] - Optional hardcoded content to save.
 */
function saveTabContent(id, contentOverride = null) {
    const tab = tabs.get(id);
    const div = document.getElementById(`edit-${id}`);
    if (!tab || tab.readonly) return;

    // Use explicit override if provided, otherwise grab current editor HTML
    const contentToSave = contentOverride !== null ? contentOverride : (div ? div.innerHTML : '');
    localStorage.setItem(tab.name, contentToSave);

    clearTimeout(tab.saveTimer);
    tab.dirty = false;
    updateTabUi(id);
}

// Failsafe: Ensure any pending keystrokes are flushed to storage before exit
window.addEventListener('beforeunload', () => {
    tabs.forEach((tab, id) => {
        if (!tab.dirty || tab.readonly) return;
        saveTabContent(id);
    });
});

// === 4. TAB MANAGEMENT & UI RENDERING =======================================

/**
 * Creates a new active workspace, handles naming collisions, and persists it.
 * @param {string|null} name - Optional predefined name (used during imports)
 * @param {string} content - Optional initial HTML content
 */
function createNewTab(name = null, content = '') {
    const id = generateTabId();

    // Ask for the name and let the helper resolve it.
    const tabName = getUniqueTabName(name || 'tab');

    tabs.set(id, { name: tabName, dirty: false, readonly: false, saveTimer: null, savedRange: null });
    createEditor(id, content, false);

    saveTabContent(id, content);
    saveTabOrder();
    renderTabBar();
    switchTab(id);
}

/**
 * Handles the visual transition between editor views and cursor state preservation.
 * @param {number} id - The internal Map integer ID.
 */
function switchTab(id) {
    if (!tabs.has(id)) return;

    // Track previous user tab to enable rapid toggling via F1/Escape
    if (activeTabId && activeTabId !== systemTabId) {
        previousTabId = activeTabId;
    }

    // Preserve cursor state and remove active classes from the outgoing tab
    if (activeTabId) {
        const activeDiv = document.getElementById(`edit-${activeTabId}`);
        const sel = window.getSelection();

        if (sel.rangeCount > 0 && activeDiv && activeDiv.contains(sel.anchorNode)) {
            tabs.get(activeTabId).savedRange = sel.getRangeAt(0).cloneRange();
        }

        document.getElementById(`tab-${activeTabId}`)?.classList.remove('active');
        activeDiv?.classList.remove('active');
    }

    activeTabId = id;

    // Apply active classes and focus to the incoming tab
    const newActiveDiv = document.getElementById(`edit-${id}`);
    document.getElementById(`tab-${id}`)?.classList.add('active');
    newActiveDiv?.classList.add('active');
    newActiveDiv?.focus();

    // Restore cursor position
    const newTab = tabs.get(id);
    if (newTab && newTab.savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(newTab.savedRange);
    }

    // Persist active tab state to survive page reloads
    if (newTab && !newTab.readonly) {
        localStorage.setItem(ACTIVE_TAB_KEY, newTab.name);
    } else {
        localStorage.removeItem(ACTIVE_TAB_KEY);
    }
}

function closeTab(id, event) {
    event.stopPropagation();
    const tab = tabs.get(id);
    const div = document.getElementById(`edit-${id}`);

    // Prevent accidental deletion of unsaved data
    if (div?.innerText.trim().length > 0 && !confirm(`Are you sure you want to close "${tab.name}"?`)) return;

    clearTimeout(tab.saveTimer);
    localStorage.removeItem(tab.name);
    div?.remove();
    tabs.delete(id);

    saveTabOrder();

    // If closing the tab we are currently looking at, gracefully fall back
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

    // We explicitly keep this check here so we can warn the user directly
    // rather than silently altering their input to "contented-2"
    if (isSystemName(newName)) {
        alert(`The name "${SYSTEM_TAB_NAME}" is reserved for system documentation.`);
        return;
    }
    if (isTabNameTaken(newName)) {
        alert("A tab with this name already exists.");
        return;
    }

    const div = document.getElementById(`edit-${id}`);
    const content = div ? div.innerHTML : localStorage.getItem(tab.name);

    localStorage.removeItem(tab.name); // Nuke the old key
    tab.name = newName;                // Update state
    saveTabContent(id, content || ''); // Push through standard pipeline

    if (activeTabId === id) localStorage.setItem(ACTIVE_TAB_KEY, newName);

    saveTabOrder();
    renderTabBar();
}

function renderTabBar() {
    tabContainer.innerHTML = '';
    tabs.forEach((tab, id) => {
        const tabEl = document.createElement('div');
        tabEl.id = `tab-${id}`;
        tabEl.className = `tab ${id === activeTabId ? 'active' : ''}`;
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
    // Target the ID prefix directly
    const nameSpan = document.querySelector(`#tab-${id} .tab-name`);
    const tab = tabs.get(id);

    if (!nameSpan || !tab) return;
    nameSpan.innerText = tab.name;
    nameSpan.classList.toggle('dirty', tab.dirty);
}

// === 5. EDITOR OPERATIONS & EVENTS ==========================================

/**
 * Initializes a new contenteditable div for typing.
 * @param {number} id - The internal Map integer ID.
 * @param {string} content - Raw HTML to populate the editor.
 * @param {boolean} isReadonly - Locks editing (used for System Tab).
 */
function createEditor(id, content, isReadonly) {
    const div = document.createElement('div');
    div.id = `edit-${id}`;
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

            // Debounce save logic: 5000ms balances performance with data safety
            tab.saveTimer = setTimeout(() => saveTabContent(id), 5000);
        });
    }

    editorContainer.appendChild(div);
}

function getText() {
    const activeDiv = document.getElementById(`edit-${activeTabId}`);
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

// === 6. GLOBAL SHORTCUTS & FILESYSTEM PIPELINE ==============================

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

    const activeDiv = document.getElementById(`edit-${activeTabId}`);
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

/**
 * Triggers a silent browser download to save content to the user's hard drive.
 */
function exportFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    saveTabContent(activeTabId);
}

function triggerImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.htm,.html,.text';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        let cleanName = file.name.replace(/\.[^/.]+$/, "");

        try {
            const textContent = await file.text();

            // Pass the name directly. All collision logic (including system name)
            // is safely handled downstream inside createNewTab.
            createNewTab(cleanName, '');

            const activeDiv = document.getElementById(`edit-${activeTabId}`);

            // Detect if the HTML was previously exported by Contented
            if (textContent.startsWith(fileHeader)) {
                activeDiv.innerHTML = textContent.slice(fileHeader.length, -fileFooter.length);
            } else {
                activeDiv.innerText = textContent;
            }

            saveTabContent(activeTabId);
        } catch (err) {
            console.error("Failed to parse local file", err);
        }
    };
    input.click();
}

// Bootstrap initialization
init();
