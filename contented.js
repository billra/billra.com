// persist editing across F5 refresh
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
const menu = document.querySelector('.menu');
menu.addEventListener('click', event => {
    console.log('Menu clicked:', event);
});
// focus
editorDiv.focus(); // focus starts on editor

editorDiv.addEventListener('keydown', event => {
    if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        menu.focus(); // skip over browser items
    }
});
menu.addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        editorDiv.focus(); // skip over browser items
    }
});