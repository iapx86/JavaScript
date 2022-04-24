#
#	Turbo Out Run
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg3 = z.read('epr-12300.88')
    pcm = z.read('opr-12301.66') + z.read('opr-12302.67') + z.read('opr-12303.68') + z.read('opr-12304.69') + z.read('opr-12305.70') + z.read('opr-12306.71') + b'\xff' * 0x20000

rom = prg3 + pcm

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
