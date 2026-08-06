# photopoly

Hujjat suratlarini tayyorlash uchun veb-ilova: fonni olib tashlaydi, aniq
o'lchamga soladi va bosma varaqqa joylaydi.

Suratlar **brauzerda** qayta ishlanadi — fayl serverga umuman yuborilmaydi.
Server faqat ikki savolga javob beradi: bu kim, va uning eksport qilishga
huquqi bormi.

## Ishga tushirish

```bash
npm install
cp .env.example .env      # keyin .env ni to'ldiring
npm run db                # mahalliy PostgreSQL (alohida terminalda qoldiring)
```

`npm run db` chop etgan `DATABASE_URL` va `SHADOW_DATABASE_URL` ni `.env` ga
ko'chiring, so'ng:

```bash
npm run db:migrate        # jadvallarni yaratadi
npm run db:seed           # tariflarni qo'shadi
npm run dev
```

Birinchi superadminni yaratish uchun `.env` da `SEED_ADMIN_EMAIL` va
`SEED_ADMIN_PASSWORD` ni to'ldirib, `npm run db:seed` ni qayta ishga tushiring.
Mavjud pochtaga tegilmaydi, shuning uchun qayta ishga tushirish xavfsiz.

Foydali buyruqlar: `npm run db:studio` (bazani ko'rish),
`npm run db:deploy` (produksiyada migratsiya), `npm run lint`.

## Supabase

Dashboard → **Connect** dan ikkita satr olinadi. **Direct connection** ishlatilmaydi:
`db.<ref>.supabase.co` faqat IPv6 manzilga ega, shuning uchun ko'p uy
tarmoqlaridan ham, Vercel'dan ham ochilmaydi.

| O'zgaruvchi | Qaysi pooler | Port | Nima uchun |
| --- | --- | --- | --- |
| `DATABASE_URL` | Transaction | 6543 | Ilova |
| `DIRECT_URL` | Session | 5432 | Migratsiya |

Ikkitasi kerak, chunki migratsiyalar driver adapter orqali emas, Prisma'ning
o'z dvigateli orqali ketadi va u advisory lock ushlab turadigan sessiyani
talab qiladi. Transaction pooler har bir so'rovga boshqa backend beradi va
lock yo'qoladi.

Keyin:

```bash
npm run db:deploy         # jadvallarni yaratadi
npm run db:seed           # tariflarni qo'shadi
```

### Kostyum rasmlari

Admin `/admin/kostyumlar` da PNG yuklaydi; fayl Supabase Storage'ning `kostyum`
nomli **public** bucket'ida yotadi, metama'lumot esa `AttireAsset` jadvalida.
Rang tanlash yo'q — rasm qanday bo'lsa shunday chiziladi. Hech narsa
yuklanmagan bo'lsa, ish stolida kiyim tanlash imkoni ko'rinmaydi.

Kiyim **kadrga** nisbatan joylashadi, suratdagi odamga emas. Ya'ni suratning
kattaligi va siljishi kiyimga ta'sir qilmaydi — ikkalasi mustaqil sozlanadi.

Rasm brauzerda `crossOrigin="anonymous"` bilan yuklanadi. Busiz surat ekranda
ko'rinadi-yu, canvas "tainted" bo'lib `toBlob()` xato beradi — ya'ni eksport
butunlay ishlamay qoladi. Supabase public obyektlarni
`Access-Control-Allow-Origin: *` bilan beradi, shuning uchun bu ishlaydi.

Rasmning **pastki cheti** kadr tagigacha yetmasa, oxirgi piksel qatori pastga
cho'ziladi. Shuning uchun pastki chetda shaffof bo'sh joy qoldirmang —
aks holda cho'zish uchun hech narsa qolmaydi.

### Sertifikat haqida

Supabase ommaviy CA ishlatmaydi — u o'zining `Supabase Root 2021 CA` ini
beradi, va bu sertifikat hech kimning ishonch ro'yxatida yo'q. Odatdagi maslahat
tekshiruvni butunlay o'chirish (`sslmode=no-verify`), lekin u holda bazani
kimdir o'zini boshqa server qilib ko'rsatishidan himoya ham yo'qoladi.

Shuning uchun sertifikatning o'zi `src/lib/server/pg-ssl.ts` ichiga yozib
qo'yilgan va to'liq tekshiruv yoqilgan holda qoladi. Ulanish satridagi
`?sslmode=require` ni olib tashlashning hojati yo'q — kod uni o'zi olib
tashlaydi, chunki `pg` da ulanish satri koddagi sozlamadan ustun turadi va
sertifikatni jimgina tashlab yuboradi.

## Vercel'ga chiqarish

```bash
npm run db:deploy        # migratsiyalar (o'z mashinangizdan, bir marta)
npm run db:seed          # tariflar va birinchi superadmin
```

Keyin Vercel'da: **Add New → Project**, repozitoriyni tanlang. Framework
Next.js sifatida o'zi aniqlanadi, build buyrug'iga tegmang — `prisma generate`
undan oldin ishlashi shart, chunki generatsiya qilingan mijoz git'ga
kirmaydi (`.gitignore`).

O'zgaruvchilar ro'yxati `.env.example` boshida — nimasi shart, nimasini
Vercel'ga **qo'ymaslik** kerakligi bilan.

### Mintaqa

`vercel.json` da `"regions": ["fra1"]` turibdi va uni olib tashlamang.
Vercel sukut bo'yicha funksiyalarni `iad1` da (Vashington) ishga tushiradi,
baza esa Frankfurtda (`eu-central-1`). Bunda har bir so'rov Atlantikadan ikki
marta o'tadi. O'lchangan farq: sovuq yuklanish 1764 → 695 ms, issig'i
203 → 92 ms.

### Servis-ishchi

`public/sw.js` dagi `VERSION` — **xeshlanmagan** manzilda keshlanadigan biror
narsa o'zgarsa, uni ko'tarish shart. Next o'zining JS/CSS fayllariga xesh
qo'yadi, ular o'zi to'g'rilanadi; `/oflayn` va `/manifest.webmanifest` esa
qat'iy manzil bilan olinadi va cache-first beriladi. Ko'tarilmasa, o'rnatilgan
PWA eski nusxani cheksiz ushlab turadi.

### Yuklash hajmi

`next.config.ts` da `serverActions.bodySizeLimit` 4.5 MB. Buni kamaytirmang:
Next'ning sukutdagi chegarasi 1 MB, kostyum yuklash esa 4 MB gacha ruxsat
beradi — ya'ni sozlamasiz 1 MB dan katta har qanday PNG server action'ga
yetib bormasdan yiqiladi. 4.5 MB — Vercel'ning o'z chegarasi, shuning uchun
Next qabul qilgan narsani platforma ham qabul qiladi.

## Tuzilishi

| Yo'l | Nima |
| --- | --- |
| `/` | Bosh sahifa va narx ro'yxati |
| `/narxlar` | Tariflar va savol-javob |
| `/kirish`, `/royxat` | Kirish va ro'yxatdan o'tish |
| `/studio` | Ish stoli — kirish talab qilinadi |
| `/hisob` | Obuna holati va to'lovlar tarixi |
| `/admin` | Admin panel — ADMIN yoki SUPERADMIN |
| `/api/webhooks/finik` | Finik to'lov tasdig'i |

Kod: `src/lib/server/` — baza, sessiya, huquqlar; `src/lib/finik/` — to'lov
integratsiyasi; `src/proxy.ts` — marshrutlarni yo'naltirish (Next.js 16 da
`middleware.ts` shunday nomlanadi).

