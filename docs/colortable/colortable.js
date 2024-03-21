document.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="range"]').forEach(
    input => input.addEventListener('change', showColorChart));

// display count value
document.getElementById('count').addEventListener('input', () =>
    document.getElementById('count-value').textContent = document.getElementById('count').value);

// display box size value
document.getElementById('box-size').addEventListener('input', () =>
    document.getElementById('box-size-value').textContent = document.getElementById('box-size').value);

// full color background
document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey ||
        !event.key.match(/^[\s\S]$/)) { // any single character
        return;
    }
    // we have a normal keypress
    event.preventDefault();
    const overlay = document.getElementById('overlay');
    const pointerDisplay = document.getElementById('pointer-display');
    // if showing full screen color show normal display
    if (overlay.style.display == 'block') {
        document.body.style.overflow = 'auto';
        overlay.style.display = 'none';
        return;
    }
    // if hovering over color patch show full screen color
    if (pointerDisplay.style.display == 'block') {
        document.body.style.overflow = 'hidden';
        overlay.style.backgroundColor = pointerDisplay.innerText;
        overlay.style.display = 'block';
    }
});

const orders = { // z = iterates slowest, i.e. grouping
    R: ['z', 'x', 'y'],
    G: ['x', 'z', 'y'],
    B: ['x', 'y', 'z'],
};

function showColorChart() {
    const count = document.getElementById('count').value;
    const group = document.querySelector('input[type=radio][name=group]:checked').value;
    const roundUp = parseInt(document.querySelector('input[type=radio][name=round]:checked').value, 10);
    levels = makeLevels(count, roundUp);
    const hls = levelsToHex(levels); // hex level strings
    const shortHex = document.getElementById('id-short-hex').checked;
    const boxSize = document.getElementById('box-size').value;
    const display = document.getElementById('display');
    const pointerDisplay = document.getElementById('pointer-display');
    pointerDisplay.style.display = 'none';
    display.innerHTML = '';
    const zAxis = document.createElement('div');
    zAxis.className = 'z-axis';
    for (let z of hls) {
        const yAxis = document.createElement('div');
        yAxis.className = 'y-axis';
        for (let y of hls) {
            const xAxis = document.createElement('div');
            xAxis.className = 'x-axis';
            for (let x of hls) {
                const values = { x, y, z };
                const [red, green, blue] = orders[group].map(key => values[key]);
                const colorBox = makeColorBox(red, green, blue, shortHex, boxSize);
                xAxis.append(colorBox);
            }
            yAxis.prepend(xAxis);
        }
        zAxis.prepend(yAxis);
    }
    display.append(zAxis);
}

function makeColorBox(red, green, blue, shortHex, boxSize) {
    const colorBox = document.createElement('div');
    colorBox.style.width = `${boxSize}px`;
    colorBox.style.height = `${boxSize}px`;
    const longHex = `${red}${green}${blue}`;
    const colorString = shortHex && /^(\w)\1(\w)\2(\w)\3$/.test(longHex)
        ? `#${red[0]}${green[0]}${blue[0]}`
        : `#${longHex}`;
    colorBox.style.backgroundColor = colorString;
    colorBox.style.cursor = 'pointer'; // indicate click action
    // click to copy color code to clipboard
    colorBox.addEventListener('click', () =>
        navigator.clipboard.writeText(colorString)
            .then(() => console.log('Color value copied to clipboard:', colorString))
            .catch(err => console.error('Failed to copy color value to clipboard:', err)));
    const pointerDisplay = document.getElementById('pointer-display');
    colorBox.addEventListener('mouseenter',
        event => pointerDisplayEnter(pointerDisplay, colorString, event.clientX, event.clientY));
    colorBox.addEventListener('mousemove',
        event => pointerDisplayMove(pointerDisplay, colorString, event.clientX, event.clientY));
    colorBox.addEventListener('mouseout', () => pointerDisplay.style.display = 'none');
    return colorBox;
}

function pointerDisplayEnter(pointerDisplay, colorString, pointerX, pointerY) {
    pointerDisplayMove(pointerDisplay, colorString, pointerX, pointerY);
    pointerDisplay.style.display = 'block';
}
function pointerDisplayMove(pointerDisplay, colorString, pointerX, pointerY) {
    pointerDisplay.innerText = `${colorString}`;
    pointerDisplay.style.top = (pointerY + 10) + 'px';
    pointerDisplay.style.left = (pointerX + 10) + 'px';
}

function levelsToHex(levels) {
    // create an array of hex value strings from array of integers
    // e.g. [0, 127, 255] -> ['00', '7F', 'FF']
    return levels.map(num => num.toString(16).toUpperCase().padStart(2, '0'));
}

function makeLevels(count, roundUp) { // count must be > 1
    let step = 255 / (count - 1);
    let result = [];
    for (let i = 0; i < count; i++) {
        result.push(roundUp ? Math.ceil(step * i) : Math.floor(step * i));
    }
    return result;
}

document.getElementById('id-page-title').innerText = document.title;
document.getElementById('id-version').innerText = 'v' + document.querySelector('meta[name="version"]').content;
showColorChart(); // initial draw
