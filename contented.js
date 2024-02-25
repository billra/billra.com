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
editorDiv.focus(); // focus starts on editor
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
// filesystem
window.addEventListener('keydown', event => {
    if (event.key === 's' && event.ctrlKey) {
        event.preventDefault();
        saveHtml();
    }
});
function saveHtml(){
    // Files are saved immediately or a dialog is displayed allowing
    // the name to be changed. This behavior is controlled by the browser.
    // Chrome setting: "Ask where to save each file before downloading".
    // FireFox setting: "Always ask you where to save files".
    const blob=new Blob([editorDiv.innerHTML],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download='content.htm';
    link.style.display='none';
    link.click();
    URL.revokeObjectURL(url);
}