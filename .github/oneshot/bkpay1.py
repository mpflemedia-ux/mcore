import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
o = '<script src="./pay-pack.js?v=1"></script>'
names = ['booking-pay-i18n', 'booking-pay-api', 'booking-pay-pub-css', 'booking-pay-pub-ui', 'booking-pay-pub', 'booking-pay-ver', 'booking-pay-q-css', 'booking-pay-q', 'booking-pay-dep']
n = o + '\n' + '\n'.join('<script src="./%s.js?v=1"></script>' % x for x in names)
assert s.count(o) == 1
assert 'booking-pay-' not in s
s = s.replace(o, n)
open(F, 'w', encoding='utf-8').write(s)
print('patched')
