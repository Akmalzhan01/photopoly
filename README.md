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
| `/kattalashtirish` | Suratni neyron tarmoq bilan ×2/×4 kattalashtirish — kirish talab qilinadi |
| `/hisob` | Obuna holati va to'lovlar tarixi |
| `/kassa` | Do'konning kirim-chiqim daftari — kirish talab qilinadi |
| `/zakazlar` | Mijoz zakazlari doskasi — kirish talab qilinadi |
| `/karobka` | Quti chizmasi va tipografiya fayli — kirish talab qilinadi |
| `/admin` | Admin panel — ADMIN yoki SUPERADMIN |
| `/api/webhooks/finik` | Finik to'lov tasdig'i |

Kod: `src/lib/server/` — baza, sessiya, huquqlar; `src/lib/finik/` — to'lov
integratsiyasi; `src/proxy.ts` — marshrutlarni yo'naltirish (Next.js 16 da
`middleware.ts` shunday nomlanadi).

## To'lov

Finik orqali, `@mancho.devs/authorizer` bilan bir xil RSA-SHA256 imzo sxemasi
ishlatiladi (`src/lib/finik/signer.ts`). Paketning o'zi o'rnatilmagan — u
`node-jose` ni tortib keladi, imzo esa `node:crypto` da qirq qator. Buning
o'rniga **bir xilligi o'lchab tekshirilgan**: bir xil kalit bilan bir xil
so'rovlarni ikki tomondan imzolab, base64 natijalari solishtiriladi (to'lov
so'rovi, kirill va o'zbek harflari, tartiblanmagan kalitlar, bir nechta
`x-api-*`, query bilan GET, tanasiz so'rov). Baytda bir xil. Buni bilmaslik
qimmat: noto'g'ri kanonik satrga Finik `401 An invalid signature is provided`
deb javob beradi va boshqa hech narsa aytmaydi.

### Finikni ulash

1. `openssl genrsa -out finik_private.pem 2048`
2. `openssl rsa -in finik_private.pem -pubout -out finik_public.pem`
3. `finik_public.pem` ni Finikka berasiz (shaxsiy kabinet → «Ключи»), u API
   kalit qaytaradi. Hisob raqami — `FINIK_ACCOUNT_ID`.
4. `.env` ga: `FINIK_API_KEY`, `FINIK_ACCOUNT_ID`, `FINIK_PRIVATE_KEY`
   (base64), `FINIK_ENV`, va internetdan ochiq `APP_URL`.

`FINIK_PUBLIC_KEY` — ixtiyoriy. Finikning ochiq kalitlari uning hujjatlarida
e'lon qilingan, shuning uchun ikkisi ham `src/lib/finik/public-keys.ts` da
turadi va `FINIK_ENV` qaysi muhit ekanini aytadi. Sozlashda eng ko'p
adashiladigan joy shu edi: PEM ni base64 qilish, keyin beta va production
kalitlarini aralashtirib yuborish — natijada har bir webhook 401 bo'ladi,
to'lovlar `PENDING` da qoladi va hech kim sababini aytmaydi. Kalit o'zgarsa
`FINIK_PUBLIC_KEY` baribir ustun turadi: bitta o'zgaruvchi, deploy shart emas.

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

Finik **umuman** sozlanmagan bo'lsa webhook endpoint hamma so'rovni rad etadi
(503). Bu ataylab: imzosi tekshirilmagan so'rovni qabul qilish har kimga bepul
obuna berish bilan teng.

Webhook uchun `APP_URL` internetdan ochiq bo'lishi shart. Ishlab chiqish
paytida ngrok yoki cloudflared tunnelidan foydalaning.

### Webhook nimani kechiradi, nimani kechirmaydi

Imzo — yagona chegara, qolgan hammasi undan keyin keladi:

