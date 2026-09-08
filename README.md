# 올리 메신저 데스크톱

올리(Ally) 설치형 메신저의 **소스와 배포본**입니다. 받는 곳은 Releases.

- Windows: `Olly-Messenger-Setup-x.y.z.exe`

설치할 때 파란 경고가 나오면 — `추가 정보 → 실행`. 인증서를 넣기 전까지는
계속 나옵니다(`docs/build-config.md`).

---

## 무엇으로 되어 있나

앱은 파일 넷이 전부입니다. 나머지는 Electron 이 채웁니다.

```
main.js         창·트레이·알림·이동 차단 — 프로그램의 몸통
preload.js      웹 화면과 이어 주는 좁은 다리 (contextBridge)
assets/         트레이 아이콘 (읽음/안읽음, mac 용 template)
build/icon.png  프로그램 아이콘 256×256 — 말풍선
```

웹 화면 자체는 이 레포에 없습니다. `https://www.allywork.kr/messages` 를
그대로 띄웁니다.

## 만들기

윈도우 PC 에서 만듭니다. **맥에서는 만들지 않습니다** — 인증서가 USB
토큰이라 윈도우에만 꽂히고, 서명까지 한자리에서 끝내야 합니다.

```
npm install
npm run dist       # dist/Olly-Messenger-Setup-x.y.z.exe
npm run release    # 위를 만들고 GitHub Releases 에 올린다 (GH_TOKEN 필요)
```

## 설정에서 건드리면 안 되는 것

이 셋이 어긋나면 **이미 깔린 사람들이 조용히 망가집니다.**

| 값 | 무엇이 걸려 있나 |
|---|---|
| `appId: kr.allywork.messenger` | 제거 항목 GUID 가 여기서 나옵니다(`UUID.v5`). 바뀌면 덮어쓰기가 아니라 **두 개가 깔립니다.** |
| `artifactName` | `latest.yml` 의 `path` 와 같아야 합니다. 어긋나면 **자동 업데이트가 조용히 멈춥니다.** |
| `oneClick: true` + `perMachine: false` | 설치 자리가 `%LOCALAPPDATA%\Programs\ally-desktop` 로 정해집니다. 바꾸면 딴 폴더에 깔립니다. |

`productName` 이 두 군데인 것도 일부러입니다.

- 맨 위 `productName: 올리 메신저` → `app.getName()`, 즉 **설정이 쌓이는 폴더**
  이름(`%APPDATA%\올리 메신저`). 바꾸면 로그인이 풀립니다.
- `build.productName: Olly Messenger` → **exe 이름**. 한글로 두면 파일명이
  한글이 되어 배포·서명 때 걸리적거립니다.

## 문서

- `docs/build-config.md` — 용량, 서명, 인증서 고르기
- `docs/desktop-audit.md` — 프로그램을 처음부터 끝까지 눌러 본 기록과 고친 것들
