# سيجا رويال — تفعيل Firebase (مشروع seega-royal)

تم إدراج بيانات إعداد تطبيق الويب العامة في `public/firebase-config.js`. **التطبيق لا يقدر يفعّل الخدمات بنفسه من بيانات الإعداد العامة.** اتبع الخطوات التالية بصفتك مالك مشروع Firebase:

1. افتح https://console.firebase.google.com/project/seega-royal/authentication/providers ثم **Get started** إن ظهر، وفعّل **Email/Password** ثم **Google** (اضغط Save لكل مزود).
2. في **Authentication → Settings → Authorized domains** أضف `seega-royale-eg.vercel.app`، بدون https أو شرطة مائلة.
3. افتح https://console.firebase.google.com/project/seega-royal/firestore. اضغط **Create database** واختر Standard + `(default)`، ثم وضع الإنتاج **Production mode** وليس وضع اختبار واسع النطاق، وحدد موقع البيانات المتاح على الخطة المجانية.
4. بعد إنشاء قاعدة البيانات افتح تبويب **Rules**، واحذف القواعد الافتراضية واستبدلها بالنص الكامل في ملف `firestore.rules`، ثم اضغط **Publish**. لا تستخدم `allow read, write: if true`.
5. اختبر إنشاء حسابين بإيميلين مختلفين من متصفحين، ثم سجل دخولك للحساب الأول من الجهاز الثاني؛ يجب أن تظهر **نفس الصورة، الاسم، والـID**. جرّب إضافة صديق بالـID والشات العام والخاص بعد قبول الطلب.
6. **Facebook** لا يعمل بمجرد إضافة Firebase Config: أنشئ تطبيقًا في Meta for Developers وأضف App ID + App Secret في Firebase Authentication → Sign-in method → Facebook، وإعداد OAuth redirect داخل Meta. لا ترسل الأسرار هنا.

**مهم:** الكوينز والجواهر ونتائج المباريات ما زالت محفوظة محليًا، ولن تتم مزامنتها بين الأجهزة إلى أن يتوفر خادم آمن يتحقق من الأرصدة والحركات. نظام الغرف الصوتية والمشاهدة P2P تجريبي، ولا يضمن العمل عبر جميع الشبكات.

التحقق من إرسال رسائل وإضافة أصدقاء يحتاج تجربة بعد نشر قواعد Firestore؛ الاختبارات المحلية لا تثبت نجاح الخدمات السحابية الفعلية.