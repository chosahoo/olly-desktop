/*
  스토어(MSIX) 판 분기 검사 (2026-11-03).
  같은 main.js 가 설치형(NSIS)과 스토어 두 모양으로 나간다. 스토어 판에서
  electron-updater 가 돌거나 레지스트리 자동 실행을 등록하면 스토어 심사에서
  떨어지거나(패키지 밖 쓰기) 사용자에게 두 번 깔린다. 여기서 글자로 붙잡는다.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const main = readFileSync(new URL('main.js', root), 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('스토어 판 판별은 process.windowsStore 하나로', () => {
  assert.match(main, /const STORE = process\.windowsStore === true;/);
});

test('스토어 판은 electron-updater 를 켜지 않는다 — 스토어가 갱신', () => {
  const fn = main.slice(main.indexOf('function setupAutoUpdate'), main.indexOf('function setupAutoUpdate') + 300);
  assert.match(fn, /if \(!app\.isPackaged \|\| process\.platform !== 'win32' \|\| STORE\) return;/);
});

test("스토어 판의 '업데이트 확인' 은 스토어의 다운로드·업데이트 화면을 연다", () => {
  const fn = main.slice(main.indexOf('function checkForUpdates'), main.indexOf('function setupAutoUpdate'));
  assert.match(fn, /if \(STORE\) \{[\s\S]*?if \(manual\) openExternalSafely\(STORE_UPDATES_URL\);[\s\S]*?return;/);
  assert.match(main, /const STORE_UPDATES_URL = 'ms-windows-store:\/\/downloadsandupdates';/);
  // 운영체제로 넘기는 자리는 여전히 한 곳 — 웹 레포 check-logic 과 같은 잣대
  assert.equal((main.match(/shell\.openExternal\(/g) || []).length, 1);
});

test('스토어 판은 첫 실행·트레이·설정에서 레지스트리 자동 실행을 건드리지 않는다', () => {
  assert.match(main, /if \(app\.isPackaged && !STORE && !fs\.existsSync\(firstRunFlag\)\)/);
  assert.match(main, /\.\.\.\(STORE\s*\?\s*\[\]\s*:\s*\[\s*\{\s*label: '시작할 때 자동 실행'/);
  const at = main.indexOf("ipcMain.handle('ally:set-open-at-login'");
  const body = main.slice(at, main.indexOf('\n});', at));
  assert.match(body, /if \(STORE\) return null;/);
  assert.match(main, /openAtLogin: STORE \? null : app\.getLoginItemSettings\(\)\.openAtLogin === true,/);
  assert.match(main, /store: STORE,/);
});

test('appx 설정 — 식별자 자리표시자는 빌드를 막고, 확장 XML 은 안쪽 요소만', () => {
  const appx = pkg.build.appx;
  assert.equal(appx.applicationId, 'OllyMessenger'); // 영숫자만 — 'ally-desktop' 은 makeappx 가 거절
  assert.ok(existsSync(new URL(appx.customExtensionsPath, root)));
  const ext = readFileSync(new URL(appx.customExtensionsPath, root), 'utf8');
  assert.match(ext, /Category="windows\.startupTask"/);
  assert.ok(ext.includes('Executable="app' + String.fromCharCode(92) + 'Olly Messenger.exe"'), '실행 파일 경로는 app 폴더 아래 역슬래시');
  const extBody = ext.replace(/<!--[\s\S]*?-->/g, ''); // 주석은 뺀다
  assert.doesNotMatch(extBody, /<Extensions>/, 'electron-builder 가 <Extensions> 로 감싼다 — 겹치면 makeappx 0x80080204');
  assert.match(pkg.scripts['dist:store'], /check-store-identity\.mjs && electron-builder --win appx/);
  // 자리표시자가 남아 있는 지금은 검사 스크립트가 1 로 끝나야 한다
  const r = spawnSync(process.execPath, [new URL('build/check-store-identity.mjs', root).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { encoding: 'utf8' });
  const hasPlaceholder = Object.values(appx).some((v) => typeof v === 'string' && v.includes('STORE_'));
  assert.equal(r.status, hasPlaceholder ? 1 : 0, r.stderr);
});

test('켜자마자 받은 업데이트는 바로 조용히 설치하고 다시 켠다 — PC 만 끄는 사람이 옛 판에 머물지 않게', () => {
  const at = main.indexOf("autoUpdater.on('update-downloaded'");
  const h = main.slice(at, at + 1200);
  assert.match(main, /const STARTED_AT = Date\.now\(\);/);
  assert.match(h, /if \(Date\.now\(\) - STARTED_AT < INSTALL_ON_START_MS\) \{\s*quitting = true;\s*autoUpdater\.quitAndInstall\(true, true\);\s*return;/, '켜자마자 받은 업데이트를 바로 설치하지 않는다');
  assert.ok(h.indexOf('INSTALL_ON_START_MS') < h.indexOf('updateBanner = notify('), '바로 설치 판단이 준비됨 알림보다 먼저여야 한다');
  assert.match(main, /autoUpdater\.autoInstallOnAppQuit = true;/, '켠 지 오래면 종료할 때 설치는 그대로');
});
