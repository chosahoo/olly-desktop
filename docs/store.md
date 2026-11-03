# Microsoft Store 배포 (2026-11-03)

같은 코드를 두 모양으로 낸다.

| | 깃허브 설치형 (지금) | Microsoft Store |
|---|---|---|
| 파일 | `Olly-Messenger-Setup-x.y.z.exe` (NSIS) | `Olly-Messenger-Store-x.y.z.appx` (MSIX) |
| 만들기 | `npm run release` (맥에서도 됨) | `npm run dist:store` (**윈도우 PC 에서만** — makeappx) |
| 서명 | 코드서명 인증서 필요 (OV, USB 토큰) | 스토어가 서명 — 인증서 없음 |
| 업데이트 | electron-updater 가 깃허브 릴리스에서 | 스토어가 내려받아 갈아끼움 |
| 시작 시 자동 실행 | 레지스트리 Run 키 (설정 토글) | 매니페스트 startupTask — 윈도우 설정 > 앱 > 시작 프로그램 |
| 홈페이지 단추 | `/download/windows` | 스토어 링크 (`ms-windows-store://pdp/?ProductId=…`) |

코드에서는 `process.windowsStore` 가 true 인지로 갈린다(`main.js` 의 `STORE`).
검사는 `npm test` — `test/store.test.mjs`.

## 처음 한 번 — 파트너 센터

1. <https://partner.microsoft.com/dashboard/registration> 에서 개발자 계정 (개인·회사 모두 무료, 2026년 기준).
2. 앱 > 새 제품 > **MSIX 또는 PWA** > 이름 예약: `올리 메신저`.
3. 제품 관리 > 제품 ID 화면의 값 셋을 `package.json` → `build.appx` 에 넣는다.
   - `Package/Identity/Name` → `identityName`
   - `Package/Identity/Publisher` (`CN=…` 통째로) → `publisher`
   - `Package/Properties/PublisherDisplayName` → `publisherDisplayName`
   자리표시자(`STORE_…`)가 남아 있으면 `dist:store` 가 멈춘다(`build/check-store-identity.mjs`).

## 올릴 때마다

1. 윈도우 PC 에서 `npm run dist:store` → `dist/Olly-Messenger-Store-x.y.z.appx` (서명 없음 — 스토어가 한다).
2. 파트너 센터 > 제출 > 패키지에 올린다. 버전은 `package.json` 과 같이 올린다(스토어는 같은 버전 재제출을 거절).
3. **심사 메모에 테스트 계정** — 로그인이 필요한 앱은 심사원 계정을 줘야 한다. 우리는 로그인 때 메일 6자리
   2단계 인증이 있어 심사원이 통과 못 한다. 테스트회사 계정 하나는 2단계 인증을 빼 두고 그 계정을 적는다.
4. 심사는 보통 며칠. 통과하면 스토어 링크를 홈페이지에 건다.

## 로컬에서 스토어 판 돌려 보기 (개발자 모드 켠 PC)

```powershell
# 임시 식별자로 빌드한 appx 를 풀어 서명 없이 등록
& "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign-2.6.0\winCodeSign-2.6.0-5puky\windows-10\x64\makeappx.exe" unpack /o /p dist\Olly-Messenger-Store-0.1.19.appx /d dist\store-unpacked
Add-AppxPackage -Register dist\store-unpacked\AppxManifest.xml
explorer.exe 'shell:AppsFolder\<PackageFamilyName>!OllyMessenger'   # Get-AppxPackage Ally.OllyMessenger
Get-AppxPackage Ally.OllyMessenger | Remove-AppxPackage                 # 끝나면 지운다
```

2026-11-03 이 PC(LG, 개발자 모드)에서 확인한 것: 등록·실행, 개발 통로 로그인(저장소는
`%LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming\올리 메신저\`), startupTask 등록(State=2),
설정의 '업데이트 확인' 이 Microsoft Store 를 연다.

## 알려진 함정

- `appx.applicationId` 는 영숫자만 — 기본값(패키지 이름 `ally-desktop`)은 makeappx 가 거절.
- `customExtensionsPath` 의 XML 은 `<Extensions>` 로 감싸지 않는다 — electron-builder 가 감싼다. 겹치면 `0x80080204`.
- 웹 설정 화면은 `info.store` 가 true 면 자동 실행 토글 대신 "윈도우 설정 > 앱 > 시작 프로그램" 안내를,
  버전 칸에는 "Microsoft Store 가 업데이트합니다" 를 보여야 한다 (웹 레포 `MessengerSettings.tsx`).
