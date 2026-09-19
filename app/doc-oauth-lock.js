(function () {
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  try {
    localStorage.setItem('mcore_docs_drive_client', CID);
    if (!localStorage.getItem('mcore_docs_drive_root')) {
      localStorage.setItem('mcore_docs_drive_root', ROOT);
    }
  } catch (e) {}
  function lock() {
    var cid = document.getElementById('docs-cid');
    if (cid) {
      cid.value = CID;
      cid.setAttribute('autocapitalize', 'none');
      cid.setAttribute('autocomplete', 'off');
      cid.setAttribute('autocorrect', 'off');
      cid.setAttribute('spellcheck', 'false');
      cid.style.textTransform = 'none';
    }
    var root = document.getElementById('docs-root');
    if (root && !root.value) root.value = ROOT;
  }
  setInterval(lock, 400);
})();
