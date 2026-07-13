// --- Configuration & Constants ---
const CONFIG = {
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220,
    gridSteps: 30,
    marker: {
        targetHex: '#0088FF',
        baseR: 0,
        baseG: 136,
        baseB: 255,
        u: 1.0,           // Cyan axis
        v: 119 / 255      // Magenta axis
    }
};

// --- DOM Elements ---
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d');
const slider = document.getElementById('intensity');
const tLabel = document.getElementById('t-value');

// --- Setup High-DPI Canvas ---
const dpr = window.devicePixelRatio || 1;
canvas.width = CONFIG.logicalWidth * dpr;
canvas.height = CONFIG.logicalHeight * dpr;
canvas.style.width = `${CONFIG.logicalWidth}px`;
canvas.style.height = `${CONFIG.logicalHeight}px`;
ctx.scale(dpr, dpr);

// --- Helpers ---
// Modernized string padding for hex conversion
function rgbToHex(r, g, b) {
    const toHex = (c) => Math.max(0, Math.min(255, Math.round(c)))
                             .toString(16)
                             .padStart(2, '0') // Modern ES2017 feature
                             .toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Rendering Logic ---
let renderPending = false;

function draw() {
    renderPending = false; // Reset the flag

    const t = parseFloat(slider.value);
    tLabel.textContent = t.toFixed(2);

    ctx.clearRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    // Center coordinates
    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - 20;
    const L = CONFIG.edgeLength;

    // The three main axes extending from the central White vertex (Isometric)
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

                // Evaluate color at center of quad
                let [r, g, b] = colorFn((u1+u2)/2, (v1+v2)/2);

                // Apply Intensity scaling
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

    // --- DRAW THE 3 FACES ---
    // 1. Right Face (Red Max) -> spans between Yellow and Magenta
    drawFace(axYellow, axMagenta, (u, v) => [255, 255*(1-v), 255*(1-u)]);

    // 2. Left Face (Blue Max) -> spans between Cyan and Magenta
    drawFace(axCyan, axMagenta, (u, v) => [255*(1-u), 255*(1-v), 255]);

    // 3. Top Face (Green Max) -> spans between Cyan and Yellow
    drawFace(axCyan, axYellow, (u, v) => [255*(1-u), 255, 255*(1-v)]);


    // --- DRAW THE CUSTOM MARKER ---
    const { u: markerU, v: markerV, baseR, baseG, baseB } = CONFIG.marker;

    const markerX = cx + markerU * axCyan.x + markerV * axMagenta.x;
    const markerY = cy + markerU * axCyan.y + markerV * axMagenta.y;

    const markerScaledHex = rgbToHex(baseR * t, baseG * t, baseB * t);

    // Marker circle
    ctx.beginPath();
    ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Marker label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Target ${CONFIG.marker.targetHex} scaled:`, markerX - 20, markerY - 5);
    ctx.fillStyle = '#aaa';
    ctx.fillText(markerScaledHex, markerX - 20, markerY + 13);

    // Connecting line
    ctx.beginPath();
    ctx.moveTo(markerX - 10, markerY);
    ctx.lineTo(markerX - 15, markerY);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- DRAW CENTER WHITE LABEL ---
    const centerScaledHex = rgbToHex(255 * t, 255 * t, 255 * t);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`Center: ${centerScaledHex}`, cx, cy - 10);

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
}

// --- Event Handling via requestAnimationFrame ---
function requestRender() {
    if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(draw);
    }
}

// Initialize and bind events
slider.addEventListener('input', requestRender);
requestRender(); // Initial render
