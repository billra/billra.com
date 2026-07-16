/// --- Configuration & Constants ---
const CONFIG = {
    // Dynamic dimensions updated on window resize
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220,
    LEVELS: 16, // Change to 8, 32, 64, etc. to scale the entire application
    get MAX_LEVEL() { return this.LEVELS - 1; },
    get MULTIPLIER() { return 255 / this.MAX_LEVEL; }
};

// --- State Management ---
let currentLevel = CONFIG.MAX_LEVEL;
let baseRay = [15, 7, 0];

// --- DOM Elements ---
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const zoomCheckbox = document.getElementById('zoom');
const pointerDisplay = document.getElementById('pointer-display');
const coreSampleContainer = document.getElementById('core-sample');

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

// --- Rendering the Core Sample ---
function renderCoreSample() {
    coreSampleContainer.innerHTML = '';

    // Loop from MAX_LEVEL down to 0 so White/Max Color is at the top
    for (let i = CONFIG.MAX_LEVEL; i >= 0; i--) {
        // Extrapolate the exact integer color for this step of the ray
        const r = Math.round((baseRay[0] * i) / CONFIG.MAX_LEVEL);
        const g = Math.round((baseRay[1] * i) / CONFIG.MAX_LEVEL);
        const b = Math.round((baseRay[2] * i) / CONFIG.MAX_LEVEL);

        const block = document.createElement('div');
        block.className = 'core-block';

        // Add the tactile "pop" class if it matches the current level
        if (i === currentLevel) {
            block.classList.add('active-level');
        }

        const hexColor = rgbToShortHex(r * CONFIG.MULTIPLIER, g * CONFIG.MULTIPLIER, b * CONFIG.MULTIPLIER);
        block.style.backgroundColor = hexColor;
        block.title = `${hexColor} (Level ${i})`; // Tooltip on hover

        // Clicking a block scales the cube to that intensity
        block.addEventListener('click', () => {
            currentLevel = i;
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

    // level represents both the color intensity ceiling AND the grid size
    const level = currentLevel;

    ctx.clearRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - (CONFIG.logicalHeight * 0.03);

    // Check the state of the zoom toggle
    const isZoomed = zoomCheckbox.checked;

    // If zoomed, lock the edge length to maximum.
    // Otherwise, shrink it proportionally to the current level.
    const L = isZoomed ? CONFIG.edgeLength : (CONFIG.edgeLength * (level / CONFIG.MAX_LEVEL));

    const axCyan = { x: L * Math.cos(7 * Math.PI / 6), y: L * Math.sin(7 * Math.PI / 6) };
    const axYellow = { x: L * Math.cos(11 * Math.PI / 6), y: L * Math.sin(11 * Math.PI / 6) };
    const axMagenta = { x: L * Math.cos(Math.PI / 2), y: L * Math.sin(Math.PI / 2) };

    function drawFace(uAx, vAx, colorFn) {
        // A scale from 0 to level has level + 1 distinct steps
        const steps = level + 1;

        // Loop up to AND INCLUDING level
        for (let i = 0; i <= level; i++) {
            for (let j = 0; j <= level; j++) {
                // Calculate percentages based on the total number of steps
                const u1 = i / steps, u2 = (i + 1) / steps;
                const v1 = j / steps, v2 = (j + 1) / steps;

                const p1 = { x: cx + u1*uAx.x + v1*vAx.x, y: cy + u1*uAx.y + v1*vAx.y };
                const p2 = { x: cx + u2*uAx.x + v1*vAx.x, y: cy + u2*uAx.y + v1*vAx.y };
                const p3 = { x: cx + u2*uAx.x + v2*vAx.x, y: cy + u2*uAx.y + v2*vAx.y };
                const p4 = { x: cx + u1*uAx.x + v2*vAx.x, y: cy + u1*uAx.y + v2*vAx.y };

                // Fetch raw channels (0 to level)
                const [r, g, b] = colorFn(i, j);

                // Convert pure integer level to the standard 0-255 scale
                const dispR = r * CONFIG.MULTIPLIER;
                const dispG = g * CONFIG.MULTIPLIER;
                const dispB = b * CONFIG.MULTIPLIER;

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

    // Now, color coordinates run exactly from 0 up to level!
    drawFace(axYellow, axMagenta, (i, j) => [level, level - j, level - i]); // Right Face
    drawFace(axCyan, axMagenta, (i, j) => [level - i, level - j, level]);   // Left Face
    drawFace(axCyan, axYellow, (i, j) => [level - i, level, level - j]);    // Top Face
}

// --- Interactive Click Logic (Ray Selection) ---
canvas.addEventListener('click', (e) => {
    // If the cube is entirely black (level=0), a ray cannot be mathematically calculated.
    if (currentLevel === 0) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const pixelX = Math.round(cssX * dpr);
    const pixelY = Math.round(cssY * dpr);

    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;

    // Ignore clicks on the transparent background
    if (pixel[3] < 255) return;

    // Convert raw 0-255 pixel data to our grid steps
    const r = Math.round(pixel[0] / CONFIG.MULTIPLIER);
    const g = Math.round(pixel[1] / CONFIG.MULTIPLIER);
    const b = Math.round(pixel[2] / CONFIG.MULTIPLIER);

    // Mathematics of the Ray: Extrapolate the base color at the boundary
    baseRay[0] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((r * CONFIG.MAX_LEVEL) / currentLevel)));
    baseRay[1] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((g * CONFIG.MAX_LEVEL) / currentLevel)));
    baseRay[2] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((b * CONFIG.MAX_LEVEL) / currentLevel)));

    // Rebuild the core sample UI with the new ray path
    renderCoreSample();
});

// --- Interactive Scroll Logic (Global) ---
window.addEventListener('wheel', (e) => {
    // Prevent the default browser scrolling behavior globally
    e.preventDefault();

    // e.deltaY is negative when scrolling up, positive when scrolling down
    if (e.deltaY < 0 && currentLevel < CONFIG.MAX_LEVEL) {
        currentLevel++;     // Scroll up -> Increase intensity
    } else if (e.deltaY > 0 && currentLevel > 0) {
        currentLevel--;     // Scroll down -> Decrease intensity
    } else {
        return;         // Stop execution if we hit the min/max limits
    }

    renderCoreSample(); // Update the visual pop on the core
    requestRender();    // Redraw the 3D cube
}, { passive: false });

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
zoomCheckbox.addEventListener('change', requestRender);
renderCoreSample(); // Build the initial grayscale core
handleResize();     // Size the canvas and trigger the first draw
