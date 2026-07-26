# 16x16 ICO Editor

A browser-based tool for creating optimized 16x16 favicons. It functions as a
pixel-art editor and image converter, focusing on file compression, bit-level
data manipulation, and browser API mechanics to generate the smallest possible
file size for web graphics.

## Web Icons in the Modern Era

When a browser loads a website, it requests an icon for the tab. Providing an
optimized set of icons ensures compatibility and minimizes bandwidth usage.

### Best Practices for Web Inclusion

The following HTML `<head>` tags are recommended for declaring favicons:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" href="/favicon.png">
```

### The Format Hierarchy

1. **`.ico` (Legacy & Root):** The traditional format. Browsers often request
   `/favicon.ico` from the server root even if undefined in the HTML. Minimizing
   this file size reduces bandwidth overhead.
2. **`.svg` (Modern Vector):** The standard for high-resolution displays. SVGs
   are scalable for complex designs but lack support in legacy browsers.
3. **`.png` (Modern Raster):** Used as a fallback (typically 32x32 or 192x192)
   for devices that support PNG icons but not SVG.

## Anatomy of the File Formats

Understanding the file structures is necessary for optimizing them.

### The ICO Container

An `.ico` file operates as a container for one or more images. For a single
16x16 icon, the structure is as follows:

- **Header (6 bytes):** Declares the file as an icon and states the image count.
- **Directory Entry (16 bytes):** Details the width, height, color depth, size,
  and exact byte offset of the image payload.
- **The Payload:** The image data.

### Payload Types: BMP vs. PNG

Historically, the image payload inside an ICO was an uncompressed Bitmap (BMP).
A standard 16x16 32-bit BMP payload requires exactly 1,024 bytes (plus 40 bytes
for a DIB header).

However, modern browsers support PNG-compressed payloads inside the ICO
container. Embedding a PNG can reduce the 1,064-byte payload to fewer than 100
bytes.

### The PNG Structure

A PNG file consists of an 8-byte signature followed by a series of chunks:

- `IHDR`: The header (dimensions, bit depth, color type).
- `PLTE`: The palette (if using Indexed colors).
- `tRNS`: Transparency information.
- `IDAT`: The LZ77-compressed pixel data.
- `IEND`: The end-of-file marker.

## The Quest for the Smallest File

Since favicons are requested on nearly every page load, reducing the size by
even a few bytes saves significant bandwidth over high traffic volumes.

### The Browser Canvas Metadata Problem

Generating a PNG via `canvas.toBlob()` often results in browsers injecting
unnecessary metadata chunks. Chrome may inject an `sRGB` chunk for color
profiles, while Firefox may inject `pHYs` for pixel aspect ratios, adding
unnecessary bytes.

This project bypasses `canvas.toBlob()`. Instead, raw RGBA pixel data is
extracted from the canvas, and PNG chunks are constructed manually. This ensures
a file containing only the essential `IHDR`, `PLTE`, `tRNS`, `IDAT`, and `IEND`
chunks.

## The Core Engineering: Compression Showdown

The editor processes the image using two distinct strategies simultaneously,
outputting the most efficient result.

### Truecolor vs. Indexed

An Indexed PNG (mapping a limited palette to 4-bit pixels) is often smaller than
a Truecolor PNG (32-bit RGBA). However, for 16x16 icons, this varies.
Introducing a palette requires a `PLTE` chunk and a `tRNS` chunk, adding
approximately 31 bytes to the file.

The LZ77 compression algorithm relies on repeating patterns. For a solid 16x16
transparent square, LZ77 compresses Truecolor data efficiently, reducing 1,024
bytes to around 11 bytes. Since both formats compress to a similar base size,
Truecolor is smaller overall by avoiding the 31-byte palette penalty.

Conversely, geometric complexity breaks repeating patterns. Truecolor struggles
to compress complex edges, whereas 4-bit Indexed data maintains a small
footprint. For complex shapes, Indexed compression is more efficient.

### Manual Bit-Packing

To generate the Indexed PNG, pixels are manually packed into bytes. The optimal
bit depth is calculated dynamically based on the color count:

- **1-bit:** 8 pixels packed into a single byte.
- **2-bit:** 4 pixels per byte.
- **4-bit:** 2 pixels per byte using bitwise shifts (e.g., `(pixel1 << 4) | pixel2`).

### Zlib Brute-Forcing

After packing, the data is passed to the `IDAT` chunk compressor. The
`bestDeflate()` function iterates the data through all four of Pako's
compression strategies (Default, Filtered, Huffman Only, RLE) at maximum
compression (level 9). The strategy yielding the lowest byte count is selected.

## App Architecture & Performance

The editor architecture is designed for memory efficiency and performance.

### The Single Source of Truth

Instead of relying on the DOM or JavaScript objects to track pixel states, the
grid is backed by a single 1,024-byte `Uint8ClampedArray` (16x16 pixels × 4
channels).

### Fast Rendering

Updating four individual array indices (R, G, B, and A) per pixel during drag
events is inefficient. Instead, a `DataView` is mapped over the buffer. Selected
hex colors are converted into a single 32-bit unsigned integer (`0xRRGGBBAA`).
Painting triggers a single `setUint32()` operation, enabling rapid interactions
without dropping frames or causing memory leaks.
