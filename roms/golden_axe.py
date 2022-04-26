#
#	Golden Axe
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg1 = merge(z.read('goldnaxej/epr-12540.a7') + z.read('goldnaxe2/epr-12521.a8'), z.read('goldnaxej/epr-12539.a5') + z.read('goldnaxe2/epr-12519.a6'))
    key = z.read('goldnaxej/317-0121.key')
    bg = z.read('epr-12385.ic19') + z.read('epr-12386.ic20') + z.read('epr-12387.ic21')
    obj = merge(z.read('mpr-12379.ic12')[:0x20000] + z.read('mpr-12381.ic13')[:0x20000], z.read('mpr-12378.ic9')[:0x20000] + z.read('mpr-12380.ic10')[:0x20000])
    obj += merge(z.read('mpr-12383.ic14')[:0x20000], z.read('mpr-12382.ic11')[:0x20000]) + b'\xff' * 0x40000
    obj += merge(z.read('mpr-12379.ic12')[0x20000:] + z.read('mpr-12381.ic13')[0x20000:], z.read('mpr-12378.ic9')[0x20000:] + z.read('mpr-12380.ic10')[0x20000:])
    obj += merge(z.read('mpr-12383.ic14')[0x20000:], z.read('mpr-12382.ic11')[0x20000:]) + b'\xff' * 0x40000
    prg2 = z.read('epr-12390.ic8') + z.read('mpr-12384.ic6')

rom = prg1 + key + bg + obj + prg2

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
