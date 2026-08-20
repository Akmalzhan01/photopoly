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
qo'yadi, ular o'zi to'g'rilanadi; `/oflayn`, `/manifest.webmanifest` va
`/studio` esa qat'iy manzil bilan olinadi. Ko'tarilmasa, o'rnatilgan PWA eski
nusxani cheksiz ushlab turadi.

Sahifalar **network-first** beriladi: aloqa bor bo'lsa doim yangi nusxa
keladi, keshdagisi faqat aloqa yo'q bo'lganda ishlatiladi. Cache-first
tezroq bo'lardi, lekin deploydan keyin eski redaktorni ko'rsatib turaverardi.

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
| `/kassa` | Do'konning kirim-chiqim daftari — kirish talab qilinadi |
| `/zakazlar` | Mijoz zakazlari doskasi — kirish talab qilinadi |
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

## Mavzu (yorug'/qorong'i)

Uchta holat: **система** (ekranga ergashadi, sukut bo'yicha), **светлая**,
**тёмная**. Tanlov `localStorage` da — bu hisobning emas, **ekranning** xususiyati:
yorug' do'kon zalida va kechqurun uydagi bir xil odamga har xil javob kerak.

Butun palitra `globals.css` da tokenlashtirilgan, shuning uchun mavzu almashganda
**faqat tokenlar** o'zgaradi — birorta komponent qaysi mavzu yoqilganini bilmaydi.
Rollar saqlanadi, qiymatlar emas: `pit` — cho'kkan sirt, qorong'ida eng qorasi,
yorug'da eng oqi (kiritish maydoni qog'ozda oq bo'ladi). Xuddi shunday
`safe-soft` — **matn** sifatida o'qilishi shart bo'lgan urg'u, shuning uchun
qorong'ida ochroq, yorug'da to'qroq bo'ladi.

Ikki nozik joy, ikkalasi ham xatodan keyin tushunilgan:

- **Qatlamsiz (`unlayered`) qoida har qanday `@layer` dan ustun turadi.**
  Yorug' mavzu bloki `@layer base` ichida turganda `html { color-scheme: dark }`
  uni jimgina bosib ketardi. Ranglar almashardi (ular `@theme` dan, ya'ni o'zi
  qatlamli), lekin `color-scheme` yo'q — natijada yorug' sahifada **qorong'i sana
  tanlagich, select va scrollbar** qolardi. Shuning uchun mavzu bloklari
  qatlamsiz.
- **`<head>` dagi kichik skript** birinchi bo'yashdan oldin `data-theme` ni
  yozadi. Busiz saqlangan yorug' mavzu bir kadr davomida qorong'i chizilardi —
  o'sha oq chaqnash.

Kontrast o'lchangan, taxmin qilinmagan. Yorug' mavzuda barcha matn/fon
juftliklari WCAG AA dan o'tadi (eng yomoni 4.91:1). `--l-safe` dastlab `#c4430f`
edi va 4.41:1 bergani uchun to'qlashtirildi.

## Kassa

Do'kon o'zining kirim-chiqimini yozadigan daftar. To'rtta yon-panel bo'limi:

| Yo'l | Nima |
| --- | --- |
| `/kassa` | Обзор — jami, kategoriyalar, oxirgi yozuvlar |
| `/kassa/kirim` | Приход — faqat kirim: forma va ro'yxat |
| `/kassa/chiqim` | Расход — faqat chiqim |
| `/kassa/hisobot` | Отчёт — kunlar bo'yicha jadval, o'rtacha, eng yaxshi kun |

Приход va Расход sahifalari bitta komponent (`direction.tsx`), chunki ular
faqat ishora bilan farq qiladi — ikki faylni qo'lda bir xil holatda ushlab
turish ertami-kechmi ajralib ketardi. Formada yo'nalish **almashtirgichi yo'q**:
uni sahifaning o'zi belgilaydi, aks holda «Приход» sahifasida turib pulni
noto'g'ri ustunga yozib qo'yish mumkin bo'lardi.

Davr (`?davr=`) barcha bo'limlar uchun umumiy va yon paneldagi havolalarga
qo'shib yuboriladi — «o'tgan oy»ni ko'rib turib Расход'ga o'tsangiz, o'tgan oy
qolishi kerak. Shuning uchun `KassaNav` mijoz komponenti: layout `searchParams`
ni ko'ra olmaydi. U `useSearchParams` ishlatgani uchun `Suspense` ichida turadi
— busiz Next butun maketni statik chiqara olmay, build'ni rad etadi.

Bu **ilovaning o'z pulidan butunlay boshqa narsa**: `Payment` — bizga obuna
uchun to'langan pul, `LedgerEntry` — do'konning mijozlaridan olgan puli.
Ikkalasi ataylab alohida jadval: egasi boshqa, va aralashtirilsa do'konning
tushumi bizning hisob-kitob ekranimizda tasodifan ko'rinib qolishi mumkin edi.

**Yozuvni faqat egasi ko'radi.** `src/lib/server/ledger.ts` dagi har bir
funksiya `userId` oladi va har bir so'rov shu bo'yicha filtrlaydi; o'chirish esa
`id` **va** egasi bo'yicha mos keladi, ya'ni topilgan id bilan ham begona
yozuvni o'chirib bo'lmaydi. Server action hech qachon formadan foydalanuvchi
id'sini olmaydi — egasi doim sessiyadagi odam. Admin panelida bu ma'lumot
ko'rsatilmaydi.

Ikkita nozik joy:

- **Sana — sana, vaqt emas** (`@db.Date`). Kassa daftariga soat kerak emas, va
  uni saqlash har bir yig'indiga vaqt mintaqasi savolini olib kirardi.
- **«Bugun» Bishkek bo'yicha hisoblanadi** (`SHOP_TIME_ZONE`). Server UTC'da
  ishlaydi; kechqurun soat 20:00 da yopilgan do'kon UTC'da 14:00 da bo'ladi,
  ya'ni UTC kuni bilan kechki tushum ertangi hisobotga tushib ketardi va har
  kunlik hisobot ish kunining oxirgi olti soatida noto'g'ri bo'lardi.

Kategoriyalar ro'yxati kodda (`src/lib/ledger.ts`), ustun esa oddiy matn —
shuning uchun keyinchalik har bir do'konga o'z kategoriyasini qo'shish
migratsiyasiz mumkin. Erkin matn qilinmadi: «Бумага» va «бумага » deb yozilgan
ikki kun bitta xarajat sifatida qo'shilmasdi.

### Summa qanday o'qiladi

`wholeNumber()` odam yozgan sonni oladi: «1500», «1 500», «1.500», «1'500» —
hammasi bitta son. Lekin **ajratgichdan keyin uchtadan boshqa raqam kelsa, rad
etiladi**. Minglik ajratgichdan keyin doim uchta raqam turadi; `1200,50` esa
kasr yozgan odam, va vergulni shunchaki tashlab yuborish 1 200 o'rniga
**120 050** somni daftarga yozardi. Somda tiyin kundalik muomalada yo'q, ya'ni
bunday kiritishning ishlatsa bo'ladigan o'qilishi yo'q — yuz baravar xatoni
jimgina saqlagandan ko'ra qayta so'ragan yaxshi. Zakaz narxi ham shu
funksiyadan o'tadi, chunki u kassaga aynan shu son bo'lib tushadi.

## Zakazlar

Mijozdan olingan ish qabul qilinganidan topshirilgunicha kuzatiladi. Uchta
yon-panel bo'limi:

| Yo'l | Nima |
| --- | --- |
| `/zakazlar` | Ro'yxat — har bir zakaz bitta qator |
| `/zakazlar/yangi` | Zakazni qabul qilish formasi |
| `/zakazlar/arxiv` | Topshirilgan va bekor qilinganlar |

Bosqichlar: **Новый → Обработка → Печать → Готов → Выдан**, ustiga `Отменён`.
Bekor qilingan zakaz ro'yxatda turmaydi — o'lik ish tirik ishning yonida joy
egallamasligi kerak — lekin o'chirib ham yuborilmaydi, aks holda mijoz ketgani
haqidagi fakt yo'qoladi. U arxivda turadi va u yerdan qaytarish mumkin.

### Nega ustunlar emas

Avval bu sahifa beshta ustunli kanban doska edi, kartalarni sudrab ko'chirish
bilan. **U yomon chiqdi va almashtirildi.** Beshta ustun butun matnni 10px ga
siqib qo'yardi — peshtaxta narigi tomonidan hech kim o'qimaydigan o'lcham. Ish
bosqichini o'zgartirish esa yo sudrashni talab qilardi — buni sensorli
brauzerlar umuman qo'llab-quvvatlamaydi — yo `◂ ▸` belgilarini yechishni, ular
esa zakaz qayerga ketayotgani haqida hech narsa demasdi.

Endi bosqich oddiy ochiluvchi ro'yxatda: har bir manzil nomi bilan yozilgan,
bitta bosishda ishlaydi, klaviaturadan ham yetib boriladi. Matn qo'l uzunligida
o'qiladigan darajada katta. Gorizontal aylantirish yo'q.

Qator bosilsa telefon, izoh va xavfli tugmalar ochiladi. Bosiladigan joy —
butun chap tomon, burchakdagi kichkina belgi emas.

Ro'yxat optimistik: bosilgan zahoti bosqich o'zgaradi, server javobini kutmaydi
— Bishkekdan Frankfurtgacha borib kelish do'konni ikkinchi marta bosishga
undaydigan darajada uzoq. React optimistik nusxani action tugagunicha ushlab
turadi, shuning uchun rad etilgan o'zgarish o'zi orqaga qaytadi; kodda hech
qanday «revert» yozilmagan. Yuqoridagi raqamlar va filtrlardagi sonlar ham shu
ro'yxatdan hisoblanadi, ya'ni ular qator bilan birga o'zgaradi.

### Nomer

Har bir do'konda o'z hisobi, 1 dan boshlab (`@@unique([userId, number])`) —
yordamchi ekrandan cuid o'qib o'tirmasdan «zakaz 12» deb chaqira olsin. Ataylab
tranzaksiyasiz: READ COMMITTED da bir soniyada olingan ikki zakaz tranzaksiya
ichida ham, tashqarisida ham bir xil maksimumni o'qiydi. Bir xil nomerni
haqiqatda **unique indeks** to'xtatadi; kod esa rad javobini olib qaytadan
so'raydi.

### Kassaga yozish

Topshirilgan zakazni bitta tugma bilan kassaga kirim qilib yozish mumkin.
**Avtomatik emas**: kartani sinab ko'rish uchun «Выдан»ga sudragan odam
daftarda o'zi yozmagan pulni topib qolmasligi kerak.

Zakaz `LedgerEntry` ga `ledgerEntryId String? @unique` orqali bog'lanadi, ya'ni
bir zakaz ko'pi bilan bitta yozuvga arziydi. Ikki marta yozilishidan
himoya — shartli `updateMany` (`ledgerEntryId: null`), kod ichidagi tekshiruv
emas: ikki marta bosilsa ikkinchisi yangilanadigan qator topmaydi.

Bu yer ilovadagi **yagona interaktiv tranzaksiya**. `activatePayment` avval
egallab, keyin ishini qiladi; bu yerda esa avval egallab bo'lmaydi — zakaz
yozuvga ko'rsatadi, ya'ni tashqi kalit uchun yozuv oldin mavjud bo'lishi shart.
Bu esa hech kim egasi bo'lmagan qator paydo bo'ladigan lahza qoldiradi, va
birovning daftaridagi hech narsa tushuntirmaydigan qator — yozuv yo'qligidan
battar. Poygada yutqazgan urinish yozuvni o'zi bilan birga orqaga qaytaradi.

`onDelete: SetNull` — kassadagi qatorni o'chirsangiz, zakaz yana bo'shaydi va
uni qaytadan yozish mumkin. Qatordagi «Убрать из кассы» ham aynan shu yozuvni
o'chiradi.

### Ko'rinish

Topshirilgan zakaz ro'yxatda yana 14 kun turadi (`DONE_WINDOW_DAYS`) — aks holda
ro'yxat cheksiz o'sib, bugungi ishning surati bo'lishdan to'xtaydi. Qolganlari
arxivda.

Muddat belgisi `text-safe` bilan chiziladi, `text-ember` bilan emas: ember
qorong'i mavzuda 2.75:1 beradi, kechikkan zakaz esa o'z rangi bilan ma'no
tashiydigan yagona narsa. O'lchandi — yorug'da 5.31:1, qorong'ida 6.00:1.
Topshirilgan zakazda muddat oddiy sana bo'lib ko'rinadi: o'tgan hafta
tugatilgan ish haqida «просрочен» deyish shunchaki yolg'on.

**Yozuvni faqat egasi ko'radi** — kassadagi bilan bir xil qoida.
`src/lib/server/orders.ts` dagi har bir so'rov `userId` bo'yicha filtrlaydi,
ko'chirish va o'chirish esa `id` **va** egasi bo'yicha mos keladi. Admin
panelida mijozlar ro'yxati ko'rsatilmaydi.

## Kadrlash

Masshtab, burilish va siljish — foydalanuvchining **o'z** kompozitsiyasi, shuning
uchun o'lcham (preset) bosilganda ular saqlanib qoladi. Preset faqat chiqish
natijasini belgilaydi: qog'oz, dpi, fon, chegara.

Burilishda masshtab **qayta hisoblanmaydi**. Burilgan tasvirning tashqi
to'rtburchagi kattaroq bo'ladi va uni kadrga sig'dirish uchun kichraytirish
mumkin edi — lekin u holda qiyshiq suratni to'g'irlaganda bosh ham kichrayib
ketardi, hujjat suratida esa bosh o'lchami me'yorlangan. Shuning uchun surat
joyida buriladi, burchaklarda fon ochilib qolsa masshtab bilan yopiladi.

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

**Ish stoli internetsiz to'liq ishlaydi** — sahifani qayta yuklasangiz ham.
Fon o'chirish, kadrlash, o'lchamlar, eksport — hammasi joyida.

Buni ishlashi uchun sahifaning o'zi keshlanishi kerak edi, ilgari esa bu
mumkin emas edi: eksport limiti HTML ichida render qilinardi, ya'ni tayyor
sahifa har bir hisob uchun boshqacha edi. Umumiy kompyuterda uni keshlash
oldingi operatorning tarifi va qolgan eksportlarini keyingi odamga ko'rsatib
qo'yardi.

Shuning uchun limit sahifadan **chiqarildi**. Endi u yuklangandan keyin
alohida so'raladi va qurilmada nusxasi saqlanadi. Studio HTML'i hamma uchun
**bayt-ma-bayt bir xil** — bu taxmin emas, o'lchandi: ikkita boshqa-boshqa
hisob bilan kirib, serverdan kelgan javob solishtiriladi
(`CACHEABLE_PAGES` ga yangi yo'l qo'shishdan oldin shu tekshiruv qayta
o'tkazilishi shart).

**Hisob, kassa, zakazlar va admin sahifalari keshlanmaydi** — ularda bitta
odamning raqamlari turadi.

### Internetsiz eksport

Eksport ishlaydi, lekin **server oldin bergan ruxsat doirasida**. Qolgan
eksportlar soni qurilmadagi nusxadan olinadi va shundan ayiriladi; qarz
yozib qo'yiladi va aloqa tiklanganda hisobdan yechiladi. Ya'ni simni sug'urib
qo'yish bilan qo'shimcha eksport olib bo'lmaydi, lekin peshtaxta oldida
mijoz turganda internet o'chgani ish to'xtashiga sabab ham bo'lmaydi.

Qarz **so'rovdan oldin** o'chiriladi: javob yo'qolsa, ikki marta yechilgandan
ko'ra bir marta yechilmagani yaxshi. Obuna muddati o'tgan bo'lsa, internetsiz
ham eksport rad etiladi — muddat mahalliy nusxada ham bor.

Chiqishda (`Выйти`) qurilmadagi limit nusxasi ham, servis-ishchining keshi
ham tozalanadi.

### Bitta shart

**Kamida bir marta internet bilan ochish kerak.** Servis-ishchi o'zini
ro'yxatdan o'tkazgan sahifani ushlab qololmaydi, shuning uchun aktivlashgan
zahoti studio sahifasini va uning JS/CSS fayllarini o'zi yuklab qo'yadi.

Segmentatsiya modeli bundan mustasno: u ish paytida yuklanadi, ya'ni **bitta
suratni internet bilan ishlab berish kerak** — shundan keyin model keshda
qoladi va fon o'chirish internetsiz ham ishlaydi.
