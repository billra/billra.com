// Head metadata initialization
document.getElementById('id-version').innerText = document.querySelector('meta[name="version"]').content;

// Core State (Relying directly on 'id-help' as our system tab anchor)
const ACTIVE_TAB_KEY = 'active🐱tab';
const tabs = new Map([['id-help', { name: 'contented', dirty: false }]]);
let activeTabId = 'id-help';
let tabCounter = 0;
let saveTimer = null;

// DOM Elements
const tabContainer = document.getElementById('tab-container');
const addTabBtn = document.getElementById('add-tab');
const workspaceDiv = document.getElementById('workspace');

// --- Initialization & Local Storage ---
function init() {
    let maxUntitled = 0;

    // Reconstruct tabs directly from localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        // Guard clause: Skip the active tab tracker key
        if (key === ACTIVE_TAB_KEY) continue;

        const name = key;
        const id = `editor-${Date.now()}-${i}`;

        if (name.startsWith('Untitled ')) {
            const num = parseInt(name.replace('Untitled ', ''), 10);
            if (!isNaN(num) && num > maxUntitled) maxUntitled = num;
        }

        tabs.set(id, { name, dirty: false });
        createEditorDiv(id, localStorage.getItem(key));
    }

    tabCounter = maxUntitled;
    renderTabBar();

    // Restore the active view
    const savedActiveName = localStorage.getItem(ACTIVE_TAB_KEY);
    const activeEntry = [...tabs.entries()].find(([_, t]) => t.name === savedActiveName);

    if (activeEntry) {
        switchTab(activeEntry[0]);
    } else if (tabs.size > 1) {
        switchTab([...tabs.keys()][1]); // Switch to the first user-created tab
    } else {
        createNewTab();
    }
}

function saveDirtyTabs() {
    tabs.forEach((tab, id) => {
        if (!tab.dirty || id === 'id-help') return;

        const div = document.getElementById(id);
        if (!div) return;

        localStorage.setItem(tab.name, div.innerHTML);
        tab.dirty = false;
        updateTabPillUi(id);
    });
    console.log('Saved dirty tabs.');
}
window.addEventListener('beforeunload', saveDirtyTabs);

// --- Tab Management ---
function createNewTab(name = null, content = '') {
    tabCounter++;
    const tabName = name || `Untitled ${tabCounter}`;

    if ([...tabs.values()].some(t => t.name === tabName)) {
        return createNewTab(null, content);
    }

    const id = `editor-${Date.now()}`;
    tabs.set(id, { name: tabName, dirty: false });

    createEditorDiv(id, content);
    localStorage.setItem(tabName, content);

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

        if (tab && !tab.dirty) {
            tab.dirty = true;
            updateTabPillUi(id);
        }

        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDirtyTabs, 5000);
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

    // Flattened confirmation prompt
    if (div?.innerText.trim().length > 0 && !confirm(`Are you sure you want to close "${tab.name}"?`)) return;

    localStorage.removeItem(tab.name);
    div?.remove();
    tabs.delete(id);

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

    // Shift file storage to the new key
    const content = localStorage.getItem(tab.name);
    localStorage.removeItem(tab.name);
    localStorage.setItem(newName, content || '');

    tab.name = newName;
    if (activeTabId === id) localStorage.setItem(ACTIVE_TAB_KEY, newName);

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
        titleSpan.innerText = tab.name + (tab.dirty ? ' *' : '');
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
    const pill = document.querySelector(`.tab-pill[data-id="${id}"] .tab-title`);
    const tab = tabs.get(id);

    if (!pill || !tab) return;

    pill.innerText = tab.name + (tab.dirty ? ' *' : '');
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