| Holat | Javob | Natija |
| --- | --- | --- |
| Imzo yo'q yoki boshqa kalit bilan | 401 | hech narsa o'zgarmaydi |
| `host` boshqa (proxy almashtirgan) | 401 | logda `host`, `path`, `x-api-*` — sababi ko'rinadi |
| To'g'ri imzo, `status: success` | 200 | to'lov `PAID`, obuna `ACTIVE` |
| **Xuddi o'sha xabar yana** | 200 | obuna bitta qoladi |
| **Vaqti bir necha soat orqada** | 200 | **faollashtiriladi** |
| `status` boshqa | 200 | to'lov `PENDING` da qoladi |
| Summa mos kelmaydi | 200 | to'lov `FAILED`, obuna berilmaydi |
| To'langan zakaz haqida g'alati xabar | 200 | `PAID` **o'zgarmaydi** |

Oxirgi uchtasi o'ylab emas, hisoblab tanlangan:

- **Eski `x-api-timestamp` ni rad etmaydi.** Finikning hujjati ±5 daqiqa
  deyapti, lekin u muvaffaqiyatsiz yetkazishni **bir kun** qayta uriadi va
  qayta urinishda yangi vaqt qo'yishini hech qayerda yozmagan. Rad etish —
  pulini to'lagan mijoz hech narsa olmasligi, jim-jitlikda. Takroriy xabar esa
  hech narsa bermaydi: imzo tanani Finikdan kelganini isbotlaydi, summa zakaz
  bilan solishtiriladi, `activatePayment` faqat `PENDING` satrni o'zgartiradi.
  Ya'ni takror — bo'sh ish. Baland log yo'qolgan to'lovdan yaxshiroq.
- **To'langan zakazni `FAILED` qilmaydi.** Avval summa mos kelmasa satr shartsiz
  `FAILED` bo'lardi — ya'ni allaqachon to'langan zakaz haqidagi ikkinchi g'alati
  xabar obunani ishlab turganda uni «muvaffaqiyatsiz» deb belgilardi.

### Finik aslida nima yuboradi

Bir so'mlik haqiqiy to'lov bilan o'lchangan, hujjatdan emas:

- `status` — `"succeeded"` (hujjatda `"success"` ham uchraydi, shuning uchun
  tekshiruv registrga qaramaydi va `succe` bilan boshlanishiga qaraydi);
- `transactionId` — **bizning** `PaymentId` imizning nusxasi, Finikning id'si
  emas. Uni `externalId` ga yozish o'z havolamizni ikki marta saqlash bo'lardi
  va Finik kabinetida qidirish uchun hech narsa qolmasdi;
- Finikning o'z id'si — `id`, ya'ni `<clientId>_<qrTransactionId>_DEBIT`.
  `externalId` ga shu yoziladi;
- `fields.paymentId` — zakazni topish uchun ishlatiladigan yagona maydon;
- `amount` tanada ham, `fields.amount` da ham keladi; tekshiruv yuqoridagisini
  oladi.

Butun zanjir **yolg'on Finik** bilan sinaladi: o'z kalit juftligi yasaladi,
`FINIK_PUBLIC_KEY` unga qaratiladi va webhook o'z imzomiz bilan yuboriladi —
imzo sxemasi baytda bir xil bo'lgani uchun endpoint uchun farqi yo'q. 35 ta
tekshiruv, hammasi haqiqiy bazada: obuna muddati, uzaytirish eski muddat
tugagan joydan boshlanishi, takroriy xabar, summa, kalit yo'q holati.

Undan keyin bir marta **haqiqiy 1 so'm** bilan ham o'tkazilgan: production
kalitlari, deploy qilingan sayt, Finikning o'z webhooki. To'lov `PAID` bo'ldi,
obuna yoqildi. Yolg'on Finik nimani sinay olmasa — imzoning haqiqiy kalit bilan
mosligi va Finik tanasining chin shakli — o'sha bir to'lovda ko'rindi.

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

## Sifatni yaxshilash

Redaktorning «03 Качество» bo'limida: hujjat surati aniq o'lchamga ketayotganda
yo'l-yo'lakay tuzatiladi. Standart holatda **o'chiq**. Arifmetika — `enhance.ts`,
quyidagi jadvallar bilan birga.

