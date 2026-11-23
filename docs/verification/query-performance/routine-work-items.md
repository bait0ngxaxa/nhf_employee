# Phase 1 · Routine Work Items ที่กรองช่วงวันและ timing

## กลไกและสัญญาที่ตรวจสอบ

Baseline ยืนยันว่าเส้นทางที่กรองช่วงวันก่อนแบ่งหน้า materialize Task IDs และ Occurrence graph ของทุก Task ที่ผ่าน scope แล้วคัดใน Node ในตัวอย่าง 2,500 Tasks / 25,000 Occurrences ที่ 25 รายการต่อหน้า Prisma ยังสร้าง aggregate นับ occurrences สำหรับ Task DTO แม้ serializer เส้นทางนี้ไม่ใช้ค่านั้น [Phase 0 baseline](https://github.com/bait0ngxaxa/nhf_employee/blob/099182ae49da9abba8985bc5a49e2460d951f67e/docs/verification/query-performance/README.md)

ช่วงที่ร้องขอเกิดจาก intersection ระหว่างช่วงวันที่ของผู้ใช้, timing status และวันที่เริ่มต้นที่เลือก occurrence ได้ตามปกติ หากมี Due Date ในช่วงและไม่มี Due Date ที่เลือกได้ก่อนต้นช่วง ค่า minimum จะอยู่ในช่วงเสมอ Query ใช้ Prisma `some` / `none` บน `dueDate` จริงซึ่งรวม override อยู่แล้ว `none` จำเป็นเมื่อขอบล่างอยู่หลังวันปัจจุบัน จากนั้น MySQL ใช้ `title ASC, id ASC`, offset และ limit หน้าเดียวกัน ตัวเลือกเดิมยังเลือก Due Date ต่ำสุดและ ID ต่ำสุดจาก candidates ของหน้าที่ได้ [Prisma relation filters](https://www.prisma.io/docs/orm/v6/prisma-client/queries/relation-queries)

ตัวกรองเลือก Task ใช้ conjunction กับ metadata และ authorization scope เดิม การตรวจ broad scope, focused occurrence และ fallback มาก่อนตัวกรองปกติ เมื่อมี authorized focus เดิมจะส่ง historical occurrence ได้แม้ขัด timing filter การนับ, hydrate หน้า และอ่าน occurrence ของหน้าอยู่ใน read-only Repeatable Read transaction เดียวกันเพื่อให้ pagination total และ rows มาจาก snapshot เดียวกัน การแปลงวันที่และการประกอบ payload ทำหลังออกจาก transaction [Prisma MySQL transaction isolation](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)

ให้ `T` เป็น Task ที่ผ่าน metadata/scope, `O` เป็น Occurrence ทั้งหมดของ Task เหล่านั้น, `P` เป็นขนาดหน้า และ `W` เป็น Occurrence ในช่วงของ Task บนหน้านั้น ก่อนแก้ ชั้น Node ใช้พื้นที่ `O(T + O)` และมีงาน linear สำหรับ materialization, แปลงวันและ group บวก worst-case `Σ Oᵢ log Oᵢ` สำหรับ sort ตาม Task หลังแก้ใช้พื้นที่ `O(P + W)` และงาน linear ตาม row ที่อ่านกับ `Σ Wᵢ log Wᵢ` สำหรับ selector เดิม ตัวเลขนี้นับแถวหลักของ Task/Occurrence และให้ relation fan-out แยก งานฐานข้อมูลยังขึ้นกับ selectivity, จำนวน candidate ที่ต้อง scan, count, sort และ offset MySQL ยังอาจ scan occurrences เป็นสัดส่วนกับประวัติแม้ส่งกลับเฉพาะหน้า

## ผลเปรียบเทียบก่อน–หลัง

ทั้งสอง revision รันต่อกันใน job เดียวบน Ubuntu 24.04, AMD EPYC 7763, 4 logical CPUs, RAM 15.61 GiB, MySQL 8.0.46, Node 24.22.1 และ Prisma 6.19.3 ใช้ disposable MySQL ใหม่ต่อ revision, fixture เดียวกัน, วันที่กรุงเทพฯ 23 พ.ย. 2026, 2 warm-ups และ 20 serial samples ต่อกรณี ค่า p50/p95 รวม authorization, query, processing และ serialization เทียบ SHA-256 ของ JSON DTO ทั้งหมดครบ 12 กรณี และตรวจ focus/403 กับ fixture oracle โดยตรง Profiler และ cleanup ผ่านทั้งสอง revision [Hosted comparison run](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45099094107) [Samples, plans และ digests](routine-work-items-comparison.jsonl)

| Operation | Occurrences | ก่อน p50 (ms) | หลัง p50 (ms) | ก่อน p95 (ms) | หลัง p95 (ms) | SELECT ก่อน → หลัง | Correctness |
|---|---:|---:|---:|---:|---:|---|---|
| All unfiltered control | 0 | 4.41 | 4.38 | 5.21 | 5.03 | 8 → 8 | DTO ตรงกัน |
| All upcoming | 0 | 3.72 | 4.94 | 4.33 | 5.56 | 7 → 7 | DTO ตรงกัน |
| Mine today–day 7 | 0 | 3.64 | 4.82 | 4.08 | 5.41 | 7 → 7 | DTO ตรงกัน |
| All unfiltered control | 1,000 | 34.64 | 34.81 | 37.29 | 38.26 | 18 → 18 | DTO ตรงกัน |
| All upcoming | 1,000 | 107.86 | 27.65 | 112.61 | 29.29 | 18 → 18 | DTO ตรงกัน |
| Mine today–day 7 | 1,000 | 20.16 | 13.08 | 21.08 | 16.76 | 18 → 18 | DTO ตรงกัน |
| All unfiltered control | 10,000 | 38.41 | 38.10 | 42.44 | 40.05 | 18 → 18 | DTO ตรงกัน |
| All upcoming, page 5 | 10,000 | 970.50 | 36.57 | 1,004.19 | 37.80 | 18–21 → 18 | DTO ตรงกัน |
| Mine today–day 7 | 10,000 | 112.37 | 24.94 | 113.91 | 26.47 | 18 → 18 | DTO ตรงกัน |
| All unfiltered control | 25,000 | 42.72 | 42.58 | 48.74 | 43.96 | 18 → 18 | DTO ตรงกัน |
| All upcoming, page 12 | 25,000 | 2,521.01 | 49.79 | 2,608.58 | 53.28 | 18–21 → 18–21 | DTO ตรงกัน |
| Mine today–day 7 | 25,000 | 258.48 | 28.14 | 272.20 | 28.78 | 18 → 18 | DTO ตรงกัน |
| All from today, page 12 (75% match) | 25,000 | 1,880.15 | 37.38 | 1,965.50 | 41.89 | 18–20 → 18 | DTO ตรงกัน |

กรณี 75% ใช้ runner แยก (AMD EPYC 9V74, 4 logical CPUs, RAM 15.61 GiB) โดย before และ after ยังรันคู่บนเครื่องเดียวกัน วิธีรันซ้ำคือใช้ fixture `taskCount = 2_500` ใน profiler แล้ววัด `scope: "all", page: 12, limit: 25, dueFrom: today` โดยใช้ expected rows `fixtures.filter((row) => row.shift >= 0)` [Hosted broad-filter comparison](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45099559236)

ที่ 25,000 occurrences และ `All upcoming` CPU p50 ลดจาก 2,520.98 เป็น 26.21 ms, Prisma query-event duration รวม p50 จาก 79 เป็น 22 ms และ RSS สูงสุดที่เก็บได้จาก 1,511.72 เป็น 236.05 MiB ตัวเลข RSS รวมหน่วยความจำของ process จากกิจกรรมก่อนหน้า จำนวน `SELECT` ใกล้เดิม และมี `BEGIN`/`COMMIT` เพิ่มสอง statements กับ isolation `SET` หนึ่ง statement ในกรณีฐานว่าง ค่า p95 ของ filtered ทั้งสองกรณีเพิ่ม 1.23–1.33 ms ซึ่งยอมรับเพื่อคง snapshot เดียว และเทียบผลลดลงในทุกกรณีที่มีข้อมูล ทิศทางใน unfiltered control มีทั้งเพิ่มและลด จึงไม่ตีความเป็นประโยชน์จากการเปลี่ยน query

### แผน MySQL ที่ 25,000 occurrences

- **All upcoming, page 12** เดิม SELECT Occurrence ส่ง 25,000 แถวหลัง scan/sort และแผน hydrate ยัง materialize full occurrence count ใหม่ Candidate ใช้ `routine_occurrences_dueDate_idx` อ่าน 6,250 แถวในช่วงและ 3,125 แถวในช่วงก่อนหน้า (1 loop ต่อ range, ทำซ้ำใน count และ page) แล้ว deduplicate ชุด Task IDs สำหรับ semi/anti joins. Count ได้ 625 Tasks และ root จบที่ 11.2 ms. Page sort และ offset 275 ก่อนส่ง 25 Tasks โดย root จบที่ 14.7 ms. Hydration ใช้ existing `(taskId, periodKey)` range อ่าน 250 Occurrences ของ Task เหล่านั้น, ส่ง 125 แถวหลัง date filter และไม่มี derived count จาก projection ของหน้า
- **Mine today–day 7** Candidate ใช้ `routine_task_assignees_employeeId_role_idx` หา 250 Task IDs, probe `(taskId, periodKey)` 250 loops เฉลี่ย 8 rows ต่อ loop ใน count และ page. Hydration อ่านช่วงของ 25 Tasks และส่ง 75 Occurrence rows จากเดิม 2,500; จำนวน Task ที่ตรง date คือ 125
- **All from today (75% match)** Count ใช้ table scan 25,000 Occurrences และ deduplicate จาก 9,375 future rows เป็น 1,875 Tasks, root 7.39 ms. Page ใช้ range บน `dueDate` และ sort Task ด้วย offset เดิม, root 11.2 ms. ส่ง 125 Occurrence rows สำหรับ hydrate หน้า
- `EXPLAIN ANALYZE` เป็นเวลา execution แยกแต่ละ SELECT ภายใต้ profiler และแสดง loop/rows ต่อ iterator จึงรวมตรง ๆ เป็น end-to-end หรือ `ROWS_EXAMINED` ของทุก statement ไม่ได้ ยังไม่มี lock-wait หรือ transaction-throughput benchmark ภายใต้ concurrent requests คง schema เดิมไว้เพราะผลนี้ใช้ index ที่มีอยู่แล้ว

## การตรวจ correctness

- ตรวจ baseline/candidate บน MySQL จริงด้วย DTO digest ที่ตรงกันครบทุกกรณี ทดสอบ scope `all` และ `mine`, occurrence focus ที่ข้ามวันกรองเมื่อได้รับอนุญาต, hidden focus และ all-scope 403
- เพิ่ม differential integration test สำหรับ DTO ทั้งหมดเทียบกับ unfiltered reference ครอบคลุมวันกรุงเทพฯ ที่เปลี่ยนวัน UTC, วันที่ 0/1/7/8, overrides, tie ด้วย ID, task ที่มีแต่อดีตหรือไม่มี occurrence, กรองเกินหน้าสุดท้าย, assignee scope และ focus ที่อ้าง Task ผิด
- Focused query/resolver tests 73 tests, TypeScript, targeted ESLint และ architecture check ผ่าน

## แนวทางที่ทดลองแล้วพักไว้

ทดลองแทน filter/sort ในตัวเลือกหนึ่ง Task ด้วย minimum pass แบบรักษา focus และ exact object identity เทียบ implementation จริงกับ candidate บน Node 24.22.1/Windows, 10 occurrences ต่อ Task, focus เป็น historical 10% ของ Tasks, 5 warm-ups และ 30 samples สลับลำดับสอง implementation แต่ละ sample ทำซ้ำให้เรียก selector 100,000 ครั้ง แล้ว normalize เป็นเวลาต่อ batch

| Input | Tasks ต่อ batch | ก่อน p50 / p95 (ms) | Candidate p50 / p95 (ms) |
|---|---:|---:|---:|
| เรียงเหมือน query ปกติ | 25 | 0.0090 / 0.0129 | 0.0049 / 0.0068 |
| เรียงเหมือน query ปกติ | 2,500 | 0.8900 / 1.0459 | 0.4828 / 0.6114 |
| สลับวันครบกำหนด | 25 | 0.0098 / 0.0109 | 0.0045 / 0.0059 |
| สลับวันครบกำหนด | 2,500 | 1.0356 / 1.1014 | 0.4606 / 0.4838 |

Minimum pass มีเวลา `O(n)` และพื้นที่เพิ่ม `O(1)` ต่อ Task ขณะที่ filter/sort worst-case `O(n log n)` และ `O(n)` แต่ผลที่วัดบนหน้าปกติประหยัด p95 ราว 0.006 ms จึงคง selector เดิม จัดลำดับงานจากต้นทุน materialization ที่พบจริงก่อน การทดลองนี้เป็นเวลาของ selector โดยตรงและยังไม่มีผล end-to-end ของการสลับ algorithm เพียงอย่างเดียว

## งานค้างตามผลกระทบ ความถี่ ความเสี่ยงเมื่อโต และความมั่นใจ

1. Routine Scheduler ทำงานตามรอบและเปิดหนึ่ง Serializable transaction ต่อ recurring Task โอกาสกระทบ workload สะสมสูงตามจำนวน Task แต่ยังไม่มีระยะเวลา scheduler หรือ contention จาก disposable benchmark จึงยังไม่เลือก batch หรือเพิ่ม concurrency
2. IT historical resolution มีหลักฐาน scan 37,714 event สำหรับช่วง 30 วัน แม้ได้ 1,357 groups ควรวัดความถี่การใช้รายงานและทดลอง index ตาม event/date กับทั้ง scope กว้างและแคบก่อนตัดสินใจ การเปลี่ยน deadline หรือ KPI ไม่อยู่ในผลนี้
3. Stock analytics/search มีต้นทุนที่ขึ้นกับ active variants และ pending reservations ส่วน exact/prefix-only ไม่สามารถแทนการค้น substring ข้าม fields ได้เมื่อมีผลข้อความอื่น ต้องมี workload baseline, DTO equality สำหรับ candidate และต้นทุนเขียนของ index ก่อนเสนอ production change
4. Leave, Audit, Employee และ Authorization มีความเสี่ยงที่ระบุใน Phase 0 แต่ยังไม่ทราบความถี่ ขนาด request หรือแผนตาม selectivity มากพอสำหรับจัดลำดับเหนือ Routine และ IT [รายการ audit ทั้งเจ็ดโมดูล](https://github.com/bait0ngxaxa/nhf_employee/blob/099182ae49da9abba8985bc5a49e2460d951f67e/docs/verification/query-performance/README.md)
