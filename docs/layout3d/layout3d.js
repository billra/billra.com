// handle input change
document.querySelectorAll('input[type=radio], input[type=checkbox]').forEach((input) => {
    input.addEventListener('change', draw);
});

function draw() {
    const size = parseInt(document.querySelector('input[type=radio][name=size]:checked').value, 10);
    const zOriginFirst = document.querySelector('input[type=radio][name=z-origin][value=first]').checked;
    const showBackground = document.getElementById('show-background').checked;
    const display = document.getElementById('display');
    display.innerHTML = ''; // erase old
    const zAxis = document.createElement('div');
    zAxis.className = 'z-axis';
    if (showBackground) zAxis.style.backgroundColor = '#555';
    for (let z = 0; z < size; z++) {
        const yAxis = document.createElement('div');
        yAxis.className = 'y-axis';
        if (showBackground) yAxis.style.backgroundColor = '#888';
        for (let y = 0; y < size; y++) {
            const xAxis = document.createElement('div');
            xAxis.className = 'x-axis';
            for (let x = 0; x < size; x++) {
                const block = document.createElement('div');
                block.className = 'block';
                block.innerText = `(${x},${y},${z})`;
                xAxis.append(block);
            }
            yAxis.prepend(xAxis);
        }
        zOriginFirst ? zAxis.append(yAxis) : zAxis.prepend(yAxis);
    }
    display.append(zAxis);
}

draw(); // initial draw