## To'lov

Finik orqali, `@mancho.devs/authorizer` bilan bir xil RSA-SHA256 imzo sxemasi
ishlatiladi (`src/lib/finik/signer.ts`).

**`FINIK_API_KEY` bo'sh bo'lsa** ilova buzilmaydi — buyurtmalar `MANUAL`
rejimida yoziladi va administrator ularni panelda qo'lda tasdiqlaydi.
Mijoz uchun oqim oxirgi qadamgacha bir xil.

Bu rejimda mijozga **qayerga to'lashini aytish kerak**. Matn admin panelida
(«Umumiy» → «Как оплатить») yoziladi va buyurtma sahifasida chiqadi. U bazada
saqlanadi, `.env` da emas — noto'g'ri rekvizit pul so'raydigan yagona sahifada
turadi, uni qayta deploy qilmasdan tuzatish mumkin bo'lishi kerak. To'ldirilmasa,
sahifa mijozga administrator bilan bog'lanishni aytadi — o'ylab topilgan raqam
ko'rsatishdan ko'ra shunisi to'g'ri.

Narx sahifasidagi «Как оплатить» va pastdagi eslatma ham shu holatga qarab
o'zgaradi: Finik ulanmagan bo'lsa, QR kod va Visa haqidagi va'da ko'rsatilmaydi.

`FINIK_PUBLIC_KEY` kiritilmagan bo'lsa webhook endpoint **hamma so'rovni rad
etadi** (503). Bu ataylab: imzosi tekshirilmagan so'rovni qabul qilish har
kimga bepul obuna berish bilan teng.

Webhook uchun `APP_URL` internetdan ochiq bo'lishi shart. Ishlab chiqish
paytida ngrok yoki cloudflared tunnelidan foydalaning.

## Rang va CMYK

Brauzer canvas'i faqat RGB biladi. `toBlob()` dan CMYK fayl chiqmaydi va buni
biror sozlama bilan yoqib bo'lmaydi — CMYK'ga o'tkazish bosmaxonaning RIP'ida
yoki Photoshop'da bo'ladi.

Shuning uchun ilovaning vazifasi boshqa: **RGB'ni ikkiga tushunilmaydigan
qilib berish**. `src/lib/print-metadata.ts` har bir eksportga ikkita narsani
yozadi:

| Format | Fizik o'lcham | Rang profili |
| --- | --- | --- |
| PNG | `pHYs` | `iCCP` (+ `gAMA`, `cHRM`) |
| JPEG | JFIF `APP0` | `APP2 ICC_PROFILE`, agar brauzer o'zi yozmagan bo'lsa |
| WebP | — | brauzer o'zi yozadi |

