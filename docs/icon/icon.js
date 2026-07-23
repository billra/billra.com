/// --- Configuration & Constants ---
const CONFIG = {
    gridSize: 16
};
CONFIG.totalPixels = CONFIG.gridSize * CONFIG.gridSize;

// --- DOM Element Cache ---
const elements = {
    grid: document.getElementById('grid-container'),
    colorPicker: document.getElementById('colorPicker'),
    btnEraser: document.getElementById('btn-eraser'),
    pixels: []
};

// --- Inject Metadata ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta) document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- State Management ---
const pixelsProxy = new Proxy(new Array(CONFIG.totalPixels).fill(null), {
    set(target, index, value) {
        if (target[index] === value) return true;
        target[index] = value;

        const numIndex = parseInt(index, 10);
        if (!isNaN(numIndex) && elements.pixels[numIndex]) {
            elements.pixels[numIndex].style.backgroundColor = value || 'transparent';
        }
        return true;
    }
});

const state = new Proxy({
    currentColor: elements.colorPicker.value,
    isDrawing: false,
    pixels: pixelsProxy
}, {
    set(target, property, value) {
        if (target[property] === value) return true;

        target[property] = value;

        // Unidirectional UI update for the active tool
        if (property === 'currentColor') {
            if (value === null) {
                elements.colorPicker.classList.remove('active-tool');
                elements.btnEraser.classList.add('active-tool');
            } else {
                elements.btnEraser.classList.remove('active-tool');
                elements.colorPicker.classList.add('active-tool');
                // Ensure the color picker UI matches the state if set programmatically
                elements.colorPicker.value = value;
            }
        }

        return true;
    }
});

// --- Initialization ---
function initGrid() {
    for (let i = 0; i < CONFIG.totalPixels; i++) {
        const pixel = document.createElement('div');
        pixel.className = 'pixel';
        pixel.dataset.index = i;

        elements.pixels.push(pixel);
        elements.grid.appendChild(pixel);
    }
}

// --- Interaction Handlers ---
const handlePaint = (e) => {
    if (!state.isDrawing) return;

    const target = e.target.closest('.pixel');
    if (target) {
        const index = parseInt(target.dataset.index, 10);
        state.pixels[index] = state.currentColor;
    }
};

// Tool Selection
elements.colorPicker.addEventListener('input', (e) => {
    state.currentColor = e.target.value;
});

// Using 'click' ensures that clicking the color picker when the eraser
// is active immediately switches the mode back to paint.
elements.colorPicker.addEventListener('click', (e) => {
    state.currentColor = e.target.value;
});

elements.btnEraser.addEventListener('click', () => {
    state.currentColor = null;
});

// Grid Painting
elements.grid.addEventListener('pointerdown', (e) => {
    state.isDrawing = true;
    handlePaint(e);
});

elements.grid.addEventListener('pointerover', handlePaint);

window.addEventListener('pointerup', () => {
    state.isDrawing = false;
});

// --- Boot ---
initGrid();
