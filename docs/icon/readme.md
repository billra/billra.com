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

## Clean PNG

### Sneaky Metadata (Ancillary Chunks)

Your 142-byte PNG payload is incredibly lean — it contains only the required
`IHDR` (header), `IDAT` (pixel data), and `IEND` (footer) chunks.

Different browsers inject extra metadata chunks into their canvas exports. For
example:

- **Chrome/Edge** might inject an `sRGB` chunk to define the color space.
- **Firefox** might inject a `pHYs` chunk to define pixel aspect ratios.
These extra chunks can silently add 20 to 50 bytes to your final payload.

### What to Expect

If you run the solid green 16x16 canvas code in a modern browser, the resulting
`.ico` file (22-byte header + PNG blob) usually lands between
**180 and 220 bytes**. It is still incredibly lightweight and perfectly fine for
network transmission, but not quite hand-optimized.

---

How can I strip unnecessary metadata chunks from a PNG ArrayBuffer in JavaScript
to get the smallest possible file size?

---

To strip out the metadata, you need to parse the PNG file structure.
Fortunately, the PNG format is incredibly elegant and easy to manipulate in
memory.

A PNG file consists of an 8-byte signature followed by a series of blocks called
**chunks**. Each chunk has a strict 4-part structure:

1. **Length:** 4 bytes (How big the payload is)
2. **Type:** 4 bytes (e.g., `IHDR`, `IDAT`, `sRGB`)
3. **Data:** [Length] bytes (The actual payload)
4. **CRC:** 4 bytes (A cyclic redundancy check to ensure the data isn't corrupted)

To get the absolute smallest payload from a `canvas` export, we only need to
keep three essential chunks: `IHDR` (the header), `IDAT` (the pixel data), and
`IEND` (the end marker). We can discard everything else (`pHYs`, `sRGB`, `tEXt`,
etc.).

## The Stripper Function

Here is the JavaScript to iterate through the `Uint8Array`, identify the chunk
types, and reconstruct a pristine, bare-minimum PNG.

```javascript
/**
 * Strips non-essential chunks from a PNG Uint8Array.
 * Keeps only IHDR, IDAT, and IEND.
 */
function stripPngMetadata(pngBytes) {
  // Ensure the file is actually a PNG by checking the 8-byte signature
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) {
    if (pngBytes[i] !== signature[i]) throw new Error("Not a valid PNG");
  }

  // DataView allows us to safely read 32-bit integers (Big-Endian)
  const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  const keptChunks = [pngBytes.slice(0, 8)]; // Keep the signature
  let offset = 8;

  while (offset < pngBytes.length) {
    // Read the chunk length (4 bytes)
    const dataLength = view.getUint32(offset, false);

    // Read the chunk type (4 ASCII characters)
    const chunkType = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7]
    );

    // Total size = Length (4) + Type (4) + Data (dataLength) + CRC (4)
    const chunkTotalLength = 12 + dataLength;

    // Only keep the required chunks for a standard 32-bit RGBA image
    if (chunkType === 'IHDR' || chunkType === 'IDAT' || chunkType === 'IEND') {
      keptChunks.push(pngBytes.slice(offset, offset + chunkTotalLength));
    }

    // Move to the next chunk
    offset += chunkTotalLength;

    // Stop parsing once we hit the end marker
    if (chunkType === 'IEND') break;
  }

  // Calculate the new total file size
  const totalSize = keptChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  // Reconstruct the stripped PNG
  const strippedPng = new Uint8Array(totalSize);
  let writeOffset = 0;
  for (const chunk of keptChunks) {
    strippedPng.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return strippedPng;
}
```

### How to use it in your workflow

You can drop this directly into your existing canvas extraction logic. Here is
how it looks in practice:

```javascript
canvas.toBlob(async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const originalBytes = new Uint8Array(arrayBuffer);

  // Strip the browser's injected metadata
  const optimizedBytes = stripPngMetadata(originalBytes);

  console.log(`Original: ${originalBytes.length} bytes`);
  console.log(`Optimized: ${optimizedBytes.length} bytes`);

  // Now you can append 'optimizedBytes' to your 22-byte ICO header!
}, 'image/png');
```

Running this strips out any physical pixel dimension (`pHYs`) or color profile
(`sRGB`/`iCCP`) chunks that browsers like Chrome and Firefox habitually inject.
This ensures your final `.ico` file gets as close to that 164-byte threshold as
dynamically possible.

## PNG optimization

I have complete control of the source image. I will _not_ be using more colors
than the palette allows. Does this change my selection for choice of tools? Or
perhaps this makes things so simple that I could "roll my own"?

---

If you have absolute control over the source image and guarantee it contains 16
or fewer colors, you can absolutely "roll your own" encoder.

In fact, dropping heavy libraries is the best path forward here.

### The "Roll Your Own" Strategy

By writing a custom script, you can enforce the exact byte-saving tricks that
generic tools miss. All you need is a tiny, lightweight Zlib library like
**Pako** to handle the DEFLATE compression for the `IDAT` chunk. Everything else
is just basic array manipulation.

Here is the exact pipeline you would build:

#### 1. The "Smart" Palette Extraction

Instead of letting an algorithm arrange your colors, your script will read the
canvas and build a custom palette array with strict rules:

- Scan the canvas pixel by pixel.
- If you encounter a transparent pixel (Alpha < 255), immediately assign it to
  **Index 0**.
- Assign the remaining solid colors to Indices 1 through 15.
- Because your transparent color is guaranteed to be at Index 0, you can
  hardcode your `tRNS` chunk to be exactly 1 byte long.

#### 2. Manual 4-Bit Pixel Packing

A 4-bit PNG requires you to pack two pixels into every single byte.

- A 16-pixel row normally takes 16 bytes.
- By doing a bitwise shift (e.g., `(pixel1 << 4) | pixel2`), you compress that
  row into exactly 8 bytes.
- Add 1 byte at the start of each row for the PNG filter (just use `0` for
  "None," which works perfectly for 16x16 images).
- Your final uncompressed image payload is exactly 144 bytes (9 bytes per row ×
  16 rows).

#### 3. Max DEFLATE via Pako

You pass that 144-byte array into Pako with the compression cranked to the
absolute maximum:

```javascript
const compressedData = pako.deflate(packedPixels, { level: 9, strategy: 2 });
```

#### 4. Chunk Assembly

Finally, you stitch the byte arrays together:

- **ICO Header:** 22 bytes
- **PNG Signature:** 8 bytes
- **IHDR:** 25 bytes (declaring 4-bit Indexed color)
- **PLTE:** `12 + (colorCount * 3)` bytes
- **tRNS:** 17 bytes (12 bytes wrapper + 1 byte payload)
- **IDAT:** `12 + compressedData.length` bytes
- **IEND:** 12 bytes

By rolling your own, you get the absolute smallest mathematically possible file
without loading WebAssembly (OxiPNG) or a heavy color-math library (UPNG.js).
You have complete control over every single byte.