Alohida `/sifat` xizmati olib tashlandi. Mayda va eski suratlar uchun endi
`/kattalashtirish` bor (neyron tarmoq, `src/lib/upscale.ts`); eski `/sifat`
havolalari unga yo'naltiriladi.

### Hech narsa o'ylab topilmaydi

Bu yerdagi hammasi — mavjud piksellar ustida arifmetika. Model yo'q, va bu
cheklov emas, **ataylab**: ilovaning asosiy ishi hujjat surati, model esa yuzni
«yaxshilaganda» qiyofani o'zgartiradi. Konsullik uchun bu rad etish sababi.

Sinov buni raqam bilan tekshiradi: suratga mutlaqo silliq kvadrat qo'yiladi va
yaxshilashdan keyin uning tarqalishi hamon ~0 bo'lishi kerak. Agar biror joydan
«faktura» paydo bo'lsa — demak biror narsa o'ylab topilgan.

### Javobi ma'lum stend

Oldingi o'lchovlar **proksi** edi — «chekka energiyasi oshdi». Haddan tashqari
o'tkirlashtirilgan shovqinli surat bunday o'lchovda a'lo ball oladi, odamga esa
yoqmaydi. Shuning uchun stend boshqacha qurilgan: toza surat yasaladi, keyin u
**ataylab buziladi** (qorong'ilashtiriladi, shovqin qo'shiladi, qattiq
siqiladi), va natija o'zi hech qachon ko'rmagan toza nusxa bilan solishtiriladi.

Nima o'lchanadi:

| Ustun | Nimani aytadi |
| --- | --- |
| **zarracha** | asli tekis bo'lgan joylardagi tarqoqlik — qolgan shovqin |
| **rang** | bitta rangli dog' ichidagi xato — rang shovqini |
| **oqadi** | ikki rang chegarasidagi xato — rang chegaradan oshib ketishi |
| **halo** | qattiq chekka yonidagi yorug' kayma — «sun'iy» aynan shu |
| **tafsilot** | asli faktura bo'lgan joydagi faktura; **aslidan ko'p bo'lsa — o'ylab topilgan** |
| **PSNR** | butun kadrning toza nusxaga yaqinligi |

### Eski va yangi, bitta o'lchov bilan

| | zarracha | rang | oqadi | halo | tafsilot | PSNR |
| --- | --- | --- | --- | --- | --- | --- |
| Qanday kelgan bo'lsa | 7,29 | 3,97 | 12,6 | 4,4 | 25,13 | 30,11 |
| RGB ni bir xil ishlagan eski | 8,16 | 7,61 | 15,24 | **22,7** | **38,52** | **25,38** |
| **Yorug'lik/rang ajratilgan yangi** | **5,09** | **2,99** | 13,1 | **3,3** | 29,19 | **31,05** |
| Asl nusxa | 0 | 0 | 0 | 0 | 22,09 | — |

Eski versiya **uchala shikoyatni ham** raqamda tasdiqlaydi: shovqinni kamaytirish
o'rniga ko'paytirgan, rang xatosini ikki barobarlagan, siqilish qoldirgan
kaymadan besh barobar katta kayma chizgan, va aslida bo'lmagan fakturani yarmiga
ko'paytirgan. Natija kirgan faylga qaraganda haqiqatdan **5 dB uzoqroq** edi.

Yangisi: shovqinning uchdan biri ketdi, rang xatosining choragi ketdi, kayma
kirgan fayldagidan ham kichik, va **birinchi marta** natija kirgan fayldan
haqiqatga yaqinroq. Bitta narsa yomonlashdi — ikki kuchli rang chegarasida rang
sal oqadi (12,6 → 13,1). Bu rang dog'larini olib tashlashning haqi, va aynan
shuning uchun bu dastak sozlanadigan.

### Nega yorug'lik va rang alohida

Uchala shikoyat ham bitta narsaga borib taqaladi — eski kod qizil, yashil va
ko'kni bir xil ishlardi:

