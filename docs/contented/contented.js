// update document with head information
document.getElementById('id-version').innerText = document.querySelector('meta[name="version"]').content;

// Workspace State
const workspaceKey = 'contented_workspace';
let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let saveTimer;

// DOM Elements
const tabContainer = document.getElementById('tab-container');
const addTabBtn = document.getElementById('add-tab');
const workspaceDiv = document.getElementById('workspace');

// --- Initialization & Local Storage ---
function init() {
    const savedState = localStorage.getItem(workspaceKey);
    let parsedState = null;

    if (savedState) {
        try {
            parsedState = JSON.parse(savedState);
        } catch (e) {
            console.error("Could not parse saved workspace", e);
        }
    }

    // Always ensure the Help tab exists in our state logic
    tabs.push({ id: 'id-help', name: 'contented', isHelp: true });

    if (parsedState && parsedState.tabs && parsedState.tabs.length > 0) {
        tabCounter = parsedState.tabCounter || 0;
        parsedState.tabs.forEach(t => {
            tabs.push({ id: t.id, name: t.name, dirty: false });
            createEditorDiv(t.id, t.content);
        });
        switchTab(parsedState.activeTabId || 'id-help');
    } else {
        // First run or empty state
        createNewTab();
    }
    renderTabs();
}

function saveWorkspace() {
    const stateToSave = {
        activeTabId: activeTabId,
        tabCounter: tabCounter,
        tabs: []
    };

    // Build state directly from the DOM using the contenteditable check
    Array.from(workspaceDiv.children).forEach(div => {
        if (div.getAttribute('contenteditable') !== 'false') {
            const tabMeta = tabs.find(t => t.id === div.id);
            if (tabMeta) {
                stateToSave.tabs.push({
                    id: div.id,
                    name: tabMeta.name,
                    content: div.innerHTML
                });
                tabMeta.dirty = false; // clear dirty state
            }
        }
    });

    try {
        localStorage.setItem(workspaceKey, JSON.stringify(stateToSave));
        renderTabs(); // Re-render to clear asterisks
        console.log('Workspace saved');
    } catch (e) {
        console.error("Error saving to localStorage (Quota exceeded?)", e);
    }
}
window.addEventListener('beforeunload', saveWorkspace);

// --- Tab Management ---
function createNewTab(defaultName = null, initialContent = '') {
    tabCounter++;
    const newId = `editor-${tabCounter}`;
    const newName = defaultName || `Untitled ${tabCounter}`;

    tabs.push({ id: newId, name: newName, dirty: false });
    createEditorDiv(newId, initialContent);
    switchTab(newId);
    renderTabs();
}

function createEditorDiv(id, content) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'fill editor-div';
    div.contentEditable = 'true';
    div.spellcheck = false;
    div.innerHTML = content;

    // Keydown listener for the editor
    div.addEventListener('keydown', event => {
        if (event.key === 'F1') {
            event.preventDefault();
            switchTab('id-help');
            return;
        }

        // Mark dirty
        const tabMeta = tabs.find(t => t.id === id);
        if (tabMeta && !tabMeta.dirty && !event.ctrlKey && event.key.length === 1) {
            tabMeta.dirty = true;
            renderTabs();
        }

        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveWorkspace, 5000);
    });

    workspaceDiv.appendChild(div);
}

function switchTab(id) {
    if (activeTabId) {
        const oldActiveDiv = document.getElementById(activeTabId);
        if (oldActiveDiv) {
            oldActiveDiv.classList.remove('active');
        }
    }

    activeTabId = id;
    const newActiveDiv = document.getElementById(id);
    if (newActiveDiv) {
        newActiveDiv.classList.add('active');
        newActiveDiv.focus();
    }
    renderTabs();
}
function closeTab(id, event) {
    event.stopPropagation(); // Prevent switchTab from firing

    const div = document.getElementById(id);
    if (div.innerText.trim().length > 0) {
        if (!confirm("This tab has content. Are you sure you want to close it?")) {
            return;
        }
    }

    // Remove from DOM and state
    div.remove();
    tabs = tabs.filter(t => t.id !== id);

    // If we closed the active tab, switch to the previous one, or Help if none left
    if (activeTabId === id) {
        const remainingEditors = tabs.filter(t => !t.isHelp);
        if (remainingEditors.length > 0) {
            switchTab(remainingEditors[remainingEditors.length - 1].id);
        } else {
            switchTab('id-help');
        }
    } else {
        renderTabs();
    }
    saveWorkspace();
}