Bu bekorga emas. Chrome JPEG va WebP'ga sRGB profilini o'zi qo'yadi, **PNG'ga
esa hech narsa qo'ymaydi** — na `iCCP`, na `sRGB`, na `gAMA`. PNG esa bu yerda
ham sukutdagi format, ham bosib chiqarishning yagona formati edi. Ya'ni
bosmaxonaga borgan har bir fayl «bu ranglar qaysi fazoda» degan javobsiz
borardi, qabul qiluvchi dastur esa o'zining ishchi fazasini (ko'pincha Adobe
RGB) taxmin qilib qo'yardi. Bir xil raqamlar boshqa rang bo'lib bosilardi:
yuz qizarardi, kulrang fon ko'karardi.

Profil `src/lib/srgb-profile.ts` da, ikki ko'rinishda (xom va zlib bilan
siqilgan). U — Chrome JPEG'ga yozadigan profilning aynan o'zi, shuning uchun
bitta suratning PNG, JPEG va WebP nusxasi bir xil narsani da'vo qiladi.

### Proba (soft-proof)

Profil ranglarni ikkiga tushunilmaydigan qiladi, lekin siyohning gamutini
kengaytirmaydi: to'q ko'k va yorqin yashil bosmada baribir xiralashadi.
«Eksport» bo'limidagi **«Проба CMYK»** shuni oldindan ko'rsatadi va suratning
necha foizi sezilarli o'zgarishini aytadi.

Model — `src/lib/proof.ts`: RGB kubining sakkiz burchagi siyoh chiqara oladigan
ranglar bilan almashtiriladi va orasi trilinear to'ldiriladi (Neugebauer
tenglamasi). Ustiga **kulrang balansi** qo'yilgan, va bu shart edi: teng CMY
qog'ozda kulrang emas, jigarrang beradi, ya'ni balanssiz model hech bir bosmada
bo'lmaydigan rang og'ishini ko'rsatib, operatorni yo'q kamchilikni
«tuzatish»ga undardi. Endi kulrang aynan kulrang bo'lib o'tadi (o'lchangan:
og'ish 0), teri 8–9 birlik siljiydi, to'yingan ko'k esa 53.

Ikki narsa ataylab shunday:

- **Proba faylga tushmaydi.** U faqat ko'rinadigan canvas'ga qo'yiladi. Siyohga
  o'xshatib pishirilgan fayl bosmaga ketsa, yo'qotishni ikki marta olardi.
- **Varaq emas, suratning o'zi proof qilinadi**, keyin ko'paytiriladi. Natija
  bir xil, narxi esa qirq barobar arzon — tayyor A4 varaqni proof qilish 1.26
  soniya olardi.

Bu — prikidka, muayyan bosmaxonaning ICC profili emas. Interfeysda ham shunday
yozilgan.

Qolgan ochiq narsa: **monitor kalibrlanmagan bo'lsa** ekrandagi rang baribir
yolg'on gapiradi.

## Bepul chegara haqida ochiq gap

Limit tugagach uchta narsa bir vaqtda sodir bo'ladi:

1. `spendExport` server tomonda rad etadi — fayl umuman yaratilmaydi;
2. «Yuklab olish» va «Bosib chiqarish» tugmalari o'chadi va sababi yoziladi;
3. ekrandagi preview'ga suv belgisi tushadi.

Uchinchisi kerak, chunki ko'rinib turgan canvas — tayyor suratning **to'liq
o'lchamdagi** o'zi. Faqat tugmani to'sish o'ng tugma → «Rasmni saqlash»
qiladigan har qanday odam uchun limitni bekor qilardi.

Suv belgisi faqat **ko'rinadigan** canvasga, kompozitsiya chizilgandan keyin
qo'yiladi. Eksport yo'li o'zining alohida canvasiga chizadi, shuning uchun
belgilangan preview belgilangan faylga aylanib qololmaydi — ikkisi bitta
sirtni bo'lishmaydi.

Nimasi ochiq qolgani ham aytib qo'yilsin:

- **Limiti borlar** toza preview ko'radi, ya'ni ular o'ng tugma bilan
  hisoblagichni sarflamay surat olishlari mumkin. Bu ataylab tanlangan:
  belgini hammaga doim ko'rsatish to'lagan odamning ishini buzardi.
- **Devtools bilan** hamon toza pikselga yetish mumkin. Buni yopish uchun
  renderni serverga ko'chirish kerak, u holda esa "surat qurilmangizdan
  chiqmaydi" va'dasi yo'qoladi.

Ya'ni bu turniket, seyf emas — lekin endi turniket eshik oldida turadi.

## Oflayn

Servis-ishchi statik fayllar va segmentatsiya modelini keshlaydi, lekin
**render qilingan sahifalarni keshlamaydi** — ular bitta hisobga tegishli
ma'lumot saqlaydi va umumiy kompyuterda keyingi odamga ko'rinib qolishi
mumkin edi. Natijada: ochiq turgan ish stoli internetsiz ham ishlaydi, lekin
aloqasiz holatda sahifani qayta yuklasangiz `/oflayn` sahifasi chiqadi.
