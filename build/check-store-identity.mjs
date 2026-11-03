// 스토어 빌드 전 — 파트너 센터에서 받은 식별자가 package.json 에 들어갔는지 본다.
// 자리표시자인 채로 올리면 스토어가 거절하고, 사람은 한참 뒤에야 안다.
import { readFileSync } from 'node:fs';
const appx = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).build.appx;
const bad = Object.entries(appx).filter(([, v]) => typeof v === 'string' && v.includes('STORE_'));
if (bad.length) {
  console.error('package.json build.appx 에 파트너 센터 값이 아직 없습니다: ' + bad.map(([k]) => k).join(', '));
  console.error('파트너 센터 > 앱 > 제품 ID 화면의 Package/Identity/Name · Publisher · PublisherDisplayName 을 넣으세요.');
  process.exit(1);
}
