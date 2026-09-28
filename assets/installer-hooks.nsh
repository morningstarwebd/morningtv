; ==============================================================================
; MorningTV NSIS Installer Hooks: Process Tree Terminator
; Prevents "Error opening file for writing" during install/update/uninstall
;
; Uses Windows-native `taskkill /F /T` to forcibly kill the ENTIRE process tree
; (main binary, WebView2 renderers, local proxy threads, GPU helpers).
; The `/T` flag terminates child processes holding file locks.
; ==============================================================================

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping all running MorningTV instances..."

  ; Kill MorningTV app and its full process tree (Stream Proxy, WebView2, GPU)
  nsExec::Exec 'taskkill /F /T /IM "morningtv.exe"'
  Pop $R9
  nsExec::Exec 'taskkill /F /T /IM "MorningTV.exe"'
  Pop $R9

  ; 1500ms settle time for Windows kernel to:
  ;   - Release NTFS file handles from terminated processes
  ;   - Flush page tables and mapped file sections
  ;   - Complete asynchronous I/O manager cleanup
  Sleep 1500

  DetailPrint "Process cleanup complete."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "MorningTV installation finalized successfully."
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping running instances before uninstall..."

  nsExec::Exec 'taskkill /F /T /IM "morningtv.exe"'
  Pop $R9
  nsExec::Exec 'taskkill /F /T /IM "MorningTV.exe"'
  Pop $R9

  Sleep 1500

  DetailPrint "Process cleanup complete."
!macroend
