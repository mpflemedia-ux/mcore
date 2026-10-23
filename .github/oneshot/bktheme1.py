import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
o = '<script src="./booking-public-contrast.js?v=1"></script>'
n = '<script src="./booking-pub-css.js?v=1"></script>\n<script src="./booking-pub-i18n.js?v=1"></script>\n<script src="./booking-public-contrast.js?v=2"></script>'
assert s.count(o) == 1
s = s.replace(o, n)
open(F, 'w', encoding='utf-8').write(s)
print('patched')
