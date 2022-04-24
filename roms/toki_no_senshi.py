#
#	Toki no Senshi
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('epr-10961.ic90') + z.read('epr-10962.ic91') + z.read('epr-10963.ic92')
    key = z.read('317-0040.key')
    prg2 = z.read('epr-10967.ic126')
    bg = z.read('epr-10964.ic4') + z.read('epr-10965.ic5') + z.read('epr-10966.ic6')
    obj = z.read('epr-10958.ic87') + z.read('epr-10957.ic86') + z.read('epr-10960.ic89') + z.read('epr-10959.ic88')
    red = z.read('pr10956.ic20')
    green = z.read('pr10955.ic14')
    blue = z.read('pr10954.ic8')
    pri = z.read('pr-5317.ic28')

rom = prg1 + key + prg2 + bg + obj + red + green + blue + pri

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
