# تفعيل اجتماعي حقيقي في Firebase

راجع README. أهم شرط أن ملفات `public/firebase-config.js` ليست بيانات سرية ولا تحتوي على Admin Key. ضع Public Web App Config فقط، ولا تكتب سر Meta أو مفتاح حساب خدمة في المستودع.

المنتج يحتاج صلاحيات Firebase Authentication للبريد وجوجل وفيسبوك (الأخير يحتاج Meta App)، وCloud Firestore بقواعد `firestore.rules`. قواعد الأصدقاء تتطلب بريدًا مُؤكدًا للبحث بالبريد الإلكتروني؛ يمكن الإضافة بالـID بدون ذلك. لا تفعّل القراءة العامة للقواعد.

لا تستخدم التطبيق لإدارة أرصدة مالية قبل إضافة backend موثوق. لا تتعامل مع Firebase web config على أنه سر يضمن الخصوصية، فالأمان من Authentication وSecurity Rules والمراقبة.