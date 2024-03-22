const ui = {}; // provide nice syntax for element access
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}
document.querySelectorAll('[id]').forEach(element => {
    ui[kebabToCamel(element.id)] = document.getElementById(element.id);
});

document.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="range"]').forEach(
    input => input.addEventListener('change', showColorChart));

// display slider values
ui.count.addEventListener('input', () => ui.countValue.textContent = ui.count.value);
ui.boxSize.addEventListener('input', () => ui.boxSizeValue.textContent = ui.boxSize.value);

// full color background
document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey ||
        !event.key.match(/^[\s\S]$/)) { // any single character
        return;
    }
    // we have a normal keypress
    event.preventDefault();
    // if showing full screen color show normal display
    if (ui.overlay.style.display == 'block') {
        document.body.style.overflow = 'auto';
        ui.overlay.style.display = 'none';
        return;
    }
    // if hovering over color patch show full screen color
    if (ui.pointerDisplay.style.display == 'block') {
        document.body.style.overflow = 'hidden';
        ui.overlay.style.backgroundColor = ui.pointerDisplay.innerText;
        ui.overlay.style.display = 'block';
    }
});

const orders = { // z = iterates slowest, i.e. grouping
    R: ['z', 'x', 'y'],
    G: ['x', 'z', 'y'],
    B: ['x', 'y', 'z'],
};

function showColorChart() {
    const group = document.querySelector('input[type=radio][name=group]:checked').value;
    const roundUp = parseInt(document.querySelector('input[type=radio][name=round]:checked').value, 10);
    levels = makeLevels(ui.count.value, roundUp);
    const hls = levelsToHex(levels); // hex level strings
    const shortHex = ui.shortHex.checked;
    const boxSize = ui.boxSize.value;
    ui.pointerDisplay.style.display = 'none';
    ui.display.innerHTML = '';
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
    ui.display.append(zAxis);
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
    colorBox.addEventListener('mouseenter',
        event => pointerDisplayEnter(colorString, event.clientX, event.clientY));
    colorBox.addEventListener('mousemove',
        event => pointerDisplayMove(colorString, event.clientX, event.clientY));
    colorBox.addEventListener('mouseout', () => ui.pointerDisplay.style.display = 'none');
    return colorBox;
}

function pointerDisplayEnter(colorString, pointerX, pointerY) {
    pointerDisplayMove(colorString, pointerX, pointerY);
    ui.pointerDisplay.style.display = 'block';
}
function pointerDisplayMove(colorString, pointerX, pointerY) {
    ui.pointerDisplay.innerText = `${colorString}`;
    ui.pointerDisplay.style.top = (pointerY + 10) + 'px';
    ui.pointerDisplay.style.left = (pointerX + 10) + 'px';
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

ui.pageTitle.innerText = document.title;
ui.version.innerText = 'v' + document.querySelector('meta[name="version"]').content;
showColorChart(); // initial draw
