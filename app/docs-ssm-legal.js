(function () {
  function fix() {
    var folder = document.getElementById('docs-folder');
    var box = document.getElementById('docs-result');
    if (!box || !folder) return;
    var txt = box.textContent || '';
    if (!/SSM|Borang D/i.test(txt)) return;
    if (/08_Legal/.test(folder.value)) return;
    folder.value = folder.value.replace(/01_Contracts & Agreements/g, '08_Legal');
    if (!/08_Legal/.test(folder.value) && folder.value.indexOf('05_Clients/') === 0) {
      var parts = folder.value.split('/');
      if (parts.length >= 2) folder.value = parts[0] + '/' + parts[1] + '/08_Legal';
    }
    box.innerHTML = box.innerHTML.replace(/01_Contracts & Agreements/g, '08_Legal');
  }
  setInterval(fix, 400);
})();
