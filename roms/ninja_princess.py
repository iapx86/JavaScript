#
#	Ninja Princess
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('nprincesu/epr-6573.129') + z.read('nprincesu/epr-6574.130') + z.read('nprincesu/epr-6575.131') + z.read('nprincesu/epr-6576.132') + z.read('nprinces/epr-6616.133') + z.read('nprincesu/epr-6578.134')
    prg2 = z.read('epr-6559.120')
    bg = z.read('epr-6558.62') + z.read('nprinces/epr-6557.61') + z.read('epr-6556.64') + z.read('nprinces/epr-6555.63') + z.read('epr-6554.66') + z.read('nprinces/epr-6553.65')
    obj = z.read('epr-6546.117') + z.read('epr-6548.04') + z.read('epr-6547.110') + z.read('ninja/epr-6549.05')
    pri = z.read('pr-5317.76')

rom = prg1 + prg2 + bg + obj + pri

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
