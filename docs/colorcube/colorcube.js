// --- Configuration & Constants ---
const CONFIG = {
    gridSteps: 16, // 16 discrete levels per channel (0 through 15)

    // These will now be updated dynamically based on window size
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220
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

// --- Setup Responsive High-DPI Canvas ---
const dpr = window.devicePixelRatio || 1;

function handleResize() {
    // 1. Set canvas width to exactly 50% of the viewport width
    CONFIG.logicalWidth = window.innerWidth * 0.5;

    // 2. Set height slightly taller than width to accommodate the isometric
    // hexagon's natural shape, plus a little extra room for the tooltip.
    CONFIG.logicalHeight = CONFIG.logicalWidth * 1.1;

    // 3. Scale the cube's edge length to fill out the canvas.
    // (An isometric hexagon's total width is ~1.732 * L, and height is 2 * L)
    // Setting L to 0.45 means the cube will take up ~78% of the canvas width
    // and 90% of the canvas height, fitting perfectly in the center.
    CONFIG.edgeLength = CONFIG.logicalWidth * 0.45;

    // Apply the new dimensions
    canvas.width = CONFIG.logicalWidth * dpr;
    canvas.height = CONFIG.logicalHeight * dpr;
    canvas.style.width = `${CONFIG.logicalWidth}px`;
    canvas.style.height = `${CONFIG.logicalHeight}px`;

    // Reset transform to avoid compounding scales on resize
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Redraw the canvas with the new sizes
    requestRender();
}

// Listen for window resizing to keep it perfectly at 50%
window.addEventListener('resize', handleResize);

// --- Helpers ---
function rgbToShortHex(r, g, b) {
    const toHex = (c) => {
        const level = Math.round(c / 17);
        return Math.max(0, Math.min(15, level)).toString(16).toUpperCase();
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Rendering Logic ---
let renderPending = false;

function draw() {
    renderPending = false;

    const sliderVal = parseInt(slider.value, 10);
    const t = sliderVal / 15; // Normalize back to 0-1 for the rendering math

    // Convert the 0-15 integer to a Hex string (0-F) for the UI label
    tLabel.textContent = sliderVal.toString(16).toUpperCase();

    ctx.clearRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - (CONFIG.logicalHeight * 0.03); // Scale the vertical offset
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

                let [r, g, b] = colorFn(i, j);

                r = Math.round(r * t);
                g = Math.round(g * t);
                b = Math.round(b * t);

                const dispR = r * 17;
                const dispG = g * 17;
                const dispB = b * 17;

                ctx.fillStyle = `rgb(${dispR},${dispG},${dispB})`;

                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';

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

    drawFace(axYellow, axMagenta, (i, j) => [15, 15 - j, 15 - i]); // Right Face
    drawFace(axCyan, axMagenta, (i, j) => [15 - i, 15 - j, 15]);   // Left Face
    drawFace(axCyan, axYellow, (i, j) => [15 - i, 15, 15 - j]);    // Top Face
}

// --- Interactive Hover Logic ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const pixelX = Math.round(cssX * dpr);
    const pixelY = Math.round(cssY * dpr);

    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;

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

// Initialize
slider.addEventListener('input', requestRender);
handleResize(); // Automatically calls requestRender on the first load
