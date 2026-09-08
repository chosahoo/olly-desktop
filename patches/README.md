# 윈도우 작업표시줄 안 읽음 표시 (2026-09-05)

이 저장소는 배포본만 두는 곳이라 소스가 없다(`ally_desktop` 은 맥에 있다).
윈도우에서 확인하고 고친 것을 여기 남긴다 — 맥에서 소스에 옮겨 넣으면 된다.

## 무엇이 문제였나

맥은 독 아이콘에 안 읽은 수가 붙는데(`app.setBadgeCount`), **윈도우는
아무 표시가 없었다.** 창을 내려 두면 트레이 툴팁을 열어야 알 수 있었다.
카톡·슬랙·아마란스가 다 쓰는 자리(작업표시줄 오버레이 아이콘)가 비어 있었다.

## 고친 방법

`main.js` 의 `ipcMain.on('ally:badge')` 안에 윈도우 분기를 더한다.

```js
if (process.platform === 'win32' && win && !win.isDestroyed()) {
  if (unread > 0) {
    win.setOverlayIcon(unreadOverlay(), `안 읽은 메시지 ${unread}개`);
  } else {
    win.setOverlayIcon(null, '');
  }
}
```

`unreadOverlay()` 는 `assets/unread.png`(16x16 빨간 점)를 한 번 읽어 둔다.
`createTray()` 위에 둔다.

```js
let overlayCache = null;
function unreadOverlay() {
  if (!overlayCache) {
    overlayCache = nativeImage.createFromPath(
      path.join(__dirname, 'assets', 'unread.png')
    );
  }
  return overlayCache;
}
```

숫자가 아니라 점 하나로 둔 이유: 오버레이에 숫자를 그리려면 자리마다
아이콘을 미리 만들어야 한다. 있고 없고만 알면 충분하고, 정확한 수는
트레이 툴팁과 창 안에 이미 있다.

## 파일

- `main.js.patched` — 고친 main.js 전체 (설치본에서 풀어 고친 것)
- `unread.png.base64` — 16x16 오버레이 아이콘. 아래로 되돌린다

```
base64 -d patches/unread.png.base64 > assets/unread.png
```

## 확인한 것

윈도우 11 에서 설치본의 `app.asar` 를 고쳐 다시 묶고 띄워, 작업표시줄
아이콘에 빨간 점이 붙는 것을 눈으로 봤다. 안 읽은 수가 0 이 되면 사라진다.

---

# 창 크기·위치 — 아마란스처럼 (2026-09-06)

## 무엇이 문제였나

기본 창이 **960x720** 이었다. 웹 화면 기준이지 상주 창 기준이 아니다.
아마란스 메신저는 **작은 창** 이다 — 실제로 띄워 놓고 재니 363x582 였다.
넓은 창은 자리를 뺏어서 매번 옆으로 끌게 된다.

또 한가운데 떠서 보던 것을 가렸다.

## 고친 방법

`createWindow()` 에서

```js
width: saved?.width || 380,
height: saved?.height || 600,
x: saved?.x ?? corner.x,
y: saved?.y ?? corner.y,
```

`cornerPosition()` 을 새로 둔다 — 화면 **우측 하단에 딱 붙인다**.
알림이 뜨는 자리이기도 해서 눈이 이미 그쪽을 본다.

```js
function cornerPosition(width, height) {
  const { workArea } = screen.getPrimaryDisplay();
  const margin = 8;
  return {
    x: Math.max(workArea.x, workArea.x + workArea.width - width - margin),
    y: Math.max(workArea.y, workArea.y + workArea.height - height - margin),
  };
}
```

`screen` 을 `require('electron')` 목록에 더해야 한다.
작업표시줄을 침범하지 않도록 화면 전체가 아니라 `workArea` 를 쓴다.
자리를 옮기면 그 자리를 기억하므로 이 계산은 처음 한 번만 쓰인다.

## 함께 고친 것 (웹)

좁은 창에서는 대화 목록이 화면 높이를 채우지 않아 아래가 허옇게 남았다.
`app/messages/page.tsx` 에서 목록 카드를 늘 `flex-1` 로 바꿨다(커밋 7733354e).

## 확인한 것

윈도우 11 에서 설치본을 다시 묶고 띄워, 우측 하단(오른쪽 끝 2554 /
작업영역 2560, 아래 1522 / 1528)에 좁고 긴 모양으로 뜨는 것을 눈으로 봤다.

최소 크기도 420x560 에서 320x480 으로 내렸다 — 기본이 380x600 이라
최소가 그보다 크면 안 된다.

---

# 창 제목이 웹 제목으로 덮여 잘렸다 (2026-09-07)

## 무엇이 문제였나

