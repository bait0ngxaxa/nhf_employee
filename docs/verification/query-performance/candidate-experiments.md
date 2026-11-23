# ผลทดลอง Stock และ IT บน disposable MySQL

ทั้งสองงานรันบน GitHub-hosted Ubuntu 24.04 แยก environment ต่อการทดลอง ใช้ MySQL 8.0.46, Prisma 6.19.3 และ Node 24.22.1 บน 4 logical CPUs, RAM ประมาณ 15 GiB. สร้างข้อมูลสังเคราะห์หลังตรวจ database/account/server UUID ใน Compose project ของงาน แล้ว teardown และตรวจ cleanup เมื่อจบ การวัดใช้ 2 warm-ups และ 20 serial samples ต่อ operation, ใช้ nearest-rank p50/p95, วัด application call และ JSON serialization ไม่มี HTTP หรือ concurrent writers ตัวเลข query ในตารางมาจาก Prisma query events ซึ่งรวม control statements ที่ Prisma ส่ง event ออกมา สัญญาณ plans เป็นผลแยกจาก `EXPLAIN ANALYZE` บน SQL จริง ส่วน INSERT เป็น `createMany` 500 แถวต่อ sample แล้วลบ rows หลังจับเวลา `INDEX_LENGTH` เป็นค่าประมาณพื้นที่รวมของ secondary indexes ทั้งตาราง

รันซ้ำจาก SHA ของ verification branch ที่อ้างในแต่ละหัวข้อ โดย checkout แยกบน Linux ที่มี Docker Compose, รัน `npm ci` แล้วรัน `node scripts/run-mysql-integration-tests.mjs --profile-routine` ชื่อ flag มาจาก runner เดิม โดยแต่ละ SHA ผูก flag กับสคริปต์ของงานนั้น `.github/workflows/ci.yml` บน verification branch ใช้เฉพาะการ dispatch benchmark ส่วน workflow บน PR ของรายงานและ implementation ใช้ CI ปกติ

## Phase 2 · Stock

