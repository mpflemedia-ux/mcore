import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
a = '<script src="./onboarding-review.js?v=1"></script>\n'
assert s.count(a) == 1
s = s.replace(a, a + '<script src="./onboarding-review-mobile.js?v=1"></script>\n')
open(F, 'w', encoding='utf-8').write(s)
print('patched')
