# ผลวัด Stock Analytics และ Inventory Snapshot

## ขอบเขต

ตรวจ `readStockAnalytics()` จาก `main` ที่ `7c49424c0bd185035c928f3dbaf8562243718f4e` เทียบกับ candidate ที่ `6e09bc7c` บน MySQL 8.0.46, Prisma 6.19.3 และ Node.js 24.22.1 ใน WSL2 Ubuntu ข้อมูลทั้งหมดสร้างใน disposable Docker Compose หลังตรวจชื่อฐานข้อมูล บัญชี และ server UUID การทดสอบไม่ใช้ฐานข้อมูลแอปพลิเคชัน รุ่นก่อนหน้าวัด p95 1,354.36 ms จาก runner และ fixture คนละชุด จึงใช้เป็นบริบทย้อนหลังและใช้ค่า baseline ที่จับคู่ในรอบนี้สำหรับคำนวณผลต่าง [ผลทดลองเดิม](candidate-experiments.md)

## เส้นทางเดิมและสาเหตุที่ยืนยันแล้ว

1. เปิด interactive transaction แบบ `RepeatableRead` จากนั้นคำนวณจำนวนคำขอจ่ายแล้ว รายการ Top Materials ประเภท และตัวเลือกหน่วยจากช่วงเวลาประเทศไทย SQL ใช้คอลัมน์จริง `APPROVED` และ `reviewedAt`
2. ตรวจ pending line ที่ไม่มี Variant แล้วอ่าน Variant และ Stock Item ที่ active ทีละ 500 ตาม ID Prisma อ่านชื่อ Stock Item และกราฟ Variant Attribute แยกจาก query หลักในแต่ละ batch ส่วน `groupBy()` รวมยอดจองจาก request สถานะ `PENDING` ให้ Variant ใน batch
3. ใช้ `getAvailableQuantity()` และ `classifyStockHealth()` รวม Stock Health และยอดคงเหลือของ Top Materials ตามหน่วย จัดลำดับ alerts ให้ out มาก่อน low และ ID น้อยมาก่อนในแต่ละกลุ่ม จากนั้นคืนไม่เกิน 20 รายการ
4. อ่านจำนวน pending requests ตัวเลือกประเภท และ historical detail เมื่อมี `itemId` ก่อนประกอบ DTO และ commit

แผนเดิมของ batch แรกที่ 16,000 active Variants เริ่มจาก scan Stock Items 10,000 แถว ตรวจ Variant ผ่าน `stock_item_variants_stockItemId_idx` 8,000 รอบ แล้ว sort ผล join 16,000 แถวเพื่อคืน 500 แถว แผนนี้ทำให้ cursor ช่วยตัดผลลัพธ์ แต่ยังมีการอ่าน Stock Items ซ้ำหลาย batch

ใน fixture dense มี Variant Attribute links 61,936 แถว Prisma ส่ง 96 attribute statements ใน 32 batches โดยบันทึก query events ของ sample หนึ่งรวม 431 ms แผนอ่าน links ตัวอย่างเลือก scan covering index ตาม `attributeValueId` ทั้ง 61,936 entries แล้วกรองด้วย Variant IDs การเลื่อน hydration หลังจัดอันดับทำให้แผนของ Top 20 ใช้ primary-key range และคืน 76 links สำหรับ fixture นี้ ชื่อ Stock Item ใช้เฉพาะตอนคืน alert จึงเลื่อนการอ่านไปด้วย

แผน reservation มีทั้งการเริ่มจาก Variant ID แล้วตรวจ request สถานะ pending และการเริ่มจาก `stock_requests_status_idx` แล้วตรวจ Request Items ทุกคำขอ pending ใน batch ตัวอย่างหนึ่งของแผนหลังเลื่อน hydration อ่าน 5,000 pending requests เพื่อคืน 25 กลุ่มใน 19.3 ms แผนก่อนหน้าในชุดข้อมูลเดียวกันเคยคืน 25 กลุ่มใน 3.41 ms ด้วย Variant-first range lookup จึงต้องเทียบแผนและข้อมูลที่มี pending น้อยกับข้อมูลที่กระจายหลาย Variant ก่อนเลือก query

## วิธีวัด

