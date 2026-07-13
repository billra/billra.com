// --- Configuration & Constants ---
const CONFIG = {
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220,
    gridSteps: 30
};

// --- DOM Elements ---
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d');
const slider = document.getElementById('intensity');
const tLabel = document.getElementById('t-value');
const pointerDisplay = document.getElementById('pointer-display');
const versionSpan = document.getElementById('version'); // New

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
function rgbToHex(r, g, b) {
    const toHex = (c) => Math.max(0, Math.min(255, Math.round(c)))
                             .toString(16)
                             .padStart(2, '0')
                             .toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Rendering Logic ---
let renderPending = false;

function draw() {
    renderPending = false;

    const t = parseFloat(slider.value);
    tLabel.textContent = t.toFixed(2);

    // Clears the canvas with transparent black (rgba 0,0,0,0)
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

                let [r, g, b] = colorFn((u1+u2)/2, (v1+v2)/2);
                r *= t; g *= t; b *= t;

                const colorString = `rgb(${r},${g},${b})`;
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

    // 1. Right Face (Red Max)
    drawFace(axYellow, axMagenta, (u, v) => [255, 255*(1-v), 255*(1-u)]);
    // 2. Left Face (Blue Max)
    drawFace(axCyan, axMagenta, (u, v) => [255*(1-u), 255*(1-v), 255]);
    // 3. Top Face (Green Max)
    drawFace(axCyan, axYellow, (u, v) => [255*(1-u), 255, 255*(1-v)]);
}

// --- Interactive Hover Logic ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();

    // Calculate CSS coordinates relative to the canvas element
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Scale to match the internal devicePixelRatio buffer size
    const pixelX = Math.round(cssX * dpr);
    const pixelY = Math.round(cssY * dpr);

    // Read the single pixel data
    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;

    // Check Alpha channel (pixel[3]). If 0, we are hovering outside the drawn hexagon.
    if (pixel[3] === 0) {
        pointerDisplay.style.display = 'none';
        return;
    }

    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    pointerDisplay.innerText = hex;
    pointerDisplay.style.display = 'block';
    // Offset the tooltip slightly from the cursor
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
