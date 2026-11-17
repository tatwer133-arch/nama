# سيجا رويال V10 — الشات، الموافقة على الصوت، المشاهدة، والتواصل السحابي

النسخة العامة بعد النشر: https://seega-royale-eg.vercel.app/

## متاح فورًا بدون Firebase

- عند وصول رسالة داخل الجولة والشات مقفول: صوت تنبيه، اهتزاز (لو الجهاز بيدعمه)، عداد أحمر على زر الشات، ورسالة قصيرة؛ ويمكن تفعيل إشعار المتصفح بإذن المستخدم إذا الصفحة مفتوحة في الخلفية.
- طلب اتصال صوتي من اللاعب الآخر. المتلقي يرى **موافقة/رفض** قبل تفعيل الميكروفون؛ المرسل يرى الانتظار ثم الرفض أو بدء الصوت. يمكن إلغاء الطلب.
- نافذة الهدايا تُعرض مباشرة تحت `#modal-root` (خارج حاوية WebGL)، بعرض محدود داخل شاشة الموبايل، ولن تنقص يمينًا. الأصوات والهدايا الأصلية محفوظة.
- مشاهدون عبر `https://seega-royale-eg.vercel.app/watch/ROOMCD` باستخدام اتصال PeerJS تجريبي. صاحب الغرفة يطلب تشغيل المشاهدة **بموافقة المنافس**. تظهر أسماء وأفاتارات المشاهدين للاعبين. المشاهد ممنوع من تحريك الحجارة والهدايا والميكروفون على مستوى المحرك؛ يُسمح له بالشات فقط. إرسال الصوت للمشاهدين عبر WebRTC/PeerJS عندما يكون المايك شغالًا وقد يفشل على بعض الشبكات.
- الشات الصوتي والغرف بين جهازين **P2P تجريبي** ويعتمدان على شبكة PeerJS العامة بدون TURN مضمون. صاحب الغرفة لازم يترك الصفحة مفتوحة.
- باقي الألعاب والجرافيك ثلاثي الأبعاد ونظام العملات التجريبية من V8 ما زالوا موجودين.

## محضّر برمجيًا لكنه لا يعمل دون Firebase

توجد ملفات `public/cloud-social.js` و `public/cloud-profile.js` و `firestore.rules` لإدارة حسابات Firebase الحقيقية، والمزامنة بين الأجهزة، والبحث عن أصدقاء بالـID أو بريد مُتحقق منه، والقبول والرفض، ورسائل الأصدقاء، ودعوة غرفة، وشات عام، وحالات Online/Playing/Watching. 

**الحساب المتصل والمزامنة لا يعملان على الموقع ما دام `public/firebase-config.js` = null.** لا يكفي نشر Vercel. يجب على مالك المشروع ربط Firebase Authentication وFirestore بقواعد آمنة. لا نُنشئ بيانات وهمية أو نُظهر أصدقاء محليين على أنهم أونلاين.

### إعداد Firebase

1. أنشئ مشروعًا مجانيًا في [Firebase Console](https://console.firebase.google.com/) وفعل Firestore وFirebase Authentication.
2. فعّل Email/Password وGoogle؛ لتفعيل Facebook يجب إعداد تطبيق Meta ومفاتيحه **داخل لوحة Firebase فقط**.
3. أضف `seega-royale-eg.vercel.app` إلى Authorized domains داخل Authentication.
4. انسخ بيانات **Web app config العامة** (ليست secrets) في `public/firebase-config.js`.
5. انشر قواعد `firestore.rules` قبل تشغيل التواصل السحابي، ثم انشر ملفات الموقع.
6. جرّب التسجيل على موبايلين، وتوثيق البريد للعثور عليه بالإيميل، وإضافة الأصدقاء والمشاهدة، مع حسابين مختلفين.

### حدود ما زال يحتاج إلى خلفية إنتاجية

- لا يوجد Push Notifications إذا كان التطبيق مقفولًا بالكامل؛ الموجود تنبيهات داخل اللعبة وBrowser Notification لصفحة حية بعد الموافقة. يحتاج FCM + Service Worker للتنبيه أثناء الإغلاق.
- الحضور عبر Firestore يعتمد على heartbeat وبالتالي حالة Offline قد تتأخر حتى دقيقتين. الخدمة الإنتاجية يفضل استعمال RTDB `onDisconnect`.
- العملات والجواهر والدوري محليين؛ **لا يصح** استخدامهم لجوائز قيمة أو معاملات مالية قبل بناء خادم مؤمّن يفرض القواعد ويتحقق من الحركات والأرصدة.
- الشات العام بحاجة إلى نظام تبليغ/إشراف وحماية من الرسائل المزعجة قبل الإطلاق العام الكبير.

## اختبارات

```bash
node --test tests.mjs tests-v4.mjs tests-online.mjs tests-v5.mjs tests-v6.mjs tests-v7.mjs tests-v8.mjs tests-v9.mjs
```

تحققنا من البروتوكول عبر محاكاة مضيف وضيف ومشاهد؛ **اختبار WebRTC/P2P الحقيقي بين أجهزة على شبكات مختلفة لم يكتمل** في بيئة الاختبار. متصفح Chromium في بيئة التنفيذ محظور من فتح عناوين localhost، لذا لا يمكن تأكيد شكل النافذة بصريًا على هاتف فعلي هنا.


## V10: Web app linked to Firebase `seega-royal`
- Public Firebase web app config is set in `public/firebase-config.js` (no Admin secrets).
- Email/Password and Google Auth + Cloud Firestore **must be enabled** by the project owner, with this repo's `firestore.rules` published; otherwise auth / social synchronization will not work.
- Whitelist `seega-royale-eg.vercel.app` under Authentication → Settings → Authorized domains.
- Facebook additionally needs a Meta developer application connected in Firebase Authentication.
- `players`, `directory`, `presence`, `friendRequests`, `dmThreads`, `inbox`, `emailIndex`, and `publicChat` are protected by Firestore rules.
- Cloud sync stores name, avatar/photo, stable player ID and preferences. Wallet, purchased gems, rankings remain browser-local until a trusted authoritative server is built.
- Firebase web API key is *public* app identification; rely on Auth and Firestore Rules for access control.