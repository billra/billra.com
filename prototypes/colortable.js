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
    colorBox.style.backgroundColor = `#${red}${green}${blue}`;
    colorBox.classList.add('color-box');
    colorBoxWithValue.appendChild(colorBox);
    const colorValue = document.createElement('div');
    colorValue.innerText = `#${red}${green}${blue}`;
    colorBoxWithValue.appendChild(colorValue);
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
