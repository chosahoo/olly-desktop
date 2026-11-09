/*
  안 읽음 표시 — 트레이 빨간 점 · 작업표시줄 깜빡임 (2026-11-09, CSR 제보).
  창을 트레이로 닫아 두면 작업표시줄 단추가 없어 오버레이도 깜빡임도 안 보였다.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const main = readFileSync(new URL('main.js', root), 'utf8').replace(/\r\n/g, '\n');

test('안 읽은 메시지가 있으면 트레이 아이콘이 빨간 점 판으로 바뀐다', () => {
  assert.ok(existsSync(new URL('assets/tray-unread.png', root)), 'assets/tray-unread.png 가 없다');
  const at = main.indexOf('function trayIcon');
  const fn = main.slice(at, at + 700);
  assert.match(fn, /unread > 0 \? 'tray-unread\.png' : 'tray\.png'/);
  const rebuild = main.slice(main.indexOf('const rebuild = () =>'), main.indexOf('tray.rebuild = rebuild'));
  assert.match(rebuild, /tray\.setImage\(trayIcon\(\)\)/, '안 읽음이 바뀌어도 트레이 아이콘을 다시 그리지 않는다');
});

test('창이 앞에 없을 때 깜빡이고, 창을 올리면 멈춘다', () => {
  const at = main.indexOf("ipcMain.on('ally:badge'");
  const badge = main.slice(at, at + 1500);
  assert.match(badge, /!win\.isFocused\(\) && unread > 0\) \{\s*win\.flashFrame\(true\)/, '포커스 없을 때 깜빡이지 않는다');
  assert.doesNotMatch(badge, /!win\.isVisible\(\) && unread > 0/, '숨었을 때만 깜빡이면 트레이로 닫은 창은 단추가 없어 아무 표시도 없다');
  assert.match(main, /win\.on\('focus', \(\) => \{\s*if \(process\.platform === 'win32'\) win\.flashFrame\(false\);/);
});

test("'새 버전 준비됨' 알림은 붙잡아 두었다가 종료 직전에 닫는다 — 갱신 뒤 알림 센터에 옛 알림이 남지 않게", () => {
  assert.match(main, /updateBanner = notify\(\s*`올리 메신저 \$\{info\.version\} 준비됨`/);
  const bq = main.slice(main.indexOf("app.on('before-quit'"), main.indexOf("app.on('before-quit'") + 200);
  assert.match(bq, /^\s*closeUpdateBanner\(\);/m, '종료 때 옛 준비됨 알림을 안 닫는다');
  assert.match(main, /if \(updateBanner\) updateBanner\.close\(\);/);
});

