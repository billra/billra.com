function regenerateLevels() {
    const count = parseInt(document.querySelector('input[type=radio][name=count]:checked').value, 10);
    const roundUp = parseInt(document.querySelector('input[type=radio][name=round]:checked').value, 10);
    gLevels = makeLevels(count, roundUp);
}
let gLevels;

document.querySelectorAll('input[type=radio][name=count]').forEach((rb) => {
    rb.addEventListener('change', () => {
        regenerateLevels();
        showColorChart();
    });
});

document.querySelectorAll('input[type=radio][name=round]').forEach((rb) => {
    rb.addEventListener('change', () => {
        regenerateLevels();
        showColorChart();
    });
});

document.getElementById('id-grey-wrap').addEventListener('change', showColorChart);

document.addEventListener('DOMContentLoaded', () => {
    regenerateLevels();
    showColorChart();
});

function showColorChart() {
    const hls = levelsToHex(gLevels); // hex level strings
    console.log(hls);
    const greyWrap = document.getElementById('id-grey-wrap').checked;
    const container = document.getElementById('color-container');
    container.innerHTML = ''; // clear old values

    for (let red of hls) {
        for (let green of hls) {
            for (let blue of hls) {
                makeColorBox(container, red, blue, green, greyWrap);
            }
        }
    }
}

function makeColorBox(container, red, blue, green, greyWrap) {
    if (greyWrap && red === blue && blue === green) {
        const lineBreak = document.createElement('br');
        container.appendChild(lineBreak);
    }

    const colorBoxWithValue = document.createElement('div');
    colorBoxWithValue.classList.add('color-box-with-value');
    const colorBox = document.createElement('div');
    const colorValue = `#${red}${green}${blue}`;
    colorBox.style.backgroundColor = colorValue;
    colorBox.classList.add('color-box');
    colorBox.setAttribute('data-color-value', colorValue);

    colorBox.style.cursor = 'pointer'; // indicate click action

    // click to copy color code to clipboard
    colorBox.addEventListener('click', () => {
        navigator.clipboard.writeText(colorValue)
            .then(() => {
                console.log('Color value copied to clipboard:', colorValue);
            })
            .catch(err => {
                console.error('Failed to copy color value to clipboard:', err);
            });
    });

    colorBox.addEventListener('mouseover', (event) => {
        const colorValue = event.target.dataset.colorValue;
        const colorValueDisplay = document.createElement('div');
        colorValueDisplay.classList.add('color-value-display');
        document.body.appendChild(colorValueDisplay);
        colorValueDisplay.innerText = `${colorValue}`;

        // Position the color value display next to the cursor
        document.addEventListener('mousemove', (event) => {
            colorValueDisplay.style.position = 'fixed';
            colorValueDisplay.style.top = (event.clientY + 10) + 'px';
            colorValueDisplay.style.left = (event.clientX + 10) + 'px';
        });
    });

    colorBox.addEventListener('mouseout', (event) => {
        const colorValueDisplay = document.querySelector('.color-value-display');
        if (colorValueDisplay) {
            colorValueDisplay.remove(); // Remove color value display on mouseout
        }
    });

    colorBoxWithValue.appendChild(colorBox);
    const colorValueElement = document.createElement('div');
    colorValueElement.innerText = colorValue;
    colorBoxWithValue.appendChild(colorValueElement);
    container.appendChild(colorBoxWithValue);
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
