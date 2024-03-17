let gSize;

function changeSize(){
    gSize = parseInt(document.querySelector('input[type=radio][name=size]:checked').value, 10);
    Draw();
}

document.querySelectorAll('input[type=radio][name=size]').forEach((rb) => {
    rb.addEventListener('change', () => {
        changeSize();
    });
});

document.getElementById('show-background').addEventListener('change', () => {
    document.querySelectorAll('.z-axis').forEach((elm) => {
        elm.classList.toggle('no-background');
    });
    document.querySelectorAll('.y-axis').forEach((elm) => {
        elm.classList.toggle('no-background');
    });
    // only changing the styling, no Draw() needed
});

function Draw() {
    const display = document.getElementById('display');
    display.innerHTML = ''; // erase old
    const zAxis = document.createElement('div');
    zAxis.classList.add('z-axis');
    for (let z = gSize - 1; z >= 0; z--) {
        const yAxis = document.createElement('div');
        yAxis.classList.add('y-axis');
        for (let y = gSize - 1; y >= 0; y--) {
            const xAxis = document.createElement('div');
            xAxis.classList.add('x-axis');
            for (let x = 0; x < gSize; x++) {
                const block = document.createElement('div');
                block.classList.add('block');
                block.innerText = `(${x},${y},${z})`;
                xAxis.appendChild(block);
            }
            yAxis.appendChild(xAxis);
        }
        zAxis.appendChild(yAxis);
    }
    display.appendChild(zAxis);
}

changeSize(); // for initial draw
