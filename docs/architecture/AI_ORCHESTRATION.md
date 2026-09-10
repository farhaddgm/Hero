# معماری یکپارچهٔ Multi-AI در Hero

- نسخهٔ قرارداد: 1.0
- وضعیت: هستهٔ deterministic، role routing، Skill Registry، Organization Advisor، Quality Gate، ارزیابی ۱۱ تیم، reliability، benchmark مصنوعی، Pricing Catalog نسخه‌دار، transport adapterهای واقعی و hydration نسخه‌دار پیاده‌سازی شده؛ Provider زنده همچنان جداگانه gated است
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
  Role Policy -> Role Binding -> Agent Profile -> Provider/Model
  Skill -> scoped knowledge/tool boundary
  Context Snapshot -> Invocation -> Structured Result
  Evaluation -> Decision Proposal -> Owner/Gate
  Organization Advisor -> evidence/options/roadmap (advisory-only)
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
- `Default Role Policy`: نگاشت نسخه‌دار Role به Provider، Model و Tool Policy پیش‌فرض؛ تغییر آن تاریخچهٔ Invocationهای قبلی را تغییر نمی‌دهد.
- `AgentProfile`: ترکیب Role، Provider، Model، Prompt Version، Context Policy، Tool Policy، Output Schema، Timeout و محدودیت Retry/Cost.
- `Skill`: قابلیت نسخه‌دار شامل دانش، اصول، schema و مرز ابزار؛ Skill مجوز اجرا ایجاد نمی‌کند.
- `Skill Binding`: اتصال scoped یک Skill به سازمان، Team، Role یا Task؛ برای جایگزینی نسخهٔ فعال، Binding قبلی باید صریحاً معرفی شود.
- `Project Role Binding`: نگاشت نسخه‌دار Role به Profile برای یک Project و در صورت نیاز Team/Skill؛ جایگزینی Binding با `supersedesBindingId` انجام می‌شود.
- `AI Invocation`: ثبت Profile Snapshot، Context Snapshot، وضعیت، Usage، نتیجه و خطا.
- `Evaluation`: Evidence ساختاریافته با verdict، score، confidence و findings؛ verdict به‌تنهایی مجوز نیست.
- `Evaluator Workflow`: خروجی `evaluation-v1` فقط از Invocation نقش‌های Evaluator/Verifier/Code Reviewer به Evaluation لینک‌شده تبدیل می‌شود.
- `Decision Proposal`: گزینه‌ها، شواهد، توصیه و سطح اطمینان؛ فقط مالک می‌تواند آن را resolve کند و resolve شدن Authorization ایجاد نمی‌کند.
- `Workflow Contract`: هر workflow ترتیب Roleها، schema خروجی و policy تغییر را صریح می‌کند؛ Planner همین route را روی هر Task ثبت می‌کند.
- `Organization Performance Review`: برای هر دوره دقیقاً ۱۱ team evidence و پنج score نرمال‌شده می‌دهد؛ نتیجهٔ آن توصیه است، نه تغییر خودکار وضعیت تیم.
- `Organization Advisor`: ترکیب read-only نقش‌های Analyst، Evaluator، Decision Maker، Planner و Researcher شرطی؛ از evidence هر ۱۱ تیم گزینه، recommendation و roadmap می‌سازد و هیچ dispatch، authorization یا mutation انجام نمی‌دهد.
- `Reliability Policy`: timeout، retry، cost cap، health check و latency/attempt evidence پیش از پذیرش نتیجه اعمال می‌شوند.
- `Synthetic Benchmark`: Provider/Profileها با runner تزریق‌شده و بدون شبکه مقایسه می‌شوند؛ نتیجه فقط advisory است. در صورت فعال‌بودن PostgreSQL، تاریخچهٔ benchmark با digest، idempotency و اعتبارسنجی مجددِ authority در `ai_benchmark_runs` و `ai_benchmark_results` ذخیره و پس از restart بازیابی می‌شود؛ این داده هرگز مجوز Provider، mutation یا release صادر نمی‌کند.

## سیاست پیش‌فرض Provider

پیش‌فرض فعلی طبق تصمیم `AI-DESIGN-0.1` این است: همهٔ Roleها با `openai/chatgpt` و `read-only` کار می‌کنند، به‌جز `executor` که با `openai/codex` و `development` کار می‌کند. این نگاشت به‌صورت Policy نسخه‌دار نگهداری می‌شود و Admin/مالک می‌تواند آن را تغییر دهد؛ Provider، Model و Profile همچنان جداگانه ثبت و به Role Binding متصل می‌شوند. Adapterهای واقعی OpenAI Responses، Anthropic Messages، Google Gemini و OpenAI-compatible در runtime قابل پیکربندی‌اند؛ در نبود credential، cost accounting و active authorization verifier هیچ درخواست بیرونی ارسال نمی‌شود و حالت پیش‌فرض همچنان deterministic است.