function renameTab(id) {
    if (id === 'id-help') return;
    const tabMeta = tabs.find(t => t.id === id);
    const newName = prompt("Enter new tab name:", tabMeta.name);
    if (newName && newName.trim() !== '') {
        tabMeta.name = newName.trim();
        renderTabs();
        saveWorkspace();
    }
}

// --- Render UI ---
function renderTabs() {
    tabContainer.innerHTML = '';

    tabs.forEach(t => {
        const pill = document.createElement('div');
        pill.className = `tab-pill ${t.id === activeTabId ? 'active' : ''}`;

        let displayText = t.name;
        if (t.dirty) displayText += ' *';

        const titleSpan = document.createElement('span');
        titleSpan.innerText = displayText;
        pill.appendChild(titleSpan);

        // Click to switch
        pill.addEventListener('mousedown', (e) => {
            e.preventDefault(); // prevent losing editor focus instantly
            switchTab(t.id);
        });

        // Double click to rename
        if (!t.isHelp) {
            pill.addEventListener('dblclick', () => renameTab(t.id));

            // Close button
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.innerText = 'x';
            closeBtn.addEventListener('mousedown', (e) => closeTab(t.id, e));
            pill.appendChild(closeBtn);
        }

        tabContainer.appendChild(pill);
    });
}

// --- Global Event Listeners ---
addTabBtn.addEventListener('click', () => createNewTab());

// Help div specific key handler
document.getElementById('id-help').addEventListener('keydown', event => {
    if (event.key.match(/^[\s\S]$/)) { // any single character
        event.preventDefault();
        // Switch back to the last active editor, or create one
        const editors = tabs.filter(t => !t.isHelp);
        if (editors.length > 0) switchTab(editors[editors.length - 1].id);
        else createNewTab();
    }
});

// Selection helper
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

// --- Filesystem (Modified for Tabs) ---
const contentedFileBegin = '<div id="contented" style="color: white; background-color: black;">';
const contentedFileEnd = '</div>';

window.addEventListener('keydown', event => {
    if (activeTabId === 'id-help') return;
    const activeDiv = document.getElementById(activeTabId);
    const activeTabMeta = tabs.find(t => t.id === activeTabId);

    // ctrl + 'S' -> save as HTML
    if (event.key === 'S' && event.ctrlKey) {
        event.preventDefault();
        const html = contentedFileBegin + activeDiv.innerHTML + contentedFileEnd;
        let filename = activeTabMeta.name;
        if (!filename.toLowerCase().endsWith('.htm') && !filename.toLowerCase().endsWith('.html')) filename += '.htm';
        save(filename, html);
    }
    // ctrl + 's' -> save as text
    if (event.key === 's' && event.ctrlKey) {
        event.preventDefault();
        const text = getText();
        let filename = activeTabMeta.name;
        if (!filename.toLowerCase().endsWith('.txt')) filename += '.txt';
        save(filename, text);
    }
    // ctrl + 'o' -> open file
    if (event.key === 'o' && event.ctrlKey) {
        event.preventDefault();
        loadDialog();
    }
});

function save(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    link.click();
    URL.revokeObjectURL(url);

    // Clear dirty state on hard save
    const tabMeta = tabs.find(t => t.id === activeTabId);
    if (tabMeta) {
        tabMeta.dirty = false;
        renderTabs();
    }
}

function loadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.htm,.html,.text';
    input.onchange = () => {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            // Create a new tab for the loaded file
            createNewTab(file.name, '');
            doLoad(reader.result);
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

function doLoad(str) {
    const activeDiv = document.getElementById(activeTabId);
    if (str.startsWith(contentedFileBegin)) {
        const html = str.slice(contentedFileBegin.length, -contentedFileEnd.length);
        activeDiv.innerHTML = html;
    } else {
        activeDiv.innerText = str;
    }
    saveWorkspace();
}

// Bootstrap
init();
