"""Generate a multi-size Windows ICO with PNG-compressed images."""
import struct
from PIL import Image
import io
import sys

DEFAULT_SIZES = (16, 32, 48, 64, 128, 256)


def create_ico(src_path, dst_path, sizes=DEFAULT_SIZES):
    src = Image.open(src_path).convert('RGBA')

    images = []
    for size in sizes:
        im = src.resize((size, size), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format='PNG')
        png_data = buf.getvalue()
        images.append((size, png_data))

    count = len(images)
    # ICONDIR: reserved(2), type(2), count(2)
    header = struct.pack('<HHH', 0, 1, count)

    # Each ICONDIRENTRY is 16 bytes
    # width(1), height(1), colors(1), reserved(1), planes(2), bpp(2), size(4), offset(4)
    # For 256x256, width and height are stored as 0
    directory = b''
    data = b''
    offset = 6 + 16 * count
    for size, png_data in images:
        w = size if size < 256 else 0
        h = size if size < 256 else 0
        size_len = len(png_data)
        directory += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, size_len, offset)
        data += png_data
        offset += size_len

    with open(dst_path, 'wb') as f:
        f.write(header + directory + data)


if __name__ == '__main__':
    create_ico(sys.argv[1], sys.argv[2])
    print(f"Generated {sys.argv[2]} with sizes: {list(DEFAULT_SIZES)}")
