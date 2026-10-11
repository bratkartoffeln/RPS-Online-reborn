const [major, minor] = process.versions.node.split('.').map(Number);
if (!(major > 22 || (major === 22 && minor >= 12))) {
  console.error('Node.js ab Version 22.12 wird benoetigt. Gefunden: ' + process.versions.node);
  process.exit(1);
}
