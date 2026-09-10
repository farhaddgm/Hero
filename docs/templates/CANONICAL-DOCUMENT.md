# Template: سند canonical

> این فایل template است. placeholderها باید هنگام ساخت سند جدید جایگزین شوند و خود template نباید حاوی مقدار runtime یا Secret باشد.

## Metadata رجیستری

```text
Document ID: <DOCUMENT-ID>
Canonical path: <REPOSITORY-RELATIVE-PATH>
Title: <TITLE>
Type: <ALLOWED-TYPE>
Scope: <hero|product|cross-project>
Status: <proposed|active|superseded|archived>
Version: <SEMVER>
Owner: <OWNER-ROLE>
Review cadence: <ALLOWED-CADENCE>
Supersedes: <DOCUMENT-IDS-OR-NONE>
Superseded by: <DOCUMENT-ID-OR-NONE>
```

## هدف

مسئله، مخاطب و مرز این سند را کوتاه و قابل‌آزمون بنویسید.

## قواعد یا تصمیم‌ها

فقط محتوای canonical این موضوع را بنویسید. اگر قاعده در سند دیگری وجود دارد، Document ID و version آن را reference کنید و متن را کپی نکنید.

## پیامدها

اثر روی Hero، Productها، migration، backward compatibility و کنترل‌های CI را ثبت کنید.

## شواهد و Review

commit، reviewer، تاریخ و Evidence غیرمحرمانه را ثبت کنید. Secret یا configuration واقعی ممنوع است.
