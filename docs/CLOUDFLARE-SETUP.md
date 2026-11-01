# Put free Cloudflare in front of pejiai.com (phone steps, ~20 minutes)

**Why:** GitHub Pages cannot send security headers. Without them, browsers can't be told
"never show this site inside someone else's page" (clickjacking), "always use HTTPS" (HSTS),
and so on. Cloudflare's free plan adds these headers, plus bot protection and DDoS protection.
Nothing about how you edit the site changes.

> Your database (Supabase) is a separate server and already has its own protection and rate
> limits; Cloudflare protects the website files.

## 1. Add the site to Cloudflare
1. Go to **dash.cloudflare.com** → sign up (use 2FA!) → **Add a domain** → type `pejiai.com` → choose the **Free** plan.
2. Cloudflare copies your DNS records. Check they look like this (add any that are missing):

   | Type  | Name | Content                    | Proxy        |
   |-------|------|----------------------------|--------------|
   | A     | @    | 185.199.108.153            | Proxied (orange) |
   | A     | @    | 185.199.109.153            | Proxied      |
   | A     | @    | 185.199.110.153            | Proxied      |
   | A     | @    | 185.199.111.153            | Proxied      |
   | CNAME | www  | ghosmali22-prog.github.io  | Proxied      |

   Keep any email (MX/TXT) records exactly as they are.
3. Cloudflare shows **two nameservers** (like `xxx.ns.cloudflare.com`). Copy them.

## 2. Point the domain to Cloudflare (Spaceship)
1. **spaceship.com** → Domains → `pejiai.com` → **Nameservers** → **Custom**.
2. Paste the two Cloudflare nameservers → Save. It can take from minutes to a few hours.
   Cloudflare emails you when it's active.

## 3. HTTPS settings (Cloudflare → pejiai.com)
1. **SSL/TLS → Overview** → choose **Full** (not "Flexible", not "Strict").
2. **SSL/TLS → Edge Certificates**:
   - Always Use HTTPS → **On**
   - Minimum TLS Version → **1.2**
   - HTTP Strict Transport Security (HSTS) → Enable → Max-Age **6 months**, Include subdomains **On**, Preload **Off**, No-Sniff **On**.

## 4. Security headers (Rules → Transform Rules → Modify Response Header → Create rule)
Name: `Security headers` · When: **All incoming requests** · Then add **Set static** for each:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `frame-ancestors 'self'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |

Deploy. (The full script/style policy is already inside every page; this header adds the parts a
page can't set for itself.)

## 5. Bots and floods
1. **Security → Bots** → **Bot Fight Mode: On**.
2. **Security → Settings** → Security level **Medium**; Browser Integrity Check **On**.
3. **Security → WAF → Rate limiting rules** → Create rule (1 free rule):
   Name `Too many requests` · If **URI Path** *starts with* `/` · **50 requests per 10 seconds** per IP →
   **Block** for 10 seconds.
4. DDoS protection is on automatically.

## 6. Turnstile ("are you human?" on the contact form) — optional but recommended
1. Cloudflare → **Turnstile** → **Add widget** → name `pejiai contact`, domain `pejiai.com`, mode **Managed** → Create.
2. You get a **Site Key** (public) and a **Secret Key** (private).
3. **First** the site key: GitHub → repo `pejman-ai` → Settings → Secrets and variables → Actions →
   **Variables** tab → New variable → Name `TURNSTILE_SITE_KEY`, value = site key. Then Actions →
   "Deploy to GitHub Pages" → **Run workflow**. The check now appears on the form.
4. **Then** the secret key: Supabase → project → **Edge Functions → Secrets** → Add
   `TURNSTILE_SECRET_KEY` = secret key. From now on the server refuses messages without a valid check.
   (Doing it in this order means the form never stops working.)

## 7. Check
Open **securityheaders.com**, type `https://pejiai.com` → you should get an **A**.
The deploy's "Check the live site" step also prints whether the headers are present.

## Later: stronger demo lock
With Cloudflare active, demos can additionally be served from `demo.pejiai.com` by a Cloudflare
Worker with a real `frame-ancestors https://pejiai.com` header. Ask Claude to set this up.
