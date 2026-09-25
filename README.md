# Wraith Core Launcher

لانشر سيرفر **Wraith Core** على RedM: آخر التحديثات، حالة السيرفر وعدد اللاعبين، زر الدسكورد، والدخول للسيرفر بضغطة.

## التحميل
- **نسخة التثبيت (موصى بها، تتحدث تلقائياً):** [WraithCore-Setup.exe](https://github.com/Wraith-Core/launcher/releases/latest/download/WraithCore-Setup.exe)
- **نسخة بدون تثبيت:** [WraithCore-Portable.exe](https://github.com/Wraith-Core/launcher/releases/latest/download/WraithCore-Portable.exe)

> أول تشغيل قد يظهر لك Windows رسالة «Windows protected your PC» لأن الملف غير موقّع رقمياً: اضغط **More info** ثم **Run anyway**.

يحتاج [RedM](https://redm.net/) مثبت على جهازك.

---

### للمطورين
- المحتوى كله (التحديثات، الروابط، رمز الدخول، الشعار) يأتي من السيرفر: `http://37.221.94.8:30120/w_deploy/launcher.json`، فتغييره لا يحتاج إصدار جديد من اللانشر.
- تشغيل محلي: `npm install` ثم `npm start`
- إصدار جديد: ارفع `version` في `package.json` ثم `npm run release -- "وش تغيّر"`
