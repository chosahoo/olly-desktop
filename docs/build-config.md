# 설치본 빌드 설정 — 용량 줄이기 · 서명 넣기

빌드는 맥에서 한다. 여기 적은 것을 그 프로젝트의 `package.json` (또는
`electron-builder.yml`) 에 옮기면 된다.

측정한 날: 2026-09-07 · 기준: `Olly-Messenger-Setup-0.1.1.exe`

---

## 지금 무엇이 용량을 먹는가

설치본 **114MB**, 설치하면 **372MB**. 안을 열어 본 결과다.

| | 크기 | 줄일 수 있나 |
|---|---|---|
| `Olly Messenger.exe` (크로미움) | 234M | ✗ Electron 런타임이라 못 줄인다 |
| **`locales/` (언어 55개)** | **49M** | ✅ 한국어·영어만 남기면 47M |
| `dxcompiler.dll` | 25M | △ DirectX 셰이더 컴파일러. 빼면 일부 PC에서 렌더링이 깨질 수 있다 |
| **`LICENSES.chromium.html`** | **20M** | △ 라이선스 고지. 법적으로 넣는 편이 안전하다 |
| `resources.pak` | 12M | ✗ |
| `icudtl.dat` | 11M | △ 국제화 데이터. 건드리면 날짜·정렬이 틀어진다 |
| **우리 앱 코드 (`app.asar`)** | **2.1M** | — 우리 몫은 이것뿐이다 |

**우리가 만든 것은 2.1MB 다.** 나머지는 전부 크로미움이다.

---

## 1. 언어 파일 정리 (제일 큰 몫)

크로미움은 언어 55개를 다 넣는다. 한국 회사가 쓰는 프로그램에 태국어·힌디어
번역이 들어갈 이유가 없다.

```json
"build": {
  "electronLanguages": ["ko", "en-US"]
}
```

→ `locales/` 49MB → 약 2MB. **설치본 114MB → 90MB 안팎.**

## 2. 압축 최대로

```json
"build": {
  "compression": "maximum"
}
```

→ 몇 MB 더. 빌드가 조금 느려진다.

## 3. 아키텍처 확인

x64 하나만 만드는지 본다. `ia32` 까지 같이 넣으면 두 배가 된다.

```json
"build": {
  "win": { "target": [{ "target": "nsis", "arch": ["x64"] }] }
}
```

윈도우 11은 전부 64비트다. 32비트를 뺄 때 잃는 것은 없다.

---

## 4. 서명 — 빨간 화면을 없애는 것

**지금 설치본은 서명이 아예 없다** (`Get-AuthenticodeSignature` → `NotSigned`).
그래서 받는 사람마다 빨간 전체 화면을 본다:

> Microsoft Defender SmartScreen에서 인식할 수 없는 앱의 시작을 차단했습니다.

CSR 은 **직원들이 각자 설치한다.** 60명이 각각 저 화면을 보고, 대부분은
멈추고 담당자에게 전화한다. 안내 문구로는 한계가 있다 —
받는 화면(allywork.kr)에 무엇이 뜨는지 미리 적어 두긴 했다.

### 인증서를 넣으면

```json
"build": {
  "win": {
    "certificateSubjectName": "회사 이름 그대로",
    "signingHashAlgorithms": ["sha256"],
    "rfc3161TimeStampServer": "http://timestamp.digicert.com"
  }
}
```

클라우드 서명(Azure)이면 `sign` 에 스크립트를 물린다. 인증서를 정한 뒤 채운다.

### 어떤 인증서인가

| | 값 | 빨간 화면 |
|---|---|---|
| Azure 코드서명 (Microsoft) | 월 $10 안팎 | **자격 요건(사업 3년)을 먼저 확인해야 한다** |
| OV 인증서 | 연 20~40만원 | 초기엔 남는다. 설치가 쌓여야 사라지는데 60명 규모면 오래 걸린다 |
| EV 인증서 | 연 50~120만원 | 서명하는 즉시 없다 |

2023-06 부터 규정이 바뀌어 OV·EV 모두 **하드웨어 토큰이나 클라우드 HSM** 이
필요하다. Azure 는 클라우드라 토큰이 없다.

---

## 안 하기로 한 것 — 웹앱(PWA)

크로미움을 빼고 윈도우에 이미 있는 웹뷰를 쓰면 114MB → 5MB 가 되고
**빨간 화면도 사라진다**(설치 파일이 없으니까). 그런데 **CSR 이 별도 프로그램을
요구했다.** 웹앱은 트레이 상주도 안 된다. 그래서 안 한다.

