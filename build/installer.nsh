/*
  설치할 때 "실행 중입니다. OK 를 누르면 종료됩니다" 를 안 띄운다.

  왜 —

  electron-builder 기본 동작은 앱이 돌고 있으면 MessageBox 를 띄우고
  **사람이 누를 때까지 무한정 기다린다.** 창이 다른 창 뒤에 깔리면
  설치가 멈춘 것처럼 보인다(실제로 7분을 기다린 적이 있다).

  회사 메신저는 늘 켜져 있는 프로그램이다. 60명에게 새 판을 돌릴 때
  전원이 이 창을 보고 눌러야 한다면 그건 설치가 아니라 숙제다.

  자동 업데이트로 올라올 때(--updated)는 원래도 안 물어봤다. 손으로
  설치 파일을 돌릴 때만 물어봤다. 그 차이를 없앤다.

  무엇을 바꿨나 —

  app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh
  의 _CHECK_APP_RUNNING 을 그대로 옮기고 이 두 줄만 뺐다.

      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK doStopProcess
      Quit

  나머지는 손대지 않았다. 특히 —

  - 먼저 **곱게 닫는다**. KILL_PROCESS 의 두 번째 인자가 0 이면
    taskkill 에 /F 를 안 붙인다 = 창 닫기 신호. 1초 기다렸다가 그래도
    안 죽으면 그때 강제로 끈다. 쓰던 메시지를 날리지 않으려는 순서다.
  - **못 끄면 그때는 묻는다**($(appCannotBeClosed)). 관리자 권한으로
    떠 있어 못 끄는 경우인데, 이건 사람이 손을 대야 풀린다. 이 창까지
    없애면 설치가 조용히 실패한다.

  electron-builder 를 올릴 때 —

  이 매크로는 CHECK_APP_RUNNING 안의 `!ifmacrodef customCheckAppRunning`
  자리에 끼워진다. 공식으로 열어 둔 자리라 웬만해선 안 바뀌지만,
  올린 뒤에는 원본과 다시 견줘 보는 게 좋다. 갈라져도 조용히 지나간다.

  build/installer.nsh 는 nsis.include 의 기본값이라 package.json 에
  따로 적을 것이 없다.
*/

/*
  이 둘은 우리가 직접 챙겨야 한다.

  allowOnlyOneInstallerInstance.nsh 는 이렇게 되어 있다 —

      !ifmacrondef customCheckAppRunning
        !include "getProcessInfo.nsh"
        Var pid
      !endif

  즉 **우리가 매크로를 정의한 순간 저 둘을 안 넣어 준다.** 커스텀
  매크로는 안 쓸 거라고 보는 것이다. 안 챙기면 제거 프로그램을 만들 때
  `Invalid command: "${GetProcessInfo}"` 로 빌드가 깨진다.
*/
!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE

  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
    ${if} ${isUpdated}
      # 앱이 스스로 나갈 틈을 준다
      Sleep 300
    ${endIf}

    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      ${if} ${isUpdated}
        Sleep 1000
      ${endIf}

      # 여기서 원래는 물어봤다. 안 묻고 바로 닫는다.
      DetailPrint "$(appClosing)"

      !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
      # 파일이 "사용 중" 으로 안 잡히게
      Sleep 300

      # 다시 세어 보는 횟수
      StrCpy $R1 0

      loop:
        IntOp $R1 $R1 + 1

        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          # 곱게 나갈 틈을 한 번 더
          Sleep 1000
          !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1 # 1 = 강제
          !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${else}
            Goto not_running
          ${endIf}
        ${else}
          Goto not_running
        ${endIf}

        # 여기까지 왔으면 관리자 권한으로 떠 있어 못 끄는 것이다.
        # 이건 사람이 손을 대야 한다 — 그래서 이 창은 남긴다.
        ${if} $R1 > 1
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
          Quit
        ${else}
          Goto loop
        ${endIf}
      not_running:
    ${endIf}
  ${endIf}
!macroend

/*
  옛 이름으로 만들어진 시작메뉴 바로가기를 치운다.

  왜 —

  0.1.3 까지는 바로가기 이름이 productName 그대로 "Olly Messenger" 였다.
  0.1.4 부터 "올리 메신저" 로 바꿨는데, electron-builder 는 **옛 이름
  링크를 안 지운다.** 지우는 코드가 있긴 한데(installer.nsh 의
  `Rename $oldStartMenuLink $newStartMenuLink`) `keepShortcuts` 가
  켜졌을 때만 돈다. 보통 설치는 새것만 만들고 끝이라 시작메뉴에 두 개가
  남는다.

  새로 까는 사람은 겪지 않는다 — 옛 이름 링크가 아예 없으니까.
  **이미 깔아 본 PC 만** 두 개가 된다. 개발·시험용 PC 가 그렇다.

  없어도 되는 것을 지우는 것뿐이라 실패해도 무시한다.
*/
!macro customInstall
  Delete "$SMPROGRAMS\Olly Messenger.lnk"
  Delete "$DESKTOP\Olly Messenger.lnk"
  ClearErrors
!macroend