- **rang shovqini** — eng xunuk turi, lekin tafsilot deyarli olib yurmaydi.
  Shuning uchun uni **qattiq** silliqlash mumkin: ko'z fakturani yorug'likdan
  o'qiydi (shu sababdan birinchi rangli televizordan beri hamma format rangni
  yorug'likdan kam uzatadi). RGB da silliqlasangiz — tafsilot ham ketadi.
- **ekspozitsiya — bu yorug'lik.** Uni faqat yorug'likka qo'llasangiz, rang va
  to'yinganlik joyida qoladi. Eski kod bundan tashqari o'rtacha rang bo'yicha
  **oq balansni taxmin qilardi** — «rang o'zgarib ketdi» aynan shu edi. Endi u
  alohida tugma va **o'chiq**.
- **halo ham yorug'lik**: asl suratda yo'q kayma. Faqat yorug'likni
  o'tkirlashtirib, pikselga qo'shnilari diapazonidan uzoqqa ketishni taqiqlab,
  u yo'qoladi.

### Asosiy shovqin — zerno emas, kvadratchalar

Eng muhim kashfiyot. Silliqlash nega deyarli ishlamasdi: messenjerdan kelgan
suratda **yuqori chastotalar allaqachon yo'q** — siqish birinchi bo'lib ularni
tashlaydi. Qolgani esa 8×8 kvadratlar orasidagi zina, va u **past chastotali**.

Buni raqam ko'rsatdi: tekis joyda 8 ga karrali ustunlar bo'ylab qadam **3,25**,
qolgan ustunlarda **0,80** — to'rt barobar. Va radius bo'yicha o'lchov: r=2 da
tarqoqlik 1,71, r=8 da **2,45** — ya'ni kattaroq radius natijani **yomonlashtiradi**.
Hech qanday silliqlash kvadratni olib tashlay olmaydi, chunki istalgan foydali
radiusda kvadrat — bu farq emas, bu o'zining tekis joyi.

Shuning uchun chok **chok sifatida** ishlanadi: agar kvadrat chegarasidagi qadam
kichik bo'lsa (ya'ni bu mazmun emas, kodlash), u yopiladi va tuzatish keyingi
bir necha pikselga yoyiladi. Zina — yumshoq qiyalikka aylanadi. Va bu **o'zi
aniqlanadi**: PNG da, skrinshotda yoki o'lchami o'zgartirilgan suratda to'r mos
kelmaydi, nisbat 1 ga teng chiqadi va hech narsa qilinmaydi.

### Kattalashtirish ham kayma chizardi

Lanczos **halqa beradi** (uning o'tkirligi manfiy qanotlaridan keladi). Stend
ko'rsatdi: mayda suratni 2× qilganda, **o'tkirlashtirish umuman o'chiq
bo'lganda ham**, kayma 2,2 dan 20 ga chiqardi. Ya'ni «sun'iy» ning uchdan biri
o'tkirlashtirishdan emas, kattalashtirishdan edi.

Endi har bir chiqish pikseli o'zi orasida turgan ikkita kirish piksel
diapazonida ushlab turiladi (anti-ringing). Kayma: **24,4 → 2,8**, o'tkirlik
o'chiq bo'lganda esa **0**.

### Tartib muhim

Ekspozitsiya → kvadratchalar → shovqin → kattalashtirish → o'tkirlik. Bu tartib
**o'lchab** topilgan. Qorong'i surat diapazonning tor qismini egallaydi; uni
ochish ichidagi hamma narsani, jumladan shovqinni ham, o'sha koeffitsientga
ko'paytiradi — shuning uchun oldin ekspozitsiya, keyin ostonalar.

Ostonalar **suratning o'zidan o'lchanadi**, qat'iy son emas. Ikki xil o'lchov
ikki xil ish uchun: nozik shovqin uchun |piksel − xira nusxa| medianasi, «bu joy
tekismi» degan savol uchun esa **mahalliy tarqoqlikning** o'z taqsimoti (30-chi
protsentil). Ikkinchisi kerak bo'ldi, chunki siqilgan suratda birinchisi 0,96
chiqadi, haqiqatan tekis yuzning tarqoqligi esa 3,24 — noto'g'ri o'lchov bilan
butun kadr «faktura» deb o'qilib, silliqlash hech narsaga tegmasdi.

