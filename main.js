/*
  올리 메신저 — 설치형 껍데기 (Windows·macOS).

  화면 자체는 웹(allywork.kr/messages)을 그대로 쓴다. 메신저 UI 를 여기
  또 만들면 웹·앱·데스크톱 세 벌이 서로 어긋난다 — 회사 메신저의 본체는
  '항상 켜져 있고, 안 읽은 수가 보이고, 알림이 오는 것'이고 그게 이 파일의
  일이다. 웹은 UA 의 'AllyDesktop' 을 보고 뼈대 없는 메신저 화면을 준다.

  로그인 세션은 Electron 프로필에 남아 다음 실행에도 유지된다.
*/

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage, Notification, screen } = require('electron');
const path = require('path');
const fs = require('fs');

/*
  창 위치·크기 기억 — 매번 화면 한가운데 960x720 으로 뜨면
  '내 자리' 를 잡아 둔 사람이 매일 다시 끌어야 한다.
*/
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');
/*
  기억한 창 상태에 판 번호를 붙인다.

  0.1.1 의 기본 크기는 960x720 이었다. 그 판을 깐 PC 는 창을 한 번도 안
  만졌어도 그 크기가 기억돼 있다(옮기거나 닫을 때 저장하니까). 0.1.4 에서
  기본을 380x600 으로 줄였는데, 옛 기억이 남은 PC 에서는 새 판도 960x720 으로
  떴다 — 사장님 PC 가 그랬다(9/9). 옛 판이 남긴 기억은 버리고 새 기본으로 뜬다.
  사람이 새 판에서 다시 옮기거나 늘이면 그때부터 다시 기억한다.
*/
const STATE_VERSION = 2;

/*
  프로그램 설정 — 이 PC 의 것. 계정 설정(알림·대화·자리비움)은 웹이 서버에 둔다.
  지금은 '켤 때 창 숨기고 트레이로만' 하나.
*/
const prefsPath = () => path.join(app.getPath('userData'), 'prefs.json');
function loadPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) || {};
  } catch {
    return {};
  }
}
function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  try {
    fs.writeFileSync(prefsPath(), JSON.stringify(next));
  } catch {
    /* 설정 저장 실패로 앱이 흔들리면 안 된다 */
  }
  return next;
}
function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (!state || state.v !== STATE_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}
function saveWindowState() {
  if (!win || win.isDestroyed()) return;
  try {
    fs.writeFileSync(statePath(), JSON.stringify({ ...win.getBounds(), v: STATE_VERSION }));
  } catch {
    /* 상태 저장 실패로 앱이 흔들리면 안 된다 */
  }
}

/*
  주소는 못 박는다.

  전에는 `process.env.ALLY_URL` 을 배포본에서도 그대로 따랐다. 개발할 때
  편하려고 둔 것인데, 그러면 이 PC 를 만질 수 있는 사람이 환경변수 하나로
  **'올리 메신저' 라고 적힌 창에 아무 사이트나 띄울 수 있다** — preload
  다리까지 딸려 간다. 개발 중(app.isPackaged 가 false)일 때만 따른다.
*/
const DEFAULT_URL = 'https://www.allywork.kr/messages';
const APP_URL = app.isPackaged ? DEFAULT_URL : process.env.ALLY_URL || DEFAULT_URL;
const APP_ORIGIN = new URL(APP_URL).origin;

/*
  메신저 창에서는 **메신저만** 연다 (9/10, 사장님 결정).

  전에는 우리 origin 이면 어디든 갔고, 게시판·결재 단추가 브라우저를 열었다.
  그 길이 곧 웹 로그인과 이어지는 길이다 — 메신저 창의 세션으로 회사 관리
  화면까지 닿을 수 있으면 매장 공용 PC 에서 위험하다. 그래서 메신저 화면과
  로그인 화면 말고는 우리 주소라도 막는다. 남의 주소(대화 속 링크)는 전처럼
  기본 브라우저로 보낸다 — 그건 우리 세션과 무관하다.
*/
const MESSENGER_PATHS = ['/messages', '/auth/'];
function isMessengerPath(url) {
  if (!isOurs(url)) return false;
  try {
    const { pathname } = new URL(url);
    return MESSENGER_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  } catch {
    return false;
  }
}

