// persist editor contents across F5 refresh
const editorDiv = document.getElementById('id-editor');
const contentsKey = 'contents';
window.addEventListener('beforeunload', () => {
    localStorage.setItem(contentsKey, editorDiv.innerHTML);
    console.log('editor state saved');
});
const savedState = localStorage.getItem(contentsKey);
if (savedState) {
    editorDiv.innerHTML = savedState;
    console.log('editor state restored');
}
// help section
const helpDiv = document.getElementById('id-help');
helpDiv.style.display = 'none'; // starts not displayed
// menu handling
const menuDiv = document.getElementById('id-menu');
function swapView() {
    // swap help and editor display
    if (editorDiv.style.display === 'none') {
        helpDiv.style.display = 'none';
        editorDiv.style.display = 'block';
        editorDiv.focus();
    } else {
        editorDiv.style.display = 'none';
        helpDiv.style.display = 'block';
        helpDiv.focus();
    }
}
menuDiv.addEventListener('click', swapView);
menuDiv.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        swapView();
    }
});
// focus
function skipBrowserTabstops(event){
    if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        menuDiv.focus();
    }
}
editorDiv.addEventListener('keydown', skipBrowserTabstops);
helpDiv.addEventListener('keydown', skipBrowserTabstops);
menuDiv.addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        if (editorDiv.style.display === 'none') {
            helpDiv.focus();
        } else {
            editorDiv.focus();
        }
    }
});
// preserve editor cursor and selection
editorDiv.focus(); // focus starts on editor
let blurRange = window.getSelection().getRangeAt(0); // initialized
editorDiv.addEventListener('focus', () => {
    // console.log('editorDiv focus, set selection');
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(blurRange);
});
editorDiv.addEventListener('blur', () => {
    // console.log('editorDiv blur, save selection');
    const selection = window.getSelection();
    blurRange = selection.getRangeAt(0);
});
function getText() {
    const selection = window.getSelection();
    if (document.activeElement === editorDiv) { // if editorDiv currently has focus
        // update blurRange so focus restores correct selection
        blurRange = selection.getRangeAt(0);
    } else {
        // required so that selectAllChildren does not trigger
        // a focus event and end up only selecting the blurRange
        editorDiv.focus();
    }
    // the editorDiv will get a focus event here if it does not already have focus
    selection.selectAllChildren(editorDiv);
    // The contenteditable div uses &nbsp; to preserve display spacing.
    // Replace: html '&nbsp' text retrieval correctly returns '\u00A0'
    // (unicode non-breaking space). We almost always want spaces.
    const text = selection.toString().replace(/\u00A0/g, ' ');
    // restore blurRange selection
    selection.removeAllRanges();
    selection.addRange(blurRange);
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
        const html = contentedFileBegin + editorDiv.innerHTML + contentedFileEnd;
        save('content.htm', html);
    }
});
window.addEventListener('keydown', event => {
    // ctrl + 's' (lowercase letter) pressed  -> save as text
    if (event.key === 's' && event.ctrlKey) {
        event.preventDefault();
        const text = getText();
        save('content.txt', text);
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
window.addEventListener('keydown', event => {
    // ctrl + 'o' pressed  -> open file
    if (event.key === 'o' && event.ctrlKey) {
        event.preventDefault();
        loadDialog();
    }
});
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
        editorDiv.innerHTML = html;
        return;
    }
    // text files: undo the getText html '&nbsp' to space conversion
    const strFixed = str
        .replaceAll('\n ', '\n\u00A0') // preserve space after newline
        .replaceAll('  ', ' \u00A0');  // double spaces need nbsp
    // side effect:
    // A line that starts out being '1&nbsp; 2' reconstitutes to '1 &nbsp;2'.
    // Similarly, '1&nbsp; &nbsp;2' reconstitutes to '1 &nbsp; 2'.
    editorDiv.innerText = strFixed;
}
