// update document with head information
document.getElementById('id-version').innerText = document.querySelector('meta[name="version"]').content;
// persist editor contents across F5 refresh
const editDiv = document.getElementById('id-edit');
const contentsKey = 'contents';
function saveEditorContents() {
    localStorage.setItem(contentsKey, editDiv.innerHTML);
    console.log('editor state saved');
}
window.addEventListener('beforeunload', saveEditorContents);
const savedState = localStorage.getItem(contentsKey);
if (savedState) {
    editDiv.innerHTML = savedState;
    console.log('editor state restored');
}
// help section
const helpDiv = document.getElementById('id-help');
helpDiv.style.display = 'none'; // starts not displayed
// button handling
const btnDiv = document.getElementById('id-button');
function swapView() {
    // swap help and editor display
    if (editDiv.style.display === 'none') {
        helpDiv.style.display = 'none';
        editDiv.style.display = 'block';
        editDiv.focus();
    } else {
        editDiv.style.display = 'none';
        helpDiv.style.display = 'block';
        helpDiv.focus();
    }
}
helpDiv.addEventListener('keydown', event => {
    event.preventDefault();
    swapView(); // any key: return to editor
});
btnDiv.addEventListener('click', event => {
    event.preventDefault();
    swapView();
});
btnDiv.addEventListener('mousedown', event => {
    // prevent default selection behavior
    // retain selection in editDiv
    event.preventDefault();
});
btnDiv.addEventListener('keydown', event => {
    // enter and space swaps between help and editor
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        swapView();
    }
    // wrap focus, avoiding browser items
    if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        editDiv.focus(); // only handle editDiv
        // btnDiv will never have focus when helpDiv is displayed
    }
});
let timer;
editDiv.addEventListener('keydown', event => {
    // show contented specific help for F1
    if (event.key === 'F1') {
        event.preventDefault();
        swapView();
        return;
    }
    // wrap focus, avoiding browser items
    if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        btnDiv.focus();
        return;
    }
    // assume we typed a character, editor is dirty
    if (document.title.slice(-1) != '*') {
        document.title += ' *';
    }
    clearTimeout(timer); // reset timer on each keydown
    timer = setTimeout(() => {
        saveEditorContents();
        document.title = document.title.slice(0, -2);
    }, 5000);

});
// preserve editor cursor and selection
editDiv.focus(); // focus starts on editor
function getText() {
    const selection = window.getSelection();
    const initialRange = selection.getRangeAt(0);
    // the editDiv will get a focus event here if it does not already have focus
    selection.selectAllChildren(editDiv);
    // The contenteditable div uses &nbsp; to preserve display spacing.
    // Replace: html '&nbsp' text retrieval correctly returns '\u00A0'
    // (unicode non-breaking space). We almost always want spaces.
    const text = selection.toString().replaceAll('\u00A0', ' ');
    // restore selection
    selection.removeAllRanges();
    selection.addRange(initialRange);
    return text;
}
// filesystem
const contentedFileBegin = '<div id="contented" style="color: white; background-color: black;">';
const contentedFileEnd = '</div>'; // single definition for creation and identification
window.addEventListener('keydown', event => {
    // ctrl + 'S' (capital letter) pressed  -> save as HTML
    if (event.key === 'S' && event.ctrlKey) {
        event.preventDefault();
        // wrapped content can be displayed in browser and recognized as innerHTML when loading
        const html = contentedFileBegin + editDiv.innerHTML + contentedFileEnd;
        save('content.htm', html);
    }
    // ctrl + 's' (lowercase letter) pressed  -> save as text
    if (event.key === 's' && event.ctrlKey) {
        event.preventDefault();
        const text = getText();
        save('content.txt', text);
    }
    // ctrl + 'o' pressed  -> open file
    if (event.key === 'o' && event.ctrlKey) {
        event.preventDefault();
        loadDialog();
    }
});
function save(filename, content) {
    // Files are saved immediately or a dialog is displayed allowing
    // the name to be changed. This behavior is controlled by the browser.
    // Chrome setting: "Ask where to save each file before downloading".
    // FireFox setting: "Always ask you where to save files".
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    link.click();
    URL.revokeObjectURL(url);
}
function loadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.htm,.html,.text';
    input.onchange = () => {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const str = reader.result;
            doLoad(str);
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}
function doLoad(str) {
    if (str.startsWith(contentedFileBegin)) {
        const html = str.slice(contentedFileBegin.length, -contentedFileEnd.length);
        editDiv.innerHTML = html;
        return;
    }
    // text files: undo the getText html '&nbsp' to space conversion
    // see git\aichatcli\prototypes\nbsp.html for test cases
    const strFixed = str
        .replace(/  /g, '\u00A0 ') // in general
        .replace(/  /g, ' \u00A0') // odd count leftovers
        .replace(/(^|\n) /g, '$1\u00A0') // first must be nbsp
        .replace(/ ($|\n)/g, '\u00A0$1'); // last must be nbsp
    editDiv.innerText = strFixed;
}
