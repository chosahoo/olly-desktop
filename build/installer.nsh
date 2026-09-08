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
