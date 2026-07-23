/// --- Configuration & Constants ---
const CONFIG = {
    gridSize: 16
};
CONFIG.totalPixels = CONFIG.gridSize * CONFIG.gridSize;

// --- DOM Element Cache ---
const elements = {
    grid: document.getElementById('grid-container'),
    colorPicker: document.getElementById('colorPicker'),
    pixels: [] // Holds the DOM nodes for instant updates
};

// --- Inject Metadata ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta) document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- State Management ---
// To track array changes seamlessly, we use a nested proxy specifically for the pixel data.
const pixelsProxy = new Proxy(new Array(CONFIG.totalPixels).fill(null), {
    set(target, index, value) {
        if (target[index] === value) return true;
        target[index] = value;

        // Ensure index is a number before attempting DOM lookup
        const numIndex = parseInt(index, 10);
        if (!isNaN(numIndex) && elements.pixels[numIndex]) {
            // Null implies transparent. Otherwise, apply the color string.
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

elements.colorPicker.addEventListener('input', (e) => {
    state.currentColor = e.target.value;
});

// Using event delegation on the grid container for performance
elements.grid.addEventListener('pointerdown', (e) => {
    state.isDrawing = true;
    handlePaint(e); // Paint the first clicked pixel immediately
});

elements.grid.addEventListener('pointerover', handlePaint);

// Bind pointerup to window so dragging outside the grid cleanly stops drawing
window.addEventListener('pointerup', () => {
    state.isDrawing = false;
});

// --- Boot ---
initGrid();
