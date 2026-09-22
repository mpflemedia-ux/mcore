(function () {
  function setLine(box, label, value) {
    if (!value) return;
    var nodes = box.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.querySelector('b') && el.textContent.indexOf(label) === 0 && el.children.length <= 2) {
        var next = '<b>' + label + '</b> \u2014 ' + value;
        if (el.innerHTML !== next) el.innerHTML = next;
      }
    }
  }
  function apply() {
    var cls = window._docsAiClass;
    if (!cls || !cls.folder) return;
    var folder = document.getElementById('docs-folder');
    var box = document.getElementById('docs-result');
    if (!folder || !box) return;
    if (folder.value !== cls.folder) folder.value = cls.folder;
    setLine(box, 'What', cls.what);
    setLine(box, 'Who', cls.who);
    setLine(box, 'Where', cls.folder);
    setLine(box, 'Why', cls.why);
  }
  setInterval(apply, 350);
})();
