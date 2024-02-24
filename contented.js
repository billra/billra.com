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
