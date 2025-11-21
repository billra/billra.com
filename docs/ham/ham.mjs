// ────────── tiny DOM helpers ──────────
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// collect all [id] elements into a camel-cased `ui` object
const ui = {};
$$('[id]').forEach(el =>
    ui[el.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = el
);

// ────────── constants (CSS px) ──────────
const SNAKE_WIDTH = 30;
const CELL_SIZE   = SNAKE_WIDTH * 2; // match negative and positive space width: 2
const SNAKE_COLOR = '#1f5';
// background gets same radius as snake
document.documentElement.style.setProperty('--snake-radius', SNAKE_WIDTH / 2 + 'px');

// ────────── SVG helpers ──────────
const SVG_NS = 'http://www.w3.org/2000/svg';

// Replace the content of `container` with a fresh <svg> element and returns that element.
const setupSvg = (container, width, height) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width',  width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    container.replaceChildren(svg);
    return svg;
};

// ────────── draw the snake as a single polyline ──────────
const drawSnake = (svg, path, cols, rows, width, height) => {
    if (!path) return;

    const offX = (width  - cols * CELL_SIZE) / 2;
    const offY = (height - rows * CELL_SIZE) / 2;

    const points = path
        .map(({ x, y }) =>
            `${offX + CELL_SIZE * (x + 0.5)},${offY + CELL_SIZE * (y + 0.5)}`
        )
        .join(' ');

    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points',          points);
    polyline.setAttribute('fill',            'none');
    polyline.setAttribute('stroke',          SNAKE_COLOR);
    polyline.setAttribute('stroke-width',    SNAKE_WIDTH);
    polyline.setAttribute('stroke-linecap',  'round');
    polyline.setAttribute('stroke-linejoin', 'round');

    svg.append(polyline);
};

// ────────── draw the snake as a filled outline path ──────────
const dir   = (p, q) => ({ x: Math.sign(q.x - p.x), y: Math.sign(q.y - p.y) });
const left  = ({x, y}) => ({ x:  y, y: -x });

// left wall forward, right wall reverse
function wall (centers, R) {
    const D     = centers.slice(1).map((c, i) => dir(centers[i], c));
    const start = { x: centers[0].x     + left(D[0]).x     * R,
                    y: centers[0].y     + left(D[0]).y     * R };
    const end   = { x: centers.at(-1).x + left(D.at(-1)).x * R,
                    y: centers.at(-1).y + left(D.at(-1)).y * R };

    let cmd = '';

    for (let i = 1; i < centers.length - 1; ++i) {
        const dp = D[i - 1], dn = D[i];
        if (dp.x === dn.x && dp.y === dn.y) continue; // straight

        const prev = { x: centers[i].x + left(dp).x * R,
                       y: centers[i].y + left(dp).y * R };
        cmd += ` L ${prev.x} ${prev.y}`;

        const next = { x: centers[i].x + left(dn).x * R,
                       y: centers[i].y + left(dn).y * R };
        const sweep = (dp.x * dn.y - dp.y * dn.x) > 0 ? 1 : 0;
        cmd += ` A ${R} ${R} 0 0 ${sweep} ${next.x} ${next.y}`;
    }

    cmd += ` L ${end.x} ${end.y}`;
    return { start, end, cmd };
}

// 180° semicircle
const cap = (to, R) => ` A ${R} ${R} 0 1 1 ${to.x} ${to.y}`;

// draw filled path snake
function drawSnakeQ(svg, path, cols, rows, width, height) {
    if (!path || path.length < 2) return;

    const R     = SNAKE_WIDTH / 2;
    const DEBUG = true;

    // cell centers
    const offX = (width - cols * CELL_SIZE) / 2;
    const offY = (height - rows * CELL_SIZE) / 2;
    const center = ({ x, y }) => ({
        x: offX + CELL_SIZE * (x + 0.5),
        y: offY + CELL_SIZE * (y + 0.5)
    });
    const centers = path.map(center);

    // left wall (head → tail), right wall (tail → head)
    const leftWall  = wall(centers,                R);
    const rightWall = wall([...centers].reverse(), R);

    // assemble:  line ◂ cap ◂ line ◂ cap
    const d = `M ${leftWall.start.x} ${leftWall.start.y}`
            + leftWall.cmd            // head→tail (left side)
            + cap(rightWall.start, R) // tail: left→right
            + rightWall.cmd           // tail→head (right side)
            + cap(leftWall.start, R)  // head: right→left
            + 'Z';

    const outline = document.createElementNS(SVG_NS, 'path');
    outline.setAttribute('d', d);

    if (DEBUG) {
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#f66');
        outline.setAttribute('stroke-width', 2);
        outline.setAttribute('vector-effect', 'non-scaling-stroke');
        outline.setAttribute('fill-rule', 'evenodd');
    } else {
        outline.setAttribute('fill', SNAKE_COLOR);
    }
    svg.append(outline);
}

// ────────── status line & buttons ──────────
const updateUI = (msg, { ok = true, busy = false } = {}) => {
    ui.status.textContent = msg;
    ui.status.classList.toggle('error', !ok);

    ui.generate.disabled = busy;
    ui.cancel.disabled   = !busy;
};

// ────────── worker glue ──────────
const WORKER_URL = new URL('./worker.mjs', import.meta.url); // single instance
let worker = null;

const generateSnake = () => {
    worker?.terminate(); // abort an existing run
    worker = null;

    const cols = +ui.cols.value; // unary + → number
    const rows = +ui.rows.value;

    const width  = cols * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;
    const height = rows * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;

    const svg = setupSvg(ui.drawing, width, height);
    const svgQ = setupSvg(ui.drawingQ, width, height);

    updateUI('Working …', { busy: true });

    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.postMessage({ cols, rows, version: ui.version.textContent });

    worker.onmessage = ({ data }) => {
        if (data.debug) {
            console.log('%cworker:', 'color:grey', data.debug);
            return;
        }

        drawSnake(svg, data.path, cols, rows, width, height);
        drawSnakeQ(svgQ, data.path, cols, rows, width, height);

        updateUI(
            data.path ? `Found path: ${cols} × ${rows}`
                      : 'Failed: no Hamiltonian path',
            { ok: Boolean(data.path) }
        );

        worker.terminate();
        worker = null;
    };

    worker.onerror = e => {
        console.error(`Worker error: ${e.message} (line ${e.lineno})`);
        updateUI('Error or cancelled.', { ok: false });
        worker.terminate();
        worker = null;
    };
};

// ────────── event wiring ──────────
ui.generate.addEventListener('click', generateSnake);
ui.cancel.addEventListener('click', () => {
    worker?.terminate();
    worker = null;
    updateUI('Cancelled.', { ok: false });
});

// ────────── bootstrap ──────────
document.addEventListener('DOMContentLoaded', () => {
    ui.pageTitle.textContent = document.title;
    ui.version.textContent   = 'v' + $('meta[name="version"]').content;
    generateSnake();
});