`BrowserWindow` 의 `title` 은 **웹 페이지의 `<title>` 이 덮어쓴다.** 그래서
380px 짜리 좁은 창 제목줄에

    Ally(올리) - HR의 모든 것 | 급여·근태·휴가 통합 관리

가 들어가 뒤가 잘렸다. 메신저 창인데 무슨 창인지 알 수가 없었다.

## 고친 방법

`createWindow()` 안에서 웹이 제목을 바꾸려 할 때 막는다.

```js
win.on('page-title-updated', (event) => {
  event.preventDefault();
  win.setTitle('올리 메신저');
});
win.setTitle('올리 메신저');
```

## 확인한 것

설치본 창 제목줄이 `올리 메신저` 로 뜬다.

---

# 알림 배너를 끝까지 확인했다 (2026-09-08)

**코드를 고친 것은 없다.** 전에는 "이어져 있다" 까지만 말할 수 있었는데,
실제로 뜨는 것과 눌렀을 때를 처음 봤다. 그 방법을 남긴다.

## 어떻게 확인했나

개발용 electron 이 이 PC 에 없어 직접 못 쏜다. 대신 **다른 사람이 보낸
메시지를 DB 에 직접 넣었다.** 웹이 10초마다 방 목록을 받아 새 메시지를
보면 `bridge.notify()` 를 부르므로, 넣기만 하면 배너가 뜬다.

(주)데모테크의 1:1 방에서만 했고 — **페흐도도(실사용)와 CSR 은 안
건드렸다** — 끝나고 넣은 메시지를 전부 지웠다.

## 결과

| | |
|---|---|
| 앱 목록에 뜨기까지 | 8~9초 (10초 폴링) |
| 작업표시줄 빨간 오버레이 | 붙는다 |
| 윈도우가 알림을 받았나 | `LastNotificationAddedTime` 이 +8~9초로 갱신, 횟수 6 → 7 |
| 배너 실물 | 알림 센터에 남는다 — `Olly Messenger` / 제목이 **보낸 사람** / 본문이 메시지 |
| **눌렀을 때** | **앱이 앞으로 나오고 그 방이 열린다** (`ally:open-room`) |

## 배너는 화면 캡처로 못 잡는다 — 결함이 아니다

`CopyFromScreen`(BitBlt)으로 찍으면 **토스트가 안 잡힌다.**
ShellExperienceHost 가 따로 그리는 오버레이라서다. 열 장을 연속으로
찍어도 전부 같은 그림이 나온다.

다음에 확인할 일이 생기면 캡처로 씨름하지 말고 이 둘을 볼 것:

    # 알림이 언제 들어왔나
    HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\kr.allywork.messenger
      LastNotificationAddedTime (FILETIME) · PeriodicNotificationCount

    # 실물
    Win+N (알림 센터)

## 함께 확인한 것

- `app.setAppUserModelId('kr.allywork.messenger')` 가 **설치본 바로가기의
  AppID 와 일치한다** (`Get-StartApps` 로 확인). 어긋나면 윈도우에서
  배너가 조용히 안 뜬다
- 알림을 쏘는 폴링(`fetchRooms`)에는 `visibilityState` 게이트가 없다 —
  창을 내려 두어도 돈다. 게이트는 방 안의 메시지 폴링에만 있고, 그건
  읽음 처리를 겸해서 그렇다

## 파일

- `main.js.patched` — 2026-09-07 자 main.js 전체 (창 제목 수정 포함)
- `preload.js` — 웹↔껍데기 다리. 알림·뱃지가 여기를 지난다

---

# 🔴 앱 창이 남의 사이트로 갈 수 있었다 (2026-09-08)

**이건 급하다. 11월 배포 전에 꼭 들어가야 한다.**

## 무엇이 문제였나

밖으로 나가는 링크를 기본 브라우저로 넘기는 판정이 **앞글자 비교**였다.

```js
const APP_ORIGIN = new URL(APP_URL).origin;   // 'https://www.allywork.kr'

win.webContents.setWindowOpenHandler(({ url }) => {
  if (url.startsWith(APP_ORIGIN)) return { action: 'allow' };   // ← 여기
  ...
});
win.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith(APP_ORIGIN)) { ... }                      // ← 여기
});
```

`startsWith` 라서 이런 주소가 통과한다:

```
'https://www.allywork.kr.evil.com/login'.startsWith('https://www.allywork.kr')  → true
'https://www.allywork.krmalware.com/'  .startsWith('https://www.allywork.kr')  → true
```

공격자가 자기 도메인 앞에 `allywork.kr` 을 붙이기만 하면 된다
(`allywork.kr.evil.com` 은 evil.com 주인이 마음대로 만든다).

## 왜 나쁜가

