import sys, base64
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
a = '<script src="./notif-settings.js?v=3"></script>\n'
assert s.count(a) == 1
add = ''.join('<script src="./%s.js?v=1"></script>\n' % n for n in ['notif-os', 'notif-push', 'notif-push-boot', 'notif-push-ui', 'notif-push-admin'])
s = s.replace(a, a + add)
for o, n in [('<script src="./notif-core.js?v=2"></script>', '<script src="./notif-core.js?v=3"></script>'), ("navigator.serviceWorker.register('./sw.js?v=14')", "navigator.serviceWorker.register('./sw.js?v=15')")]:
    assert s.count(o) == 1
    s = s.replace(o, n)
open(F, 'w', encoding='utf-8').write(s)
open('app/icons/badge-96.png', 'wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAABVElEQVR42u3bSw6CQBRE0Ya4/y3j1DhSoV/Xk3PnBqhfY6JjAAAAAAAAAACAf2f79YPHcRynL75tW4oQq55n7/7Q3e9jNwJr2e+cvoTra8DdG7AyhQlnUEwDqsVIeQEwQQyoT2VK+jWAAfXpTEp/bANmiZQmvgliQF1aE9OvAQyoSW1q+ls04Kx4yeKbIAbMTXF6+jWAAfPS3CH97RrwqahdxDdBDLi+BZ3SrwEMuLYF3dLfugHvYncU3wQx4JoWdE2/BjCg/hsyA15I+Xn6yvvY7/zwCdd3BjgD1qUwYQI1gAFr0pjyAhDVgCpRkv4caIIYUJvOpPTHNmCWSGnimyAG1KU1Mf3xDbhKtFTxTRAD5qc3Of0awIC5KU5Pf6sGfCtmB/FNEAPmtKBL+scY49EtMZ3ENUEMAAMYAAYwAAxgABjAADCAAWAAAAAAAAAAAAD34gmajJRklBvx2AAAAABJRU5ErkJggg=='))
print('patched')
