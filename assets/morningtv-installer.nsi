Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2

!if "{{compression}}" == "none"
  SetCompress off
!else
  SetCompressor /SOLID "{{compression}}"
!endif

!include MUI2.nsh
!include FileFunc.nsh
!include StrFunc.nsh
!include x64.nsh
!include WordFunc.nsh
!include nsDialogs.nsh
!include "utils.nsh"
!include "FileAssociation.nsh"
!include "Win\COM.nsh"
!include "Win\Propkey.nsh"
${Using:StrFunc} StrLoc

{{#if installer_hooks}}
!include "{{installer_hooks}}"
{{/if}}

!define WEBVIEW2APPGUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define MANUFACTURER "{{manufacturer}}"
!define PRODUCTNAME "{{product_name}}"
!define VERSION "{{version}}"
!define VERSIONWITHBUILD "{{version_with_build}}"
!define HOMEPAGE "{{homepage}}"
!define INSTALLMODE "{{install_mode}}"
!define LICENSE "{{license}}"
!define INSTALLERICON "{{installer_icon}}"
!define MAINBINARYNAME "{{main_binary_name}}"
!define MAINBINARYSRCPATH "{{main_binary_path}}"
!define BUNDLEID "{{bundle_id}}"
!define COPYRIGHT "{{copyright}}"
!define OUTFILE "{{out_file}}"
!define ARCH "{{arch}}"
!define ADDITIONALPLUGINSPATH "{{additional_plugins_path}}"
!define ALLOWDOWNGRADES "{{allow_downgrades}}"
!define DISPLAYLANGUAGESELECTOR "{{display_language_selector}}"
!define INSTALLWEBVIEW2MODE "{{install_webview2_mode}}"
!define WEBVIEW2INSTALLERARGS "{{webview2_installer_args}}"
!define WEBVIEW2INSTALLERPATH "{{webview2_installer_path}}"
!define ESTIMATEDSIZE "{{estimated_size}}"
!define STARTMENUFOLDER "{{start_menu_folder}}"

Var PassiveMode
Var UpdateMode
Var NoShortcutMode
Var WixMode
Var OldMainBinaryName
Var AppStartMenuFolder
Var DeleteAppDataCheckboxState
Var Dialog
Var HwndDesktopCheckbox
Var HwndStartupCheckbox
Var DesktopShortcutState
Var StartupShortcutState
Var SummaryBox

Name "${PRODUCTNAME}"
BrandingText "MorningTV | Native Windows Live Television"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\${PRODUCTNAME}"
VIProductVersion "${VERSIONWITHBUILD}"
VIAddVersionKey "ProductName" "${PRODUCTNAME}"
VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
!addplugindir "${ADDITIONALPLUGINSPATH}"

!if "${INSTALLMODE}" == "perMachine"
  RequestExecutionLevel admin
!else if "${INSTALLMODE}" == "currentUser"
  RequestExecutionLevel user
!else
  !define MULTIUSER_MUI
  !define MULTIUSER_INSTALLMODE_INSTDIR "${PRODUCTNAME}"
  !define MULTIUSER_INSTALLMODE_COMMANDLINE
  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_VALUENAME "CurrentUser"
  !define MULTIUSER_INSTALLMODE_FUNCTION RestorePreviousInstallLocation
  !define MULTIUSER_EXECUTIONLEVEL Highest
  !include MultiUser.nsh
!endif

!if "${INSTALLERICON}" != ""
  !define MUI_ICON "${INSTALLERICON}"
!endif

!define MUI_ABORTWARNING
!define MUI_BGCOLOR "FFFFFF"
!define MUI_TEXT_LICENSE_TITLE "License Agreement"
!define MUI_TEXT_LICENSE_SUBTITLE "Please read the following important information before continuing."
!define MUI_LICENSEPAGE_TEXT_TOP "Please read the following License Agreement. You must accept the terms of this agreement before continuing with the installation."
!define MUI_LICENSEPAGE_RADIOBUTTONS
!define MUI_LICENSEPAGE_RADIOBUTTONS_TEXT_ACCEPT "I accept the agreement"
!define MUI_LICENSEPAGE_RADIOBUTTONS_TEXT_DECLINE "I do not accept the agreement"
!define MUI_TEXT_DIRECTORY_TITLE "Select Destination Location"
!define MUI_TEXT_DIRECTORY_SUBTITLE "Where should ${PRODUCTNAME} be installed?"
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install ${PRODUCTNAME} into the following folder.$\r$\n$\r$\nTo continue, click Next. If you would like to select a different folder on any drive (e.g. C:, D:, E:), click Browse."
!define MUI_TEXT_STARTMENU_TITLE "Select Start Menu Folder"
!define MUI_TEXT_STARTMENU_SUBTITLE "Where should Setup place the program's shortcuts?"
!define MUI_STARTMENUPAGE_TEXT_TOP "Setup will create the program's shortcuts in the following Start Menu folder.$\r$\n$\r$\nTo continue, click Next. If you would like to select a different folder, click Browse."
!define MUI_STARTMENUPAGE_TEXT_CHECKBOX "Don't create a Start Menu folder"
!define MUI_TEXT_INSTALLING_TITLE "Installing"
!define MUI_TEXT_INSTALLING_SUBTITLE "Please wait while Setup installs ${PRODUCTNAME} on your computer."
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCTNAME}"
!define MUI_FINISHPAGE_RUN_FUNCTION RunMainBinary

!if "${LICENSE}" != ""
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MUI_PAGE_LICENSE "${LICENSE}"
!endif
!if "${INSTALLMODE}" == "both"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MULTIUSER_PAGE_INSTALLMODE
!endif
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_DIRECTORY
!if "${STARTMENUFOLDER}" != ""
  !define MUI_STARTMENUPAGE_DEFAULTFOLDER "${STARTMENUFOLDER}"
  !define MUI_STARTMENUPAGE_NODISABLE
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MUI_PAGE_STARTMENU Application $AppStartMenuFolder
!endif

Page custom SelectTasksPage LeaveTasksPage
Page custom ReadyToInstallPage LeaveReadyToInstallPage
!insertmacro MUI_PAGE_INSTFILES
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_FINISH

!define MUI_PAGE_CUSTOMFUNCTION_PRE un.SkipIfPassive
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

{{#each languages}}
!insertmacro MUI_LANGUAGE "{{this}}"
{{/each}}
!insertmacro MUI_RESERVEFILE_LANGDLL
{{#each language_files}}
!include "{{this}}"
{{/each}}

Function .onInit
  ${GetOptions} $CMDLINE "/P" $PassiveMode
  ${IfNot} ${Errors}
    StrCpy $PassiveMode 1
  ${EndIf}
  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}
  ${GetOptions} $CMDLINE "/NS" $NoShortcutMode
  ${IfNot} ${Errors}
    StrCpy $NoShortcutMode 1
  ${EndIf}

  ${If} $UpdateMode = 1
  ${OrIf} $PassiveMode = 1
    nsExec::Exec 'taskkill /F /T /IM "morningtv.exe"'
    Pop $R9
    nsExec::Exec 'taskkill /F /T /IM "MorningTV.exe"'
    Pop $R9
    Sleep 800
  ${EndIf}

  StrCpy $DesktopShortcutState ${BST_CHECKED}
  StrCpy $StartupShortcutState ${BST_UNCHECKED}
  !insertmacro SetContext
  !if "${INSTALLMODE}" == "both"
    !insertmacro MULTIUSER_INIT
  !endif
  Call RestorePreviousInstallLocation
FunctionEnd

Function SelectTasksPage
  Call SkipIfPassive
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Select Additional Tasks" "Which additional tasks should be performed?"
  ${NSD_CreateLabel} 0 0 100% 20u "Select the additional tasks you would like Setup to perform while installing ${PRODUCTNAME}, then click Next."
  Pop $0
  ${NSD_CreateLabel} 0 25u 100% 10u "Additional icons:"
  Pop $0
  ${NSD_CreateCheckbox} 10u 37u 90% 12u "Create a desktop shortcut"
  Pop $HwndDesktopCheckbox
  ${NSD_SetState} $HwndDesktopCheckbox $DesktopShortcutState
  ${NSD_CreateLabel} 0 58u 100% 10u "Startup options:"
  Pop $0
  ${NSD_CreateCheckbox} 10u 70u 90% 12u "Launch ${PRODUCTNAME} automatically on Windows startup"
  Pop $HwndStartupCheckbox
  ${NSD_SetState} $HwndStartupCheckbox $StartupShortcutState
  nsDialogs::Show
FunctionEnd

Function LeaveTasksPage
  ${NSD_GetState} $HwndDesktopCheckbox $DesktopShortcutState
  ${NSD_GetState} $HwndStartupCheckbox $StartupShortcutState
FunctionEnd

Function ReadyToInstallPage
  Call SkipIfPassive
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Ready to Install" "Setup is now ready to begin installing ${PRODUCTNAME} on your computer."
  ${NSD_CreateLabel} 0 0 100% 18u "Click Install to continue with the installation, or click Back if you want to review or change any settings."
  Pop $0
  StrCpy $1 "Destination location:$\r$\n   $INSTDIR$\r$\n$\r$\n"
  !if "${STARTMENUFOLDER}" != ""
    StrCpy $1 "$1Start Menu folder:$\r$\n   $AppStartMenuFolder$\r$\n$\r$\n"
  !endif
  StrCpy $1 "$1Additional tasks:$\r$\n"
  ${If} $DesktopShortcutState == ${BST_CHECKED}
    StrCpy $1 "$1   Additional icons:$\r$\n      Create a desktop shortcut$\r$\n"
  ${EndIf}
  ${If} $StartupShortcutState == ${BST_CHECKED}
    StrCpy $1 "$1   Startup options:$\r$\n      Launch on Windows startup$\r$\n"
  ${EndIf}
  ${NSD_CreateText} 0 20u 100% 100u $1
  Pop $SummaryBox
  SendMessage $SummaryBox 0x00CF 1 0 ; EM_SETREADONLY
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x000C 0 "STR:Install"
  nsDialogs::Show
FunctionEnd

Function LeaveReadyToInstallPage
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x000C 0 "STR:$(^NextBtn)"
FunctionEnd

Section WebView2
  ${If} $UpdateMode = 1
    Goto webview_done
  ${EndIf}
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}
  ${If} $0 == ""
    !if "${INSTALLWEBVIEW2MODE}" == "downloadBootstrapper"
      DetailPrint "Downloading and installing Microsoft Edge WebView2 Runtime..."
      NSISdl::download "https://go.microsoft.com/fwlink/p/?LinkId=2124703" "$TEMP\MicrosoftEdgeWebview2Setup.exe"
      Pop $0
      ${If} $0 == "success"
        ExecWait '"$TEMP\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
        Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
      ${EndIf}
    !else if "${INSTALLWEBVIEW2MODE}" == "offlineInstaller"
      Delete "$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe"
      File "/oname=$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe" "${WEBVIEW2INSTALLERPATH}"
      ExecWait '"$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe" ${WEBVIEW2INSTALLERARGS} /install' $1
      ${If} $1 <> 0
        Abort "WebView2 installation failed."
      ${EndIf}
    !endif
  ${EndIf}
  webview_done:
SectionEnd

Section Install
  SetOutPath $INSTDIR
  !ifmacrodef NSIS_HOOK_PREINSTALL
    !insertmacro NSIS_HOOK_PREINSTALL
  !endif
  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
  File "${MAINBINARYSRCPATH}"
  {{#each resources_dirs}}
    CreateDirectory "$INSTDIR/{{this}}"
  {{/each}}
  {{#each resources}}
    File /a "/oname={{this.[1]}}" "{{no-escape @key}}"
  {{/each}}
  {{#each binaries}}
    File /a "/oname={{this}}" "{{no-escape @key}}"
  {{/each}}
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr SHCTX "Software\${MANUFACTURER}\${PRODUCTNAME}" "" $INSTDIR
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "Publisher" "${MANUFACTURER}"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "DisplayIcon" "$INSTDIR\${MAINBINARYNAME}.exe"

  !if "${STARTMENUFOLDER}" != ""
    !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
      Call CreateOrUpdateStartMenuShortcut
    !insertmacro MUI_STARTMENU_WRITE_END
  !endif

  ${If} $DesktopShortcutState == ${BST_CHECKED}
  ${OrIf} $PassiveMode = 1
  ${OrIf} ${Silent}
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}

  ${If} $StartupShortcutState == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}" '"$INSTDIR\${MAINBINARYNAME}.exe"'
  ${EndIf}

  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    SetAutoClose true
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTINSTALL
    !insertmacro NSIS_HOOK_POSTINSTALL
  !endif
SectionEnd

Function .onInstSuccess
  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    ${GetOptions} $CMDLINE "/R" $R0
    ${IfNot} ${Errors}
      ${GetOptions} $CMDLINE "/ARGS" $R0
      nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" "$R0"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function RunMainBinary
  nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" ""
FunctionEnd

Section Uninstall
  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
  Delete "$INSTDIR\${MAINBINARYNAME}.exe"
  {{#each resources}}
    Delete "$INSTDIR/{{this.[1]}}"
  {{/each}}
  {{#each binaries}}
    Delete "$INSTDIR/{{this}}"
  {{/each}}
  Delete "$INSTDIR\uninstall.exe"
  {{#each resources_ancestors}}
    RMDir /REBOOTOK "$INSTDIR/{{this}}"
  {{/each}}
  RMDir "$INSTDIR"
  !if "${STARTMENUFOLDER}" != ""
    !insertmacro MUI_STARTMENU_GETFOLDER Application $AppStartMenuFolder
    Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    RMDir "$SMPROGRAMS\$AppStartMenuFolder"
  !endif
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
  DeleteRegKey SHCTX "Software\${MANUFACTURER}\${PRODUCTNAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  !ifmacrodef NSIS_HOOK_POSTUNINSTALL
    !insertmacro NSIS_HOOK_POSTUNINSTALL
  !endif
  ${If} $PassiveMode = 1
  ${OrIf} $UpdateMode = 1
    SetAutoClose true
  ${EndIf}
SectionEnd

Function un.onInit
  !insertmacro SetContext
  !if "${INSTALLMODE}" == "both"
    !insertmacro MULTIUSER_UNINIT
  !endif
  ${GetOptions} $CMDLINE "/P" $PassiveMode
  ${IfNot} ${Errors}
    StrCpy $PassiveMode 1
  ${EndIf}
  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}

  nsExec::Exec 'taskkill /F /T /IM "morningtv.exe"'
  Pop $R9
  nsExec::Exec 'taskkill /F /T /IM "MorningTV.exe"'
  Pop $R9
  Sleep 800
FunctionEnd

Function RestorePreviousInstallLocation
  ReadRegStr $0 SHCTX "Software\${MANUFACTURER}\${PRODUCTNAME}" ""
  ${If} $0 != ""
    ${StrLoc} $1 $0 "\_up_" ">"
    ${If} $1 != ""
      StrCpy $0 $0 $1
    ${EndIf}
    StrCpy $INSTDIR $0
  ${EndIf}
FunctionEnd

Function SkipIfPassive
  ${IfThen} $PassiveMode = 1 ${|} Abort ${|}
FunctionEnd

Function un.SkipIfPassive
  ${IfThen} $PassiveMode = 1 ${|} Abort ${|}
FunctionEnd

Function CreateOrUpdateStartMenuShortcut
  ${If} $UpdateMode = 1
    Return
  ${EndIf}
  ${If} $NoShortcutMode = 1
    Return
  ${EndIf}
  CreateDirectory "$SMPROGRAMS\$AppStartMenuFolder"
  CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
FunctionEnd

Function CreateOrUpdateDesktopShortcut
  ${If} $UpdateMode = 1
    Return
  ${EndIf}
  ${If} $NoShortcutMode = 1
    Return
  ${EndIf}
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
FunctionEnd
