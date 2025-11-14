// Hamiltonian path web worker

// Fisher–Yates shuffle
function shuffle(arr) {
    for (let i = 0; i < arr.length; i++) {
        const j = Math.floor(Math.random() * (i + 1)); // 0 ≤ j ≤ i
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function dfs(x, y, visited, path, left, width, height) {
    visited[y][x] = true;
    path.push({ x, y });
    if (left === 1) return true;
    const frontier = [];
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
            frontier.push([nx, ny]);
        }
    }
    shuffle(frontier);
    for (const [nx, ny] of frontier) {
        if (dfs(nx, ny, visited, path, left - 1, width, height)) return true;
    }
    visited[y][x] = false;
    path.pop();
    return false;
}

addEventListener('message', ({ data: { width, height, version } }) => {
    self.postMessage({ debug: `width=${width}, height=${height}, version=${version}` });

    const visited = Array.from({ length: height }, () => Array(width).fill(false));
    const startX  = Math.floor(Math.random() * width);
    const startY  = Math.floor(Math.random() * height);
    const path    = [];

    const ok = dfs(startX, startY, visited, path, width * height, width, height);
    self.postMessage({ path: ok ? path : null });
});
