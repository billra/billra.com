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
// Draw the Hamiltonian snake as a single <polyline>.
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

// ───────────────── helpers ─────────────────
const dir   = (p, q) => ({ x: Math.sign(q.x - p.x), y: Math.sign(q.y - p.y) });
const left  = ({x, y}) => ({ x:  y, y: -x });
const right = ({x, y}) => ({ x: -y, y:  x });

/*────────────────── one wall ──────────────────
 * centers → wall path fragment
 *
 * includeMove === true   ▶  “M x y …”
 * includeMove === false  ▶  “L x y …”
 */
function buildWall(centers, R, includeMove = true) {
    const dir   = (p, q) => ({ x: Math.sign(q.x - p.x),
                               y: Math.sign(q.y - p.y) });
    const left  = ({x, y}) => ({ x:  y, y: -x });

    const D = centers.slice(1).map((c, i) => dir(centers[i], c));

    const startOff = left(D[0]);
    const start    = {
        x: centers[0].x + startOff.x * R,
        y: centers[0].y + startOff.y * R
    };

    let cmd = `${includeMove ? 'M' : 'L'} ${start.x} ${start.y}`;

    for (let i = 1; i < centers.length - 1; ++i) {
        const dp = D[i - 1], dn = D[i];
        if (dp.x === dn.x && dp.y === dn.y) continue;        // straight

        const prev = {
            x: centers[i].x + left(dp).x * R,
            y: centers[i].y + left(dp).y * R
        };
        cmd += ` L ${prev.x} ${prev.y}`;

        const next = {
            x: centers[i].x + left(dn).x * R,
            y: centers[i].y + left(dn).y * R
        };
        const sweep = (dp.x * dn.y - dp.y * dn.x) > 0 ? 1 : 0;
        cmd += ` A ${R} ${R} 0 0 ${sweep} ${next.x} ${next.y}`;
    }

    const endOff = left(D[D.length - 1]);
    const end    = {
        x: centers[centers.length - 1].x + endOff.x * R,
        y: centers[centers.length - 1].y + endOff.y * R
    };
    cmd += ` L ${end.x} ${end.y}`;

    return { d: cmd, start, end };
}
// ───────────────────────────────────────────

// ────────── Filled Outline Snake ──────────
const drawSnakeQ = (svg, path, cols, rows, width, height) => {
    if (!path || path.length < 2) return;

    const R     = SNAKE_WIDTH / 2;
    const DEBUG = true;

    // Cell center → pixel
    const offX = (width  - cols * CELL_SIZE) / 2;
    const offY = (height - rows * CELL_SIZE) / 2;
    const toPx = ({x, y}) => ({
        x: offX + CELL_SIZE * (x + 0.5),
        y: offY + CELL_SIZE * (y + 0.5)
    });
    const centers = path.map(toPx);

    // left wall (head → tail)  – starts with ‘M’
    const leftWall  = buildWall(centers, R, true);

    // right wall (tail → head) – starts with ‘L’
    const rightWall = buildWall([...centers].reverse(), R, false);

    // two 180° semicircles that close the outline
    const tailCap = ` A ${R} ${R} 0 1 1 ${rightWall.start.x} ${rightWall.start.y}`;
    const headCap = ` A ${R} ${R} 0 1 1 ${leftWall.start.x}  ${leftWall.start.y}`;

    const d = `${leftWall.d}${tailCap}${rightWall.d}${headCap}Z`;

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
};

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
