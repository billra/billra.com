// --- Configuration & Constants ---
const CONFIG = {
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220,
    gridSteps: 16 // 16 discrete levels per channel (0 through 15)
};

// --- DOM Elements ---
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d');
const slider = document.getElementById('intensity');
const tLabel = document.getElementById('t-value');
const pointerDisplay = document.getElementById('pointer-display');
const versionSpan = document.getElementById('version');

// --- Inject Version ---
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta && versionSpan) {
    versionSpan.textContent = `v${versionMeta.content}`;
}

// --- Setup High-DPI Canvas ---
const dpr = window.devicePixelRatio || 1;
canvas.width = CONFIG.logicalWidth * dpr;
canvas.height = CONFIG.logicalHeight * dpr;
canvas.style.width = `${CONFIG.logicalWidth}px`;
canvas.style.height = `${CONFIG.logicalHeight}px`;
ctx.scale(dpr, dpr);

// --- Helpers ---
// Converts standard 0-255 RGB values back to 3-digit hex (e.g., #ABC)
function rgbToShortHex(r, g, b) {
    const toHex = (c) => {
        // Divide by 17 to map 0-255 back to 0-15 levels
        const level = Math.round(c / 17);
        return Math.max(0, Math.min(15, level)).toString(16).toUpperCase();
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Rendering Logic ---
let renderPending = false;

function draw() {
    renderPending = false;

    const t = parseFloat(slider.value);
    tLabel.textContent = t.toFixed(2);

    ctx.clearRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - 20;
    const L = CONFIG.edgeLength;

    const axCyan = { x: L * Math.cos(7 * Math.PI / 6), y: L * Math.sin(7 * Math.PI / 6) };
    const axYellow = { x: L * Math.cos(11 * Math.PI / 6), y: L * Math.sin(11 * Math.PI / 6) };
    const axMagenta = { x: L * Math.cos(Math.PI / 2), y: L * Math.sin(Math.PI / 2) };

    const { gridSteps } = CONFIG;

    function drawFace(uAx, vAx, colorFn) {
        for (let i = 0; i < gridSteps; i++) {
            for (let j = 0; j < gridSteps; j++) {
                const u1 = i / gridSteps, u2 = (i + 1) / gridSteps;
                const v1 = j / gridSteps, v2 = (j + 1) / gridSteps;

                const p1 = { x: cx + u1*uAx.x + v1*vAx.x, y: cy + u1*uAx.y + v1*vAx.y };
                const p2 = { x: cx + u2*uAx.x + v1*vAx.x, y: cy + u2*uAx.y + v1*vAx.y };
                const p3 = { x: cx + u2*uAx.x + v2*vAx.x, y: cy + u2*uAx.y + v2*vAx.y };
                const p4 = { x: cx + u1*uAx.x + v2*vAx.x, y: cy + u1*uAx.y + v2*vAx.y };

                // Get the exact 0-15 level for this grid block
                let [r, g, b] = colorFn(i, j);

                // Apply intensity scaling and quantize back to a solid integer level (0-15)
                r = Math.round(r * t);
                g = Math.round(g * t);
                b = Math.round(b * t);

                // Map 0-15 space back up to 0-255 space for the Canvas API
                const dispR = r * 17;
                const dispG = g * 17;
                const dispB = b * 17;

                const colorString = `rgb(${dispR},${dispG},${dispB})`;
                ctx.fillStyle = colorString;
                ctx.strokeStyle = colorString;
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    // 1. Right Face (Red Max) -> spans between Yellow and Magenta
    drawFace(axYellow, axMagenta, (i, j) => [15, 15 - j, 15 - i]);

    // 2. Left Face (Blue Max) -> spans between Cyan and Magenta
    drawFace(axCyan, axMagenta, (i, j) => [15 - i, 15 - j, 15]);

    // 3. Top Face (Green Max) -> spans between Cyan and Yellow
    drawFace(axCyan, axYellow, (i, j) => [15 - i, 15, 15 - j]);
}

// --- Interactive Hover Logic ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const pixelX = Math.round(cssX * dpr);
    const pixelY = Math.round(cssY * dpr);

    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;

    // Check Alpha channel. If it's not fully opaque (255), we are off the cube
    // or on an anti-aliased edge. Hide tooltip to prevent false readings.
    if (pixel[3] < 255) {
        pointerDisplay.style.display = 'none';
        return;
    }

    const hex = rgbToShortHex(pixel[0], pixel[1], pixel[2]);

    pointerDisplay.innerText = hex;
    pointerDisplay.style.display = 'block';
    pointerDisplay.style.left = `${e.clientX + 15}px`;
    pointerDisplay.style.top = `${e.clientY + 15}px`;
});

canvas.addEventListener('mouseleave', () => {
    pointerDisplay.style.display = 'none';
});

// --- Event Handling via requestAnimationFrame ---
function requestRender() {
    if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(draw);
    }
}

// Initialize and bind events
slider.addEventListener('input', requestRender);
requestRender();
