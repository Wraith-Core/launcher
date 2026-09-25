// electron-builder signing hook: signs each Windows binary with the "Wraith Core" code-signing
// certificate from this PC's certificate store (the private key never leaves the store).
//
// Why a hook instead of electron-builder's built-in signtool call: build/installer.nsh signs the
// temporary NSIS stub as soon as makensis writes it (Smart App Control blocks it unsigned), and a
// signed stub copies its certificate-table entry into the uninstaller it writes. That entry then
// points past the end of the uninstaller, which signtool rejects (0x800700C1). Clearing the stale
// entry first turns it back into a normal unsigned executable that signs cleanly.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const THUMBPRINT = '6529C1D352A5AE451AD46FC52797D72C439ADBDB';
const TIMESTAMP = 'http://timestamp.digicert.com';

function clearStaleCertificateTable(file) {
  const b = fs.readFileSync(file);
  if (b.length < 0x40 || b.readUInt16LE(0) !== 0x5a4d) return; // not "MZ"
  const pe = b.readUInt32LE(0x3c);
  if (b.readUInt32LE(pe) !== 0x4550) return; // not "PE\0\0"
  const magic = b.readUInt16LE(pe + 24);
  const dataDirs = pe + 24 + (magic === 0x20b ? 112 : 96);
  const entry = dataDirs + 4 * 8; // IMAGE_DIRECTORY_ENTRY_SECURITY
  const offset = b.readUInt32LE(entry);
  const size = b.readUInt32LE(entry + 4);
  if (offset && offset + size > b.length) {
    b.writeUInt32LE(0, entry);
    b.writeUInt32LE(0, entry + 4);
    fs.writeFileSync(file, b);
    console.log(`  • cleared stale certificate table  file=${file}`);
  }
}

exports.default = async function sign(configuration) {
  const file = configuration.path;
  clearStaleCertificateTable(file);
  const quoted = file.replace(/'/g, "''");
  const script = [
    `$c = Get-Item 'Cert:\\CurrentUser\\My\\${THUMBPRINT}' -ErrorAction Stop`,
    `$r = Set-AuthenticodeSignature -LiteralPath '${quoted}' -Certificate $c -HashAlgorithm SHA256 -TimestampServer '${TIMESTAMP}'`,
    `if ($r.SignerCertificate.Thumbprint -ne '${THUMBPRINT}') { Write-Error ('signing failed: ' + $r.StatusMessage); exit 1 }`,
  ].join('; ');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
};