1. 그 페이지가 **앱 창 안에서** 열린다
2. **preload 다리(window.allyDesktop)가 딸려 간다** — 남의 페이지가
   `notify()` 로 '올리 메신저' 이름의 OS 알림을 띄울 수 있다
3. 우리가 창 제목을 `올리 메신저` 로 못 박아 두었다(위 9/7 항목). 그래서
   **'올리 메신저' 라고 적힌 창에 남의 로그인 화면**이 뜬다
4. 메신저 대화에 링크 하나 던지면 된다. 본문 URL 은 눌리게 되어 있다

CSR 직원 60명에게 뿌릴 프로그램이다.

## 고친 방법

`origin` 을 통째로 견준다. 파싱이 실패하면 우리 것이 아니다.

```js
const isOurs = (url) => {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
};
```

`setWindowOpenHandler` 와 `will-navigate` 둘 다 이걸 쓰고,
**`will-redirect` 도 새로 막았다** — `will-navigate` 는 처음 이동만 잡는다.
우리 주소로 들어갔다가 30x 로 남의 주소로 넘어가면 안 잡혔다.

## 확인한 것

```
통과  https://www.allywork.kr/messages
막힘  https://www.allywork.kr.evil.com/login
막힘  https://www.allywork.krmalware.com/
막힘  http://www.allywork.kr/messages      ← http 강등도 막는다
막힘  javascript:alert(1)
막힘  not a url
막힘  https://allywork.kr/messages         ← www 없는 주소는 브라우저로
```

---

# 권한 요청을 전부 거절한다 (2026-09-08)

Electron 은 크롬과 달리 **묻지 않고 대체로 내준다** — 기본 처리기가
허용에 가깝다. 위 이동 구멍과 겹치면, 남의 페이지가 카메라·마이크를
조용히 얻을 수 있었다.

메신저는 카메라·마이크·위치·클립보드 읽기가 필요 없다. 알림도 우리
다리(`ally:notify`)로 나가지 웹 Notification 을 쓰지 않는다.

```js
win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
  callback(false);
});
```

필요해지면 그때 그것만 연다.

## 함께 확인해서 이상 없던 것

- `contextIsolation: true`, `nodeIntegration: false` — 제대로 잡혀 있다
- `certificate-error` 를 무시하는 코드 없음
- `webSecurity`·`sandbox` 는 안전한 기본값 그대로
- preload 가 내주는 것은 `setBadge`·`notify` 둘뿐

---

# main.js 를 처음부터 끝까지 읽고 다섯 가지 (2026-09-08)

374줄을 통째로 읽으며 찾은 것들. 위의 이동 구멍과 같은 날이다.

## 1. 🔴 로그아웃이 어디에도 없었다

데스크톱은 웹 뼈대를 걷어내고 메신저만 그리는데(`app/messages/layout.tsx`
의 `if (desktop)`), **로그아웃 단추가 그 뼈대에 있었다.** 트레이 메뉴에도
없었다 — 열기 / 자동 실행 / 종료 셋뿐.

그래서 **한 번 로그인하면 나갈 길이 없다.** 세션은 Electron 프로필에
남아 재시작해도 유지된다. 자리를 옮기거나 PC 를 물려주면 **다음 사람이
전 사람 메신저를 그대로 본다.** 매장 공용 PC 면 더 그렇다.
CSR 은 60명이고 매장이 여럿이다.

트레이 메뉴에 `로그아웃` 을 넣는다 — 쿠키·로컬저장소를 지우고 뱃지를
0 으로 돌린 뒤 다시 연다.

## 2. 🟡 ALLY_URL 을 배포본에서도 따랐다

```js
const APP_URL = process.env.ALLY_URL || 'https://www.allywork.kr/messages';
```

개발 편의로 둔 것인데 배포본도 따랐다. 이 PC 를 만질 수 있는 사람이
환경변수 하나로 **'올리 메신저' 라고 적힌 창에 아무 사이트나** 띄울 수
있다 — preload 다리까지 딸려 간다. `app.isPackaged` 가 false 일 때만
따른다.

## 3. 창이 안 보이는 곳에 떴다

노트북에 모니터를 달아 쓰다가 빼면, 기억해 둔 x/y 가 **없는 화면**을
가리킨다. 트레이 아이콘은 있는데 눌러도 아무 일이 안 일어나는 것처럼
보인다. 회사 PC 는 모니터를 뺐다 꽂았다 한다.

`onSomeScreen()` 으로 어느 화면에든 걸치는지 보고, 아니면 버리고 처음처럼
우측 하단에 놓는다. 제목줄이 40px 은 보여야 잡아서 끌 수 있으므로 그만큼
여유를 둔다.

    그 자리 씀        한 대 · 우측하단 정상
    버리고 처음자리    한 대인데 보조모니터 자리
    그 자리 씀        두 대 · 보조모니터 자리
    버리고 처음자리    제목줄이 위로 나감
    버리고 처음자리    아래로 거의 다 나감

