(function () {
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  try {
    localStorage.setItem('mcore_docs_drive_client', CID);
    if (!localStorage.getItem('mcore_docs_drive_root')) {
      localStorage.setItem('mcore_docs_drive_root', ROOT);
    }
  } catch (e) {}
  function once() {
    var cid = document.getElementById('docs-cid');
    if (!cid || cid.getAttribute('data-locked') === '1') return;
    cid.value = CID;
    cid.readOnly = true;
    cid.setAttribute('data-locked', '1');
    cid.setAttribute('autocapitalize', 'none');
    cid.setAttribute('autocomplete', 'off');
    cid.setAttribute('spellcheck', 'false');
    cid.style.textTransform = 'none';
    var root = document.getElementById('docs-root');
    if (root && !root.value) root.value = ROOT;
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'docs-connect') once();
  }, true);
  var n = 0;
  var t = setInterval(function () {
    once();
    n++;
    if (n > 8) clearInterval(t);
  }, 300);
})();
