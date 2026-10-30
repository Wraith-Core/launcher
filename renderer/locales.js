// Account pairing messages. The launcher currently uses Arabic.
const launcherLocales = {
  "ar": {
    "unlinked": "اربط حسابك من داخل اللعبة لعرض ساعات اللعب وبياناتك.",
    "waiting": "بانتظار تأكيد الربط من داخل اللعبة.",
    "expired": "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
    "unavailable": "تعذر تحديث بيانات الحساب. حاول بعد قليل.",
    "pairHelp": "انسخ الأمر التالي واكتبه في محادثة اللعبة خلال خمس دقائق:",
    "unlinkFailed": "تعذر إلغاء الربط. تحقق من الاتصال وحاول مجددًا.",
    "copied": "نُسخ أمر الربط."
  },
  "en": {
    "unlinked": "Link your account in game to view your play time and profile.",
    "waiting": "Waiting for in-game confirmation.",
    "expired": "This code expired. Request a new code.",
    "unavailable": "Your account could not be refreshed. Try again shortly.",
    "pairHelp": "Copy this command into game chat within five minutes:",
    "unlinkFailed": "Unlinking failed. Check your connection and try again.",
    "copied": "Pairing command copied."
  }
};
const launcherText = launcherLocales[document.documentElement.lang] || launcherLocales.ar;
