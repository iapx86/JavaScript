#
#	Wonder Boy
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('wboy2/epr-7587.129') + z.read('wboy2/epr-7588.130') + z.read('wboy2/epr-7589.131') + z.read('wboy2/epr-7590.132') + z.read('wboy2/epr-7591.133') + z.read('wboy2/epr-7592.134')
    prg2 = z.read('epr-7498.120')
    bg = z.read('epr-7497.62') + z.read('epr-7496.61') + z.read('epr-7495.64') + z.read('epr-7494.63') + z.read('epr-7493.66') + z.read('epr-7492.65')
    obj = z.read('epr-7485.117') + z.read('epr-7487.04') + z.read('epr-7486.110') + z.read('epr-7488.05')
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
