// easy UI access
const ui = {};
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}
document.querySelectorAll('[id]').forEach(element => {
    ui[kebabToCamel(element.id)] = document.getElementById(element.id);
});

// Constants for magic numbers
const CANVAS_MARGIN = 22;          // Outer margin (in pixels) around the drawn grid on the canvas
const CELL_MIN_SIZE = 22;          // Minimum grid cell size in pixels
const CELL_MAX_SIZE = 60;          // Maximum grid cell size in pixels
const SNAKE_MIN_RADIUS = 5;        // Minimum snake head/tail radius (px)
const SNAKE_MAX_RADIUS = 14;       // Maximum snake head/tail radius (px)
const SNAKE_RADIUS_FACTOR = 0.42;  // Fraction of cell size for snake's thickness
const STATUS_DELAY_MS = 60;        // Milliseconds to wait before generating path (lets UI update first)

// Cached CSS variables for snake styles
const rootStyle = getComputedStyle(document.documentElement);
const SNAKE_COLOR = rootStyle.getPropertyValue('--snake-color');

// set title and version
ui.pageTitle.innerText = document.title;
ui.version.innerText = 'v' + document.querySelector('meta[name="version"]').content;

// Worker reference
let worker = null;

// UI functions
function updateStatus(msg, ok = true) {
    ui.status.textContent = msg;
    ui.status.style.color = ok ? '#7f7' : '#f66';
}

// drawing
function drawSnake(ctx, path, width, height) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!path) return;

    const cellSizeX = Math.max(CELL_MIN_SIZE, Math.min(CELL_MAX_SIZE, (ctx.canvas.width - 2 * CANVAS_MARGIN) / width));
    const cellSizeY = Math.max(CELL_MIN_SIZE, Math.min(CELL_MAX_SIZE, (ctx.canvas.height - 2 * CANVAS_MARGIN) / height));
    const cellSize = Math.floor(Math.min(cellSizeX, cellSizeY));
    const offsetX = Math.floor((ctx.canvas.width - cellSize * width) / 2);
    const offsetY = Math.floor((ctx.canvas.height - cellSize * height) / 2);

    const snakeRad = Math.max(SNAKE_MIN_RADIUS, Math.min(SNAKE_MAX_RADIUS, cellSize * SNAKE_RADIUS_FACTOR));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = snakeRad * 2;

    function cellCenter(c) {
        return [
            offsetX + cellSize * (c.x + 0.5),
            offsetY + cellSize * (c.y + 0.5)
        ];
    }
    ctx.beginPath();
    const [sx, sy] = cellCenter(path[0]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < path.length; ++i) {
        const [x, y] = cellCenter(path[i]);
        ctx.lineTo(x, y);
    }
    ctx.strokeStyle = SNAKE_COLOR;
    ctx.stroke();
    ctx.fillStyle = SNAKE_COLOR;
    ctx.beginPath();
    const [hx, hy] = cellCenter(path[0]);
    ctx.arc(hx, hy, snakeRad, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    const [tx, ty] = cellCenter(path[path.length - 1]);
    ctx.arc(tx, ty, snakeRad, 0, 2 * Math.PI);
    ctx.fill();
}

// Main path generation logic using a Web Worker
function generateSnake() {
    // Abort any running worker
    if (worker) {
        worker.terminate();
        worker = null;
    }

    const width = parseInt(ui.width.value, 10),
        height = parseInt(ui.height.value, 10);
    const canvas = ui.snake;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateStatus('Working...');
    ui.cancel.disabled = false;   // Enable Cancel button (user can cancel)
    ui.generate.disabled = true;  // Disable Generate (prevent multiple starts)

    worker = new Worker('worker.js');
    worker.postMessage({ width, height, version: ui.version.innerText });

    worker.onmessage = function (e) {
        if (e.data.debug) {
            console.log('from worker: ' + e.data.debug);
            return;
        }
        ui.cancel.disabled = true;      // Disable Cancel when done
        ui.generate.disabled = false;   // Enable Generate button again
        const path = e.data.path;
        if (path) {
            drawSnake(ctx, path, width, height);
            updateStatus(`Found path: ${width} x ${height}`);
        } else {
            updateStatus("Failed: no Hamiltonian path found", false);
        }
        worker.terminate();
        worker = null;
    };

    worker.onerror = function (e) {
        console.error(`Worker exception "${e.message}" at line ${e.lineno}`);
        ui.cancel.disabled = true;
        ui.generate.disabled = false;
        updateStatus("Error or canceled.", false);
        worker.terminate();
        worker = null;
    };
}

// Cancel button logic
ui.cancel.addEventListener('click', () => {
    if (worker) {
        worker.terminate();
        worker = null;
        ui.cancel.disabled = true;
        ui.generate.disabled = false;
        updateStatus("Canceled.", false);
    }
});

// Responsive canvas
function autoResizeCanvas() {
    const w = parseInt(ui.width.value, 10),
        h = parseInt(ui.height.value, 10),
        size = Math.max(25, Math.min(70, Math.floor(600 / Math.max(w, h))));
    ui.snake.width = w * size + 48;
    ui.snake.height = h * size + 48;
}
ui.width.addEventListener('input', autoResizeCanvas);
ui.height.addEventListener('input', autoResizeCanvas);

// "Generate" button logic
ui.generate.addEventListener('click', generateSnake);

// initial setup
window.onload = () => {
    autoResizeCanvas();
    generateSnake();
};
