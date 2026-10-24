import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
a = '<script src="./booking-token-fix.js?v=1"></script>'
b = '<script src="./booking-token-fix.js?v=2"></script>'
assert s.count(a) == 1, a
s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="").write(s)