### Tezlik

| | eski | yangi |
| --- | --- | --- |
| Ko'rinish (1,5 Mpiks) | 343 ms | 538 ms |
| 12 Mpiks surat | 2,8 s | 4,3 s |

Ko'proq ish qilinadi, shuning uchun sekinroq. Uch marta tezlashtirildi:
ekspozitsiya egri chizig'i 256 ta qiymat uchun **oldindan** hisoblanadi (har
piksel uchun `pow` va `tanh` emas), min/maks ajratiladigan ikki o'tishda
olinadi, keng radiusli ishlar (rang va «tekis joy» xaritasi) **yarim
o'lchamda** bajariladi — ikkalasi ham past chastotali, JPEG ham rangni shunday
saqlaydi.

### Endi qayerda to'xtaydi

Tafsilot 29,19, asl nusxada 22,09. Ya'ni kadrda hamon aslida bo'lmagan faktura
bor — bu qolgan shovqin, u tafsilotdek o'qiladi. Filtrlash buni yopa olmaydi:
siqilish artefaktini kiprikdan ajratish — model rostdan yaxshi qiladigan
yagona narsa.

**Model aynan shu uchun kerak bo'ladi.** Lekin endi bu ancha kichik ish:
ekspozitsiya, rang, kvadratchalar va shovqinning asosiy qismi endi model uchun
dalil emas.

### Chegara proporsiyani buzmaydi

Rastr chegarasi 6000 piksel har tomonda. Ilgari u **har o'qqa alohida**
qo'yilardi: 4000 × 3000 suratni 2× so'rasangiz 6000 × 6000 chiqardi — piksel
soni to'g'ri, shakli noto'g'ri, yuz uchdan birga cho'zilgan. Endi chegara
masshtabga qo'yiladi, ikkala tomon birga tushadi, va sahifa «Станет»
qatorida qaysi o'lcham chiqishini oldindan aytadi.

### Eksport hisobi

Ikkala sahifa ham bitta `useExports()` ni ishlatadi: aloqa yo'qligida ham
server bergan limitdan ortiq yozilmaydi, qarz esa ulanish qaytganda **bir
marta** to'lanadi. Limit tugaganda redaktorda tugma o'chadi, xizmat sahifasida
esa sabab va tarif havolasi ko'rsatiladi — ikkalasida ham ko'rinayotgan
natijaga suv belgisi tushadi, chunki ekrandan olish ham eksport.

## Karobka

`/karobka` — qutining o'lchamidan **развёртка** (yoyilma) va tipografiyaga
beriladigan fayl. Sof geometriya: server ham, model ham kerak emas, hammasi
brauzerda hisoblanadi.

To'rtta tur, 95% buyurtma shularga kiradi:

| Tur | Nima |
| --- | --- |
| Обычная | To'rt qanotli, yondan yelimlanadi. FEFCO 0201 |
| С крышкой | Ikki detal: tag va qopqoq |
| Подушка | Torslari yelimsiz, chetlari yoy |
| С замком | Tili ichkariga qistiriladi, skotch kerak emas |

### Ichki yoki tashqi

Birinchi va eng qimmat savol. 200 mm **ichki** deb aytilgan joyda tipografiya
**tashqi** deb tushunsa — shtamp chiqindiga ketadi, bu tuzatma emas. Shuning
uchun bu jimgina qabul qilinadigan taxmin emas, ko'rinadigan tugmacha, va
chizmada **ikkalasi ham** yoziladi.

### Qalinlikka tuzatma