| Role | Provider پیش‌فرض | Model پیش‌فرض | Tool Policy |
| --- | --- | --- | --- |
| Analyst، Evaluator، Decision Maker، Planner، Researcher، Verifier، Code Reviewer | OpenAI | ChatGPT | read-only |
| Executor | OpenAI | Codex | development |

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
| Provider/Model/Profile/Role Policy | زیرسیستم جدید AI Orchestration |
| Skill و دانش scoped | Skill Registry و Skill Binding |
| مشاور کل سازمان | Organization Performance + Organization Advisor |

Projectionهای PostgreSQL مربوط به AI در migration `002_ai_orchestration_projections.sql` تعریف شده‌اند و Snapshotهای versioned ده Registry دامنه و وضعیت Control Dashboard در migration `004_domain_registry_snapshots.sql` نگهداری می‌شوند. جدول موازی برای Memory، Approval یا Run به‌عنوان منبع حقیقت ساخته نشده است؛ Snapshot فقط read projection قابل‌بازسازی است.

کاتالوگ AI با احراز هویت جداگانهٔ Admin نیز قابل مدیریت است: نشست Admin با `HERO_ADMIN_AUTH_SECRET` امضا می‌شود و مسیرهای صریح Provider/Model/Profile/Binding/Skill/Role Policy و ویرایش/rollback نسخهٔ اصول Team را مجاز می‌کند. Admin نمی‌تواند تأیید نهایی Team، Project، Release، Runner، Dispatch، Secret یا Production را تغییر دهد؛ گیت external-spend و Provider زنده همچنان مستقل باقی می‌ماند.

Diagnostic read model در `/api/operations/diagnostics` سلامت ۱۱ Projection، Snapshot/Event integrity، replay dry-run، digest، تاریخچهٔ امن تغییرات AI، freshness دانش و تعارض تخصیص را گزارش می‌کند. این گزارش advisory-only است و هیچ مجوز یا mutation ایجاد نمی‌کند.

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
- Policy پیش‌فرض همهٔ Roleها روی ChatGPT و Executor روی Codex، با تغییر نسخه‌دار و auditپذیر برای Admin/مالک؛
- Skill Registry با version، knowledge/principles refs، tool policy و bindingهای scoped؛
- Organization Advisor با pipeline ترکیبی، evidence coverage برای ۱۱ تیم، گزینه‌ها، recommendation، uncertainty و roadmap advisory-only؛
- Quality Gate async که Evaluation لینک‌شده را به `approved`، `changes-requested` یا `blocked` تبدیل می‌کند و revision را همچنان جداگانه مجاز می‌داند؛
- ارزیابی دوره‌ای همهٔ ۱۱ تیم با evidence داخلی، پوشش کامل و bandهای strong/watch/intervention؛
- timeout، retry، health check، cost cap و ثبت attempt/latency در Invocation؛
- projection adapter متصل به Event Store و migration افزایشی 003؛
- benchmark مصنوعی نسخه‌دار برای مقایسهٔ Provider/Profile بدون شبکه و بدون اختیاردهی؛
- گیت live invocation با external-spend authorization نسخه‌مند، تطبیق Step ID/Document Version، active authorization verifier، timeout/retry و cost accounting؛
- Pricing Catalog نسخه‌دار با Registry، migration 007، Token/Request-Unit Adapter، sync خارج از مسیر درخواست، fail-closed و تست synthetic؛ نرخ دستی Environment منبع هزینه نیست؛
- migration 004 و hydration نسخه‌دار ده Registry دامنه و وضعیت Control Dashboard از PostgreSQL؛ Snapshotها append-only هستند و مقدار خام credential را نمی‌پذیرند؛
- endpointهای `/api/ai/events`، `/api/ai/skills`، `/api/ai/skill-bindings`، `/api/ai/role-policies`، `/api/ai/organization-evaluations` و `/api/ai/organization-advisor`، به‌همراه قراردادهای Skill و Advisor؛
- endpoint عمومی `/ai-orchestration-contract`.

### مراحل بعدی

1. اتصال Resolver احراز هویت به Authorization Engine واقعی Hero و اجرای controlled pilot؛ adapter واقعی آماده است اما ارسال live بدون این اتصال مجاز نیست.
2. نمایش dashboardیِ جزئیات Performance Review و مقایسهٔ benchmark، بدون تبدیل نتیجه به اختیار.
3. Fallback چند Provider و circuit breaker فقط پس از تعریف authorization و cost policy مستقل.
4. Benchmark واقعی روی Dataset پاک‌سازی‌شده با ثبت Provider، Model، Prompt و Dataset Version؛ benchmark فعلی synthetic است و جای آن را نمی‌گیرد.

این مسیر با Snapshot فعلی فقط تا طراحی، قرارداد، توسعه و تست deterministic پیش می‌رود. Provider زنده، External Spend، Secret Change، پیام خارجی و Production همچنان نیازمند مجوز مستقل هستند.