/*
  우리 주소인가.

  **앞글자 비교(startsWith)로 보면 안 된다.** APP_ORIGIN 이
  'https://www.allywork.kr' 이라 'https://www.allywork.kr.evil.com' 이
  통과한다 — 공격자가 자기 도메인 앞에 붙이기만 하면 된다. origin 을
  통째로 견준다. 파싱이 안 되면 우리 것이 아니다.

  창을 만들기 전에 정해 둔다 — did-fail-load 처리기가 이보다 먼저
  등록되는데, 안쪽에 두면 나중에 순서를 건드릴 때 TDZ 로 터진다.
*/
const isOurs = (url) => {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
};

let win = null;
let tray = null;
let quitting = false;
let unread = 0;

/*
  Windows 배너 알림의 조건 — AppUserModelID 가 바로가기와 일치해야
  알림 센터가 이 앱을 알아본다. 안 박으면 패키징 앱에서 배너가
  조용히 안 뜨는 수가 있다 (NSIS 바로가기의 appId 와 같은 값).
*/
if (process.platform === 'win32') {
  app.setAppUserModelId('kr.allywork.messenger');
}

/* 한 벌만 뜬다 — 두 번 실행하면 기존 창을 앞으로 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

/*
  처음 켤 때 놓을 자리 — 화면 **우측 하단에 딱 붙인다.**

  메신저는 종일 띄워 두는 물건이다. 한가운데 뜨면 보던 것을 가려서
  매번 옆으로 끌게 된다. 오른쪽 아래는 알림이 뜨는 자리이기도 해서
  눈이 이미 그쪽을 본다.

  작업표시줄을 침범하지 않도록 workArea 를 쓴다(화면 전체 크기가 아니다).
  자리를 옮기면 그 자리를 기억하므로, 이 계산은 처음 한 번만 쓰인다.
*/
function cornerPosition(width, height) {
  const { workArea } = screen.getPrimaryDisplay();
  const margin = 8;
  return {
    x: Math.max(workArea.x, workArea.x + workArea.width - width - margin),
    y: Math.max(workArea.y, workArea.y + workArea.height - height - margin),
  };
}

/*
  저장해 둔 자리가 지금도 화면 안인지 본다.

  노트북에 모니터를 달아 쓰다가 빼면, 기억해 둔 x/y 가 **없는 화면**을
  가리킨다. 그러면 창이 보이지 않는 곳에 뜬다 — 트레이 아이콘은 있는데
  눌러도 아무 일이 안 일어나는 것처럼 보인다. 회사 PC 는 모니터를 뺐다
  꽂았다 한다.

  어느 화면에든 조금이라도 걸치면 그 자리를 쓰고, 아니면 버리고 처음처럼
  우측 하단에 놓는다.
*/
function onSomeScreen(bounds) {
  if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return false;
  const margin = 40; // 제목줄이 이만큼은 보여야 잡아서 끌 수 있다
  return screen.getAllDisplays().some(({ workArea: a }) => {
    return (
      bounds.x + bounds.width > a.x + margin &&
      bounds.x < a.x + a.width - margin &&
      bounds.y + margin < a.y + a.height &&
      bounds.y >= a.y - 1
    );
  });
}

