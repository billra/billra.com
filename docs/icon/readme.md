# Icon Editor

## Example

colortable.ico 164 bytes

```cmd
(py313) C:\Users\billr\Desktop\git\billra.com>certutil -dump -f docs\colortable\colortable.ico
  0000  ...
  00a4
    0000  00 00 01 00 01 00 10 10  10 00 01 00 04 00 8e 00   ................
    0010  00 00 16 00 00 00 89 50  4e 47 0d 0a 1a 0a 00 00   .......PNG......
    0020  00 0d 49 48 44 52 00 00  00 10 00 00 00 10 08 06   ..IHDR..........
    0030  00 00 00 1f f3 ff 61 00  00 00 55 49 44 41 54 38   ......a...UIDAT8
    0040  8d 63 60 18 68 c0 88 45  ec 3f 16 79 6c 62 0c 0c   .c`.h..E.?.ylb..
    0050  0c 0c 0c 4c d8 4c fd bf  99 8b 28 31 06 06 06 06   ...L.L....(1....
    0060  16 1c 36 13 23 c6 88 ee  9c ff b8 6c 41 07 8c be   ..6.#......lA...
    0070  df d0 f5 c2 4d fe 0f 35  e8 3f 32 1f 87 18 86 17   ....M..5.?2.....
    0080  f0 05 18 69 81 48 0a 18  0d 44 2a 24 e5 81 07 00   ...i.H...D*$....
    0090  6a 7f 38 67 02 fc 81 b0  00 00 00 00 49 45 4e 44   j.8g........IEND
    00a0  ae 42 60 82                                        .B`.
CertUtil: -dump command completed successfully.
```

The `colortable.ico` file contains a **PNG-compressed image** inside the `.ico`
container, rather than using classic BMP data.

### ICONDIR and ICONDIRENTRY

At offset 0x0000:

```text
00 00 01 00 01 00 10 10 10 00 01 00 04 00 8e 00
```

These bytes mean:

- `00 00`: Reserved
- `01 00`: Type = 1 (icon)
- `01 00`: Image count = 1
- `10`: Width = 16
- `10`: Height = 16
- `10`: Color count = 16 (may be 0 if PNG, but some tools fill this in)
- `00`: Reserved
- `01 00`: Planes = 1
- `04 00`: Bit count = 4 (may not match actual image bpp if PNG used)
- `8e 00 00 00`: Image data size = 0x008E = **142 bytes**
- `16 00 00 00`: Offset to image = 0x16 = **22 bytes** (right after headers)

### PNG Signature and Data

At offset 0x0016 (the start of the image in the ICO):

```text
89 50 4E 47 0D 0A 1A 0A
```

This is the PNG file signature. The remainder of the ICO file is the PNG image
file stream. Also seen are PNG chunk names like `IHDR`, `IDAT`, and `IEND`.

## Retrieving PNG Data

Use the `<canvas>` element and its `toBlob` or `toDataURL` methods to create a
PNG image from graphics.

```js
// Create a canvas and draw something
const canvas = document.createElement('canvas');
canvas.width = 16;
canvas.height = 16;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#00FF00';
ctx.fillRect(0, 0, 16, 16);

// Generate PNG Blob and extract bytes (Modern async approach)
canvas.toBlob(async (blob) => {
  // Convert directly to ArrayBuffer
  const pngArrayBuffer = await blob.arrayBuffer();

  // Get raw bytes
  const uint8Array = new Uint8Array(pngArrayBuffer);

  console.log(`Generated ${uint8Array.length} bytes of PNG data.`);
}, 'image/png');
```
