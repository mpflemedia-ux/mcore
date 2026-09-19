(function () {
  function fix() {
    var folder = document.getElementById('docs-folder');
    var box = document.getElementById('docs-result');
    if (!box || !folder) return;
    var txt = box.textContent || '';
    if (!/SSM|Borang D/i.test(txt)) return;
    if (/01_Contracts/.test(folder.value)) {
      folder.value = folder.value.replace(/01_Contracts & Agreements/g, '08_Legal');
    }
  }
  setInterval(fix, 600);
})();
