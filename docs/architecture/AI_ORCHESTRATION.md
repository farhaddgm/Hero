# معماری یکپارچهٔ Multi-AI در Hero

- نسخهٔ قرارداد: 1.0
- وضعیت: هستهٔ deterministic، role routing، Quality Gate، ارزیابی ۱۱ تیم، reliability، benchmark مصنوعی، transport adapterهای واقعی و hydration نسخه‌دار پیاده‌سازی شده؛ Provider زنده همچنان جداگانه gated است
- دامنه: ادغام معماری `ai-assistant/Wepod` با پلتفرم Hero

## تصمیم معماری

Hero پلتفرم حاکمیت و اجرای یک سازمان نرم‌افزاری است و Wepod/`ai-assistant` یک Project یا محصول تحت مدیریت آن محسوب می‌شود. معماری Multi-AI به‌صورت یک زیرسیستم داخلی در Modular Monolith Hero قرار می‌گیرد؛ هستهٔ جدا یا Orchestrator موازی ساخته نمی‌شود.

```text
مالک پروژه
    |
    v
Hero Control Plane
  Team Registry / Planner / Workflow
  Memory / Principles / Authorization
  Quality / Assurance / Release
    |
    v
AI Orchestration
  Role -> Agent Profile -> Provider/Model
  Context Snapshot -> Invocation -> Structured Result
  Evaluation -> Decision Proposal -> Owner/Gate
    |
    v
Provider Adapters
  OpenAI / Anthropic / Google / Compatible / Deterministic
```

## مرزهای مفهومی

```text
Team != AI Role
Task Kind != Agent Profile
Run != AI Invocation
Evaluation != Approval
Decision Proposal != Authorization
Provider != Model
Credential Reference != Credential Value
```

تیم‌ها واحدهای سازمانی با مسئولیت، اختیار، readiness و مالکیت خروجی هستند. Roleها قابلیت‌های AI هستند و می‌توانند بین تیم‌ها و Projectها به‌صورت مستقل تخصیص یابند. چند تیم می‌توانند از یک Role استفاده کنند و یک تیم می‌تواند چند Role داشته باشد.

## Benchmark معماری

Benchmark فاز فعلی مقایسهٔ شکل معماری است، نه اندازه‌گیری Latency یا هزینهٔ واقعی؛ چون Provider زنده و Dataset عملیاتی هنوز متصل نیستند.

| گزینه | تعویض Provider | استقلال Role/Profile | Audit و Governance | پیچیدگی فاز اول | تصمیم |
| --- | ---: | ---: | ---: | ---: | --- |
| SDK مستقیم در Business Logic | ضعیف | ضعیف | متوسط | کم در شروع، زیاد در ادامه | رد |
| LiteLLM به‌عنوان هسته | عالی | متوسط | نیازمند لایهٔ تکمیلی | متوسط | فقط Gateway آینده |
| LangGraph/CrewAI به‌عنوان هسته | خوب | خوب | نیازمند تطبیق با گیت‌های Hero | زیاد | فعلاً رد |
| هستهٔ دامنه‌ای Hero + Provider Adapter | عالی | عالی | عالی | متوسط | انتخاب |

نتیجه: قرارداد داخلی Hero باید منبع حقیقت Role، Profile، Context، Invocation، Evaluation و Approval بماند. LiteLLM یا Gateway مشابه بعداً می‌تواند پشت Provider Port برای Routing، Retry، Fallback و Cost Tracking قرار گیرد.

## اجزای فاز پایه

