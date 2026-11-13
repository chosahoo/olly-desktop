/*
  기존 메신저 대조 4가지 (2026-11-09) — 화면 캡처 · 대화방 새 창 · 알림창 N초 뒤 숨기기 · 알림 대신 창 띄우기.
  웹(app/messages/page.tsx · MessengerSettings)이 부르는 이름이 바뀌면 단추가 조용히 죽으니 이름을 못 박는다.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8').replace(/\r\n/g, '\n');
const main = read('main.js');
const pre = read('preload.js');
const pkg = JSON.parse(read('package.json'));

test('다리 이름 — captureScreen · openRoomWindow · notify({hideAfterSec, popWindow})', () => {
  assert.match(pre, /captureScreen: \(\) => ipcRenderer\.invoke\('ally:capture'\)/);
  assert.match(pre, /openRoomWindow: \(roomId\) => ipcRenderer\.invoke\('ally:open-room-window', String\(roomId \|\| ''\)\)/);
  assert.match(pre, /hideAfterSec: Number\(payload\?\.hideAfterSec\) \|\| 0/);
  assert.match(pre, /popWindow: payload\?\.popWindow === true/);
  assert.match(main, /features: \['capture', 'roomWindow', 'notifyHide', 'notifyPop', 'systemIdle', 'copyText'\]/);
});

test('대화방 새 창 — 방 id 를 거르고, 같은 잣대로 이동을 막고, solo 주소로 연다', () => {
  const h = main.slice(main.indexOf("ipcMain.handle('ally:open-room-window'"));
  assert.match(h.slice(0, 300), /if \(!isOurContents\(event\.sender\)\) return false;[\s\S]*if \(!ROOM_ID\.test\(id\)\) return false;/);
  const fn = main.slice(main.indexOf('function openRoomWindow'), main.indexOf('function closeRoomWindows'));
  assert.match(fn, /^\s*guardNavigation\(w\);/m, '새 창이 주소 제한을 안 받는다');
  assert.match(fn, /contextIsolation: true,\s*nodeIntegration: false/);
  assert.match(fn, /\/messages\?room=\$\{encodeURIComponent\(roomId\)\}&solo=1/);
  assert.match(main, /^\s*guardNavigation\(win\);/m, '메인 창도 같은 검사를 거쳐야 한다');
  // 로그아웃하면 방 창도 닫는다(공용 PC)
  const lo = main.slice(main.indexOf('async function logoutSession'), main.indexOf('async function logoutSession') + 300);
  assert.match(lo, /closeRoomWindows\(\)/);
  // 배지·배너는 메인 창 것만 — 새 창이 같이 폴링해도 알림이 두 번 안 나간다
  const notify = main.slice(main.indexOf("ipcMain.on('ally:notify'"), main.indexOf("ipcMain.on('ally:notify'") + 200);
  assert.match(notify, /if \(!fromOurWindow\(_event\)\) return;/);
});

test('화면 캡처 — 덮개는 로컬 페이지·자기 다리만, 결과는 클립보드 그림 + 붙여넣기', () => {
  assert.ok(existsSync(new URL('assets/capture.html', root)));
  assert.ok(existsSync(new URL('capture-preload.js', root)));
  assert.ok(pkg.build.files.includes('capture-preload.js'), '빌드 파일 목록에 capture-preload.js 가 없다 — 설치본에서 덮개가 안 뜬다');
  const html = read('assets/capture.html');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'/);
  const start = main.slice(main.indexOf('async function startCapture'), main.indexOf("ipcMain.handle('ally:capture'"));
  assert.match(start, /preload: path\.join\(__dirname, 'capture-preload\.js'\)/);
  assert.match(start, /sandbox: true/);
  assert.match(start, /overlay\.webContents\.on\('will-navigate', \(e\) => e\.preventDefault\(\)\)/);
  const fin = main.slice(main.indexOf('function finishCapture'), main.indexOf('async function startCapture'));
  // Electron 44 에는 clipboard.writeImage 가 없다 — 부르면 예외로 조용히 취소된다(11/9 실기에서 잡음)
  assert.doesNotMatch(main, /clipboard\.writeImage\(/);
  assert.match(fin, /await clipboard\.write\(\[new ClipboardItem\(\{ 'image\/png': new Blob\(\[png\], \{ type: 'image\/png' \}\) \}\)\]\)/);
  assert.match(main, /fullscreen: true,/);
  assert.match(fin, /c\.target\.paste\(\)/);
  // 덮개에서 오는 신호는 덮개 것만 받는다
  assert.match(main, /ipcMain\.on\('ally:capture-done', \(event, rect\) => \{\s*if \(!fromCaptureOverlay\(event\)\) return;/);
  assert.match(main, /ipcMain\.handle\('ally:capture', \(event\) => \{\s*if \(!isOurContents\(event\.sender\)\) return false;/);
});

test('알림 — N초 뒤 닫기 · -1 은 안 숨김 · popWindow 면 배너 없이 창', () => {
  const n = main.slice(main.indexOf("ipcMain.on('ally:notify'"), main.indexOf("ipcMain.on('ally:notify'") + 3000);
  assert.match(n, /if \(popWindow === true\) \{[\s\S]*?win\.show\(\);[\s\S]*?ally:open-room[\s\S]*?return;\s*\}/);
  assert.ok(n.indexOf('popWindow === true') < n.indexOf('new Notification('), '창을 띄울 때도 배너가 먼저 나간다');
  // 배너 띄우기는 showBanner 로 떨어져 나갔다(11/13 55b31c5 — 윈도우는 close 이벤트가 안 와 타이머에서 직접 놓는다)
  const b = main.slice(main.indexOf('function showBanner('), main.indexOf('function showBanner(') + 3800);
  assert.match(b, /if \(process\.platform === 'win32' && !\(hide > 0\) && hide !== -1\) hide = 10;/, "윈도우에서 '기본' 은 10초 뒤 우리가 닫아야 한다(3775d92) — 트레이 '알림 시험'(hide: 0)도 showBanner 를 지나므로 그 안에서");
  // notify()('내려받기 완료'·업데이트)도 윈도우에서 10초 뒤 닫는다 — 안 닫히면 뒤 배너가 줄을 선다(11/13 M36 실기)
  const nf = main.slice(main.indexOf('function notify('), main.indexOf('function notify(') + 1200);
  assert.match(nf, /if \(process\.platform === 'win32'\) \{\s*setTimeout\(\(\) => \{\s*try \{\s*n\.close\(\);/, "notify() 배너가 윈도우에서 저절로 안 닫힌다");
  assert.match(b, /timeoutType: hide === -1 \? 'never' : 'default'/);
  assert.match(b, /if \(Number\.isFinite\(hide\) && hide > 0\) \{\s*setTimeout\(\(\) => \{\s*if \(!liveBanners\.has\(banner\)\) return;\s*banner\.close\(\);/);
});
