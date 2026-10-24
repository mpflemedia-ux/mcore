import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
R = [("booking.js?v=2", "booking.js?v=3"),
     ("booking-realtime.js?v=1", "booking-realtime.js?v=2"),
     ("booking-card-ui.js?v=2", "booking-card-ui.js?v=3")]
for a, b in R:
    a = "<script src=\"./" + a + "\"></script>"
    assert s.count(a) == 1, a
    s = s.replace(a, "<script src=\"./" + b + "\"></script>")
open(p, "w", encoding="utf-8", newline="").write(s)