Karton qog'oz emas: u burchakdan aylanib o'tishi kerak, va buklanish materialning
ichki yuzasidan emas, **o'rtasidan** o'tadi. Shuning uchun ichida `L` joy
qoldirishi kerak bo'lgan devor biglar orasida `L + T` bo'ladi — har ikki uchida
yarim qalinlikdan. Buni tashlab ketsangiz har bir quti tor chiqadi; qo'lda
yasalgan yoyilmalardagi eng ko'p uchraydigan nuqson shu.

### O'lchamda chegara yo'q

Xohlagan son: 8 mm ham, 3500 mm ham, 62,5 mm ham. Vergul ham, nuqta ham
qabul qilinadi. Chegara **taqiq emas, maslahat**: g'ayrioddiy son ekranda
ogohlantirish beradi, lekin chizma baribir chiziladi.

Buning uchun `NumberField` qayta yozildi va u **butun ilovada umumiy** — ya'ni
studioda ham shu nuqson bor edi. Eski versiya har bosishda o'qib, chegaraga
qisardi: 200 turgan maydonga yozsangiz bir lahzaga 2006 bo'lib maksimumga
qisilardi, keyin har bosish yana maksimum berardi va **maydon o'sha yerda
qotib qolardi**. Tozalasangiz ham yordam bermasdi — bo'sh satr son emas,
shuning uchun eski qiymat kursor ostida qaytib kelardi. Kasr ham shuning
uchun kiritilmasdi: «62.» — bu 62, va nuqta yozilishi bilanoq yeyilardi.

Endi maydon yozilayotgan matnni **o'zida ushlaydi** va faqat o'qiy olgan
sonini xabar qiladi. Tekshiruv maydondan chiqqanda bo'ladi, bosishlar orasida
emas: yarim yozilgan son noto'g'ri emas — u yarim yozilgan.

`type="number"` emas, `type="text"` + `inputMode="decimal"`: raqam maydoni
«62,» ni umuman ushlab turolmaydi, vergul esa bu interfeysni o'qiydiganlarning
yarmi uchun kasr belgisi.

### Burchaklar o'zingizniki

«Тонкая настройка» bo'limida — men formulaga qo'ygan barcha nisbatlar:
yelim qanoti, qanot chuqurligi, prorez kengligi, burchak tilchasi, qopqoq
zazori, yoy balandligi, qulf tili, changdan himoya qanoti. Har birining yonida
formula bergan qiymat turadi va bir bosishda qaytariladi.

Bular **konventsiya, xulosa emas** — o'z kartonini va yelim mashinasini
biladigan ustaxona yelim qanoti qanday bo'lishini formuladan yaxshiroq biladi.
O'zgartirilgan qiymat chizmaga ham, DXF ga ham tushadi.

Yumaloqlash alohida: faqat **erkin** burchaklar yumaloqlanadi. Bigovka
uchraydigan burchak — bu karton bukiladigan joy, uni yumaloqlash bukilishni
ham olib ketadi. Prorez tubi esa aksincha yumaloqlangani yaxshi — karton aynan
o'tkir prorez uchida yirtiladi — lekin u odatda radius sig'adigan darajada
uzun emas, va tekshiruv qirrani yeyish o'rniga rad etadi.

### Nima hosil bo'lishini ko'rish

O'ng tomonda quti **yig'iladi**. Ползунок 0 da — yassi varaq, 1 da — quti,
oradagi har qanday holatda — bukilish jarayoni. Sichqoncha bilan sudrab
aylantirish mumkin.

Qo'shimcha kutubxona yo'q, oddiy CSS transform. Geometriya allaqachon aniq
ma'lum — har bir panel to'rtburchak, har bir bigovka uning qirrasi — hal
qiladigan narsa yo'q, faqat burish. Kutubxonasiz sahifa esa internet
uzilganda ham ishlaydi.

