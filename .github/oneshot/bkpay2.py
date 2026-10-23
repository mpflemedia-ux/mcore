import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
a = '<script src="./booking-pay-pub-css.js?v=1"></script>'
assert s.count(a) == 1, 'anchor'
s = s.replace(a, '<script src="./booking-pay-pub-css.js?v=2"></script>')
open(p, 'w', encoding='utf-8', newline='').write(s)
