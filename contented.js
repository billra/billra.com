// persist editor contents across F5 refresh
const editorDiv = document.querySelector('.editor');
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
// menu handling
const menuDiv = document.querySelector('.menu');
menuDiv.addEventListener('click', event => {
    console.log('Menu clicked:', event);
});
// focus
editorDiv.addEventListener('keydown', event => {
    if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        menuDiv.focus(); // skip over browser items
    }
});
menuDiv.addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        editorDiv.focus(); // skip over browser items
    }
});


editorDiv.focus(); // focus starts on editor
let blurRange = window.getSelection().getRangeAt(0); // initialized
editorDiv.addEventListener('focus', () => {
    console.log('editorDiv focus, set selection');
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(blurRange);
});
editorDiv.addEventListener('blur', () => {
    console.log('editorDiv blur, save selection');
    const selection = window.getSelection();
    blurRange = selection.getRangeAt(0);
});
function getText() {
    // The contenteditable div uses &nbsp; to preserve display spacing.
    // Replace: html '&nbsp' text retrieval correctly returns '\u00A0'
    // (unicode non-breaking space). We almost always want spaces.
    const selection = window.getSelection();
    // if editorDiv currently has focus, we must update blurRange to latest selection
    if (document.activeElement === editorDiv) {
        blurRange = selection.getRangeAt(0);
    } else {
        editorDiv.focus();
    }
    selection.selectAllChildren(editorDiv); // editor div would get focus event here if it did not already have focus
    const text = selection.toString().replace(/\u00A0/g, ' ');
    selection.removeAllRanges();
    selection.addRange(blurRange);
    return text;
}


// filesystem
window.addEventListener('keydown', event => {
    // ctrl + 'S' (capital letter) pressed  -> save as HTML
    if (event.key === 'S' && event.ctrlKey) {
        event.preventDefault();
        // wrapped content can be displayed in browser and recognized as innerHTML when loading
        const html = '<div id="contented" style="color: white; background-color: black;">' + editorDiv.innerHTML + '</div>';
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
