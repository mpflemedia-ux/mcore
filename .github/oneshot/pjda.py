import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
for a, b in [
  ('<script src="./pj-sr-convert.js?v=2"></script>\n', '<script src="./pj-sr-convert.js?v=3"></script>\n'),
  ('<script src="./pj-multi2-detail.js?v=1"></script>\n', '<script src="./pj-multi2-detail.js?v=2"></script>\n'),
  ('<script src="./pj-share-wa.js?v=2"></script>\n', '<script src="./pj-share-wa.js?v=2"></script>\n<script src="./pj-done-auto.js?v=1"></script>\n'),
]:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
open(F, 'w', encoding='utf-8').write(s)
print('patched')