function createWindow() {
  const stored = loadWindowState();
  const saved = onSomeScreen(stored) ? stored : null;
  const width = stored?.width || 380;
  const height = stored?.height || 600;
  const corner = cornerPosition(width, height);
  win = new BrowserWindow({
    /*
      아마란스 메신저와 같은 크기 — 실제로 띄워 놓은 창을 재니 363x582 였다.
      회사 메신저는 모니터 한켠에 종일 두는 물건이라 넓으면 자리를 뺏는다.
      960x720 은 웹 화면 기준이었지 상주 창 기준이 아니었다.
      넓히면 목록과 대화가 좌우로 갈라진다(웹이 768 부터 나눈다).
    */
    width,
    height,
    x: saved?.x ?? corner.x,
    y: saved?.y ?? corner.y,
    // 기본이 380x600 이므로 최소를 그 아래로 둔다
    minWidth: 320,
    minHeight: 480,
    title: '올리 메신저',
    autoHideMenuBar: true,
    // 그릴 준비가 되면 보인다 — '켤 때 트레이로만' 이면 안 보이고 트레이에만 앉는다
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  /*
    제목은 '올리 메신저' 로 못 박는다.

    BrowserWindow 의 title 은 웹 페이지의 <title> 이 덮어쓴다. 그래서
    좁은 창에 'Ally(올리) - HR의 모든 것 | 급여·근태·휴가 통합 관리' 가
    들어가 뒤가 잘렸다. 메신저 창이니 메신저라고만 적는다.
  */
  win.on('page-title-updated', (event) => {
    event.preventDefault();
    win.setTitle('올리 메신저');
  });
  win.setTitle('올리 메신저');

  // 웹이 데스크톱을 알아보는 표식
  const ua = win.webContents.getUserAgent();
  win.webContents.setUserAgent(`${ua} AllyDesktop/${app.getVersion()}`);

  /*
    못 열면 알려 준다.

    이 프로그램은 윈도우 시작과 함께 뜬다 — **네트워크가 붙기 전에 뜨는
    일이 흔하다.** 전에는 그냥 크롬의 회색 오류 화면이 나왔고, 사람은
    프로그램이 고장 난 줄 알았다. 사정을 적고 다시 시도할 자리를 준다.
  */
  const showOffline = () => {
    const html = `<!doctype html><meta charset="utf-8">
      <style>
        body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
             font-family:'Malgun Gothic',system-ui,sans-serif;background:#f8fafc;color:#0f172a}
        .box{text-align:center;padding:24px}
        h1{font-size:15px;margin:0 0 6px}
        p{font-size:12.5px;color:#64748b;margin:0 0 16px;line-height:1.6}
        button{font:inherit;font-size:13px;padding:8px 18px;border:0;border-radius:8px;
               background:#0a7d43;color:#fff;cursor:pointer}
      </style>
      <div class="box">
        <h1>연결하지 못했습니다</h1>
        <p>인터넷이 아직 안 붙었을 수 있습니다.<br>잠시 뒤 다시 시도해 주세요.</p>
        <button onclick="location.replace('${APP_URL}')">다시 시도</button>
      </div>`;
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  };
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    if (code === -3) return; // 우리가 부른 취소
    /*
      **우리 주소를 못 열었을 때만** 이 화면을 보여준다.

      처음엔 실패면 무조건 띄웠는데, 그러면 바깥 링크를 눌렀을 때도 떴다 —
      will-navigate 가 막고 브라우저로 보낸 뒤 그 주소의 실패가 여기로
      올라온다. **브라우저로 보냈을 뿐인데 앱 창이 보던 화면을 잃었다.**
      (실제로 가짜 도메인으로 이동을 시도해 보다 찾았다.)
    */
    if (!isOurs(url)) return;
    showOffline();
  });

  win.loadURL(APP_URL);
  win.once('ready-to-show', () => {
    /*
      켤 때 트레이로만 — 윈도우 시작과 함께 뜨는 회사 메신저가 매번 창부터
      들이밀면 성가시다. 설정에서 끄고 켠다(기본 꺼짐 = 창을 보여 준다).
      사람이 직접 실행했을 때(두 번째 실행)는 second-instance 가 창을 올린다.
    */
    if (loadPrefs().hideOnStart === true) return;
    win.show();
  });

  /*
    닫기 = 숨기기. 회사 메신저는 꺼지면 안 된다 — 트레이/독에 남아
    알림과 뱃지를 계속 받는다. 진짜 종료는 트레이 메뉴에서.
  */
  win.on('moved', saveWindowState);
  win.on('resized', saveWindowState);
  win.on('close', (event) => {
    saveWindowState();
    if (!quitting) {
      event.preventDefault();
      if (process.platform === 'darwin') app.hide();
      else win.hide();
    }
  });

  /*
    올리 밖으로 나가는 링크(첨부 원본, 외부 URL)는 기본 브라우저로.

    **전에는 url.startsWith(APP_ORIGIN) 으로 봤다. 그건 앞글자 비교라
    뚫린다.**

        APP_ORIGIN = 'https://www.allywork.kr'
        'https://www.allywork.kr.evil.com/login'.startsWith(APP_ORIGIN) → true

    공격자가 자기 도메인에 allywork.kr 로 시작하는 이름을 붙이면
    (allywork.kr.evil.com) 그 페이지가 **앱 창 안에서** 열렸다. 그러면
    preload 다리(window.allyDesktop)까지 딸려 간다. 게다가 우리가 창
    제목을 '올리 메신저' 로 못 박아 두어서, **'올리 메신저' 라고 적힌
    창에 남의 로그인 화면**이 뜬다. 메시지에 링크 하나 던지면 된다.

    origin 을 통째로 견준다. 파싱이 실패하면 우리 것이 아니다.
    (2026-09-08)
  */
  /*
    권한은 전부 거절한다.

    Electron 은 크롬과 달리 **묻지 않고 대체로 내준다**(기본 처리기가
    허용에 가깝다). 메신저는 카메라·마이크·위치·클립보드 읽기가 필요
    없다. 알림도 우리 다리(ally:notify)로 나가지 웹 Notification 을
    쓰지 않는다. 필요해지면 그때 그것만 연다.
  */
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // 우리 주소인데 메신저가 아니다 — 열지 않는다(브라우저로도 안 보낸다)
    if (isOurs(url) && !isMessengerPath(url)) return { action: 'deny' };
    if (isOurs(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isOurs(url) && !isMessengerPath(url)) {
      event.preventDefault(); // 메신저 밖 우리 화면 — 막는다
      return;
    }
    if (!isOurs(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  /*
    되돌림(redirect)도 같이 막는다. will-navigate 는 처음 이동만 잡는다 —
    우리 주소로 들어갔다가 30x 로 남의 주소로 넘어가면 그건 안 잡힌다.
  */
  win.webContents.on('will-redirect', (event, url) => {
    if (isOurs(url) && !isMessengerPath(url)) {
      event.preventDefault();
      win.loadURL(APP_URL); // 메신저로 되돌린다
      return;
    }
    if (!isOurs(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  /*
    자동 로그아웃 주기 — 로그인한 지 n일이 지나면 세션을 지우고 로그인 화면으로 (9/10).
    로그인 시각은 로그인 화면 다음에 메신저가 열린 순간으로 잡는다.
  */
  win.webContents.on('did-navigate', (_event, url) => {
    try {
      const { pathname } = new URL(url);
      if (pathname.startsWith('/messages') && !loadPrefs().loginAt) {
        savePrefs({ loginAt: Date.now() });
      }
    } catch {
      /* 주소가 이상하면 그냥 둔다 */
    }
  });
}

function trayIcon() {
  const file =
    process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  return nativeImage.createFromPath(path.join(__dirname, 'assets', file));
}

/* 작업표시줄 오버레이(빨간 점) — 한 번 읽어 두고 다시 쓴다 */
let overlayCache = null;
function unreadOverlay() {
  if (!overlayCache) {
    overlayCache = nativeImage.createFromPath(
      path.join(__dirname, 'assets', 'unread.png')
    );
  }
  return overlayCache;
}

/** 세션을 지우고 로그인 화면으로. show 면 창도 앞으로 */
async function logoutSession(show) {
  if (!win || win.isDestroyed()) return;
  try {
    await win.webContents.session.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers'],
    });
  } catch {
    /* 지우다 실패해도 다시 열기는 한다 */
  }
  savePrefs({ loginAt: null });
  unread = 0;
  if (tray && tray.rebuild) tray.rebuild();
  if (process.platform === 'win32') win.setOverlayIcon(null, '');
  if (process.platform === 'darwin') app.setBadgeCount(0);
  win.loadURL(APP_URL);
  if (show) {
    win.show();
    win.focus();
  }
}

const AUTO_LOGOUT_DAYS = [1, 7, 30];
const DEFAULT_AUTO_LOGOUT_DAYS = 7;
function autoLogoutDays() {
  const v = Number(loadPrefs().autoLogoutDays);
  return AUTO_LOGOUT_DAYS.includes(v) ? v : DEFAULT_AUTO_LOGOUT_DAYS;
}
/** 로그인한 지 주기를 넘겼으면 로그아웃. 켤 때와 한 시간마다 */
function enforceAutoLogout() {
  const at = Number(loadPrefs().loginAt);
  if (!at) return;
  if (Date.now() - at > autoLogoutDays() * 24 * 60 * 60 * 1000) logoutSession(false);
}

function createTray() {
  tray = new Tray(trayIcon());
  const rebuild = () => {
    tray.setToolTip(unread > 0 ? `올리 메신저 — 안 읽음 ${unread}` : '올리 메신저');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: unread > 0 ? `안 읽은 메시지 ${unread}개` : '새 메시지 없음',
          enabled: false,
        },
        { type: 'separator' },
        /*
          업데이트 — 사람이 누를 자리 (9/9, 사장님: "프로그램 안에서 업데이트 누르면 되나").
          켤 때와 4시간마다 알아서 확인하지만, 다 받은 판은 **종료할 때** 갈아끼운다.
          회사 메신저는 종료를 안 하니 여기서 바로 설치하고 다시 켤 수 있어야 한다.
        */
        ...updateMenuItems(),
        { type: 'separator' },
        {
          label: '열기',
          click: () => {
            if (win) {
              win.show();
              win.focus();
            }
          },
        },
        {
          label: '시작할 때 자동 실행',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked });
          },
        },
        {
          /*
            **로그아웃이 어디에도 없었다.**

            데스크톱은 웹 뼈대를 걷어내고 메신저만 그리는데, 로그아웃
            단추가 그 뼈대에 있었다. 그래서 한 번 로그인하면 나갈 길이
            없었다 — 세션은 Electron 프로필에 남아 재시작해도 유지된다.
            자리를 옮기거나 PC 를 물려주면 다음 사람이 전 사람 메신저를
            그대로 본다. 매장 공용 PC 면 더 그렇다.
          */
          label: '로그아웃',
          click: () => logoutSession(true),
        },
        { type: 'separator' },
        {
          label: '종료',
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ])
    );
  };
  rebuild();
  tray.on('click', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
  tray.rebuild = rebuild;
}

