#
#	Time Tunnel
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('un01.69') + z.read('un02.68') + z.read('un03.67') + z.read('un04.66') + z.read('un05.65') + z.read('un06.64') + z.read('un07.55') + z.read('un08.54') + z.read('un09.53') + z.read('un10.52')
    prg2 = z.read('un19.70')
    gfx = z.read('un11.1') + z.read('un12.2') + z.read('un13.3') + z.read('un14.4') + z.read('un15.5') + z.read('un16.6') + z.read('un17.7') + z.read('un18.8')
    pri = z.read('eb16.22')

rom = prg1 + prg2 + gfx + pri

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
