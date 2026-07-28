import dom from './elements.mjs';
import { generateIcons } from './ico.mjs';

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
const generatedAssets = { indexedIco: null, indexedPng: null, truecolorIco: null, truecolorPng: null };

/**
 * Safely manages Blob Object URLs to prevent memory leaks during rapid regeneration.
 */
const objectUrlManager = (() => {
    const urls = new Set();
    return {
        create(blob) {
            const url = URL.createObjectURL(blob);
            urls.add(url);
            return url;
        },
        revokeAll() {
            urls.forEach(url => URL.revokeObjectURL(url));
            urls.clear();
        }
    };
})();

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

// --- Magnifier Initialization ---
const magnifier = document.createElement('div');
magnifier.className = 'magnifier';
const magnifierImg = document.createElement('img');
magnifier.appendChild(magnifierImg);
document.body.appendChild(magnifier);

// --- Render Previews ---
function renderPreviews(icoBuffer, containerElement) {
    containerElement.innerHTML = '';
    if (!icoBuffer) return;

    const label = document.createElement('span');
    label.className = 'preview-label';
    label.textContent = '🔍 samples:';
    containerElement.appendChild(label);

    const blob = new Blob([icoBuffer], { type: 'image/x-icon' });
    const url = objectUrlManager.create(blob);
    const backgrounds = ['bg-white', 'bg-grey', 'bg-black', 'bg-red', 'bg-green', 'bg-blue'];

    backgrounds.forEach(bgClass => {
        const box = document.createElement('div');
        box.className = `preview-box ${bgClass}`;

        const img = document.createElement('img');
        img.src = url;

        box.appendChild(img);
        containerElement.appendChild(box);

        box.addEventListener('mouseenter', () => {
            magnifier.style.display = 'block';
            magnifier.className = `magnifier ${bgClass}`;
            magnifierImg.src = url;
        });

        box.addEventListener('mousemove', (e) => {
            magnifier.style.left = `${e.clientX + 15}px`;
            magnifier.style.top = `${e.clientY - 15}px`;
        });

        box.addEventListener('mouseleave', () => {
            magnifier.style.display = 'none';
        });
    });
}

function updateOutputUI({ truecolorResult, indexedResult }) {
    objectUrlManager.revokeAll();

    dom.titleTruecolor.textContent = `Truecolor RGBA: ${truecolorResult.icoBuffer.length} bytes`;
    dom.logTruecolor.textContent = truecolorResult.log;
    renderPreviews(truecolorResult.icoBuffer, dom.previewTruecolor);

    generatedAssets.truecolorIco = truecolorResult.icoBuffer;
    generatedAssets.truecolorPng = truecolorResult.pngBuffer;
    dom.sizeTcIco.textContent = `${truecolorResult.icoBuffer.length.toLocaleString()} bytes`;
    dom.sizeTcPng.textContent = `${truecolorResult.pngBuffer.length.toLocaleString()} bytes`;

    if (indexedResult) {
        dom.titleIndexed.textContent = `Optimized Indexed (${indexedResult.bitDepth}-bit): ${indexedResult.icoBuffer.length} bytes`;
        dom.logIndexed.textContent = indexedResult.log;
        renderPreviews(indexedResult.icoBuffer, dom.previewIndexed);

        generatedAssets.indexedIco = indexedResult.icoBuffer;
        generatedAssets.indexedPng = indexedResult.pngBuffer;
        dom.sizeIdxIco.textContent = `${indexedResult.icoBuffer.length.toLocaleString()} bytes`;
        dom.sizeIdxPng.textContent = `${indexedResult.pngBuffer.length.toLocaleString()} bytes`;

        dom.btnSaveIdxIco.disabled = false;
        dom.btnSaveIdxPng.disabled = false;
    } else {
        dom.titleIndexed.textContent = `Optimized Indexed: N/A`;
        dom.logIndexed.textContent = `Skipped: Image has more than 16 colors.`;
        renderPreviews(null, dom.previewIndexed);

        generatedAssets.indexedIco = null;
        generatedAssets.indexedPng = null;
        dom.sizeIdxIco.textContent = `N/A`;
        dom.sizeIdxPng.textContent = `N/A`;

        dom.btnSaveIdxIco.disabled = true;
        dom.btnSaveIdxPng.disabled = true;
    }

    dom.outputPanel.style.display = 'flex';
}

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

        // The generator now handles everything and gives back the ready-to-display logs and binaries!
        const results = generateIcons(rgbaPixels);
        updateOutputUI(results);

    } catch (err) {
        console.error(err);
        alert("An error occurred during generation.");
    }
});

// --- Save & Download Logic ---
function triggerDownload(data, filename, type) {
    if (!data) return;
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

dom.btnSaveIdxIco.addEventListener('click', () => triggerDownload(generatedAssets.indexedIco, 'favicon-indexed.ico', 'image/x-icon'));
dom.btnSaveIdxPng.addEventListener('click', () => triggerDownload(generatedAssets.indexedPng, 'favicon-indexed.png', 'image/png'));
dom.btnSaveTcIco.addEventListener('click', () => triggerDownload(generatedAssets.truecolorIco, 'favicon-truecolor.ico', 'image/x-icon'));
dom.btnSaveTcPng.addEventListener('click', () => triggerDownload(generatedAssets.truecolorPng, 'favicon-truecolor.png', 'image/png'));

// --- Boot ---
initGrid();
