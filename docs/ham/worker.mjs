// Hamiltonian path web worker

// Fisher–Yates shuffle
function shuffle(arr) {
    for (let i = 0; i < arr.length; i++) {
        const j = Math.floor(Math.random() * (i + 1)); // 0 ≤ j ≤ i
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function dfs(x, y, visited, path, remaining, cols, rows) {
    visited[y][x] = true;
    path.push({ x, y });
    if (remaining === 1) return true;
    const frontier = [];
    for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
            frontier.push([nx, ny]);
        }
    }
    shuffle(frontier);
    for (const [nx, ny] of frontier) {
        if (dfs(nx, ny, visited, path, remaining - 1, cols, rows)) return true;
    }
    visited[y][x] = false;
    path.pop();
    return false;
}

addEventListener('message', ({ data: { cols, rows, version } }) => {
    self.postMessage({ debug: `cols=${cols}, rows=${rows}, version=${version}` });

    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const startX  = Math.floor(Math.random() * cols);
    const startY  = Math.floor(Math.random() * rows);
    const path    = [];

    const ok = dfs(startX, startY, visited, path, cols * rows, cols, rows);
    self.postMessage({ path: ok ? path : null });
});