## 4. 못 열었을 때 크롬 오류 화면이 나왔다

이 프로그램은 **윈도우 시작과 함께 뜬다** — 네트워크가 붙기 전에 뜨는
일이 흔하다. 그때 회색 크롬 오류 화면이 나와서, 사람은 프로그램이 고장
난 줄 알았다.

`did-fail-load` 를 받아 우리 문구를 보여주고 '다시 시도' 를 준다.

## 5. ipc 를 아무 데서나 받았다

`ipcMain.on` 은 preload 를 가진 아무 webContents 에게서나 받는다. 창은
지금 하나뿐이고 이동도 origin 으로 묶었지만, 받는 쪽에서도 보낸 창이
우리 창인지 본다 — 나중에 창을 하나 더 여는 날 이 검사가 없으면 조용히
뚫린다.

---

## 자동 업데이트는 손대지 않았다

`electron-updater` + GitHub 릴리즈 + TLS + sha512(latest.yml) — 표준
모델이다. 다만 **지금은 설치본에 서명이 없어서** electron-updater 의
발행자 확인(`verifyUpdateCodeSignature`)이 의미를 못 갖는다.
인증서를 넣으면 그때부터 값을 한다. 인증서 얘기는 `build-config.md`.

---

# 실제로 띄워서 시험했다 (2026-09-08)

윈도우에 electron 을 깔아(`devDependencies`) 개발 모드로 띄우고, 프로필을
따로 준 뒤(`--user-data-dir`) 눌러 봤다. 사장님이 쓰시던 설치본은 건드리지
않았다.

    npm i -D electron
    node node_modules/electron/install.js      # 실행파일 내려받기
    npx electron . --user-data-dir=<시험용 폴더>

## 화면 밖 창 되살리기 — 부숴서 확인

화면은 1707 너비인데 시험용 폴더의 `window-state.json` 에 `{"x":4200,...}`
를 심어 두고 띄웠다.

    고침 넣은 상태  →  x=1319   (우측 하단, 보임)
    고침 뺀 상태    →  x=4200   (화면 밖, 안 보임)

빼면 트레이 아이콘은 있는데 눌러도 아무것도 안 나타난다.

## 오프라인 화면

`ALLY_URL` 을 없는 주소로 두고 띄우니 `연결하지 못했습니다 / 다시 시도`
가 떴다. 전에는 크롬 회색 오류 화면이었다.

## 트레이 로그아웃

메뉴에 `열기` · `시작할 때 자동 실행` · `로그아웃` · `종료` 가 뜬다.

## 이동 차단 — 세 갈래 다

로그인 화면에서 `https://www.allywork.kr.example.com/` 으로 가 보려 했다.
(example.com 은 IANA 예약 도메인이라 시험에 안전하다.)

    (가) 같은 창 링크 클릭         → 주소 그대로 (막힘)
    (나) target=_blank 링크 클릭   → 주소 그대로 (막힘)
    (다) location.href 로 이동     → 주소 그대로 (막힘)

그리고 **기본 브라우저에 그 주소 창이 열렸다** — 앱에서 막고 밖으로
보낸 것이 눈으로 확인됐다.

## 시험하다 찾은 것 — 내가 넣은 버그

처음엔 `did-fail-load` 가 뜨면 무조건 오프라인 화면을 띄웠다. 그랬더니
**바깥 링크를 눌렀을 뿐인데 앱 창이 보던 화면을 잃었다.** 우리 주소를
못 열었을 때만 띄우도록 고쳤다.

```js
win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
  if (!isMainFrame) return;
  if (code === -3) return;      // 우리가 부른 취소
  if (!isOurs(url)) return;     // 밖으로 보낸 주소의 실패 — 창은 그대로
  showOffline();
});
```

`isOurs` 도 바깥(모듈 자리)으로 올렸다 — `did-fail-load` 처리기가 그보다
먼저 등록되는데 안쪽 const 로 두면 나중에 순서를 건드릴 때 TDZ 로 터진다.

## CDP 로 강제 이동시키면 다르게 보인다

`Page.navigate` 로 밀어 넣으면 `chrome-error://` 가 남는다. **그건 사용자
경로가 아니다** — 링크 클릭으로 다시 재면 창이 그대로다. 다음에 시험할
사람이 헷갈리지 않게 적어 둔다.

## 아직 눌러 못 본 것

- **권한 거절** — 카메라·마이크를 요구하는 페이지가 있어야 한다
- 닫기=숨기기 · 트레이 클릭으로 열기 · 두 번 실행하면 기존 창 앞으로
- 자동 시작 토글
