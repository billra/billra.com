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
    const { key } = event;
    if (key.length === 1 && key.match(/[a-zA-Z0-9 ]/)) {
        event.preventDefault();
        const pageContents = document.getElementById('page-contents');
        const pointerDisplay = document.querySelector('.pointer-display');
        if (pointerDisplay && pointerDisplay.textContent) {
            pageContents.style.display = 'none';
            document.body.style.backgroundColor = pointerDisplay.innerText;
        } else {
            pageContents.style.display = 'block';
            document.body.style.backgroundColor = 'black';
        }
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
    console.log(hls);
    const shortHex = document.getElementById('id-short-hex').checked;
    const boxSize = document.getElementById('box-size').value;
    const display = document.getElementById('display');
    display.innerHTML = ''; // clear old values
    // This can be triggered by keyboard control of the size slider.
    // We clear the pointer color value display as there might me a new
    // color under the pointer without an associated mousemove event.
    clearPointerDisplay();
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
    // Position the color value display next to the pointer
    colorBox.addEventListener('mousemove',
        event => makePointerDisplay(colorString, event.clientX, event.clientY));
    colorBox.addEventListener('mouseout', clearPointerDisplay);
    return colorBox;
}

function makePointerDisplay(colorString, pointerX, pointerY) {
    let pointerDisplay = document.querySelector('.pointer-display');
    if (!pointerDisplay) {
        pointerDisplay = document.createElement('div');
        pointerDisplay.className = 'pointer-display';
        document.body.appendChild(pointerDisplay);
        pointerDisplay.innerText = `${colorString}`;
        pointerDisplay.style.position = 'fixed';
    }
    pointerDisplay.style.top = (pointerY + 10) + 'px';
    pointerDisplay.style.left = (pointerX + 10) + 'px';
}

function clearPointerDisplay() {
    const pointerDisplay = document.querySelector('.pointer-display');
    if (pointerDisplay) {
        pointerDisplay.remove();
    }
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

showColorChart(); // initial draw