다시 꺼낼 때: 다른 회사에 팔 때, 또는 CSR 이 생각을 바꿀 때.

---

## 정한 것 (2026-09-07)

**인증서는 10월 첫주에 산다.** 그때 예산이 생긴다.

그 전에 **무료로 되는 두 가지는 지금 넣어 둔다** — 둘 다 심사 대기가 병목이라,
10월에 신청하면 11월에나 서명할 수 있게 된다.

| 지금 (무료) | 왜 |
|---|---|
| **D-U-N-S 번호** (나이스디앤비) | EV 발급에 법인 실재 확인용으로 쓴다. **2~4주** 걸린다. 없으면 변호사 확인서를 따로 내야 하고 돈이 든다 |
| **Azure 코드서명 신청** | 통과하면 EV 를 안 사도 된다(월 $10). 거절돼도 손해가 없다 |

사업자는 **법인**이다. 그래서 인증서에 회사 이름이 찍힌다 —
직원이 설치할 때 개인 이름보다 낫다.

### 일정이 맞는다 — 빨간 화면을 겪는 사람이 없다

**CSR 직원 배포는 11월부터다.** 그래서 이렇게 된다:

| 때 | 무엇 |
|---|---|
| 9/16 시연 | 인증서 없이. 시연 PC 에 미리 설치해 두면 경고가 안 뜬다 |
| 10월 첫주 | 인증서 구매 (D-U-N-S 를 지금 넣어 두면 며칠 만에 발급) |
| 10월 중순 | 서명한 설치본 재배포 |
| **11월** | **CSR 직원 배포 — 이때는 경고가 안 뜬다** |

한 달 여유가 있다. 직원이 빨간 화면을 볼 일은 없다.

### 윈도우만 만든다 (2026-09-07)

**메신저 프로그램은 윈도우만 배포한다.** 맥은 안 만든다.

그래서 이것들이 통째로 빠진다:

- 애플 개발자 계정 **연 $99**
- 공증(notarization) 절차와 그 대기 시간
- dmg 두 벌(애플실리콘·인텔) 빌드

인증서도 **윈도우용 하나만** 사면 된다. 맥 인증서는 애플 것이라
윈도우 인증서로 대신할 수 없다 — 안 만들기로 했으니 살 일이 없다.

README 의 macOS 안내와 릴리스의 dmg 는 정리해야 한다(맥에서 할 일).

### 클라우드 서명을 고를 것

하드웨어 토큰은 해외 배송이라 1~2주가 더 붙는다.
SSL.com eSigner 나 Azure 는 클라우드라 배송이 없다.

---

# Smart App Control 이 서명 없는 설치본을 막았다 (2026-09-09)

**먼저 결론** — 영구 차단이 아니다. 처음 보는 파일일 때 한 번 막히고,
조금 뒤 다시 누르면 됐다. 그래도 그대로 뿌릴 수는 없다. 아래에 실제로
본 것과 그 뜻을 적는다.

0.1.4 설치본을 만들어 돌렸더니 처음엔 실행조차 안 됐다.

    An Application Control policy has blocked this file.

이벤트 로그(`Microsoft-Windows-CodeIntegrity/Operational`):

    3077 · Code Integrity determined that a process attempted to load
           Olly-Messenger-Setup-0.1.4.exe that did not meet the
           Enterprise signing level requirements
    3118 · Smart App Control Block Details

이 PC 의 상태 —

    HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy
      VerifiedAndReputablePolicyState = 1     (0=꺼짐 1=켜짐 2=평가중)

## 왜 이게 SmartScreen 보다 나쁜가

| | SmartScreen | **Smart App Control** |
|---|---|---|
| 나오는 것 | 파란 경고창 | 실행 자체가 안 됨 |
| 사람이 넘어갈 수 있나 | **있다** — '추가 정보 → 실행' | **없다.** 버튼이 없다 |
| 끄는 법 | 설정에서 켰다 껐다 | **한 번 끄면 다시 못 켠다** (윈도우 재설치 전까지) |

'추가 정보 → 실행' 안내로 넘길 수 있다고 적어 둔 것은 SmartScreen 얘기다.
Smart App Control 이 켜진 PC 에서는 **안내할 것이 없다.**

## 영구 차단이 아니다 — 처음 보는 파일일 때만 막는다