/*
  새 메시지 배너 — 웹이 '남이 보낸 새 메시지' 를 감지해 넘긴다.
  누르면 창을 앞으로 가져오고 그 방을 열라고 웹에 되돌려 준다.
*/
/*
  우리 창에서 온 것만 받는다.

  ipcMain 은 preload 를 가진 아무 webContents 에게서나 받는다. 창은 지금
  하나뿐이고 이동도 우리 origin 으로 묶었지만, 받는 쪽에서도 한 번 더
  본다 — 나중에 창을 하나 더 여는 날 이 검사가 없으면 조용히 뚫린다.
*/
const fromOurWindow = (event) =>
  !!win && !win.isDestroyed() && event.sender === win.webContents;

ipcMain.on('ally:notify', (_event, payload) => {
  if (!fromOurWindow(_event)) return;
  if (!Notification.isSupported()) return;
  const { title, body, roomId } = payload || {};
  const banner = new Notification({
    title: String(title || '올리 메신저'),
    body: String(body || ''),
    icon: appIcon(),
  });
  banner.on('click', () => {
    if (!win) return;
    win.show();
    win.focus();
    if (roomId) win.webContents.send('ally:open-room', String(roomId));
  });
  banner.show();
});

/*
  웹의 게시판·결재 단추 → 기본 브라우저.

  상주 창은 메신저만 싣고 웹 뼈대를 걷어내므로, 이게 없으면 메신저에서
  게시판·결재로 갈 길이 없다. 아마란스 메신저는 왼쪽 아이콘으로 모듈을
  브라우저에 연다.

  **우리 origin 만 연다.** preload 다리가 넓어진 만큼, 웹이 뚫려 남의
  주소를 밀어 넣어도 여기서 버린다 — 링크 처리(setWindowOpenHandler)와
  같은 isOurs 잣대다.
*/
/* 9/10 — 'ally:open-external' 은 뺐다. 메신저 창은 메신저만 연다 */

