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
const zoomCheckbox = document.getElementById('zoom');
const pointerDisplay = document.getElementById('pointer-display');
const coreSampleContainer = document.getElementById('core-sample');

// --- State Management ---
let currentN = 15;
let baseRay = [15, 15, 15]; // Defaults to the White/Grayscale neutral axis

// --- Inject Title and Version ---
document.getElementById('page-title').textContent = document.title;

const versionMeta = document.querySelector('meta[name="version"]');
document.getElementById('version').textContent = `v${versionMeta.content}`;

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

// --- Rendering the Core Sample (Replaces Slider) ---
function renderCoreSample() {
    coreSampleContainer.innerHTML = '';

    // Loop from 15 down to 0 so White/Max Color is at the top
    for (let i = 15; i >= 0; i--) {
        // Extrapolate the exact integer color for this step of the ray
        const r = Math.round((baseRay[0] * i) / 15);
        const g = Math.round((baseRay[1] * i) / 15);
        const b = Math.round((baseRay[2] * i) / 15);

        const block = document.createElement('div');
        block.className = 'core-block';

        // Add the tactile "pop" class if it matches the current intensity
        if (i === currentN) {
            block.classList.add('active-level');
        }

        const hexColor = rgbToShortHex(r * 17, g * 17, b * 17);
        block.style.backgroundColor = hexColor;
        block.title = `${hexColor} (Level ${i})`; // Tooltip on hover

        // Clicking a block scales the cube to that intensity
        block.addEventListener('click', () => {
            currentN = i;
            renderCoreSample(); // Re-render to move the active "pop"
            requestRender();    // Re-draw the 2D canvas
        });

        coreSampleContainer.appendChild(block);
    }
}

// --- Rendering Logic ---
let renderPending = false;

function draw() {
    renderPending = false;

    // N represents both the color intensity ceiling AND the grid size
    const N = currentN;

    ctx.clearRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - (CONFIG.logicalHeight * 0.03);

    // Check the state of the zoom toggle
    const isZoomed = zoomCheckbox.checked;

    // If zoomed, lock the edge length to maximum.
    // Otherwise, shrink it proportionally to N.
    const L = isZoomed ? CONFIG.edgeLength : (CONFIG.edgeLength * (N / 15));

    const axCyan = { x: L * Math.cos(7 * Math.PI / 6), y: L * Math.sin(7 * Math.PI / 6) };
    const axYellow = { x: L * Math.cos(11 * Math.PI / 6), y: L * Math.sin(11 * Math.PI / 6) };
    const axMagenta = { x: L * Math.cos(Math.PI / 2), y: L * Math.sin(Math.PI / 2) };

    function drawFace(uAx, vAx, colorFn) {
        // A hex scale from 0 to N has N + 1 distinct steps
        const steps = N + 1;

        // Loop up to AND INCLUDING N
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= N; j++) {
                // Calculate percentages based on the total number of steps
                const u1 = i / steps, u2 = (i + 1) / steps;
                const v1 = j / steps, v2 = (j + 1) / steps;

                const p1 = { x: cx + u1*uAx.x + v1*vAx.x, y: cy + u1*uAx.y + v1*vAx.y };
                const p2 = { x: cx + u2*uAx.x + v1*vAx.x, y: cy + u2*uAx.y + v1*vAx.y };
                const p3 = { x: cx + u2*uAx.x + v2*vAx.x, y: cy + u2*uAx.y + v2*vAx.y };
                const p4 = { x: cx + u1*uAx.x + v2*vAx.x, y: cy + u1*uAx.y + v2*vAx.y };

                // Fetch raw channels (0 to N)
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

// --- Interactive Click Logic (Ray Selection) ---
canvas.addEventListener('click', (e) => {
    // If the cube is entirely black (N=0), a ray cannot be mathematically calculated.
    if (currentN === 0) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const pixelX = Math.round(cssX * dpr);
    const pixelY = Math.round(cssY * dpr);

    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;

    // Ignore clicks on the transparent background
    if (pixel[3] < 255) return;

    // Convert raw 0-255 pixel data to our 0-15 hex steps
    const r = Math.round(pixel[0] / 17);
    const g = Math.round(pixel[1] / 17);
    const b = Math.round(pixel[2] / 17);

    // Mathematics of the Ray: Extrapolate the base color at the N=15 boundary
    baseRay[0] = Math.min(15, Math.max(0, Math.round((r * 15) / currentN)));
    baseRay[1] = Math.min(15, Math.max(0, Math.round((g * 15) / currentN)));
    baseRay[2] = Math.min(15, Math.max(0, Math.round((b * 15) / currentN)));

    // Rebuild the core sample UI with the new ray path
    renderCoreSample();
});

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

// --- Interactive Scroll Logic (Global) ---
window.addEventListener('wheel', (e) => {
    // Prevent the default browser scrolling behavior globally
    e.preventDefault();

    // e.deltaY is negative when scrolling up, positive when scrolling down
    if (e.deltaY < 0 && currentN < 15) {
        currentN++;     // Scroll up -> Increase intensity
    } else if (e.deltaY > 0 && currentN > 0) {
        currentN--;     // Scroll down -> Decrease intensity
    } else {
        return;         // Stop execution if we hit the min/max limits
    }

    renderCoreSample(); // Update the visual pop on the core
    requestRender();    // Redraw the 3D cube
}, { passive: false }); // passive: false is required to allow preventDefault()

// --- Event Handling via requestAnimationFrame ---
function requestRender() {
    if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(draw);
    }
}

// Initialize
zoomCheckbox.addEventListener('change', requestRender);
renderCoreSample(); // Build the initial grayscale core
handleResize();     // Size the canvas and trigger the first draw
