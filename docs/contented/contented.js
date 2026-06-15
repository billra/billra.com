// update document with head information
document.getElementById('id-version').innerText = document.querySelector('meta[name="version"]').content;

// Workspace State
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
    // Always ensure the Help tab exists in our state logic
    tabs.push({ id: 'id-help', name: 'contented', isHelp: true });

    let loadedTabs = 0;
    let maxUntitled = 0;

    // 1. Reconstruct tabs from individual localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith('_tab')) {
            const name = key.slice(0, -4); // remove '_tab'

            // Keep track of the highest "Untitled X" to prevent naming collisions on new tabs
            if (name.startsWith('Untitled ')) {
                const num = parseInt(name.replace('Untitled ', ''), 10);
                if (!isNaN(num) && num > maxUntitled) maxUntitled = num;
            }

            const id = `editor-${++loadedTabs}`;
            tabs.push({ id: id, name: name, dirty: false });
            createEditorDiv(id, localStorage.getItem(key));
        }
    }

    tabCounter = maxUntitled; // Resume counter from highest saved state

    // 2. Restore active tab or default to Help
    if (loadedTabs === 0) {
        createNewTab();
    } else {
        const savedActiveName = localStorage.getItem('activeTab');
        const activeMeta = tabs.find(t => t.name === savedActiveName);
        if (activeMeta) {
            switchTab(activeMeta.id);
        } else {
            switchTab('id-help');
        }
    }

    renderTabs();
}

function saveDirtyTabs() {
    // Only save tabs that have been edited
    Array.from(workspaceDiv.children).forEach(div => {
        if (div.getAttribute('contenteditable') !== 'false') {
            const tabMeta = tabs.find(t => t.id === div.id);
            if (tabMeta && tabMeta.dirty) {
                localStorage.setItem(`${tabMeta.name}_tab`, div.innerHTML);
                tabMeta.dirty = false;
            }
        }
    });
    renderTabs(); // clear asterisks
    console.log('Dirty tabs saved to storage');
}
window.addEventListener('beforeunload', saveDirtyTabs);

// --- Tab Management ---
function createNewTab(defaultName = null, initialContent = '') {
    tabCounter++;
    const newName = defaultName || `Untitled ${tabCounter}`;

    // Safety check: Ensure the generated name doesn't already exist
    if (tabs.some(t => t.name === newName)) {
        return createNewTab(null, initialContent); // try the next number
    }

    const newId = `editor-${Date.now()}`; // Unique ID for DOM only
    tabs.push({ id: newId, name: newName, dirty: true });

    createEditorDiv(newId, initialContent);
    // Instantly save the new empty tab to storage so it exists on refresh
    localStorage.setItem(`${newName}_tab`, initialContent);

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
        saveTimer = setTimeout(saveDirtyTabs, 5000);
    });

    workspaceDiv.appendChild(div);
}

function switchTab(id) {
    if (activeTabId) {
        const oldActiveDiv = document.getElementById(activeTabId);
        if (oldActiveDiv) oldActiveDiv.classList.remove('active');
    }

    activeTabId = id;
    const newActiveDiv = document.getElementById(id);
    if (newActiveDiv) {
        newActiveDiv.classList.add('active');
        newActiveDiv.focus();
    }

    // Update active tab in local storage
    const activeMeta = tabs.find(t => t.id === id);
    if (activeMeta && !activeMeta.isHelp) {
        localStorage.setItem('activeTab', activeMeta.name);
    } else {
        localStorage.removeItem('activeTab'); // Unset activeTab defaults to Help on refresh
    }

    renderTabs();
}

function closeTab(id, event) {
    event.stopPropagation();

    const div = document.getElementById(id);
    if (div.innerText.trim().length > 0) {
        if (!confirm("This tab has content. Are you sure you want to close it?")) {
            return;
        }
    }

    const tabMeta = tabs.find(t => t.id === id);

    // 1. Remove from local storage
    localStorage.removeItem(`${tabMeta.name}_tab`);

    // 2. Remove from DOM and state
    div.remove();
    tabs = tabs.filter(t => t.id !== id);

    // 3. Switch view
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
}

function renameTab(id) {
    if (id === 'id-help') return;
    const tabMeta = tabs.find(t => t.id === id);

    const newName = prompt("Enter new tab name:", tabMeta.name);
    if (!newName || newName.trim() === '' || newName.trim() === tabMeta.name) return;

    const cleanedName = newName.trim();

    // Prevent name collisions
    if (tabs.some(t => t.name.toLowerCase() === cleanedName.toLowerCase())) {
        alert("A tab with this name already exists.");
        return;
    }

    const oldName = tabMeta.name;
    tabMeta.name = cleanedName;

    // Migrate storage to the new key
    const content = localStorage.getItem(`${oldName}_tab`);
    localStorage.removeItem(`${oldName}_tab`);
    if (content !== null) {
        localStorage.setItem(`${cleanedName}_tab`, content);
    }

    // Update active tab key if we are renaming the active tab
    if (activeTabId === id) {
        localStorage.setItem('activeTab', cleanedName);
    }

    renderTabs();
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

        pill.addEventListener('mousedown', (e) => {
            e.preventDefault();
            switchTab(t.id);
        });

        if (!t.isHelp) {
            pill.addEventListener('dblclick', () => renameTab(t.id));

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

document.getElementById('id-help').addEventListener('keydown', event => {
    if (event.key.match(/^[\s\S]$/)) {
        event.preventDefault();
        const editors = tabs.filter(t => !t.isHelp);
        if (editors.length > 0) switchTab(editors[editors.length - 1].id);
        else createNewTab();
    }
});

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

// --- Filesystem ---
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

    const tabMeta = tabs.find(t => t.id === activeTabId);
    if (tabMeta) {
        tabMeta.dirty = false;
        // Also force a write to localStorage so the clean state is preserved
        localStorage.setItem(`${tabMeta.name}_tab`, document.getElementById(activeTabId).innerHTML);
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
            // Strip the extension for the tab name
            const tabName = file.name.replace(/\.[^/.]+$/, "");

            // Check if a tab with this name already exists before creating
            if (tabs.some(t => t.name.toLowerCase() === tabName.toLowerCase())) {
                alert(`A tab named "${tabName}" is already open.`);
                return;
            }

            createNewTab(tabName, '');
            doLoad(reader.result);
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

function doLoad(str) {
    const activeDiv = document.getElementById(activeTabId);
    const tabMeta = tabs.find(t => t.id === activeTabId);

    if (str.startsWith(contentedFileBegin)) {
        const html = str.slice(contentedFileBegin.length, -contentedFileEnd.length);
        activeDiv.innerHTML = html;
    } else {
        activeDiv.innerText = str;
    }

    // Save the loaded content to local storage immediately
    localStorage.setItem(`${tabMeta.name}_tab`, activeDiv.innerHTML);
    tabMeta.dirty = false;
    renderTabs();
}

// Bootstrap
init();
