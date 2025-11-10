// Hamiltonian path web worker

onmessage = function (e) {
    const { width, height, version } = e.data;
    postMessage({ debug: `width: ${width}, height: ${height}, version: ${version}` });

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; --i) {
            let j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
    function dfs(x, y, visited, path, left) {
        visited[y][x] = true;
        path.push({ x, y });
        if (left === 1) return true;
        let neighs = [];
        for (let [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            let nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
                neighs.push([nx, ny]);
            }
        }
        shuffle(neighs);
        for (let [nx, ny] of neighs) {
            if (dfs(nx, ny, visited, path, left - 1)) return true;
        }
        visited[y][x] = false;
        path.pop();
        return false;
    }
    let path = null;
    let sx = Math.floor(Math.random() * width),
        sy = Math.floor(Math.random() * height);
    let visited = Array.from({ length: height }, () => Array(width).fill(false));
    let p = [];
    if (dfs(sx, sy, visited, p, width * height)) {
        path = p;
    }
    postMessage({ path });
};
