// easy UI access
const ui = {};
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}
document.querySelectorAll('[id]').forEach(element => {
    ui[kebabToCamel(element.id)] = document.getElementById(element.id);
});

// Fixed values
const CELL_SIZE = 22;           // Grid cell size in pixels
const CANVAS_MARGIN = 22;       // Outer margin in pixels
const SNAKE_COLOR = '#1f5';
const SNAKE_RADIUS = 5;         // Snake head/tail radius (px)
const SNAKE_THICKNESS = 10;     // Snake body thickness

// set title and version
ui.pageTitle.innerText = document.title;
ui.version.innerText = 'v' + document.querySelector('meta[name="version"]').content;

// Worker reference
let worker = null;

// UI functions
function updateStatus(msg, ok = true) {
  ui.status.textContent = msg;
  ui.status.classList.toggle('error', !ok);
}

// drawing
function drawSnake(ctx, path, width, height) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!path) return;

    const offsetX = Math.floor((ctx.canvas.width - CELL_SIZE * width) / 2);
    const offsetY = Math.floor((ctx.canvas.height - CELL_SIZE * height) / 2);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = SNAKE_THICKNESS;

    function cellCenter(c) {
        return [
            offsetX + CELL_SIZE * (c.x + 0.5),
            offsetY + CELL_SIZE * (c.y + 0.5)
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
    ctx.arc(hx, hy, SNAKE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    const [tx, ty] = cellCenter(path[path.length - 1]);
    ctx.arc(tx, ty, SNAKE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
}

// Main path generation logic using a Web Worker
function generateSnake() {
    if (worker) {
        worker.terminate();
        worker = null;
    }

    const width = parseInt(ui.width.value, 10),
        height = parseInt(ui.height.value, 10);

    // Set canvas size based on the number of cells and margin
    ui.snake.width = width * CELL_SIZE + 2 * CANVAS_MARGIN;
    ui.snake.height = height * CELL_SIZE + 2 * CANVAS_MARGIN;

    const canvas = ui.snake;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateStatus('Working...');
    ui.cancel.disabled = false;
    ui.generate.disabled = true;

    worker = new Worker('worker.js');
    worker.postMessage({ width, height, version: ui.version.innerText });

    worker.onmessage = function (e) {
        if (e.data.debug) {
            console.log('from worker: ' + e.data.debug);
            return;
        }
        ui.cancel.disabled = true;
        ui.generate.disabled = false;
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

// "Generate" button logic
ui.generate.addEventListener('click', generateSnake);

// initial setup
window.onload = () => {
    generateSnake();
};
