import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
R = [('booking.js?v=1', 'booking.js?v=2'),
     ('booking-pay-i18n.js?v=1', 'booking-pay-i18n.js?v=2'),
     ('booking-pay-pub-css.js?v=2', 'booking-pay-pub-css.js?v=3'),
     ('booking-pay-pub-ui.js?v=1', 'booking-pay-pub-ui.js?v=2'),
     ('booking-pay-pub.js?v=1', 'booking-pay-pub.js?v=2')]
for a, b in R:
    a = '<script src="./' + a + '"></script>'
    assert s.count(a) == 1, a
    s = s.replace(a, '<script src="./' + b + '"></script>')
q = '<script src="./booking-pay-q.js?v=1"></script>'
assert s.count(q) == 1, 'q'
assert s.count('booking-pay-go.js') == 0, 'go'
s = s.replace(q, '<script src="./booking-pay-q.js?v=2"></script>\n<script src="./booking-pay-go.js?v=1"></script>')
open(p, 'w', encoding='utf-8', newline='').write(s)