/*
  메신저 설정 화면(웹)이 묻고 바꾸는 것들 — 이 PC 의 프로그램 값.
  모두 우리 창에서 온 요청만 받는다(fromOurWindow).
*/
ipcMain.handle('ally:get-info', (event) => {
  if (!fromOurWindow(event)) return null;
  return {
    version: app.getVersion(),
    openAtLogin: app.getLoginItemSettings().openAtLogin === true,
    hideOnStart: loadPrefs().hideOnStart === true,
    autoLogoutDays: autoLogoutDays(),
    update: updateInfo(),
    canUpdate: Boolean(updater),
  };
});
ipcMain.handle('ally:set-open-at-login', (event, on) => {
  if (!fromOurWindow(event)) return false;
  app.setLoginItemSettings({ openAtLogin: Boolean(on) });
  if (tray && tray.rebuild) tray.rebuild();
  return app.getLoginItemSettings().openAtLogin === true;
});
ipcMain.handle('ally:set-auto-logout-days', (event, days) => {
  if (!fromOurWindow(event)) return null;
  const v = Number(days);
  if (!AUTO_LOGOUT_DAYS.includes(v)) return autoLogoutDays();
  savePrefs({ autoLogoutDays: v });
  enforceAutoLogout();
  return v;
});
ipcMain.handle('ally:set-hide-on-start', (event, on) => {
  if (!fromOurWindow(event)) return false;
  return savePrefs({ hideOnStart: Boolean(on) }).hideOnStart === true;
});
ipcMain.handle('ally:check-updates', (event) => {
  if (!fromOurWindow(event)) return null;
  checkForUpdates(true);
  return updateInfo();
});
ipcMain.handle('ally:install-update', (event) => {
  if (!fromOurWindow(event)) return false;
  if (!updater || update.state !== 'downloaded') return false;
  quitting = true;
  updater.quitAndInstall(true, true);
  return true;
});

