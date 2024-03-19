document.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="range"]').forEach((input) => {
    input.addEventListener('change', () => {
        showColorChart();
    });
});

// display box size value
document.getElementById('box-size').addEventListener('input', () => {
    document.getElementById('box-size-value').textContent = document.getElementById('box-size').value;
});

function showColorChart() {
    const count = parseInt(document.querySelector('input[type=radio][name=count]:checked').value, 10);
    const roundUp = parseInt(document.querySelector('input[type=radio][name=round]:checked').value, 10);
    levels = makeLevels(count, roundUp);
    const hls = levelsToHex(levels); // hex level strings
    console.log(hls);
    const shortHex = document.getElementById('id-short-hex').checked;
    const boxSize = document.getElementById('box-size').value;
    const container = document.getElementById('color-container');
    container.innerHTML = ''; // clear old values
    // This can be triggered by keyboard control of the size slider.
    // We clear the cursor color value display as there might me a new
    // color under the cursor without an associated mousemove event.
    clearCursorDisplay();

    for (let red of hls) {
        for (let green of hls) {
            for (let blue of hls) {
                makeColorBox(container, red, blue, green, shortHex, boxSize);
            }
        }
    }
}

function clearCursorDisplay(){
    const cursorDisplay = document.querySelector('.cursor-display');
    if (cursorDisplay) {
        cursorDisplay.remove();
    }
}

function makeCursorDisplay(colorString,pointerX,pointerY){
    let cursorDisplay = document.querySelector('.cursor-display');
    if (!cursorDisplay) {
        cursorDisplay = document.createElement('div');
        cursorDisplay.classList.add('cursor-display');
        document.body.appendChild(cursorDisplay);
        cursorDisplay.innerText = `${colorString}`;
        cursorDisplay.style.position = 'fixed';
    }
    cursorDisplay.style.top = (pointerY + 10) + 'px';
    cursorDisplay.style.left = (pointerX + 10) + 'px';
}

function makeColorBox(container, red, blue, green, shortHex, boxSize) {
    const colorBox = document.createElement('div');
    colorBox.style.width = `${boxSize}px`;
    colorBox.style.height = `${boxSize}px`;
    const longHex = `${red}${green}${blue}`;
    const colorString = shortHex && /^(\w)\1(\w)\2(\w)\3$/.test(longHex)
        ? `#${red[0]}${green[0]}${blue[0]}`
        : `#${longHex}`;
    colorBox.style.backgroundColor = colorString;
    colorBox.classList.add('color-box');

    colorBox.style.cursor = 'pointer'; // indicate click action

    // click to copy color code to clipboard
    colorBox.addEventListener('click', () => {
        navigator.clipboard.writeText(colorString)
            .then(() => {
                console.log('Color value copied to clipboard:', colorString);
            })
            .catch(err => {
                console.error('Failed to copy color value to clipboard:', err);
            });
    });

    // Position the color value display next to the cursor
    colorBox.addEventListener('mousemove', (event) => {
        makeCursorDisplay(colorString,event.clientX,event.clientY);
    });

    colorBox.addEventListener('mouseout', (event) => {
        clearCursorDisplay();
    });

    container.appendChild(colorBox);
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
