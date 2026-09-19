try {
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  if (!localStorage.getItem('mcore_docs_drive_root')) {
    localStorage.setItem('mcore_docs_drive_root', ROOT);
  }
  localStorage.setItem('mcore_docs_drive_client', CID);
} catch (e) {}
