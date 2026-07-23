import pako from 'https://esm.sh/pako@2.2.0';

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
    btnGenerate: document.getElementById('btn-generate'),
    outputPanel: document.getElementById('output-panel'),
    outputLog: document.getElementById('output-log'),
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

        if (property === 'currentColor') {
            if (value === null) {
                elements.colorPicker.classList.remove('active-tool');
                elements.btnEraser.classList.add('active-tool');
            } else {
                elements.btnEraser.classList.remove('active-tool');
                elements.colorPicker.classList.add('active-tool');
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

elements.colorPicker.addEventListener('input', (e) => state.currentColor = e.target.value);
elements.colorPicker.addEventListener('click', (e) => state.currentColor = e.target.value);
elements.btnEraser.addEventListener('click', () => state.currentColor = null);

elements.grid.addEventListener('pointerdown', (e) => {
    state.isDrawing = true;
    handlePaint(e);
});
elements.grid.addEventListener('pointerover', handlePaint);
window.addEventListener('pointerup', () => state.isDrawing = false);

// --- Generation Logic ---

// Helper to convert hex string "#ff0000" or null to RGBA
function parseColor(val) {
    if (val === null) return { r: 0, g: 0, b: 0, a: 0 };
    const r = parseInt(val.substr(1, 2), 16);
    const g = parseInt(val.substr(3, 2), 16);
    const b = parseInt(val.substr(5, 2), 16);
    return { r, g, b, a: 255 };
}

// Helper to format bytes for the log
const toHex = (val, bytes = 1) => val.toString(16).padStart(bytes * 2, '0');

elements.btnGenerate.addEventListener('click', () => {
    try {
        const palette = [];
        let transparentIndex = -1;

        const findColor = (r, g, b, a) => palette.findIndex(c => c.r === r && c.g === g && c.b === b && c.a === a);

        // 1. Build Palette directly from State Array
        for (let i = 0; i < CONFIG.totalPixels; i++) {
            const { r, g, b, a } = parseColor(state.pixels[i]);
            let idx = findColor(r, g, b, a);

            if (idx === -1) {
                if (palette.length >= 16) {
                    alert("Error: 16x16 4-bit ICOs support a maximum of 16 colors. Please reduce your palette.");
                    return;
                }

                if (a < 255 && transparentIndex === -1) {
                    palette.unshift({ r, g, b, a });
                    transparentIndex = 0;
                } else {
                    palette.push({ r, g, b, a });
                }
            }
        }

        // Handle empty canvas edge case (force at least 1 transparent color)
        if (palette.length === 0) {
            palette.push({ r: 0, g: 0, b: 0, a: 0 });
            transparentIndex = 0;
        }

        // 2. Pack 4-bit Pixels
        const packedPixels = new Uint8Array(16 * 9);
        let writePos = 0;

        for (let y = 0; y < 16; y++) {
            packedPixels[writePos++] = 0; // PNG Filter: None
            for (let x = 0; x < 16; x += 2) {
                const p1 = parseColor(state.pixels[y * 16 + x]);
                const p2 = parseColor(state.pixels[y * 16 + (x + 1)]);

                const p1Idx = findColor(p1.r, p1.g, p1.b, p1.a);
                const p2Idx = findColor(p2.r, p2.g, p2.b, p2.a);

                packedPixels[writePos++] = (p1Idx << 4) | p2Idx;
            }
        }

        // 3. Compress
        const compressedData = pako.deflate(packedPixels, { level: 9, strategy: 2 });

        // 4. Build PNG Chunks
        const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        const ihdrData = new Uint8Array(13);
        const ihdrView = new DataView(ihdrData.buffer);
        ihdrView.setUint32(0, 16, false);
        ihdrView.setUint32(4, 16, false);
        ihdrData[8] = 4; // 4-bit depth
        ihdrData[9] = 3; // Indexed color
        const ihdrChunk = createChunk('IHDR', ihdrData);

        const plteData = new Uint8Array(palette.length * 3);
        palette.forEach((c, i) => {
            plteData[i*3] = c.r; plteData[i*3+1] = c.g; plteData[i*3+2] = c.b;
        });
        const plteChunk = createChunk('PLTE', plteData);

        let trnsChunk = new Uint8Array(0);
        if (transparentIndex === 0) {
            trnsChunk = createChunk('tRNS', new Uint8Array([palette[0].a]));
        }

        const idatChunk = createChunk('IDAT', compressedData);
        const iendChunk = createChunk('IEND', new Uint8Array(0));

        // 5. Assemble PNG
        const chunks = [pngSignature, ihdrChunk, plteChunk, trnsChunk, idatChunk, iendChunk];
        const pngPayloadSize = chunks.reduce((sum, c) => sum + c.length, 0);
        const pngPayload = new Uint8Array(pngPayloadSize);
        let offset = 0;
        chunks.forEach(c => {
            pngPayload.set(c, offset);
            offset += c.length;
        });

        // 6. Assemble ICO File
        const finalIco = new Uint8Array(22 + pngPayloadSize);
        const icoView = new DataView(finalIco.buffer);

        icoView.setUint16(0, 0, true);
        icoView.setUint16(2, 1, true);
        icoView.setUint16(4, 1, true);
        finalIco[6] = 16;
        finalIco[7] = 16;
        finalIco[8] = palette.length;
        finalIco[9] = 0;
        icoView.setUint16(10, 1, true);
        icoView.setUint16(12, 4, true);
        icoView.setUint32(14, pngPayloadSize, true);
        icoView.setUint32(18, 22, true);

        finalIco.set(pngPayload, 22);

        // 7. Output Breakdown Log
        let log = `File Size: ${finalIco.length} bytes\n`;
        log += `Colors Used: ${palette.length}/16\n\n`;
        log += `--- ICO HEADER (22 Bytes) ---\n`;
        log += `- ${toHex(finalIco[0])} ${toHex(finalIco[1])}: Reserved\n`;
        log += `- ${toHex(finalIco[2])} ${toHex(finalIco[3])}: Type = 1 (icon)\n`;
        log += `- ${toHex(finalIco[4])} ${toHex(finalIco[5])}: Image count = 1\n`;
        log += `- ${toHex(finalIco[6])}: Width = 16\n`;
        log += `- ${toHex(finalIco[7])}: Height = 16\n`;
        log += `- ${toHex(finalIco[8])}: Color count = ${palette.length}\n`;
        log += `- ${toHex(finalIco[9])}: Reserved\n`;
        log += `- ${toHex(finalIco[10])} ${toHex(finalIco[11])}: Planes = 1\n`;
        log += `- ${toHex(finalIco[12])} ${toHex(finalIco[13])}: Bit count = 4\n`;
        log += `- ${toHex(icoView.getUint32(14, true), 4)}: Image data size = 0x${toHex(pngPayloadSize, 4)} = ${pngPayloadSize} bytes\n`;
        log += `- ${toHex(icoView.getUint32(18, true), 4)}: Offset to image = 0x16 = 22 bytes\n\n`;

        log += `--- PNG PAYLOAD (${pngPayloadSize} Bytes) ---\n`;
        log += `- Signature: 8 bytes\n`;
        log += `- IHDR Chunk: ${ihdrChunk.length} bytes\n`;
        log += `- PLTE Chunk: ${plteChunk.length} bytes\n`;
        if (trnsChunk.length > 0) log += `- tRNS Chunk: ${trnsChunk.length} bytes\n`;
        log += `- IDAT Chunk: ${idatChunk.length} bytes (Compressed Data)\n`;
        log += `- IEND Chunk: ${iendChunk.length} bytes\n`;

        elements.outputLog.textContent = log;
        elements.outputPanel.style.display = 'block';

        // 8. Trigger Download
        const blob = new Blob([finalIco], { type: 'image/x-icon' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'icon.ico';
        a.click();

    } catch (err) {
        console.error(err);
        alert("An error occurred during generation.");
    }
});

// --- Utilities ---
function createChunk(type, data) {
    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(type, data), false);
    return chunk;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    crcTable[i] = c;
}

function crc32(type, data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < 4; i++) crc = crcTable[(crc ^ type.charCodeAt(i)) & 0xFF] ^ (crc >>> 8);
    for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Boot ---
initGrid();
