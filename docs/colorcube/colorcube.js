// --- Configuration & Constants ---
const CONFIG = {
    // Dynamic dimensions updated on window resize
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220
};

// --- DOM Elements ---
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
    CONFIG.logicalWidth = window.innerWidth * 0.5;
    CONFIG.logicalHeight = CONFIG.logicalWidth * 1.1;

    // The maximum possible edge length at N = 15
    CONFIG.edgeLength = CONFIG.logicalWidth * 0.45;

    canvas.width = CONFIG.logicalWidth * dpr;
    canvas.height = CONFIG.logicalHeight * dpr;
    canvas.style.width = `${CONFIG.logicalWidth}px`;
    canvas.style.height = `${CONFIG.logicalHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    requestRender();
}

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

    // N represents both the color intensity ceiling AND the grid size
    const N = parseInt(slider.value, 10);
    tLabel.textContent = N.toString(16).toUpperCase();

    ctx.clearRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    // If N is 0, we draw nothing (collapses to an empty canvas)
    if (N === 0) return;

    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - (CONFIG.logicalHeight * 0.03);

    // Shrink the physical scale of the axis lines proportionally to N!
    // Since N maxes out at 15, we scale the overall dimension by N / 15.
    const L = CONFIG.edgeLength * (N / 15);

    const axCyan = { x: L * Math.cos(7 * Math.PI / 6), y: L * Math.sin(7 * Math.PI / 6) };
    const axYellow = { x: L * Math.cos(11 * Math.PI / 6), y: L * Math.sin(11 * Math.PI / 6) };
    const axMagenta = { x: L * Math.cos(Math.PI / 2), y: L * Math.sin(Math.PI / 2) };

    function drawFace(uAx, vAx, colorFn) {
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                // Since N steps make up the dynamic size of the face,
                // we divide by N to find coordinate percentages.
                const u1 = i / N, u2 = (i + 1) / N;
                const v1 = j / N, v2 = (j + 1) / N;

                const p1 = { x: cx + u1*uAx.x + v1*vAx.x, y: cy + u1*uAx.y + v1*vAx.y };
                const p2 = { x: cx + u2*uAx.x + v1*vAx.x, y: cy + u2*uAx.y + v1*vAx.y };
                const p3 = { x: cx + u2*uAx.x + v2*vAx.x, y: cy + u2*uAx.y + v2*vAx.y };
                const p4 = { x: cx + u1*uAx.x + v2*vAx.x, y: cy + u1*uAx.y + v2*vAx.y };

                // Fetch raw channels (0 to N) without complex mapping math
                const [r, g, b] = colorFn(i, j);

                // Convert pure integer level to the standard 0-255 scale
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

    // Now, color coordinates run exactly from 0 up to N!
    // Since N is the maximum channel value on the outer edges,
    // we substitute '15' with 'N' in the mapping functions.
    drawFace(axYellow, axMagenta, (i, j) => [N, N - j, N - i]); // Right Face
    drawFace(axCyan, axMagenta, (i, j) => [N - i, N - j, N]);   // Left Face
    drawFace(axCyan, axYellow, (i, j) => [N - i, N, N - j]);    // Top Face
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
handleResize();
