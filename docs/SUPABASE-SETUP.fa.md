# راهنمای راه‌اندازی Supabase (دیتابیس سایت PEJMAN AI)

زمان لازم: حدود ۱۵ تا ۲۰ دقیقه. همه‌چیز رایگانه و کارت بانکی لازم نیست.

> نکته: Supabase و Google گاهی اسم دکمه‌ها رو کمی عوض می‌کنن. اگه اسم دکمه‌ای دقیقاً مثل این راهنما نبود، دنبال نزدیک‌ترین اسم بگرد، یا از صفحه عکس بگیر و برام بفرست.

---

## قدم ۱: ساخت پروژه در Supabase

1. برو به **https://supabase.com** و روی **Start your project** بزن.
2. با **Continue with GitHub** وارد شو (همون اکانت `ghosmali22-prog`).
3. اگه ازت خواست یک Organization بسازی، اسمش رو بذار `PEJMAN AI` و پلن **Free** رو انتخاب کن.
4. روی **New project** بزن و این‌ها رو پر کن:
   - **Project name:** `pejman-ai`
   - **Database Password:** دکمهٔ **Generate a password** رو بزن و رمز رو **یک جای امن ذخیره کن** (مثلاً Notes گوشی). این رمز رو برای من نفرست.
   - **Region:** `Southeast Asia (Singapore)`، که به بانکوک نزدیک‌ترینه و سایت سریع‌تر می‌شه.
5. روی **Create new project** بزن و ۱ تا ۲ دقیقه صبر کن تا پروژه آماده بشه.

---

## قدم ۲: اجرای فایل دیتابیس (SQL)

این فایل همهٔ جدول‌ها، قوانین امنیتی و محل ذخیرهٔ عکس‌ها رو یکجا می‌سازه.

1. در منوی سمت چپ Supabase روی **SQL Editor** بزن.
2. روی **New query** (یا علامت **+**) بزن.
3. کل محتوای فایل `supabase/migrations/001_init.sql` رو کپی کن و داخل کادر بچسبون. من این فایل رو جدا هم برات می‌فرستم.
4. پایین سمت راست روی **Run** بزن.
5. باید پیام **Success. No rows returned** رو ببینی. ✅
   - اگه پیامی دربارهٔ «destructive operation» داد، روی **Run this query** بزن. این پیام فقط به‌خاطر دستورهای `drop policy if exists` هست و چیزی پاک نمی‌شه.
   - اگه پیام قرمز (Error) دیدی، از متنش عکس بگیر و برام بفرست.
6. برای اطمینان، از منوی چپ روی **Table Editor** بزن. باید این جدول‌ها رو ببینی:
   `categories`، `prompts`، `copy_events`، `messages`، `subscribers`، `site_settings`.
   جدول `categories` باید ۸ دسته داشته باشه (Portrait، Product و…).

---

## قدم ۳: برداشتن آدرس و کلید عمومی پروژه

1. از منوی چپ روی **Project Settings** (آیکون چرخ‌دنده) بزن.
2. **Data API** (یا **API**) رو باز کن و **Project URL** رو کپی کن. شکلش این‌طوریه:
   `https://abcdefghijk.supabase.co`
3. بعد بخش **API Keys** رو باز کن و **یکی** از این دو تا رو کپی کن:
   - **Publishable key** (با `sb_publishable_` شروع می‌شه)، یا
   - در تب **Legacy API keys**، کلید **anon public** (یک متن طولانی که با `eyJ` شروع می‌شه).
4. این دو مقدار (Project URL و کلید) رو **برای من بفرست**.
   - این کلید عمومیه و طراحی شده که توی سایت قرار بگیره، پس فرستادنش امنه.

> ⚠️ **هرگز** کلید **secret** یا **service_role** رو برای کسی نفرست و جایی نذار. اون کلید رمز کامل دیتابیسته.

---

## قدم ۴: فعال کردن ورود با Google (برای پنل ادمین)

این بخش طولانی‌ترین قسمته، ولی فقط یک بار انجام می‌شه.

### ۴-الف: آدرس Callback رو از Supabase بردار
1. در Supabase از منوی چپ برو به **Authentication** و بعد **Sign In / Providers** (یا **Providers**).
2. روی **Google** بزن.
3. یک آدرس به اسم **Callback URL (for OAuth)** می‌بینی، مثل:
   `https://abcdefghijk.supabase.co/auth/v1/callback`
   این آدرس رو کپی کن. این صفحه رو هم باز نگه دار.

