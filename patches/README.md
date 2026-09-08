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