/* 웹(preload 다리)이 보내는 안 읽은 수 → 독 뱃지·트레이 */
ipcMain.on('ally:badge', (_event, count) => {
  if (!fromOurWindow(_event)) return;
  unread = Number(count) || 0;
  if (process.platform === 'darwin') {
    app.setBadgeCount(unread);
  }
  if (tray && tray.rebuild) tray.rebuild();
  /*
    Windows 는 작업표시줄 단추에 **오버레이 아이콘**을 붙인다.
    맥은 독에 숫자가 붙는데 윈도우에는 아무 표시가 없어서, 창을 내려 두면
    안 읽은 것이 있는지 트레이 툴팁을 열어야 알 수 있었다.
  */
  if (process.platform === 'win32' && win && !win.isDestroyed()) {
    if (unread > 0) {
      win.setOverlayIcon(unreadOverlay(), `안 읽은 메시지 ${unread}개`);
    } else {
      win.setOverlayIcon(null, '');
    }
  }
  // 창이 숨어 있을 때는 깜빡임까지
  if (process.platform === 'win32' && win && !win.isVisible() && unread > 0) {
    win.flashFrame(true);
  }
});

/*
  자동 업데이트 — 릴리즈 저장소(olly-desktop)의 새 버전을 보면
  내려받아 두었다가 종료할 때 갈아끼운다. 회사에 뿌린 뒤 고칠 때마다
  전원이 다시 받게 할 수는 없다.

  Windows 만 — macOS 자동 업데이트는 서명(공증)된 앱에서만 동작해서,
  지금은 조용히 건너뛴다.

  상태는 트레이 메뉴에 그린다(updateMenuItems). 사람이 '업데이트 확인' 을 누르면
  결과를 알림으로도 말해 준다 — 메뉴를 다시 열어 보게 하지 않는다.
  다 받으면 '지금 설치하고 다시 시작' 이 생긴다(quitAndInstall).
*/
let updater = null;
const update = { state: 'idle', version: null, percent: 0, manual: false, error: null };

/* 알림에 붙는 큰 마크(256px). 트레이 아이콘(32px)은 알림에 넣으면 흐리다 */
function appIcon() {
  return nativeImage.createFromPath(path.join(__dirname, 'assets', 'app.png'));
}

function notify(title, body, onClick) {
  try {
    const n = new Notification({ title, body, icon: appIcon() });
    if (onClick) n.on('click', onClick);
    n.show();
  } catch {
    /* 알림 못 띄워도 동작엔 지장 없다 */
  }
}

function updateMenuItems() {
  const v = app.getVersion();
  const items = [];
  switch (update.state) {
    case 'checking':
      items.push({ label: `업데이트 확인 중… (지금 ${v})`, enabled: false });
      break;
    case 'downloading':
      items.push({ label: `새 판 ${update.version} 받는 중 ${update.percent}%`, enabled: false });
      break;
    case 'downloaded':
      items.push({
        label: `새 판 ${update.version} 지금 설치하고 다시 시작`,
        click: () => {
          quitting = true;
          updater.quitAndInstall(true, true);
        },
      });
      break;
    case 'latest':
      items.push({ label: `최신 판입니다 (${v})`, enabled: false });
      items.push({ label: '업데이트 확인', click: () => checkForUpdates(true) });
      break;
    case 'error':
      items.push({ label: '업데이트 확인 실패 — 다시 시도', click: () => checkForUpdates(true) });
      break;
    default:
      items.push({ label: `업데이트 확인 (지금 ${v})`, click: () => checkForUpdates(true) });
  }
  return items;
}

