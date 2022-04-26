#
#	Sukeban Jansi Ryuko
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg1 = merge(z.read('sjryuko1/epr-12251.43') + z.read('sjryuko1/epr-12252.42'), z.read('sjryuko1/epr-12249.26') + z.read('sjryuko1/epr-12250.25'))
    bg = z.read('epr-12224-95.b9') + z.read('epr-12225-94.b10') + z.read('epr-12226-93.b11')
    obj = merge(z.read('epr-12236-11.b5')[:0x8000] + z.read('epr-12237-18.b6')[:0x8000], z.read('epr-12232-10.b1')[:0x8000] + z.read('epr-12233-17.b2')[:0x8000])
    obj += merge(z.read('epr-12238-24.b7')[:0x8000] + z.read('epr-12239-30.b8')[:0x8000], z.read('epr-12234-23.b3')[:0x8000] + z.read('epr-12235-29.b4')[:0x8000])
    obj += merge(z.read('epr-12236-11.b5')[0x8000:] + z.read('epr-12237-18.b6')[0x8000:], z.read('epr-12232-10.b1')[0x8000:] + z.read('epr-12233-17.b2')[0x8000:])
    obj += merge(z.read('epr-12238-24.b7')[0x8000:] + z.read('epr-12239-30.b8')[0x8000:], z.read('epr-12234-23.b3')[0x8000:] + z.read('epr-12235-29.b4')[0x8000:])
    prg2 = z.read('sjryuko1/epr-12227.12')
    mcu = z.read('sjryuko1/7751.bin')
    voi = z.read('sjryuko1/epr-12228.1') + z.read('sjryuko1/epr-12229.2') + z.read('sjryuko1/epr-12230.4') + z.read('sjryuko1/epr-12231.5')
    key = z.read('317-5021.key')

rom = prg1 + bg + obj + prg2 + mcu + voi + key

def pngstring(a):
    w = 1024
    img = Image.new('P', (w, ceil(len(a) / w)))
    img.putpalette(sum([[i, 0, 0] for i in range(256)], []))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