**처음 적었던 "못 까는 PC 가 생긴다" 는 지나친 말이었다. 바로잡는다.**

막힌 그 파일을 11분 뒤에 그대로 다시 실행했더니 **그냥 됐다.**

    08:18  Olly-Messenger-Setup-0.1.4.exe  ->  차단 (CodeIntegrity 3077/3118)
    08:29  같은 파일 그대로                ->  실행됨, 종료코드 0
    08:45  Olly-Messenger-Setup-0.1.5.exe  ->  첫 시도에 실행됨

Smart App Control 은 **처음 보는 파일**의 평판을 클라우드에 묻는다.
답이 오기 전에는 막고, 답이 오면 통과시킨다. 서명이 없으면 그 판정에
시간이 걸린다.

그래서 실제로 벌어지는 일은 이렇다 —

| | |
|---|---|
| 영영 못 깐다 | **아니다** |
| 처음 눌렀을 때 막힐 수 있다 | **그렇다** |
| 조금 뒤 다시 누르면 된다 | 이번엔 그랬다 |
| 언제 풀리는지 미리 아나 | **모른다** |

## 그래도 이대로 뿌리면 안 되는 이유

직원 입장에서는 **"눌렀는데 아무 일도 안 일어난다"** 이다. 차단 메시지가
설치 실패처럼 보이고, 넘어갈 버튼이 없다. 다시 눌러 보라는 안내를 60명에게
돌리는 것도, 몇 분 뒤에 되는지 못 알려주는 것도 곤란하다.

새 판을 낼 때마다 **파일이 처음 보는 파일이 되므로** 매번 겪을 수 있다.

## 누가 걸리나

Smart App Control 은 **윈도우 11 을 새로 깐 PC 에서 기본으로 켜진다**
(22H2 이상). 윈도우 10 에서 올린 PC 는 꺼져 있다. 새로 산 PC 일수록
걸린다. 다만 켜져 있어도 위 표대로 **영구 차단은 아니다.**

각 PC 상태는 한 줄로 확인된다:

    (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy').VerifiedAndReputablePolicyState
    # 0=꺼짐  1=켜짐  2=평가중

## 인증서를 넣으면 —

서명하면 처음 보는 파일이라도 서명자로 판단할 근거가 생긴다. EV 인증서는
SmartScreen 평판을 즉시 주는 것으로 알려져 있고, 이 문제를 푸는 정식
경로다. **다만 "서명하면 Smart App Control 이 100% 통과시킨다" 고
단언하지는 못한다** — 마이크로소프트는 '신뢰할 수 있는 서명 + 좋은 평판'
을 허용한다고만 밝힌다.

**그래서 서명본이 나오면 이 PC 에서 반드시 확인해야 한다.** 이 PC 는
Smart App Control 이 켜져 있으니 그대로 시험대다.

## 하면 안 되는 것 — Smart App Control 끄기

**한 번 끄면 윈도우를 다시 깔기 전까지 못 켠다.** 직원 PC 의 보안 설정을
영구히 낮추는 일이다. 잠깐 급하다고 건드릴 것이 아니다.

## 지금 이 PC 에 깔린 것

**0.1.5** 다. 0.1.4·0.1.5 에서 바뀐 것(언어 파일 정리, 바로가기 이름과
옛 바로가기 정리)은 깔아서 확인했다. 서명한 판이 나오면 다시 한 번 본다.

## 설치가 끝나도 앱을 켜지 않는다 (2026-09-09, 0.1.8)

electron-builder 의 oneClick 설치는 끝나자마자 앱을 띄운다(`runAfterFinish` 기본 true).
그래서 설치 화면 바로 뒤에 로그인 창이 떴다. 사장님: "일반적으로 설치할 때는
로그인 안 하잖아. 설치하고 실행할 때 로그인 물어보지."

    "nsis": { "runAfterFinish": false }

설치는 조용히 끝나고, 바탕화면·시작메뉴의 '올리 메신저' 를 누를 때 로그인이 뜬다.
로그인 화면은 웹 쪽에서 데스크톱(UA AllyDesktop)이면 서비스 소개·가입 권유 없이
'올리 메신저' 로만 그리고, 자동 로그인을 기본으로 켠다 — 그래서 두 번은 안 묻는다.

아이콘은 0.1.7 부터 웹의 브랜드 마크(startup-hr-system/public/icon.png, 512px).
말풍선 아이콘은 버렸다.

홈페이지 다운로드(allywork.kr/download/windows)는 **깃허브 최신 릴리스**를 준다.
0.1.1(9/2) 이후 릴리스를 안 올려서 여기서 고친 것들이 아무에게도 안 갔다.
새 판은 `GH_TOKEN` 을 두고 `npm run release` 하거나, 깃허브에서 릴리스를 만들어
dist/ 의 exe 를 올린다.

## 보통 설치 화면으로 (2026-09-09, 0.1.9)

"다음다음이 없네, 완료됐다는 말이 있어야지." 원클릭(oneClick)은 창 하나가 잠깐 떴다
사라진다. 안내형으로 바꿨다.

    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "runAfterFinish": true,
      "installerSidebar": "build/sidebar.bmp",
      "uninstallerSidebar": "build/sidebar.bmp"
    }
    "productName": "올리 메신저",
    "executableName": "Olly Messenger"

