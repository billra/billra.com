import dom from './dom.mjs';
import { CONFIG } from './config.mjs';
import { generateIcons } from './ico.mjs';
import { updateOutputUI } from './output.mjs';

// --- Configuration Injection ---
document.documentElement.style.setProperty('--grid-size', CONFIG.gridSize);

// --- State Variables: The Single Source of Truth ---
const pixelBuffer = new Uint8ClampedArray(CONFIG.pixelCount * 4);
const pixelView = new DataView(pixelBuffer.buffer);

const gridCells = [];

// --- Inject Metadata ---
if (dom.pageTitle) dom.pageTitle.textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta && dom.version) dom.version.textContent = `v${versionMeta.content}`;

// --- UI Updaters ---
function updatePixelUI(pixelIndex, hexColor) {
    if (gridCells[pixelIndex]) {
        // Using `background` (shorthand) overwrites the CSS background-image checkerboard.
        // If it's an empty string, it removes the inline style, instantly restoring the checkerboard!
        gridCells[pixelIndex].style.background = hexColor || '';
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

function hexToColor32(hex) {
    if (!hex) return 0x00000000;
    const rgb = parseInt(hex.slice(1), 16);
    return ((rgb << 8) | 0xFF) >>> 0;
}

const state = new Proxy({
    currentColor: dom.colorPicker.value,
    currentColor32: hexToColor32(dom.colorPicker.value),
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
    for (let i = 0; i < CONFIG.pixelCount; i++) {
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

    if (pixelView.getUint32(byteOffset) === color32) return;

    // Note: DataView.setUint32 defaults to Big-Endian.
    // This is intentional: writing our (R << 24 | G << 16 | B << 8 | A) color
    // in Big-Endian places R at offset+0, G at offset+1, B at offset+2, and A at offset+3,
    // which matches the byte order for the sequential array reads during PNG generation.
    pixelView.setUint32(byteOffset, color32);

    const hexColor = color32 === 0 ? null :
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
        canvas.width = CONFIG.gridSize;
        canvas.height = CONFIG.gridSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, CONFIG.gridSize, CONFIG.gridSize);

        const rgbaData = ctx.getImageData(0, 0, CONFIG.gridSize, CONFIG.gridSize).data;

        for (let pixelIndex = 0; pixelIndex < CONFIG.pixelCount; pixelIndex++) {
            const offset = pixelIndex * 4;
            const a = rgbaData[offset + 3];

            if (a < 128) {
                setPixel(pixelIndex, 0);
            } else {
                const r = rgbaData[offset];
                const g = rgbaData[offset + 1];
                const b = rgbaData[offset + 2];

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
        for (let i = 0; i < CONFIG.pixelCount; i++) {
            // Safe to read sequentially because setPixel wrote in Big-Endian
            const offset = i * 4;
            rgbaPixels.push({
                r: pixelBuffer[offset],
                g: pixelBuffer[offset + 1],
                b: pixelBuffer[offset + 2],
                a: pixelBuffer[offset + 3]
            });
        }

        const results = generateIcons(rgbaPixels, CONFIG.gridSize);
        updateOutputUI(results);

    } catch (err) {
        console.error(err);
        alert("An error occurred during generation.");
    }
});

// --- Boot ---
initGrid();