- `AIProvider`: هویت، mode، قابلیت‌ها و Adapter اجرای Provider؛ مقدار Credential وارد Domain نمی‌شود.
- `Model`: متادیتای مدل وابسته به Provider، بدون تغییر تاریخچهٔ قبلی.
- `AgentProfile`: ترکیب Role، Provider، Model، Prompt Version، Context Policy، Tool Policy، Output Schema، Timeout و محدودیت Retry/Cost.
- `Project Role Binding`: نگاشت نسخه‌دار Role به Profile برای یک Project؛ جایگزینی Binding با `supersedesBindingId` انجام می‌شود.
- `AI Invocation`: ثبت Profile Snapshot، Context Snapshot، وضعیت، Usage، نتیجه و خطا.
- `Evaluation`: Evidence ساختاریافته با verdict، score، confidence و findings؛ verdict به‌تنهایی مجوز نیست.
- `Evaluator Workflow`: خروجی `evaluation-v1` فقط از Invocation نقش‌های Evaluator/Verifier/Code Reviewer به Evaluation لینک‌شده تبدیل می‌شود.
- `Decision Proposal`: گزینه‌ها، شواهد، توصیه و سطح اطمینان؛ فقط مالک می‌تواند آن را resolve کند و resolve شدن Authorization ایجاد نمی‌کند.
- `Workflow Contract`: هر workflow ترتیب Roleها، schema خروجی و policy تغییر را صریح می‌کند؛ Planner همین route را روی هر Task ثبت می‌کند.
- `Organization Performance Review`: برای هر دوره دقیقاً ۱۱ team evidence و پنج score نرمال‌شده می‌دهد؛ نتیجهٔ آن توصیه است، نه تغییر خودکار وضعیت تیم.
- `Reliability Policy`: timeout، retry، cost cap، health check و latency/attempt evidence پیش از پذیرش نتیجه اعمال می‌شوند.
- `Synthetic Benchmark`: Provider/Profileها با runner تزریق‌شده و بدون شبکه مقایسه می‌شوند؛ نتیجه فقط advisory است.

## سیاست پیش‌فرض Provider

پیش‌فرض اجرایی فعلی Codex است، اما به‌صورت Profile/Policy نگهداری می‌شود و در Business Logic hard-code نمی‌شود. نقش‌های تحلیل، ارزیابی و پژوهش می‌توانند Profile متفاوت داشته باشند. Adapterهای واقعی OpenAI Responses، Anthropic Messages، Google Gemini و OpenAI-compatible در runtime قابل پیکربندی‌اند؛ در نبود credential، cost accounting و active authorization verifier هیچ درخواست بیرونی ارسال نمی‌شود و حالت پیش‌فرض همچنان deterministic است.

## ادغام با Hero موجود

| قابلیت سند Multi-AI | مرز Hero پس از ادغام |
| --- | --- |
| Conversation و Project | Project، Request، Planner و Project Memory |
| Workflow و Run | Workflow Engine، Task Graph و Isolated Runner |
| Context Assembler | Project Memory با Role/Scope/Freshness و Context Snapshot |
| Evaluator | Quality Gate و Evidence؛ نه تأیید خودکار |
| Human Approval | Owner Auth، Authorization و گیت‌های حساس |
| Tool Orchestrator | Application/Adapter/Runner با مجوز دقیق |
| AI Invocation | فرزند عملیاتی Task/Run، نه جایگزین Run |
| Provider/Model/Profile | زیرسیستم جدید AI Orchestration |

Projectionهای PostgreSQL مربوط به AI در migration `002_ai_orchestration_projections.sql` تعریف شده‌اند و Snapshotهای versioned همهٔ Registryهای اصلی Control Plane در migration `004_domain_registry_snapshots.sql` نگهداری می‌شوند. جدول موازی برای Memory، Approval یا Run به‌عنوان منبع حقیقت ساخته نشده است؛ Snapshot فقط read projection قابل‌بازسازی است.

اتصال عملیاتی اکنون از طریق `createAiProjectionStore` به Event Store موجود انجام می‌شود و Outbox را با همان تراکنش می‌نویسد؛ migration `003_ai_reliability_and_team_performance.sql` فیلدهای reliability و Projectionهای ارزیابی ۱۱ تیم/benchmark را اضافه می‌کند و `createPostgresDomainRegistrySnapshotStore` برای ذخیره/بازیابی Snapshotهای Domain استفاده می‌شود. Control Plane در startup hydrate می‌شود و بعد از هر فرمان موفق Snapshot جدید ثبت می‌کند. این کار منبع حقیقت دوم ایجاد نمی‌کند؛ بازسازی Projection از Eventهای append-only انجام می‌شود.

## امنیت و اختیار

