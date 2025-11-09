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
const SNAKE_SHADOW_BLUR = 10;      // Amount of glow/blur for the snake (px)
const STATUS_DELAY_MS = 60;        // Milliseconds to wait before generating path (lets UI update first)

// Cached CSS variables for snake styles
const rootStyle = getComputedStyle(document.documentElement);
const SNAKE_COLOR = rootStyle.getPropertyValue('--snake-color');
const SNAKE_GLOW = rootStyle.getPropertyValue('--snake-glow');

// set title and version
ui.pageTitle.innerText = document.title;
ui.version.innerText = 'v' + document.querySelector('meta[name="version"]').content;

// Worker reference
let worker = null;

// UI functions
function updateStatus(msg, ok=true) {
    ui.status.textContent = msg;
    ui.status.style.color = ok ? '#7f7' : '#f66';
}

// drawing
function drawSnake(ctx, path, width, height) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!path) return;

    let cellSizeX = Math.max(CELL_MIN_SIZE, Math.min(CELL_MAX_SIZE, (ctx.canvas.width - 2 * CANVAS_MARGIN) / width));
    let cellSizeY = Math.max(CELL_MIN_SIZE, Math.min(CELL_MAX_SIZE, (ctx.canvas.height - 2 * CANVAS_MARGIN) / height));
    let cellSize = Math.floor(Math.min(cellSizeX, cellSizeY));
    let moffsetX = Math.floor((ctx.canvas.width - cellSize * width) / 2);
    let moffsetY = Math.floor((ctx.canvas.height - cellSize * height) / 2);

    let snakeRad = Math.max(SNAKE_MIN_RADIUS, Math.min(SNAKE_MAX_RADIUS, cellSize * SNAKE_RADIUS_FACTOR));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = snakeRad * 2;

    function cellCenter(c) {
        return [
            moffsetX + cellSize * (c.x + 0.5),
            moffsetY + cellSize * (c.y + 0.5)
        ];
    }
    ctx.beginPath();
    let [sx, sy] = cellCenter(path[0]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < path.length; ++i) {
        let [x, y] = cellCenter(path[i]);
        ctx.lineTo(x, y);
    }
    ctx.strokeStyle = SNAKE_COLOR;
    ctx.shadowColor = SNAKE_GLOW;
    ctx.shadowBlur = SNAKE_SHADOW_BLUR;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = SNAKE_COLOR;
    ctx.beginPath();
    let [hx, hy] = cellCenter(path[0]);
    ctx.arc(hx, hy, snakeRad, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    let [tx, ty] = cellCenter(path[path.length - 1]);
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

    let width = parseInt(ui.width.value, 10),
        height = parseInt(ui.height.value, 10);
    let canvas = ui.snake;
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateStatus('Working...');
    ui.cancel.style.display = "inline";

    worker = new Worker('worker.js');
    worker.postMessage({ width, height, maxTries: 2500 });

    worker.onmessage = function(e) {
        ui.cancel.style.display = "none";
        let path = e.data.path;
        if (path) {
            drawSnake(ctx, path, width, height);
            updateStatus(`Found path: ${width} x ${height}`);
        } else {
            updateStatus("Failed: no Hamiltonian path found??", false);
        }
        worker.terminate();
        worker = null;
    };

    worker.onerror = function(e) {
        ui.cancel.style.display = "none";
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
        ui.cancel.style.display = "none";
        updateStatus("Canceled.", false);
    }
});

// Responsive canvas
function autoResizeCanvas() {
    let w = parseInt(ui.width.value, 10),
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
