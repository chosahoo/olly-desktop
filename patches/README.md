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
