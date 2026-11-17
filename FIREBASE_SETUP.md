# تفعيل الحسابات الحقيقية — Seega Royale V8

> حاليًا Vercel يستضيف نسخة ثابتة فقط. أزرار الإيميل المحلي لا تُنشئ حسابًا سحابيًا، حتى يتم تفعيل Firebase. لا نطلب كلمة سر أو API secret هنا.

1. أنشئ مشروع Firebase خاص باللعبة من https://console.firebase.google.com/.
2. أضف Web app، وانسخ **الـ public web config** (apiKey، authDomain، projectId، appId، messagingSenderId) إلى `public/firebase-config.js` بدل `null`.
3. في Firebase Authentication > Sign-in method: فعّل Email/Password وGoogle، وفيسبوك عند امتلاك Meta App ID/secret (يُضافان داخل Firebase Console فقط، وليس للكود).
4. في Authentication > Settings > Authorized domains أضف `seega-royale-eg.vercel.app` وأي نطاق رسمي.
5. في Firestore أنشئ قاعدة بيانات، وانشر القواعد في `firestore.rules` قبل وضع التطبيق على الموقع.
6. أعد نشر نفس المشروع، واختبر تسجيل إيميل على جهاز أول ثم دخوله على جهاز ثانٍ، وتحديث صورة البروفايل، ثم إعادة فتح اللعبة.

## ماذا تتم مزامنته؟
- ID ثابت مرتبط بـ Firebase UID، الاسم والصورة والأفاتار ولون الحجارة وإعدادات الصوت.
- الحساب يعمل من أجهزة مختلفة بعد تفعيل Firebase، لكن **المحفظة والكوينز والجواهر وترتيب اللاعبين والدوريات لا تزال محلية**؛ لا تضع هذه القيم في مستندات قابلة لتعديل العميل للبطولات ذات الجوائز.
- دعوات غرف P2P لا تزال تجريبية وتعتمد على PeerJS/STUN؛ لا تتضمن matchmaking مضمونًا أو خادمًا يتحقق من الحركات.

## أمان
- لا تضع Firebase Admin Service Account أو Facebook App Secret في ملفات `public/`.
- Firebase web config بيانات تعريف علنية، لكن الأمان يأتي من Authentication + Firestore Rules.
- قواعد Firestore تمنع أي مستخدم من قراءة أو تغيير ملف لاعب آخر. لا تمنح تطبيق المتصفح صلاحية تغيير الأرصدة أو المكافآت الموثوقة.