/*
  안내형 설치 화면의 문구 — NSIS 기본 안내문은 "재부팅을 하지 않고서도 시스템
  파일을 수정할 수 있게 해줍니다" 같은 남의 말이다 (사장님: "설치 화면이 너무…", 9/9).
  우리 말로 바꾼다. 설치 창의 단추·글꼴은 윈도우 기본이라 여기서는 못 바꾼다.

  이 파일은 UTF-8 **BOM** 이어야 한다. NSIS 3 은 BOM 없는 파일을 시스템 코드페이지로
  읽어서 한글 문구가 깨진다. (patch_nsh*.mjs 가 BOM 을 붙인다 — 편집기로 저장할 때 지우지 말 것)

  ── 왼쪽 그림이 깨지던 것 ──
  MUI 는 164x314 비트맵 하나를 받아 화면 배율(125·150%…)에 맞춰 **늘인다.** 윈도우의
  늘이기(StretchBlt)는 부드럽게 안 늘여서 계단이 진다. 원본을 3배로 줘도 마찬가지 —
  줄일 때도 픽셀을 그냥 버린다(9/9 확인). 그래서 배율마다 **딱 맞는 크기**의 그림을
  다섯 장 넣어 두고, 화면이 뜰 때 그 PC 의 그림 칸 크기를 재서 맞는 장을 늘이지 않고
  붙인다. 그림은 build/side-{100,125,150,175,200}.bmp — PowerShell System.Drawing 으로
  같은 그림을 배율만 달리해 그린 것.
*/
/*
  설치 창 글꼴 — 기본은 윈도우 옛 대화상자 글꼴(굴림 계열)이라 한글이 촌스럽다
  (사장님: "한글 폰트가 완전 구려", 9/9). 맑은 고딕으로. MUI 제목·본문이 다 이걸 따른다.
*/
!macro customHeader
  SetFont "Malgun Gothic" 9
!macroend

!macro customInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\side-100.bmp "${BUILD_RESOURCES_DIR}\side-100.bmp"
  File /oname=$PLUGINSDIR\side-125.bmp "${BUILD_RESOURCES_DIR}\side-125.bmp"
  File /oname=$PLUGINSDIR\side-150.bmp "${BUILD_RESOURCES_DIR}\side-150.bmp"
  File /oname=$PLUGINSDIR\side-175.bmp "${BUILD_RESOURCES_DIR}\side-175.bmp"
  File /oname=$PLUGINSDIR\side-200.bmp "${BUILD_RESOURCES_DIR}\side-200.bmp"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "올리 메신저를 설치합니다"
  !define MUI_WELCOMEPAGE_TEXT "회사 메신저와 전자결재를 바탕화면에서 바로 씁니다.$\r$\n$\r$\n설치는 1분이 안 걸리고, 끝나면 회사 계정으로 한 번만 로그인하면 됩니다.$\r$\n$\r$\n다음을 눌러 시작하세요."
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW allyWelcomeShow
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "설치가 끝났습니다"
  !define MUI_FINISHPAGE_TEXT "올리 메신저가 준비됐습니다.$\r$\n$\r$\n처음 열 때 회사 계정으로 로그인하면, 다음부터는 묻지 않습니다."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_RUN_TEXT "지금 올리 메신저 열기"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW allyFinishShow
  !insertmacro MUI_PAGE_FINISH

  ; $0 = 그림 칸(HWND). 칸의 실제 픽셀 크기를 재서 맞는 장을 그대로 붙인다.
  Function allySideImage
    System::Call '*(i, i, i, i) p .r1'
    System::Call 'user32::GetClientRect(p r0, p r1)'
    System::Call '*$1(i, i, i .r2, i .r3)'
    System::Free $1
    StrCpy $4 "$PLUGINSDIR\side-100.bmp"
    ${If} $2 >= 184
      StrCpy $4 "$PLUGINSDIR\side-125.bmp"
    ${EndIf}
    ${If} $2 >= 225
      StrCpy $4 "$PLUGINSDIR\side-150.bmp"
    ${EndIf}
    ${If} $2 >= 266
      StrCpy $4 "$PLUGINSDIR\side-175.bmp"
    ${EndIf}
    ${If} $2 >= 307
      StrCpy $4 "$PLUGINSDIR\side-200.bmp"
    ${EndIf}
    ; LR_LOADFROMFILE(0x10) — 칸 크기로 읽는다. 크기가 같으면 늘이지 않는다
    System::Call 'user32::LoadImage(p 0, t r4, i 0, i r2, i r3, i 0x10) p .r5'
    ${If} $5 <> 0
      ; STM_SETIMAGE = 0x172, IMAGE_BITMAP = 0. 전 그림은 지운다
      SendMessage $0 0x172 0 $5 $6
      ${If} $6 <> 0
        System::Call 'gdi32::DeleteObject(p r6)'
      ${EndIf}
    ${EndIf}
  FunctionEnd

  Function allyWelcomeShow
    StrCpy $0 $mui.WelcomePage.Image
    Call allySideImage
  FunctionEnd

  Function allyFinishShow
    StrCpy $0 $mui.FinishPage.Image
    Call allySideImage
  FunctionEnd
!macroend
