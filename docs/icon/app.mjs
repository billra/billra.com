import dom from './dom.mjs';
import { generateIcons } from './ico.mjs';
import { updateOutputUI } from './output.mjs';

// --- Configuration & Constants ---
const CONFIG = {
    gridSize: 16
};
CONFIG.totalPixels = CONFIG.gridSize * CONFIG.gridSize;

// --- State Variables: The Single Source of Truth ---
// 1024 bytes: [R, G, B, A,  R, G, B, A, ...]
const pixelBuffer = new Uint8ClampedArray(CONFIG.totalPixels * 4);
const pixelView = new DataView(pixelBuffer.buffer); // 32-bit accessor for the buffer

const gridCells = []; // DOM cache for the grid cells

// --- Inject Metadata ---
if (dom.pageTitle) dom.pageTitle.textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta && dom.version) dom.version.textContent = `v${versionMeta.content}`;

// --- UI Updaters ---
function updatePixelUI(pixelIndex, hexColor) {
    if (gridCells[pixelIndex]) {
        gridCells[pixelIndex].style.backgroundColor = hexColor || 'transparent';
    }
}

function updateToolUI(hexColor) {
    if (hexColor === null) {
        dom.colorPicker.classList.remove('active-tool');
        dom.btnEraser.classList.add('active-tool');
    } else {
        dom.btnEraser.classList.remove('active-tool');
        dom.colorPicker.classList.add('active-tool');
        dom.colorPicker.value = hexColor;
    }
}

// Convert #RRGGBB to a single 32-bit unsigned integer: 0xRRGGBBAA
function hexToColor32(hex) {
    if (!hex) return 0x00000000; // Eraser / transparent
    const rgb = parseInt(hex.slice(1), 16);
    // Shift RGB left by 8 bits to make room for 0xFF Alpha, force unsigned
    return ((rgb << 8) | 0xFF) >>> 0;
}

const state = new Proxy({
    currentColor: dom.colorPicker.value,
    currentColor32: hexToColor32(dom.colorPicker.value), // Cache the 32-bit integer
    isDrawing: false
}, {
    set(target, property, value) {
        if (target[property] === value) return true;
        target[property] = value;

        if (property === 'currentColor') {
            const hexColor = value;
            target.currentColor32 = hexToColor32(hexColor);
            updateToolUI(hexColor);
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

        gridCells.push(pixel);
        dom.gridContainer.appendChild(pixel);
    }
}

// --- Painting Logic ---
function setPixel(pixelIndex, color32) {
    const byteOffset = pixelIndex * 4;

    // 1. One fast 32-bit equality check!
    if (pixelView.getUint32(byteOffset) === color32) return;

    // 2. One fast 32-bit assignment!
    pixelView.setUint32(byteOffset, color32);

    // 3. Update the UI
    const hexColor = color32 === 0 ? 'transparent' :
        `#${(color32 >>> 8).toString(16).padStart(6, '0')}`;

    updatePixelUI(pixelIndex, hexColor);
}

// --- File Drag & Drop Handling ---
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

dom.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropzone.classList.add('dragover');
});

dom.dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dom.dropzone.classList.remove('dragover');
});

dom.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
});

dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) processFile(e.target.files[0]);
});

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please drop an image file.");
        return;
    }

    dom.outputPanel.style.display = 'none';
    const formattedSize = file.size.toLocaleString();

    const img = new Image();
    img.onload = () => {
        dom.dropzoneText.innerHTML = `
            <span style="color: #0f0;">Loaded: ${file.name}</span><br>
            ${img.width}x${img.height} pixels • ${formattedSize} bytes
        `;

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, 16, 16);

        // Extract the raw RGBA array from the canvas
        const rgbaData = ctx.getImageData(0, 0, 16, 16).data;

        for (let pixelIndex = 0; pixelIndex < CONFIG.totalPixels; pixelIndex++) {
            const offset = pixelIndex * 4;
            const a = rgbaData[offset + 3];

            if (a < 128) {
                // Transparent threshold
                setPixel(pixelIndex, 0);
            } else {
                const r = rgbaData[offset];
                const g = rgbaData[offset + 1];
                const b = rgbaData[offset + 2];

                // Solid pixel: Shift R, G, B into their respective 32-bit slots, add 0xFF for Alpha, force unsigned
                const color32 = ((r << 24) | (g << 16) | (b << 8) | 0xFF) >>> 0;
                setPixel(pixelIndex, color32);
            }
        }

        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
}

// --- Interaction Handlers ---
const handlePaint = (e) => {
    if (!state.isDrawing) return;
    const target = e.target.closest('.pixel');
    if (target) {
        const pixelIndex = parseInt(target.dataset.index, 10);
        setPixel(pixelIndex, state.currentColor32);
    }
}

dom.colorPicker.addEventListener('input', (e) => state.currentColor = e.target.value);
dom.colorPicker.addEventListener('click', (e) => state.currentColor = e.target.value);
dom.btnEraser.addEventListener('click', () => state.currentColor = null);

dom.gridContainer.addEventListener('pointerdown', (e) => {
    state.isDrawing = true;
    handlePaint(e);
});
dom.gridContainer.addEventListener('pointerover', handlePaint);
window.addEventListener('pointerup', () => state.isDrawing = false);

dom.btnGenerate.addEventListener('click', () => {
    try {
        const rgbaPixels = [];
        for (let i = 0; i < CONFIG.totalPixels; i++) {
            const offset = i * 4;
            rgbaPixels.push({
                r: pixelBuffer[offset],
                g: pixelBuffer[offset + 1],
                b: pixelBuffer[offset + 2],
                a: pixelBuffer[offset + 3]
            });
        }

        const results = generateIcons(rgbaPixels);
        updateOutputUI(results);

    } catch (err) {
        console.error(err);
        alert("An error occurred during generation.");
    }
});

// --- Boot ---
initGrid();