1. Profileهای `read-only` هیچ Tool Actionی دریافت نمی‌کنند.
2. Evaluator فقط Evidence تولید می‌کند و نمی‌تواند کد، داده یا سرور را تغییر دهد.
3. Credential فقط با Reference امن زمان اجرا معرفی می‌شود؛ مقدار خام در Repository، Event، Log یا Context ذخیره نمی‌شود.
4. Provider زنده به‌دلیل هزینه/اقدام خارجی بدون Authorization جداگانه اجرا نمی‌شود.
5. خروجی AI قبل از تبدیل‌شدن به Action باید Schema و Policy Check شود.
6. Global Stop، اصول حیاتی، Quality Gate و Production Authorization همچنان مرجع Hero هستند.

## رودمپ ادغام

### انجام‌شده در فاز پایه

- قرارداد Multi-AI و Summary عمومی؛
- Aggregate و Eventهای Provider، Model، Profile، Binding، Invocation، Evaluation و Decision؛
- Registry deterministic برای ثبت منابع، Binding، Invocation، Evaluation و Proposal؛
- Adapter deterministic و fail-closed برای Provider زنده/غیرفعال؛
- Adapterهای HTTP واقعی برای OpenAI Responses، Anthropic Messages، Google Gemini و OpenAI-compatible با credential resolver زمان اجرا، structured JSON و cost accounting؛
- Context Assembly متصل به Project Memory با نگاشت Role به recipient role، فیلتر نقش و نسخهٔ دقیق Task/Step/Document؛
- تبدیل خروجی `evaluation-v1` به Evidence لینک‌شده به Invocation و اعتبارسنجی گزینهٔ توصیه‌شدهٔ Decision؛
- تست‌های امنیت، idempotency، snapshot و owner resolution؛
- قرارداد چهار workflow چندنقشی، نقش AI هر Task در Planner و پیش‌فرض `executor/Codex` برای implementation؛
- Quality Gate async که Evaluation لینک‌شده را به `approved`، `changes-requested` یا `blocked` تبدیل می‌کند و revision را همچنان جداگانه مجاز می‌داند؛
- ارزیابی دوره‌ای همهٔ ۱۱ تیم با evidence داخلی، پوشش کامل و bandهای strong/watch/intervention؛
- timeout، retry، health check، cost cap و ثبت attempt/latency در Invocation؛
- projection adapter متصل به Event Store و migration افزایشی 003؛
- benchmark مصنوعی نسخه‌دار برای مقایسهٔ Provider/Profile بدون شبکه و بدون اختیاردهی؛
- گیت live invocation با external-spend authorization نسخه‌مند، تطبیق Step ID/Document Version، active authorization verifier، timeout/retry و cost accounting؛
- migration 004 و hydration نسخه‌دار هشت Registry دامنه و وضعیت Control Dashboard از PostgreSQL؛ Snapshotها append-only هستند و مقدار خام credential را نمی‌پذیرند؛
- endpointهای `/api/ai/events`، `/api/ai/organization-evaluations`، `/ai-benchmark-contract` و `/organization-performance-contract`؛
- endpoint عمومی `/ai-orchestration-contract`.

### مراحل بعدی

1. اتصال Resolver احراز هویت به Authorization Engine واقعی Hero و اجرای controlled pilot؛ adapter واقعی آماده است اما ارسال live بدون این اتصال مجاز نیست.
2. نمایش dashboardیِ جزئیات Performance Review و مقایسهٔ benchmark، بدون تبدیل نتیجه به اختیار.
3. Fallback چند Provider و circuit breaker فقط پس از تعریف authorization و cost policy مستقل.
4. Benchmark واقعی روی Dataset پاک‌سازی‌شده با ثبت Provider، Model، Prompt و Dataset Version؛ benchmark فعلی synthetic است و جای آن را نمی‌گیرد.

این مسیر با Snapshot فعلی فقط تا طراحی، قرارداد، توسعه و تست deterministic پیش می‌رود. Provider زنده، External Spend، Secret Change، پیام خارجی و Production همچنان نیازمند مجوز مستقل هستند.