`src/lib/box-assemble.ts` o'sha burishlarni **JS da ham** hisoblaydi, aynan CSS
qoidalari bilan. Shuning uchun ko'rinish markazlanadi, o'lchamga moslanadi —
va **tekshirsa bo'ladi**: yig'ilgan qutining o'lchami so'ralgan qutiga mos
kelishini sinov o'lchaydi. Shu sinov haqiqiy nuqsonni tutdi — yelim qanoti
quvurning teskari tomoniga bukilib, qutiga 40 mm qo'shib yuborgandi.
Ekranda buni payqash qiyin, o'lchovda esa darhol ko'rinadi.

Yostiq-qutining uchlari **taxminiy**: ular 80° da buklanadi va bir-birining
ustiga tushadi, shuning uchun quvurdan bir oz chiqib turadi — bu ataylab, va
sinovda `yoy × cos80°` deb aniq yozilgan.

### Ikki fayl, ikki o'quvchi

**DXF** — ishchi fayl: 1:1, millimetrda, kesish va bigovka **alohida
qatlamda** (`CUT` qizil, `CREASE` ko'k — tipografiya aynan shuni qidiradi).
R12 ataylab: bosmaxonadagi har qanday eski CAD ham ochadi, yoyilmaga esa
chiziq va yoydan boshqa hech narsa kerak emas.

**Chizma (PDF/SVG)** — odam uchun: masshtabda, o'lchov chiziqlari va shtamp
bilan. Masshtab standart qatordan olinadi (1:1, 1:2, 1:2,5, 1:4, 1:5, 1:10 …),
chunki 1:3,7 dagi chizmani lineyka bilan hech kim tekshira olmaydi. Qog'oz va
yo'nalish so'ralmaydi — eng yirik masshtab beradigan variant o'zi tanlanadi,
teng bo'lsa kichikroq qog'oz.

Yozuvlar **varaq millimetrida** o'lchanadi, chizma millimetrida emas: 1:20 da
ham shrift 2,5 mm bo'lib qoladi, mikroskopik emas.

### Nimani sinov tutdi

Yoylar SVG da **teskari chizilgan edi** — ichkariga botib. Geometriya to'g'ri,
fayl yaroqli, sahifadan chiqmagan, hamma sinov yashil. Lekin quti noto'g'ri.
Sabab — SVG `sweep` bayrog'i: y o'qini ag'darish yoyning yo'nalishini teskari
qiladi. Buni tutgan sinov chizilgan chiziqning o'lchamini hisoblangan o'lcham
bilan solishtiradi (`box-browser.mjs`) — teskari yoy ikki yoy balandligiga
xato beradi.

Bundan keyin qo'shilgani: **chizma shtamp ustiga chiqmaydi** degan tekshiruv,
`#drawing` va `#title` guruhlarini alohida o'lchab. Tashqaridan qaraganda
chizmaning shtampga chiqishi sig'ib turganidan farq qilmaydi.

### Kassa bilan

Yangi kategoriya — `boxes` / «Коробки и упаковка». Eski kodlar (`documents`,
`printing`, `retouch`, `other`) **o'zgarmadi**: o'tgan oyda yozilgan qatorlar
shu satrlarga tayanadi, birini o'zgartirsangiz haqiqiy tushum nomsiz songa
aylanadi.

### Hozircha yo'q

Sahifa internetsiz ochilmaydi. Hisob-kitobning o'ziga tarmoq kerak emas, lekin
sahifa `(site)` guruhida — shapkasi hisobga qarab farq qiladi (admin havolasi),
shuning uchun servis-ishchi uni keshlay olmaydi. Studio buning uchun alohida
layoutda turadi.

## Keyingi mijoz

Suratni almashtirish uchun **sahifani qayta yuklash shart emas**. Panelda,
«Печать» tugmasi ostida — «Новое фото». O'lcham, kadrlash va qolgan sozlamalar
joyida qoladi.

Bunday tugma ilgari ham bor edi, lekin kanvas ostida 10px kulrang matn bo'lib
turardi — ish tugaydigan joydan uzoqda. Natijada odamlar sahifani qayta
yuklashardi va har safar sozlamalarini yo'qotishardi. Fayl tanlagich endi
`Studio` da turadi, chunki uni ham kanvas, ham panel ochadi.

Sudrab tashlash va Ctrl+V ham hamma vaqt ishlaydi.

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

### Model oldindan yuklanadi

Fon o'chirish **internetsiz ham ishlaydi**. Buning uchun model ish stoli
ochilgandan ~2.5 soniya keyin fonda yuklab olinadi — birinchi suratni kutmasdan,
chunki birinchi surat odatda mijoz peshtaxta oldida turganda keladi.

Kutubxona modelni **o'zi keshlamaydi** (`resources.json` ni har safar qaytadan
so'raydi), shuning uchun buni `cacheModel()` qiladi. U `preload()` chaqiradi va
shu paytda `fetch` ni vaqtincha o'raydi: kutubxona chunk manzillarini ish
paytida manifestdan hisoblaydi va tashqariga bermaydi, ya'ni u nimani
yuklaganini bilishning yagona halol yo'li — yuklashini kuzatish. O'ram allaqachon
kelayotgan baytlarni saqlaydi, ikkinchi marta so'ramaydi — do'kon aloqasida
farqi shunda.

Servis-ishchiga tayanilmadi: **u o'zini ro'yxatdan o'tkazgan tashrifni ushlab
qololmaydi**, ya'ni birinchi tashrifda model kesh yonidan o'tib ketardi.
Sahifaning o'zi keshlagani birinchi tashrifdayoq ishlaydi.

Faqat tanlangan sifat yuklanadi — ikkalasi o'nlab megabaytni ikki barobar
qilardi.

### Tayyorlik ko'rsatkichi

Ish stoli sarlavhasida kichik belgi turadi. Bu bezak emas: keshlash jimgina
ketadi, va «hali tayyor emas» bilan «umuman ishlamaydi» tashqaridan bir xil
ko'rinadi. Aynan shu sababdan bu funksiya bir marta «buzuq» deb xabar qilingan
edi.

| Belgi | Ma'nosi |
| --- | --- |
| `Офлайн не готов` | Redaktor hali saqlanmoqda |
| `Готовим офлайн…` | Model yuklanmoqda — uzilmang |
| `Офлайн без удаления фона` | Redaktor bor, model yo'q |
| `Офлайн готов` | Hammasi qurilmada |

**Belgi bir marta yolg'on aytdi va tuzatildi.** «Keshda biror narsa bormi»
degan tekshiruv keshda faqat manifest turganda ham `Офлайн готов` deb
ko'rsatardi — ya'ni u aynan o'zi oldini olishi kerak bo'lgan xatoni qildi. Endi
manifest keshdan qaytadan o'qiladi va **u sanab o'tgan har bir chunk** joyida
ekani tekshiriladi. Rantayim — bir oila (simd, threaded, jsep), qaysi birini
brauzer tanlashi o'ziga bog'liq, shuning uchun ulardan **bittasi** to'liq
bo'lsa yetarli; aniq bittasini talab qilish boshqa brauzerlarda abadiy «tayyor
emas» berardi.

### Deploydan keyin

Yangi versiya chiqqanda **bitta qo'shimcha tashrif kerak**: eski ishchi
yangisini o'rnatadigan tashrifni o'zi xizmat qiladi. Shu sababdan deploydan
keyin darhol sinab ko'rilsa, internetsiz ishlamayotgandek tuyuladi — bu
kutilgan holat, belgi buni aytib turadi.

Model keshi **versiyalanmagan** (`photopoly-model`). Ilgari u `VERSION` ga
bog'langan edi, ya'ni har bir deploy jimgina har bir do'konga o'nlab megabaytni
qaytadan yuklatardi. Chiqishda (`Выйти`) u ham tozalanadi.

Ilova yorlig'i (`start_url`) endi `/studio` ga ishora qiladi, `/` ga emas:
bosh sahifa keshlanmaydi (uning sarlavhasi kim kirganiga qarab o'zgaradi),
ya'ni yorliqdan internetsiz ochilganda «нет соединения» sahifasi chiqardi va
redaktorga umuman yetib borilmasdi.
