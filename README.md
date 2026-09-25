# Wraith Core Launcher

لانشر سيرفر **Wraith Core** على RedM: آخر التحديثات، حالة السيرفر وعدد اللاعبين، زر الدسكورد، والدخول للسيرفر بضغطة.

## التحميل (خطوتين، مرة وحدة بس)

1. **ثبّت شهادة Wraith Core:** حمّل [WraithCore-Certificate.bat](https://github.com/Wraith-Core/launcher/releases/latest/download/WraithCore-Certificate.bat) وافتحه، وإذا سألك ويندوز عن شهادة «Wraith Core» اضغط **Yes**.
   هذي الشهادة هي توقيع اللانشر، وبدونها يحجبه ويندوز 11. هي مخصصة لتوقيع البرامج فقط، وتقدر تحذفها أي وقت من `certmgr.msc`.
2. **ثبّت اللانشر:** [WraithCore-Setup.exe](https://github.com/Wraith-Core/launcher/releases/latest/download/WraithCore-Setup.exe) (يتحدث تلقائياً)
   أو النسخة بدون تثبيت: [WraithCore-Portable.exe](https://github.com/Wraith-Core/launcher/releases/latest/download/WraithCore-Portable.exe)

يحتاج [RedM](https://redm.net/) مثبت على جهازك.

---

### للمطورين
- المحتوى كله (التحديثات، الروابط، رمز الدخول، الشعار) يأتي من السيرفر: `http://37.221.94.8:30120/w_deploy/launcher.json`، فتغييره لا يحتاج إصدار جديد من اللانشر.
- تشغيل محلي: `npm install` ثم `npm start`
- إصدار جديد: ارفع `version` في `package.json` ثم `npm run release -- "وش تغيّر"`
- التوقيع يتم بشهادة «Wraith Core» من مخزن شهادات ويندوز على جهاز المالك (بصمتها في `package.json`). نسخة احتياطية من المفتاح محفوظة خارج هذا المستودع، ولا تُرفع أبداً.
