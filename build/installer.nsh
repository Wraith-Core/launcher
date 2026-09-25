; Sign every executable makensis writes, the moment it is written. electron-builder runs a temporary
; installer stub to produce the uninstaller; on a PC with Windows 11 Smart App Control an unsigned stub
; is blocked ("spawn UNKNOWN"), so it has to carry the Wraith Core signature before it runs.
!finalize `powershell -NoProfile -NonInteractive -Command "$c = Get-Item Cert:\CurrentUser\My\6529C1D352A5AE451AD46FC52797D72C439ADBDB; $r = Set-AuthenticodeSignature -FilePath '%1' -Certificate $c -HashAlgorithm SHA256 -TimestampServer http://timestamp.digicert.com; if ($r.Status -ne 'Valid') { exit 1 }"`
