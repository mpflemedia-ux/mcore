import sys
F, G = sys.argv[1], sys.argv[2]
s = open(F, encoding='utf-8').read()
a = '<script src="./pay-sheet.js?v=2"></script>\n<script src="./pay-void.js?v=1"></script>\n<script src="./pay-vlist.js?v=1"></script>\n'
b = '<script src="./pay-sheet.js?v=3"></script>\n<script src="./pay-void.js?v=1"></script>\n<script src="./pay-vlist.js?v=1"></script>\n<script src="./pay-claim.js?v=1"></script>\n<script src="./pay-rcpt.js?v=1"></script>\n'
assert s.count(a) == 1; s = s.replace(a, b)
a = '<script src="./wa-doc2-public.js?v=1"></script>\n'
assert s.count(a) == 1; s = s.replace(a, a + '<script src="./pay-claim-pub.js?v=1"></script>\n')
open(F, 'w', encoding='utf-8').write(s)
g = open(G, encoding='utf-8').read()
assert g.count(a) == 1; g = g.replace(a, a + '<script src="./pay-claim-pub.js?v=1"></script>\n')
open(G, 'w', encoding='utf-8').write(g)
print('patched')