Fixture มี 10,000 Items, 20,000 Variants (16,000 อยู่ใน active Items), 50,000 Requests และ 50,000 Request Items, 90% issued และ 10% pending, 10 categories, ชื่อไทย, SKU ของ Item และ Variant และ requester สองกลุ่มที่ครอบคลุมประมาณ 1% และ 99% ของ Requests. สคริปต์ใช้ `getItems`, `getRequests` และ `readStockAnalytics` ของ repository เดิม ยืนยัน invariant ของ default variant ผ่านเส้นทางปกติและตรวจว่า actor ที่ไม่มี `ALL` เห็นแค่คำขอของตนเอง [สคริปต์และ workflow ของ run สำหรับรันซ้ำ](https://github.com/bait0ngxaxa/nhf_employee/tree/34396183/scripts) [Hosted run และ cleanup](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45100194098) [SQL, plans และ samples](stock-query-candidates.jsonl)

### ค้นหาสินค้าและคำขอ

| Operation | รากของ scope / ผลทั้งหมด | ก่อน p50 (ms) | ก่อน p95 (ms) | Query events |
|---|---|---:|---:|---:|
| ค้น `FIX-00102` | 10,000 Items → 2 | 81.72 | 87.58 | 9 |
| ค้น `FIX-00` | 10,000 Items → 1,000 | 78.01 | 92.17 | 9 |
| ค้น `กระดาษ` | 10,000 Items → 2,500 | 67.20 | 71.10 | 9 |
| ค้น `VAR-FIX-00102` | 10,000 Items → 1 | 78.62 | 81.24 | 9–10 |
| ค้น `กระดาษ` พร้อม category/active | 1,000 Items ใน category → 200 | 14.57 | 18.86 | 9 |
| ค้น Request `1000` | 50,000 Requests → 400 | 298.44 | 326.20 | 7 |

รูป query ของ Stock item คือ `(name LIKE '%…%' OR sku LIKE '%…%' OR EXISTS variant …)` สำหรับทั้ง list และ count. ค้น exact token แบบปัจจุบันอ่าน 10,000 Items และ probe `stock_item_variants_stockItemId_idx` 9,998 loops ต่อ statement เฉลี่ย 2 variant rows ต่อ loop กรณี category ใช้ `stock_items_categoryId_idx` เหลือ 1,000 Items และ 600 variant probes. Query `sku = ?` อ่านได้จุดเดียว และ `sku LIKE 'FIX-00%'` ใช้ range บน `stock_items_sku_key` ได้จริง แต่การแทน branch เดิมด้วย exact/prefix-only ไม่รักษาผล ชุด exact SKU มีชื่อสินค้าอีกรายการที่ตรงข้อความ และ numeric Request search มี 400 ผลจาก OR ซึ่งรวม project code และข้อความอื่นนอกเหนือจาก ID. ฐานข้อมูล scan 50,000 Requests ต่อทั้ง list และ count ในกรณี numeric แบบกว้าง และมีถึง 50,000 PK probes ต่อ requester join บางตัว. คง substring semantics และ 500 ms debounce ของหน้า Stock เอาไว้ และยังไม่มีหลักฐานสำหรับ Thai full-text tokenization

### ดัชนีของ StockRequest และ analytics

เพิ่ม candidate ทั้งสามพร้อมกันใน MySQL ที่ใช้แล้วทิ้ง ได้แก่ `(requestedBy, createdAt, id)`, `(status, createdAt, id)` และ `(status, reviewedAt, id)` โดย `reviewedAt` คือคอลัมน์จริงที่ Prisma map เป็น `issuedAt`. คง input เดิมและเทียบ digest ของ payload ทั้งหมดทุกคู่ รวม analytics โดย freeze `generatedAt` ไว้ที่ค่าเดียวกัน

| Operation | Fixtures / selectivity | ก่อน p50 → หลัง p50 (ms) | ก่อน p95 → หลัง p95 (ms) | Query events ก่อน → หลัง | Correctness |
|---|---|---:|---:|---|---|
| Mine, page 16 | 516 / 50,000 | 5.83 → 5.19 | 6.87 → 5.55 | 7 → 7 | DTO ตรงกัน |
| Mine, page 200 | 49,484 / 50,000 | 71.82 → 9.97 | 78.30 → 14.21 | 7 → 7 | DTO ตรงกัน |
| Issued, page 200 | 45,000 / 50,000 | 62.52 → 9.66 | 66.21 → 10.82 | 7–8 → 7 | DTO ตรงกัน |
| Inventory snapshot + May issued | 16,000 active Variants; 3,653 issued lines | 1,327.46 → 1,235.36 | 1,354.36 → 1,271.29 | 140–141 → 140–141 | DTO ตรงกัน |
| เขียน Request 500 แถว | insert batch | 45.15 → 46.07 | 56.64 → 54.26 | — | จำนวนที่เขียนเท่ากัน |

Optimizer ใช้ candidate `requestedBy` หรือ `status` กับ list scan แบบ reverse ตาม `createdAt`. สำหรับหน้า 200 อ่าน 5,000 index rows และส่ง 25 แถวโดยตัด filesort ของ list; count ยังอ่าน 49,484/45,000 entries จาก index เดิม. Analytics ใช้ candidate `(status, reviewedAt, id)` แบบ covering range อ่าน 3,653 Request rows สำหรับ issued aggregation แต่ snapshot ยังอ่าน active Variants แบบ batch, group reservations และสร้าง alert labels ตามเดิม ส่วนนี้ยังมีงานมากใน Node และ query events 140–141. Analytics DTO ตรงกันสำหรับการทดลอง index เท่านั้น การแทน snapshot ด้วย conditional aggregation ยังไม่มีผลเทียบ DTO

ขนาด secondary indexes รวมเพิ่มจาก 10,584,064 เป็น 15,335,424 bytes (+4.53 MiB หรือประมาณ 45%) โดยยังแยกต้นทุนของแต่ละ index จากผล combined DDL ไม่ได้. ผลลึก 200 หน้าผ่านสมมติฐานบาง workload และผล sparse มีขนาดเล็ก ยังไม่มี production frequency, shallow pages, single writes หรือ lock/DDL evidence จึงพัก migration ทั้งสามไว้. การทดลองถัดไปควรเปิดทีละ index, เทียบ index ที่ใช้งานอยู่และเริ่มจาก deep list ที่พบบ่อยจริง ถ้านำไปใช้ให้บันทึกการสร้างและ rollback ของ index ที่ผ่านวัดใน migration แยก โดยทดสอบการล็อก, replica impact และคง index ที่ยังใช้กับ count หรือ workload อื่น

## Phase 3 · IT historical resolution

ใช้ fixture distribution จาก [IT Analytics benchmark เดิม](../it-analytics-performance/README.md) ที่ 50,000 Tickets, 37,714 resolution events, 730 วัน, category/type/priority กระจายและมี repeat resolution. สคริปต์เรียก dashboard application query จริงโดยคง Bangkok period, configured capability และ fixed clock. เพิ่ม candidate `(kind, toStatus, occurredAt, ticketId)` เฉพาะใน disposable server เดียวกันและเทียบ complete response hash ครบทั้งสามกรณี [สคริปต์และ workflow ของ run สำหรับรันซ้ำ](https://github.com/bait0ngxaxa/nhf_employee/tree/a87af91f/scripts) [Hosted run และ cleanup](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45100048038) [SQL, plans และ samples](it-resolution-index.jsonl)

| Operation | ก่อน p50 → หลัง p50 (ms) | ก่อน p95 → หลัง p95 (ms) | Query events ก่อน → หลัง | Correctness |
|---|---:|---:|---|---|
| All 30D | 108.11 → 83.55 | 113.59 → 87.80 | 26–28 → 26–28 | DTO ตรงกัน |
| All 90D | 201.77 → 178.91 | 207.24 → 189.92 | 26–28 → 26–28 | DTO ตรงกัน |
| Type + category 30D | 41.84 → 30.68 | 44.37 → 31.91 | 27 → 27 | DTO ตรงกัน |
| เขียน event 500 แถว | 20.98 → 22.03 | 29.37 → 28.82 | — | จำนวนที่เขียนเท่ากัน |

All 30D เปลี่ยนจาก full index scan 37,714 event rows ที่ root 25.7 ms เป็น covering range scan 1,538 rows และ temporary GROUP BY 1,357 tickets ที่ root 1.01 ms. All 90D เปลี่ยนเป็น 4,634 rows และ 4,065 groups ที่ root 2.98 ms. Type + category 30D เปลี่ยนจาก category-first ที่ probe event 3,846 ครั้ง เป็น event-first ที่ probe Ticket PK 1,538 ครั้ง ได้ 149 groups เท่าเดิม. Snapshot 30D ใช้ transaction p95 จาก 113.45 เป็น 87.69 ms โดยคงรูป query และ isolation เดิม

พื้นที่ index รวมเพิ่ม 1,572,864 bytes (1.50 MiB หรือราว 41%) และ p50 ของ synthetic write batch เพิ่ม 1.05 ms. ผลสนับสนุน candidate สำหรับ workload อ่านประวัติ แต่ fixture ไม่ครอบคลุม event kind ที่หลากหลายมาก, scope ที่แคบกว่ากรณี type + category, ขนาดจริง หรือ contention จาก writes. จึงยังไม่มี production migration การทดลองถัดไปควรเทียบ selectivity ที่กระจายกว่าและวัด write transaction ทีละ event ก่อนพิจารณา rollout. คง `MIN(occurredAt)` ต่อ ticket ภายใน period และ metrics อื่นตามเดิม