### ۴-ب: ساخت کلید ورود در Google Cloud
1. در یک تب جدید برو به **https://console.cloud.google.com** و با Gmail خودت (`ghosmali22@gmail.com`) وارد شو.
2. بالای صفحه، کنار لوگوی Google Cloud، روی منوی انتخاب پروژه بزن، بعد **New Project**. اسمش رو بذار `pejman-ai` و **Create** کن. بعد مطمئن شو همین پروژه انتخاب شده.
3. در کادر جستجوی بالا بنویس **Google Auth Platform** (یا **OAuth consent screen**) و بازش کن. اگه دکمهٔ **Get started** دیدی، بزنش:
   - **App name:** `PEJMAN AI`
   - **User support email:** ایمیل خودت
   - **Audience:** گزینهٔ **External**
   - **Contact information:** ایمیل خودت
   - تیک موافقت رو بزن و **Create** کن.
4. از منوی چپ همین بخش برو به **Audience**، بعد در قسمت **Test users** روی **Add users** بزن و `ghosmali22@gmail.com` رو اضافه کن و **Save** کن.
   - چون فقط خودت وارد پنل می‌شی، لازم نیست اپ رو Publish کنی.
5. از منوی چپ برو به **Clients** (یا **Credentials**) و بزن **Create client** (یا **Create Credentials → OAuth client ID**):
   - **Application type:** `Web application`
   - **Name:** `PEJMAN AI Admin`
   - **Authorized JavaScript origins** (با **Add URI** دو تا اضافه کن):
     - `https://ghosmali22-prog.github.io`
     - `http://localhost:5173`
   - **Authorized redirect URIs:** همون **Callback URL** که در قدم ۴-الف از Supabase کپی کردی.
   - **Create** رو بزن.
6. یک پنجره باز می‌شه که **Client ID** و **Client secret** رو نشون می‌ده. هر دو رو کپی کن.

### ۴-ج: وصل کردن Google به Supabase
1. برگرد به تب Supabase (صفحهٔ Google در Providers).
2. **Enable Sign in with Google** رو روشن کن.
3. **Client ID** و **Client Secret** رو از Google بچسبون.
4. **Save** رو بزن. ✅

> **Client secret** گوگل رو هم برای کسی نفرست. فقط همین‌جا در Supabase وارد کن.

---

## قدم ۵: تنظیم آدرس‌های مجاز برای ورود

1. در Supabase برو به **Authentication** و بعد **URL Configuration**.
2. **Site URL** رو بذار:
   `https://ghosmali22-prog.github.io/pejman-ai/`
3. در **Redirect URLs** با **Add URL** این دو تا رو اضافه کن:
   - `https://ghosmali22-prog.github.io/pejman-ai/**`
   - `http://localhost:5173/**`
4. **Save** رو بزن. ✅

---

## قدم ۶: برای من بفرست

فقط این دو مورد:
1. **Project URL**، مثلاً `https://abcdefghijk.supabase.co`
2. **Publishable key** یا **anon public key**

بعدش من سایت رو به دیتابیس وصل می‌کنم:
- فرم تماس و خبرنامه واقعاً ذخیره می‌شن.
- شمارش کپی پرامپت‌ها فعال می‌شه.
- پنل ادمین رو روی همین دیتابیس می‌سازم.

---

## امنیت: چه کسی چه کاری می‌تونه بکنه؟

این قوانین داخل خود دیتابیس اجرا می‌شن (Row Level Security)، نه فقط در ظاهر سایت. پس حتی کسی که کد سایت رو دستکاری کنه هم نمی‌تونه دورشون بزنه.

| کار | بازدیدکننده | هر اکانت Google دیگه | فقط تو (`ghosmali22@gmail.com`) |
|---|---|---|---|
| دیدن پرامپت‌های منتشرشده | ✅ | ✅ | ✅ |
| دیدن پیش‌نویس‌ها (Draft) | ❌ | ❌ | ✅ |
| فرستادن پیام از فرم تماس | ✅ | ✅ | ✅ |
| عضویت در خبرنامه | ✅ | ✅ | ✅ |
| خواندن پیام‌ها و لیست مشترکین | ❌ | ❌ | ✅ |
| اضافه، ویرایش و حذف پرامپت و دسته | ❌ | ❌ | ✅ |
| آپلود و حذف عکس | ❌ | ❌ | ✅ |
| تغییر متن‌های سایت | ❌ | ❌ | ✅ |
| شمارش کپی | فقط +۱ روی پرامپت‌های منتشرشده | همین | ✅ |

همهٔ این قوانین با ۳۲ تست خودکار امتحان شدن (`npm run test:db`).

### اگه روزی Gmail ادمین رو عوض کردی
در فایل SQL، داخل تابع `is_admin()`، ایمیل رو عوض کن. بعد فقط همون بخش رو دوباره در SQL Editor اجرا کن:
```sql
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('NEW-EMAIL@gmail.com'), false)
$$;
```
