#
#	Flicky
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('flickyo/epr-5857.bin') + z.read('flickyo/epr-5858a.bin') + z.read('flickyo/epr-5859.bin') + z.read('flickyo/epr-5860.bin')
    prg2 = z.read('epr-5869.120')
    bg = z.read('epr-5868.62') + z.read('epr-5867.61') + z.read('epr-5866.64') + z.read('epr-5865.63') + z.read('epr-5864.66') + z.read('epr-5863.65')
    obj = z.read('epr-5855.117') + z.read('epr-5856.110')
    pri = z.read('pr-5317.76')

rom = prg1 + prg2 + bg + obj + pri

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
