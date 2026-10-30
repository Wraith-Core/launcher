# لانشر ريد ريفر · Red River Launcher

## 1.4.1 (2026-10-30)

- بيانات السيرفر والتحديثات تصل عبر HTTPS موثق من السيرفر إلى المتجر ثم المشغّل.
- ربط الحساب من داخل اللعبة: «ربط حسابي»، ثم نسخ الأمر الظاهر إلى محادثة اللعبة خلال خمس دقائق.
- جلسة الربط صالحة لمدة 30 يومًا ومحفوظة بتشفير ويندوز. يمكن إلغاء الربط، ولا تصل معرفات Steam أو Discord إلى واجهة المشغّل أو طلب بيانات الحساب.
- روابط الدعم والدخول محصورة في مواقع السيرفر والخدمات المعروفة.
- اختبار: ربط حسابين مستقلين، انتهاء الرمز، إلغاء الربط وإعادة فتح المشغّل.


لانشر سيرفر **ريد ريفر** (Red River) على RedM: آخر التحديثات، حالة السيرفر وعدد اللاعبين، زر الدسكورد، والدخول للسيرفر بضغطة.

## التحميل (خطوتين، مرة وحدة بس)

1. **ثبّت شهادة التوقيع:** حمّل [RedRiver-Certificate.bat](https://github.com/Wraith-Core/launcher/releases/latest/download/RedRiver-Certificate.bat) وافتحه، وإذا سألك ويندوز عن شهادة باسم «Wraith Core» اضغط **Yes**، هذا اسم شهادة توقيع لانشر ريد ريفر.
   هذي الشهادة هي توقيع اللانشر، وبدونها يحجبه ويندوز 11. هي مخصصة لتوقيع البرامج فقط، وتقدر تحذفها أي وقت من `certmgr.msc`. إذا ثبّتها قبل، لا تعيد تثبيتها.
2. **ثبّت اللانشر:** [RedRiver-Setup.exe](https://github.com/Wraith-Core/launcher/releases/latest/download/RedRiver-Setup.exe) (يتحدث تلقائياً)
   أو النسخة بدون تثبيت: [RedRiver-Portable.exe](https://github.com/Wraith-Core/launcher/releases/latest/download/RedRiver-Portable.exe)

يحتاج [RedM](https://redm.net/) مثبت على جهازك.

عندك اللانشر من أيام Wraith Core؟ لا تسوي شي: يتحدث لحاله إلى ريد ريفر، وتبقى إعداداتك وحسابك واختصاراته كما هي.

---

### للمطورين
- المحتوى كله (اسم السيرفر، التحديثات، الروابط، رمز الدخول، الشعار) يأتي من السيرفر: `https://wraith7.com/shop/api/launcher/public/launcher.json`، فتغييره لا يحتاج إصدار جديد من اللانشر.
- تشغيل محلي: `npm install` ثم `npm start`
- إصدار جديد: ارفع `version` في `package.json` ثم `npm run release -- "وش تغيّر"`
- التوقيع يتم بشهادة «Wraith Core» من مخزن شهادات ويندوز على جهاز المالك (بصمتها في `scripts/sign.cjs`). اسم الشهادة يبقى كما هو. نسخة احتياطية من المفتاح محفوظة خارج هذا المستودع، ولا تُرفع أبداً.
- **هوية التثبيت باقية من أيام Wraith Core، لا تغيّرها أبداً**، وإلا اللانشر المثبّت عند اللاعبين يفقد تحديثاته أو بياناته أو اختصاراته:
  - `build.appId` = `com.wraithcore.launcher`: هوية التثبيت والتحديث ومفتاح إلغاء التثبيت في الريجستري.
  - `name` = `wraith-launcher`: مجلد التثبيت `%LOCALAPPDATA%\Programs\wraith-launcher` ومجلد التحديثات.
  - `productName` (الخارجي) = `Wraith Core`: اسم التطبيق داخل Electron، ومنه مجلد بيانات اللاعب `%APPDATA%\Wraith Core`. هذا المجلد مثبّت أيضاً في `main.js`.
  - `build.executableName` = `Wraith Core`: اسم الملف `Wraith Core.exe` اللي تشير له اختصارات اللاعبين وأيقونات شريط المهام.
  - `publish` = GitHub `Wraith-Core/launcher`: من هنا يجيب اللانشر تحديثاته.
  - `win.signtoolOptions.publisherName` = `Wraith Core`: اسم الشهادة (CN)، وليس اسماً يظهر للاعب.
- الأسماء اللي يشوفها اللاعب: `build.productName` و`nsis.shortcutName` و`nsis.uninstallDisplayName` و`author` و`description`، والنصوص في `renderer/`.
- كل إصدار يرفع الملفات بأسماء ريد ريفر، ومعها نسخ بالأسماء القديمة (`WraithCore-Setup.exe` و`WraithCore-Portable.exe` و`WraithCore-Certificate.bat`): نسخة 1.3.0 المحمولة تطلب `WraithCore-Portable.exe` بالاسم، والروابط القديمة في الدسكورد تشير لها. `scripts/release.mjs` يسويها تلقائياً.