화면 순서: 시작(customWelcomePage, installer.nsh) → 사용자 선택(모든 사용자/전용) →
설치 위치 → 설치 → '올리 메신저 설치 완료 · 마침'. 마침 화면의 '실행하기' 가 켜져 있어
그때 앱이 뜨고 로그인한다. 설치 중엔 아무것도 안 묻는다.

- productName 을 한글로 해야 설치 화면 문구가 '올리 메신저' 가 된다. exe 는
  executableName 으로 'Olly Messenger.exe' 그대로(경로·taskkill 안전).
- 왼쪽 그림은 164x314 24bit BMP. PowerShell System.Drawing 으로 그렸다(초록 바탕 +
  public/icon.png + '올리 메신저 / 회사 메신저 · 전자결재').
- **설치 경로가 한 단 깊어졌다**: `%LOCALAPPDATA%\Programs\ally-desktop\Olly Messenger\`.
  allowToChangeInstallationDirectory 가 켜지면 electron-builder 가 경로에 앱 이름
  폴더가 없으면 붙인다(instFilesPre). 기본 폴더(name=ally-desktop)에 'Olly Messenger' 가
  없어서 붙는다. 이전 판은 설치 프로그램이 먼저 지우니 겹치지 않는다. 지원할 때 이 경로다.
- 갓 만든 exe 는 Smart App Control 이 처음 한 번 막는다 — 1분쯤 뒤 다시 돌리면 된다.

릴리스는 이 PC 의 git 저장 로그인으로 API 를 불러 올린다(exe·blockmap·latest.yml).
홈페이지 다운로드 라우트가 5분 캐시라 올린 뒤 5분 지나야 새 판을 준다.

## 업데이트 — 사람이 누를 자리 (2026-09-09, 0.1.13)

자동 업데이트는 원래 있었다(켤 때·4시간마다 확인, 받아 두고 종료할 때 갈아끼움).
없던 것은 **사람이 누를 자리**와 우리 말 알림이다. 사장님: "프로그램 안에서
업데이트 누르면 할 수 있음?"

- 트레이 메뉴 맨 위: `업데이트 확인 (지금 0.1.13)` → 확인 중 → `최신 판입니다` /
  `새 판 x 받는 중 n%` → `새 판 x 지금 설치하고 다시 시작`(quitAndInstall).
- 다 받으면 알림 "올리 메신저 x 준비됨 — 눌러서 지금 설치하거나, 다음에 켤 때 새 판으로
  열립니다". 누르면 설치. 안 누르면 종료할 때(autoInstallOnAppQuit) 갈아끼운다.
- 사람이 눌러 확인했을 때만 결과를 알림으로 말한다(최신/실패). 자동 확인은 조용하다.
- electron-updater 기본 알림(영어 "A new update is ready to install")은 안 쓴다 —
  checkForUpdatesAndNotify 대신 checkForUpdates + 우리 알림.

확인: 0.1.13 을 깔고 켜면 로그에 "Checking for update … not available (latest 0.1.12)".
새 판을 찾는 쪽은 다음 릴리스를 올렸을 때 0.1.13 이 스스로 받는 것으로 확인된다.

## 창 크기 기억에 판 번호 (0.1.12)

window-state.json 에 `v: 2`. 0.1.1 기본이 960x720 이라 그 판을 깐 PC 는 새 판도 크게
떴다(사장님 PC). 번호가 다르면 버리고 새 기본(380x600, 우측 하단). 기본 크기를 또
바꾸면 STATE_VERSION 을 올린다.