- สร้างข้อมูลหลัก 10,000 Items, 20,000 Variants, 50,000 Requests และ 50,000 Request Items ใช้หลายหน่วยต่อ material รวม `pc` กับ `PC` ที่ collation ปกติอาจมองว่าเท่ากัน Fixtures ครอบคลุม stock เป็นศูนย์ ยอดจองเกิน stock, minimum เป็นศูนย์และตรงกับ available, หลาย request จอง Variant เดียวกัน, legacy lines ที่ไม่มี Variant และ active Variant ใต้ inactive Item
- อุ่นเครื่องสองรอบแล้ววัด 20 samples ต่อแบบบนฐานข้อมูลเดียวกัน โดยสลับลำดับก่อน–หลัง คำนวณ p50/p95 แบบ nearest-rank เวลารวมครอบคลุม Prisma transaction และ `JSON.stringify` โดยไม่มี HTTP
- Prisma query events ใช้จำแนก query shape และเวลาที่ client เห็น ส่วน MySQL Performance Schema วัด prepared executions, rows examined, rows sent และ server time แยกจาก statement ควบคุม transaction ค่า rows examined และแถวภายใน iterator ของ `EXPLAIN ANALYZE` ใช้ตอบคนละคำถาม [MySQL Statement Summary Tables](https://dev.mysql.com/doc/refman/8.0/en/performance-schema-statement-summary-tables.html) [MySQL EXPLAIN ANALYZE](https://dev.mysql.com/doc/refman/8.0/en/explain.html)
- CPU คือ user + system CPU ของ Node process ซึ่งรวม Prisma native engine ค่า RSS และ heap วัดหลังจบการอ่านต่อ sample หลังขอ GC ก่อนเริ่ม ตัวเลขนี้สะท้อนขนาด process ณ จุดวัดและไม่ได้วัด peak allocation
- เปรียบเทียบ DTO โดย deep equality ทุกคู่ รวมลำดับอาร์เรย์ ค่าตัวเลขและทุก business field ตั้ง `freshness.generatedAt` เป็นค่าเดียวกันก่อนเทียบเท่านั้น SHA-256 ใน artifact ผูกผลลัพธ์ที่ตรวจแล้วกับ scenario

## Query ที่เลือก

ใช้ Variant เป็นฝั่งแรกของ join กับ Stock Item เพื่อให้ `ORDER BY v.id LIMIT 500` หยุดได้เมื่อ batch เต็ม CTE แยก batch จากการรวมยอดจอง ทำให้ request line แต่ละแถวถูกนับหนึ่งครั้ง และยอดรวมต่อ Variant ถูก join กลับเพียงหนึ่งแถวต่อ Variant ใช้ `COALESCE` ให้ Variant ที่ไม่มียอดจองได้ศูนย์ SQL bind ค่า cursor ผ่าน Prisma โดยให้ optimizer เลือกลำดับ join ของ reservation เอง

โค้ดเรียกฟังก์ชันเดิมเพื่อ clamp stock และคำนวณ healthy/low/out รวม available ตามหน่วยแบบเปรียบเทียบสตริงตรงตัวและคงลำดับหน่วยที่พบครั้งแรก รักษาการจัดอันดับ out ก่อน low และ ID จากน้อยไปมาก ชื่อและ attributes ของ Top 20 ถูกอ่านด้วย Prisma ภายใน transaction เดียวกัน กรณีไม่มีแถวที่ต้องแจ้งเตือนจะจบโดยไม่มี enrichment query การตรวจ pending line ที่ `variantId` เป็น NULL ทำงานก่อนอ่าน inventory เช่นเดิม

Raw SQL นี้จำกัดขอบเขตเฉพาะ batch ของ Inventory Snapshot ส่วน issued history, historical detail และ Report Export ใช้สัญญาและเส้นทางเดิม เงื่อนไขกรองรายงานไม่ถูกนำมาใช้กับ current inventory ไม่มี migration หรือ index ใหม่ Timeout ของ interactive `RepeatableRead` ยังอยู่ที่ 30,000 ms

## ผลก่อนและหลังที่ 16,000 active Variants แบบ dense

| เมตริก | Baseline | เลื่อน hydration | Ordered scan + Prisma groupBy | Candidate |
| --- | ---: | ---: | ---: | ---: |
| เวลารวม p50 / p95 (ms) | 2,534.71 / 3,398.71 | 1,285.67 / 1,513.91 | 544.90 / 669.05 | 493.99 / 562.36 |
| Inventory Snapshot p50 / p95 (ms) | 2,273.82 / 3,100.57 | 1,026.96 / 1,195.68 | 286.02 / 359.44 | 239.06 / 267.33 |
| Transaction รวมการเปิดและ commit p50 / p95 (ms) | 2,534.66 / 3,398.60 | 1,285.59 / 1,513.84 | 544.84 / 668.95 | 493.94 / 562.29 |
| Prisma query events p50 / p95 | 204 / 204 | 81 / 82 | 81 / 82 | 49 / 49 |
| MySQL prepared executions p50 | 201 | 78 | 78 | 46 |
| MySQL rows examined p50 | 2,921,540 | 931,455 | 363,455 | 280,655 |
| MySQL rows sent p50 | 87,035 | 16,966 | 16,966 | 16,166 |
| MySQL execution time p50 / p95 (ms) | 1,408.42 / 1,816.60 | 1,074.77 / 1,286.98 | 398.17 / 493.52 | 394.49 / 450.67 |
| Node process CPU p50 / p95 (ms) | 1,139.44 / 1,602.08 | 207.03 / 244.39 | 143.09 / 183.40 | 93.46 / 106.78 |
| RSS p95 (MiB) | 253.58 | 251.71 | 251.71 | 251.83 |
| Heap used p95 (MiB) | 46.68 | 40.05 | 37.26 | 34.31 |
| JSON serialization p95 (ms) | 0.115 | 0.089 | 0.099 | 0.077 |
| DTO | Reference | ตรงกันทุก sample | ตรงกันทุก sample | ตรงกันทุก sample |

### ผลใน workload อื่น

| Active Variants และ fixture | Baseline เวลารวม p50 / p95 (ms) | Candidate เวลารวม p50 / p95 (ms) | Snapshot p95 ก่อน → หลัง (ms) |
| --- | ---: | ---: | ---: |
| 1,000 healthy ทั้งหมด, sparse | 317.18 / 338.07 | 264.87 / 278.19 | 87.27 → 23.00 |
| 5,000 มี 6 alerts, sparse | 653.20 / 691.48 | 326.60 / 340.74 | 420.20 → 82.36 |
| 5,000 history กระจุก, pending น้อย, sparse | 655.22 / 681.13 | 322.97 / 339.15 | 396.09 → 55.24 |
| 16,000 mixed, sparse | 1,522.67 / 1,884.54 | 476.60 / 601.32 | 1,561.65 → 314.88 |
| 16,000 healthy ทั้งหมด, dense | 2,819.87 / 2,878.77 | 513.78 / 565.78 | 2,603.93 → 278.29 |
| 32,000 mixed, dense | 5,599.53 / 6,638.21 | 649.07 / 745.15 | 6,344.40 → 452.02 |

ชุด 32,000 ขยายเป็น 18,000 Items และ 36,000 Variants โดยคงจำนวน Request Items เดิม ชุด history กระจุกย้าย issued lines ส่วนหนึ่งไปยัง Variant เดียว และลด pending rows เพื่อเทียบกับการกระจายเดิมที่มี pending 5,000 requests ผล p95 หลังรวม batch ต่ำกว่า baseline และ ordered scan ในทุกชุดที่วัดทางเลือกนั้น

### แยกต้นทุนของ query

| กลุ่มคำสั่ง | Baseline จำนวนและ client p50 | Candidate จำนวนและ client p50 |
| --- | ---: | ---: |
| Issued totals, ranking, quantities | 3 / 53, 83, <1 ms | 3 / 53, 77, 1 ms |
| Category distribution | 1 / 54 ms | 1 / 54 ms |
| Unit options | 1 / 54 ms | 1 / 54 ms |
| Variant batches รวม end probe | 33 / 710 ms | 33 / 163 ms รวม reservation |
| Reservation `groupBy()` | 32 / 127 ms | รวมใน batch |
| Stock Item names | 32 / 32 ms | 1 / <1 ms |
| Attribute relations | 96 / 335 ms | 3 / <1 ms |
| Query เลือก Variant เพื่อ hydrate alerts | 0 | 1 / <1 ms |

การจับเวลาภายในลูปแยกรอบจาก benchmark พบว่า availability, Stock Health, Top Materials และการจัดอันดับ alert ใช้ 4.08, 2.90, 2.53 และ 15.70 ms ใน baseline เทียบกับ 4.13, 2.42, 2.31 และ 5.68 ms ใน candidate ค่านี้รวม overhead ของ timer และใช้บอกขนาดโดยประมาณ งานแปลง DTO เป็น JSON ต่ำกว่า 0.12 ms ที่ p95

### EXPLAIN ANALYZE

| Query ตัวอย่าง | Plan และเวลาที่ root iterator |
| --- | --- |
| Variant batch เดิม | Items table scan 10,000 rows, Variant itemId index lookup 8,000 loops และ sort 16,000 แถวก่อนคืน 500 แถว, 36.3 ms |
| Variant batch หลังเลื่อน hydration | join ยังรับ 16,000 แถวก่อน sort และคืน 500 แถว, 37.2 ms |
| Ordered scan | Variant PRIMARY range เริ่มที่ cursor และหยุดหลัง 500 แถว ใช้ Item PRIMARY lookup 500 รอบ, 0.746 ms |
| Candidate CTE | Variant range ของ CTE เติม 500 แถวใน 0.668 ms รวม reservation lookup, aggregate, sort 500 แถว และ join คืน 500 แถวใน 4.42 ms |
| Attribute links เดิม | covering scan ดัชนี `attributeValueId` 61,936 แถว คืน 1,936 แถวใน batch ที่เลือก, 11.6 ms |
| Attribute links ของ Top 20 | covering range บน primary key คืน 76 แถว, 0.053 ms |

เมื่อ pending เหลือ 52 requests ในชุดที่ history กระจุก optimizer เริ่ม reservation join จาก `stock_requests_status_idx` แล้ว lookup IDs ใน CTE แทนการอ่านประวัติของ Variant ที่ผูก issued lines จำนวนมาก Statement รวมของ batch แรกคืน 500 แถวใน 1.64 ms เทียบกับ 4.42 ms ในชุด dense ที่ reservation join เริ่มจาก Variant ของ batch

### ทางเลือกที่ทดลอง

- Ordered scan และ Prisma `groupBy()` แก้แผน Variant scan ได้ แต่ยังส่ง reservation statements แยกอีก 32 ครั้ง Candidate เร็วกว่าในการวัดร่วมและคืนข้อมูลต่อ Variant แถวเดียว
- ทดลอง `SUM` แบบมีเงื่อนไขสำหรับ Stock Health อย่างเดียวและได้ผลเท่ากันบน fixture ค่า p95 64.82 ms สำหรับ 16,000 Variants เป็นการวัดหนึ่ง query ที่คืนสาม counts โดยยังไม่คำนวณ Top Materials, alerts หรือกราฟ attributes การแทน snapshot ทั้งหมดต้องเพิ่มการจัดลำดับ, binary unit grouping และกฎเดียวกันใน SQL จึงคงฟังก์ชัน domain เดิมไว้
- ดัชนีปัจจุบันที่เกี่ยวข้องคือ Variant PRIMARY, Item PRIMARY, `stock_item_variants_stockItemId_idx`, `stock_item_variants_isActive_idx`, `stock_request_items_variantId_idx`, `stock_request_items_requestId_idx`, `stock_requests_status_idx` และ primary key ของ `stock_variant_attribute_values` แผน candidate ใช้ดัชนีเดิมเพื่อหยุด batch และอ่าน relations ที่จำเป็น ผลวัดไม่ต้องอาศัยดัชนีชุดทดลองเดิม จึงไม่มีการทดสอบ DDL ต้นทุนเขียน หรือพื้นที่สำหรับ index ใหม่

## ความซับซ้อน

ให้ `V` เป็นจำนวน Variant ที่เข้า snapshot, `B=500`, `K=20`, `P=ceil(V/B)`, `A` เป็นจำนวน attribute links ของ Variant ที่อ่าน และ `Aₖ` เป็นจำนวน links เฉพาะ alerts ที่ชนะการจัดอันดับ

- แผนเดิมที่เริ่มจาก Items สามารถอ่าน Items ทุกแถวในแต่ละ batch และทำ join กับ Variant ตามช่วงที่ยังเหลือ ต้นทุนสแกน Items จึงเป็น `O(P × Items)` ในแผนที่พบ และจำนวน Variant ที่ส่งเข้า sort ลดลงตาม cursor ทีละ batch Query hydration ทำงานตาม `A` และแผน attribute index scan ที่พบอาจอ่าน link index ซ้ำมากกว่าจำนวน rows ที่ส่งกลับ
- แผนใหม่แบบ range traversal อ่าน Variant ตามลำดับและทำ primary-key lookup ของ Item ที่เกี่ยวข้อง จึงไม่จำเป็นต้องเริ่ม scan Items ทั้งตารางซ้ำในแต่ละ batch งาน reservation ยังขึ้นกับจำนวน line และความเลือกจำเพาะของสถานะในแผนที่ MySQL เลือก CTE ของ batch และแถวที่รวมยอดจองมีขนาดสูงสุด `B` ต่อชุด
- ฝั่งแอปยังคำนวณ health ต่อ Variant ใน `O(V)` และเลือก alert โดย sort ชุดขนาดไม่เกิน `K+1` งานค้นหาหน่วยของ Top Materials โตตามจำนวนหน่วยต่อ material ส่วนนี้เหมือนเดิม การอ่านและจัดรูปแบบ attribute เหลือเฉพาะ `Aₖ` พื้นที่ฝั่ง Node สำหรับ inventory row เป็น `O(B + K + Aₖ)` บวก accumulator ของหน่วยใน Top Materials โดยไม่มี reservation map ต่อ batch

## ความถูกต้องและ transaction

ชุด integration ควบคุมจังหวะด้วย Prisma query extension ให้ writer commit จริงหลัง reader จัดอันดับเสร็จและก่อน query โหลด alert labels ใน commit เดียว writer ปรับปริมาณและ minimum, สร้าง pending reservation, จ่ายและยกเลิกคำขอ, เปิดและปิด Variant และแก้ชื่อ Item กับ attribute value ระหว่างอ่าน DTO ต้องเท่ากับก่อน commit ยกเว้น `generatedAt` ส่วนการอ่านครั้งถัดไปต้องเห็นชื่อใหม่ ป้ายกำกับใหม่ ยอดจองเกิน physical stock ที่ถูก clamp เป็นศูนย์ และจำนวน pending/issued กับ health ที่เปลี่ยนตามข้อมูลจริง

ทดสอบให้ out-of-stock Variants อยู่หลัง batch แรกเพื่อยืนยันว่าแทน low alerts ได้ตามเดิมและเก็บ 20 ID แรกตามลำดับ ทดสอบ Variant ที่ไม่มี attributes และ pending line ที่ไม่มี Variant snapshot แม้จะกรองประวัติออกทั้งหมด ชุดทดสอบเดิมครอบคลุม Bangkok boundary, category/project filters, all-unit request frequency, สิทธิ์อ่านรายงาน และการกระทบยอดกับ annual/balance Excel

Differential fixture เพิ่ม historical detail 53 แถวเพื่อตรวจลำดับและ `hasMore` ทั้งสองหน้า รวม legacy line ที่ไม่มี Variant, inactive historical material และ `PC` กับ `pc` ที่ต้องแยกยอด ทดสอบ inventory ว่างและยอดจองจากสองคำขอรวม 4,294,967,294 ซึ่งเกิน signed INT แต่ยังคืนค่าตรงกับ baseline และ clamp available เป็นศูนย์

Benchmark concurrency ใช้ 16,000 active Variants แบบ dense และ 20 samples ต่อแบบ ให้ writer ปรับ stock และสร้าง reservation ใน transaction แยกหลัง reader อ่าน issued history และก่อน inventory scan DTO ของ reader ตรงกับ snapshot ก่อน commit ทุก sample และตรวจว่า reader ใหม่เห็นยอดจองและ stock ที่เปลี่ยนแล้ว

| เวลาระหว่าง writer commit (ms) | Baseline p50 / p95 | Candidate p50 / p95 |
| --- | ---: | ---: |
| Reader transaction | 2,591.12 / 2,818.88 | 499.67 / 512.75 |
| Inventory Snapshot หลัง writer commit | 2,323.00 / 2,553.59 | 235.20 / 251.21 |
| Writer transaction | 7.03 / 7.66 | 6.67 / 8.20 |

## การตรวจที่รันแล้ว

| คำสั่ง | ผล |
| --- | --- |
| `npm run test:integration:mysql -- --profile-stock-analytics` | ผ่าน DTO differential ทั้ง 7 workloads, pagination, binary units, inventory ว่าง, ยอดจองเกิน signed INT และ pending line ผิด invariant พร้อมตรวจ cleanup |
| `NHF_PROFILE_STOCK_ANALYTICS_CONCURRENT=1 npm run test:integration:mysql -- --profile-stock-analytics` | ผ่าน concurrent writer differential ทั้ง 40 measured samples และตรวจ cleanup |
| `npm run test:integration:mysql -- --stock-analytics` | ผ่าน 50 tests ใน 2 files รวม Stock Analytics 7 tests และ Stock concurrency 43 tests พร้อมตรวจ cleanup |
| `npm run test -- <ไฟล์ด้านล่าง>` | ผ่าน 141 tests ใน 11 files |
| `npx prisma generate`, `npm run typecheck` | ผ่าน |
| `npx eslint <ไฟล์ที่แก้> --max-warnings=0` | ผ่าน targeted lint |
| `npm run architecture:check` | ผ่าน |

Full MySQL Integration รอบแรกพบว่า Stock Analytics fixtures ทิ้ง direct grants ของ issuer สองรายไว้ ทำให้ recipient lookup ที่อ่านจากฐานข้อมูลร่วมได้ผลเกิน assertion เมื่อรันต่อจาก Stock Analytics ทดสอบซ้ำเฉพาะสองไฟล์จนได้ failure เดียวกัน แล้วเพิ่ม teardown ที่ลบ grants เฉพาะ issuer IDs ของ Stock Analytics fixtures การรัน Stock Analytics 7 tests แล้วตามด้วย recipient lookup 2 tests บน disposable DB เดียวกันผ่านทั้งหมดและตรวจ cleanup แล้ว [Integration job รอบแรก](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45115900038/job/137498555455)

```bash
npm run test -- \
  modules/stock/domain/analytics.test.ts \
  modules/stock/application/authorization.test.ts \
  modules/stock/application/presentation-capabilities.test.ts \
  modules/stock/__tests__/canonical-default-variant.test.ts \
  modules/stock/__tests__/inventory-quantity-read.test.ts \
  modules/stock/__tests__/report-export.test.ts \
  modules/stock/infrastructure/reports/workbook.test.ts \
  __tests__/api/stock-analytics-route.test.ts \
  __tests__/api/stock-reports-export-route.test.ts \
  __tests__/api/phase-11c2c2-stock-leave-route-authorization.test.ts \
  __tests__/scripts/mysql-integration-safety.test.mjs
```

## วิธีรันซ้ำ

ใช้ Git checkout ที่มีประวัติของสาขาครบและมี Docker Engine, Docker Compose และ Node 24.22.1 เมื่ออยู่บน Windows ใช้ WSL2 กับ checkout ใน Linux filesystem

```bash
npm ci
set -o pipefail
npm run test:integration:mysql -- --profile-stock-analytics | tee /tmp/stock-analytics.log
sed -n 's/^STOCK_ANALYTICS //p' /tmp/stock-analytics.log > /tmp/stock-analytics.jsonl
NHF_PROFILE_STOCK_ANALYTICS_CONCURRENT=1 npm run test:integration:mysql -- --profile-stock-analytics | tee /tmp/stock-analytics-concurrent.log
sed -n 's/^STOCK_ANALYTICS //p' /tmp/stock-analytics-concurrent.log >> /tmp/stock-analytics.jsonl
npm run test:integration:mysql -- --stock-analytics
```

Profiler โหลด baseline, hydration-only และโค้ดปัจจุบันจาก checkout เดียวกัน พร้อม ordered Variant scan ที่ใช้ Prisma `groupBy()` เป็นตัวเปรียบเทียบ คำสั่งใช้ lifecycle เดิมที่ตรวจ identity ก่อน migrations และตรวจ cleanup ใน `finally` เก็บ samples, DTO digests, query shapes และแผนจากข้อมูลสังเคราะห์โดยไม่เก็บ raw bind parameters หรือ SQL dump [หลักฐาน JSONL](stock-analytics-profile.jsonl)

## ขอบเขตของหลักฐาน

ผลนี้มาจาก fixture สังเคราะห์บนเครื่องเดียว การกระจาย pending reservations, อัตราส่วน inactive catalog และ statistics ของ production อาจทำให้ optimizer เลือก plan ต่างกัน การทดสอบ writer commit ตรวจความสอดคล้องของข้อมูล ยังไม่ได้วัด production throughput การกัก InnoDB undo history หรือ p95 เมื่อมี concurrent writers จำนวนมาก
