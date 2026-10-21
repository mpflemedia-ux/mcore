import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
a = '<script src="./pay-rcpt.js?v=1"></script>\n'
b = a + '<script src="./pay-zip.js?v=1"></script>\n<script src="./pay-rep.js?v=1"></script>\n<script src="./pay-pack.js?v=1"></script>\n'
assert s.count(a) == 1
s = s.replace(a, b)
open(F, 'w', encoding='utf-8').write(s)
print('patched')
