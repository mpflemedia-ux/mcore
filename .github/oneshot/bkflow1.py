import sys
F = sys.argv[1]
s = open(F, encoding="utf-8").read()
repls = [
  ("booking-state.js?v=2", "booking-state.js?v=3"),
  ("booking-realtime.js?v=2", "booking-realtime.js?v=3"),
  ("booking-card-ui.js?v=3", "booking-card-ui.js?v=4"),
  ("wa-doc-hooks.js?v=1", "wa-doc-hooks.js?v=2"),
  ("booking-token-fix.js?v=2", "booking-token-fix.js?v=3"),
  ("booking-pay-i18n.js?v=2", "booking-pay-i18n.js?v=3"),
  ("booking-pay-pub-ui.js?v=2", "booking-pay-pub-ui.js?v=3"),
  ("booking-pay-ver.js?v=1", "booking-pay-ver.js?v=2"),
  ("booking-pay-q.js?v=2", "booking-pay-q.js?v=3"),
  ("booking-pay-go.js?v=1", "booking-pay-go.js?v=2"),
  ("booking-pay-dep.js?v=1", "booking-pay-dep.js?v=2"),
]
for a, b in repls:
    assert s.count(a) == 1, a
    s = s.replace(a, b, 1)
needle = '<script src="./booking-pay-dep.js?v=2"></script>'
inject = needle + "\n" + "\n".join(
    '<script src="./%s.js?v=1"></script>' % x
    for x in ["booking-inbox-i18n", "booking-inbox-css", "booking-inbox", "booking-inbox2", "booking-notif-set"]
)
assert s.count(needle) == 1
s = s.replace(needle, inject, 1)
open(F, "w", encoding="utf-8").write(s)
print("patched")
