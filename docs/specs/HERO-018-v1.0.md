# HERO-018 v1.0 — کارخانه توسعه اپلیکیشن موبایل

وضعیت: مصوب برای توسعه و تست؛ Android Preview و iOS Cloud Build به مجوزهای جداگانه نیاز دارند.

## هدف

Hero باید یک درخواست سادهٔ فارسی و Planning آماده را به Blueprint و Feature Recipe نسخه‌دار برای اپلیکیشن موبایل تبدیل کند. خروجی، Expo/React Native/TypeScript، مرز Android/iOS، API مشترک، داده، Auth، تست و تحویل کنترل‌شده به Cursor را روشن می‌کند؛ UI Native از Web Factory مستقل می‌ماند.

## طراحی

1. ورودی فقط با Planning آماده، شناسه و نسخه معتبر، نام برنامهٔ قابل‌حمل، درخواست فارسی و مجوز دقیق `develop` پذیرفته می‌شود. Global Stop ساخت خروجی تازه را fail-closed متوقف می‌کند.
2. Blueprint استاندارد Expo/React Native/TypeScript، Android و iOS، سه Screen نمونه، قرارداد REST نسخه‌دار، Adapter PostgreSQL، مرز Auth و Quality Gate را ثبت می‌کند. هیچ Expo dependency، دستگاه، emulator یا زیرساخت واقعی نصب یا provision نمی‌شود.
3. Feature Recipe مسئولیت Codex برای UI/API، Claude برای Quality Gate و Cursor برای handoff انسانی را نسخه‌دار می‌کند و صریحاً API/داده را قابل‌اشتراک ولی UI را Native و مستقل تعریف می‌کند.
4. Quality Gate گام HERO-016 شواهد تست ایزولهٔ Codex و Review مستقل Claude را می‌پذیرد. فقط `QUALITY_APPROVED` خروجی Mobile Factory را به `MOBILE_FACTORY_TESTED` تبدیل می‌کند.
5. Android Preview صرفاً با کد `ANDROID_PREVIEW_REQUIRES_SEPARATE_AUTHORIZATION` ثبت می‌شود و بدون اختیار `توسعه، تست و Preview` اجرا نمی‌شود. iOS EAS/Cloud Build نیز با کد `IOS_CLOUD_BUILD_REQUIRES_SEPARATE_AUTHORIZATION` و به‌دلیل امکان هزینه و وابستگی خارجی، تا مجوز مستقل external-spend اجرا نمی‌شود. هیچ Provider، Preview، build، deploy، credential، Secret یا هزینه واقعی در این گام رخ نمی‌دهد.

## معیار پذیرش

- یک درخواست نمونه فارسی به Blueprint و Feature Recipe موبایلِ قابل‌حمل و نسخه‌دار تبدیل شود.
- Expo/React Native/TypeScript، Android/iOS، مرز API/داده/Auth، استقلال UI Native و handoff Cursor روشن و قابل‌تست باشند.
- Quality Gate موفق با `MOBILE_FACTORY_TESTED` ثبت شود، بدون mutation مستقیم Repository یا شواهد خارجی.
- Android Preview و iOS Cloud Build بدون مجوزهای مستقل به‌صورت fail-closed و قابل‌فهم گیت شوند.
- هیچ Provider واقعی، emulator، Preview، cloud build، هزینه، دیتابیس، Auth، Secret یا deploy در این گام اجرا نشود.
