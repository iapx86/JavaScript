#
#	Out Run
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg3 = z.read('epr-10187.88')
    pcm = z.read('opr-10193.66') * 2 + z.read('opr-10192.67') * 2 + z.read('opr-10191.68') * 2 + z.read('opr-10190.69') * 2 + z.read('opr-10189.70') * 2 + z.read('opr-10188.71') * 2 + b'\xff' * 0x20000

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