function setUpdate(patch) {
  Object.assign(update, patch);
  if (tray && tray.rebuild) tray.rebuild();
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('ally:update-state', updateInfo());
    } catch {
      /* 창이 막 닫히는 중이면 건너뛴다 */
    }
  }
}

/** 웹 설정 화면에 보내는 모양 */
function updateInfo() {
  return {
    state: update.state,
    version: update.version,
    percent: update.percent,
    error: update.error,
    current: app.getVersion(),
  };
}

function checkForUpdates(manual) {
  if (!updater) {
    if (manual) notify('업데이트', '이 판에서는 자동 업데이트를 쓸 수 없습니다.');
    return;
  }
  if (update.state === 'checking' || update.state === 'downloading') return;
  if (update.state === 'downloaded') {
    if (manual) notify('업데이트', `새 판 ${update.version}이 준비돼 있습니다. 트레이 메뉴에서 설치하세요.`);
    return;
  }
  setUpdate({ state: 'checking', manual: Boolean(manual), error: null });
  updater.checkForUpdates().catch((e) => {
    setUpdate({ state: 'error', error: String(e && e.message ? e.message : e) });
    if (manual) notify('업데이트 확인 실패', '인터넷 연결을 확인하고 다시 시도해 주세요.');
  });
}

function setupAutoUpdate() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  try {
    const { autoUpdater } = require('electron-updater');
    updater = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      setUpdate({ state: 'downloading', version: info.version, percent: 0 });
    });
    autoUpdater.on('update-not-available', () => {
      const manual = update.manual;
      setUpdate({ state: 'latest', manual: false });
      if (manual) notify('최신 판입니다', `올리 메신저 ${app.getVersion()} — 지금이 최신입니다.`);
    });
    autoUpdater.on('download-progress', (p) => {
      setUpdate({ percent: Math.round(p.percent || 0) });
    });
    autoUpdater.on('update-downloaded', (info) => {
      setUpdate({ state: 'downloaded', version: info.version, percent: 100, manual: false });
      // 누르면 바로 설치. 안 누르면 종료할 때 알아서 갈아끼운다
      notify(
        `올리 메신저 ${info.version} 준비됨`,
        '눌러서 지금 설치하거나, 다음에 켤 때 새 판으로 열립니다.',
        () => {
          quitting = true;
          autoUpdater.quitAndInstall(true, true);
        }
      );
    });
    autoUpdater.on('error', (e) => {
      const manual = update.manual;
      setUpdate({ state: 'error', manual: false, error: String(e && e.message ? e.message : e) });
      if (manual) notify('업데이트 확인 실패', '인터넷 연결을 확인하고 다시 시도해 주세요.');
    });

    checkForUpdates(false);
    setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);
  } catch {
    /* 업데이트 확인 실패는 메신저 동작과 무관 */
  }
}

app.whenReady().then(() => {
  setupAutoUpdate();
  /*
    첫 실행이면 자동 시작을 기본으로 켠다 — 회사 메신저는 켜 두는 것이
    기본값이어야 한다. 끄고 싶은 사람은 트레이 메뉴에서 끈다(기억된다).
  */
  const firstRunFlag = path.join(app.getPath('userData'), 'first-run-done');
  if (!fs.existsSync(firstRunFlag)) {
    try {
      app.setLoginItemSettings({ openAtLogin: true });
      fs.writeFileSync(firstRunFlag, '1');
    } catch {
      /* 자동 시작 설정 실패는 치명이 아니다 */
    }
  }

  createWindow();
  createTray();

  /*
    자동 로그아웃 — 창을 만든 뒤에 본다(로그아웃은 창의 세션을 지운다).
    처음엔 setupAutoUpdate 안에 뒀다가 개발 모드에선 안 돌았고, 다음엔 창보다
    먼저 불러 아무것도 안 했다(9/10, 심어 놓고 돌려 보다 잡음). 켤 때 + 한 시간마다.
  */
  enforceAutoLogout();
  setInterval(enforceAutoLogout, 60 * 60 * 1000);

  app.on('activate', () => {
    // macOS 독 아이콘 클릭 — 숨겨 둔 창을 다시
    if (win) win.show();
    else createWindow();
  });
});

app.on('before-quit', () => {
  quitting = true;
});

// 창을 다 닫아도 트레이에 산다 (메신저는 꺼지면 안 된다)
app.on('window-all-closed', () => {});
