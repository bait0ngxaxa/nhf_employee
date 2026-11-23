# IT Analytics · Historical resolution

## ข้อสรุป

**DEFER** การเพิ่มดัชนี production จาก `main` ที่ `32c226e83d8cad36465e1d78d46f06efe902ed73` ดัชนี `(kind, toStatus, occurredAt, ticketId)` ลดงานของ MySQL ในรายงานแบบกว้างอย่างชัดเจน ที่ 50,000 Tickets และ 154,471 events รายงาน 30D อ่าน 1,165 แถวจากเดิม 154,471 แถว และ Dashboard p95 ลดจาก 309.07 เป็น 159.14 ms ในรอบสังเคราะห์นี้ ดัชนีเพิ่มพื้นที่ secondary index 5.45 MiB หรือ 33.9% และเวลาที่วัดบน Windows/WSL มีความแปรปรวนในบางขอบเขต โดยเฉพาะผลรวม Dashboard ที่กรองแคบ ต้นทุนบนดิสก์จริงและความถี่การอ่านแบบกว้างยังไม่ทราบ จึงคง query, Prisma schema และ migrations เดิมไว้

## สาเหตุและดัชนีเดิม

เส้นทาง `getITAnalyticsDashboard` ตรวจ workforce และ scope `ALL` ของ `it.analytics.read` ภายใน RepeatableRead จากนั้น repository เรียก Prisma `groupBy(ticketId, MIN(occurredAt))` โดยคัด `STATUS_CHANGED`, `RESOLVED` และช่วง `[startAt, endAt)` ก่อนรวมกลุ่ม แล้วอ่านเฉพาะ ID, เวลาเปิด Ticket และ priority ปัจจุบันของ Ticket ที่ผ่านเกณฑ์ การกรอง category/type ใช้ข้อมูล Ticket ปัจจุบันใน snapshot เดียวกัน ส่วน backlog และการจัดกลุ่มอื่นเป็นคนละคำสั่ง

`(ticketId, occurredAt, id)` เรียงตาม Ticket จึง aggregate แบบ streaming ได้ แต่ในรายงานกว้างไม่มีค่า `ticketId` นำหน้าให้จำกัดช่วง และต้องอ่าน record เพื่อประเมิน `kind` กับ `toStatus` สำหรับ event ที่ไม่อยู่ในรายงานด้วย ใน scope แคบ optimizer เริ่มจาก index category ของ Ticket แล้ว probe ดัชนีเดิมของ event ต่อ Ticket ได้ ดัชนีนี้ยังรองรับ FK และการอ่านประวัติตาม Ticket จึงอยู่ครบในทุกการทดลอง [Prisma schema](../../../prisma/schema.prisma) [Migration เดิม](../../../prisma/migrations/20260924100000_add_it_ticket_domain/migration.sql)

## วิธีวัด

- ทำซ้ำการทดลองเดิมด้วย fixture ที่มีเฉพาะ resolution events ตาม [การทดลอง Phase 3](candidate-experiments.md#phase-3--it-historical-resolution) แล้วแยกจาก matrix ที่มีหลายชนิด event
- รันทั้งสองงานบน WSL2, Docker Compose, MySQL 8.0.46, Prisma 6.19.3, Node 24.22.1, Intel Core i5-8300H, 8 logical CPUs และ RAM ที่ WSL เห็นประมาณ 3.75 GiB ใช้ tmpfs เดิมของ Compose คนละ disposable instance ต่อ run และไม่ใช้ข้อมูลหรือ credential ของแอป
- เวลาอ้างอิงหลักคือ `2026-11-07T03:00:00Z` ใช้ 7D, 30D และ 90D ผ่าน application query จริง สถานการณ์ 7D หนาแน่นและช่วงว่างเลื่อนเฉพาะนาฬิกาที่ฉีดให้แอป ทุก variant ใช้ fixture และนาฬิกาเดียวกัน 2 warm-ups และ 20 serial samples ต่อกรณี ใช้ nearest-rank percentile
- รอบหลักทดสอบ baseline → ดัชนีเต็ม → ดัชนีแคบทีละตัว `ANALYZE TABLE` ก่อนวัด ตั้งชื่อดัชนีทดลองชื่อเดียวและถอดออกก่อนตัวถัดไป รันการทดสอบ write หลัง read ของ variant นั้น การวัดมีลำดับคงที่และใช้ warm cache จึงมีความเสี่ยงจาก cache, host scheduling และเวลาที่ต่างกันระหว่าง variant
- Application latency เริ่มก่อนเรียก service และรวม JSON serialization จบก่อน hash/assert ไม่รวม HTTP และ session transport วัดช่วง `$transaction` และเวลานอก callback แยกกัน Prisma query extension วัดรอบแต่ละ operation พร้อมค่าที่ส่งกลับ เวลา composition คือหลัง Prisma operation สุดท้ายถึงจบ transaction callback ส่วน `other` รวม Prisma operations ที่เหลือ รวม workforce และ authorization ตัวเลข percentile แต่ละคอลัมน์คำนวณแยกกัน
- ใช้ SQL ที่ Prisma ส่งจริงกับค่าพารามิเตอร์สังเคราะห์ใน memory เพื่อทำ `EXPLAIN ANALYZE`, `EXPLAIN FORMAT=JSON` และเก็บ Performance Schema แยกจากรอบจับเวลา ค่า `ROWS_EXAMINED` เป็นตัวนับของ statement และจำนวนแถวของ iterator แสดงที่แต่ละ node ใน plan เครื่องมือไม่บันทึก parameter payload, ค่า Ticket จริง หรือ DTO รายแถว [MySQL EXPLAIN](https://dev.mysql.com/doc/refman/8.0/en/explain.html) [Prisma Client v6 query logging](https://github.com/prisma/web/blob/v6/content/200-orm/500-reference/050-prisma-client-reference.mdx)

## ทำซ้ำการทดลองเดิมบน main

ที่ 50,000 Tickets ได้ 37,714 events และ SHA-256 ของ DTO ตรงกับ artifact เดิมทั้งสามกรณีทั้งก่อนและหลังเพิ่มดัชนี All Tickets 30D ยังคงเปลี่ยนจาก index scan 37,714 แถวเป็น covering range scan 1,538 แถว พื้นที่ secondary index เท่ากับผลเดิมทุก byte ตัวเลขต่อไปนี้เป็น A/B จาก WSL เครื่องเดียวกัน ส่วนตัวเลขเดิมมาจาก GitHub-hosted runner และใช้ประกอบการตรวจความสอดคล้องของแผนและ fixture [ผลทดลองเดิม](it-resolution-index.jsonl) [ผลทำซ้ำ](it-historical-resolution-reproduction.jsonl)

| Scope | Baseline p50 / p95 (ms) | ดัชนีเต็ม p50 / p95 (ms) |
| --- | ---: | ---: |
| All 30D | 177.10 / 184.30 | 138.25 / 144.86 |
| All 90D | 314.00 / 502.17 | 275.98 / 294.83 |
| Type + category 30D | 73.65 / 80.38 | 55.85 / 66.59 |
| Insert 500 resolution events | 34.41 / 46.57 | 41.81 / 47.06 |

## Cardinality และแผนจาก fixture หลายชนิด

| Tickets | Events ทั้งหมด | Resolution events | Tickets มี resolution 1 ครั้ง | Tickets มี resolution 2 ครั้ง |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 30,899 | 7,119 | 5,331 | 894 |
| 50,000 | 154,471 | 35,593 | 26,665 | 4,464 |
| 100,000 | 308,926 | 71,178 | 53,332 | 8,923 |

Fixture ครอบคลุม 730 วัน รวม creation, assignment, category, priority และ status changes ที่ 50,000 Tickets ขอบเขต 30D แบบกว้างพบ 1,165 events ที่ผ่านเงื่อนไขและ 1,028 distinct Tickets ส่วน 90D พบ 4,137 events และ 3,627 Tickets ตัวอย่าง 7D แบบเบาบางมี 63 events และ 63 Tickets เทียบกับช่วง 7D ที่ตั้งใจให้หนาแน่นมี 5,435 events และ 4,762 Tickets ในกรณี 30D มี resolution events นอกช่วง 34,428 แถว และ 118,878 แถวเป็น kind/status อื่น รายละเอียดตามชนิด/status, type/category, timing ของ composition/serialization, RSS ของ Node และทั้ง 12 scopes อยู่ใน artifact [WSL profile JSONL](it-historical-resolution-profile.jsonl)

ตัวอย่าง All 30D ที่ 50,000 Tickets ด้านล่างย่อจาก `EXPLAIN ANALYZE` โดยคงจำนวนแถวและ loops ของ iterator พร้อม artifact สำหรับแผนเต็ม

```text
Baseline
  Group aggregate: min(occurredAt)                        rows=1028 loops=1
    Filter kind, toStatus, occurredAt                    rows=1165 loops=1
      Index scan (ticketId, occurredAt, id)               rows=154471 loops=1
      cost=15549 estimated rows=154284, actual time=2.4..123 ms

Full candidate
  Scan temporary aggregation                             rows=1028 loops=1
    Aggregate using temporary table                      rows=1028 loops=1
      Covering index range (kind, toStatus, occurredAt)   rows=1165 loops=1

Narrow candidate
  Scan temporary aggregation                             rows=1028 loops=1
    Aggregate using temporary table                      rows=1028 loops=1
      Filter kind over non-covering range                 rows=1165 loops=1
        Index range (toStatus, occurredAt)                rows=1165 loops=1
```

| 50,000 Tickets | เดิม | เต็ม `kind, toStatus, occurredAt, ticketId` | แคบ `toStatus, occurredAt, ticketId` |
| --- | ---: | ---: | ---: |
| Dashboard 30D p50 / p95 (ms) | 289.73 / 309.07 | 145.16 / 159.14 | 148.95 / 165.84 |
| Dashboard 90D p50 / p95 (ms) | 445.06 / 514.96 | 288.67 / 309.19 | 297.80 / 324.17 |
| Dashboard 7D เบาบาง p50 / p95 (ms) | 238.93 / 473.11 | 89.69 / 95.43 | 89.67 / 109.47 |
| Dashboard 7D หนาแน่น p50 / p95 (ms) | 370.53 / 521.37 | 216.98 / 335.74 | 222.85 / 319.10 |
| Type + category 30D p50 / p95 (ms) | 59.00 / 62.32 | 96.96 / 162.99 | 58.82 / 63.03 |
| Rare + type 30D p50 / p95 (ms) | 26.52 / 29.26 | 51.51 / 60.69 | 27.00 / 29.71 |
| 30D Prisma aggregate p50 / p95 (ms) | 151.87 / 168.47 | 6.90 / 8.96 | 8.15 / 10.75 |
| 30D MySQL aggregate (ms, diagnostic sample) | 146.35 | 1.64 | 3.36 |
| 30D MySQL aggregate rows examined / sent | 154,471 / 1,028 | 1,165 / 1,028 | 1,165 / 1,028 |
| 90D MySQL aggregate rows examined / sent | 154,471 / 3,627 | 4,137 / 3,627 | 4,137 / 3,627 |
| 30D MySQL temporary tables / disk temporary tables | 0 / 0 | 1 / 0 | 1 / 0 |
| 30D SELECTs ต่อ Dashboard | 24 | 24 | 24 |
| 30D hydration p50 / p95 (ms) | 12.92 / 13.53 | 12.40 / 17.05 | 12.89 / 15.08 |
| 30D operations ที่เหลือ p50 / p95 (ms) | 99.79 / 119.61 | 101.36 / 110.85 | 101.84 / 109.90 |
| 30D transaction overhead p50 / p95 (ms) | 2.00 / 2.20 | 2.10 / 2.71 | 2.14 / 5.03 |

Aggregate คิดเป็นประมาณ 52% ของ Dashboard 30D จากอัตราส่วน median baseline และลดเหลือประมาณ 5% ด้วยดัชนีเต็ม Hydration ต้องโหลด Ticket จำนวนเท่าเดิม กรณี 90D baseline median ของ hydration อยู่ที่ 47.01 ms และของ operations ที่เหลือ 156.81 ms แม้ดัชนีจะช่วย scan แต่ไม่ลดปริมาณ metadata หรือจำนวนคำสั่ง ประสิทธิภาพของดัชนีแคบต่ำกว่าดัชนีเต็มใน SQL 30D/90D เพราะต้องอ่าน record เพื่อตรวจ `kind` และพื้นที่จริงที่จัดสรรใน fixture ขนาด 50k เท่ากัน

| All 30D ตามขนาด fixture | Baseline p50 / p95 (ms) | เต็ม p50 / p95 (ms) | แคบ p50 / p95 (ms) | Rows examined เดิม → เต็ม |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 80.51 / 85.18 | 52.15 / 59.17 | 51.80 / 58.42 | 30,899 → 237 |
| 50,000 | 289.73 / 309.07 | 145.16 / 159.14 | 148.95 / 165.84 | 154,471 → 1,165 |
| 100,000 | 643.01 / 1,455.58 | 267.05 / 293.33 | 266.87 / 330.21 | 308,926 → 2,327 |

รอบ 100k จบครบทุก variant และ runner ยืนยัน teardown ระหว่าง baseline ของรอบนี้ WSL มี memory pressure และใช้ swap ทำให้ p95 เปรียบเทียบเชิงสาเหตุได้จำกัด จำนวนแถวที่ MySQL ตรวจและความเท่ากันของ DTO เป็นหลักฐานที่ตรงกว่าขนาดของ latency delta ในรอบนั้น

Scope `rare-30D` มี 51 Tickets ใน category และ 17 Tickets หลังกรอง type ไม่มีผลในช่วงนั้น ทั้งสาม variants ยังคงเริ่มจาก Ticket และวัด 51 rows examined การเพิ่มขึ้นของ p95 ของ Dashboard เต็มเกิดพร้อมเวลาของ operations อื่นที่เพิ่มจาก 25.57 เป็น 51.55 ms ในรอบที่ใช้ดัชนีเต็ม โดย work count ของ aggregate เท่าเดิม จึงแยกเหตุจากความแปรปรวนของเครื่องไม่ได้ กรณี combined 30D แบบมีผลจริง เดิมตรวจ 2,615 rows ส่วนดัชนีเต็มตรวจ 2,330 rows ผ่าน event-first แล้ว join Ticket ด้วย PK ในบางกรณี MySQL เลือกแผนคนละแบบเองตาม selectivity

ทดลอง `JOIN_PREFIX(it_ticket_events)` บน SQL เดิมและมีเฉพาะดัชนีเดิม ที่ 50k combined 30D แถวที่ตรวจเพิ่มจาก 2,615 เป็น 155,636 และ MySQL sample เพิ่มจาก 6.27 เป็น 57.50 ms ส่วน rare เพิ่มจาก 51 เป็น 155,636 แถว ผล aggregate ตรงกันเมื่อเรียงตาม Ticket ID แผนนี้ไม่คุ้มสำหรับ scope แคบ และไม่มีเหตุให้เปลี่ยน query shape ในรอบนี้

## Write, storage และ contention

ใช้ Prisma repository insert แบบคืน ID สำหรับ single event, transaction Serializable ที่อ่าน Ticket และตรวจ version ก่อนแก้ Ticket พร้อมสร้าง status/category events, `createMany` 100/500 events, 4 writers บน Ticket คนละใบ และ 4 writers คู่กับ Dashboard 30D ที่กรอง category ในชุดเดียวกัน แถวเขียนสังเคราะห์ครอบคลุม creation, resolve, reopen, waiting, priority, category และ assignment เครื่องมือจับเวลาทั้ง operation รวม commit ส่วน cleanup อยู่นอกช่วงวัด แบบผสมวัดทั้ง latency ของกลุ่ม writer และของ Dashboard

| 50,000 Tickets, p50 / p95 (ms) | เดิม | เต็ม | แคบ |
| --- | ---: | ---: | ---: |
| Single event | 2.76 / 8.41 | 2.56 / 3.60 | 2.34 / 2.85 |
| Small transaction | 7.16 / 9.00 | 8.01 / 10.37 | 7.26 / 8.73 |
| Batch 100 | 6.64 / 7.52 | 7.35 / 8.23 | 7.17 / 7.92 |
| Batch 500 | 25.56 / 35.48 | 27.68 / 33.80 | 28.70 / 29.94 |
| 4 concurrent transactions | 11.97 / 14.22 | 12.50 / 14.58 | 13.08 / 15.84 |
| Mixed writer group | 12.25 / 13.36 | 12.50 / 14.72 | 12.62 / 18.78 |
| Mixed Dashboard | 210.50 / 228.38 | 156.36 / 175.51 | 154.64 / 194.43 |
| Secondary index bytes | 16,875,520 | 22,593,536 | 22,593,536 |

ดัชนีเต็มทำให้ median ของ small transaction เพิ่ม 0.85 ms และ batch 100 เพิ่ม 0.71 ms ในรอบนี้ ขณะที่ single-event p95 ที่ดูดีขึ้นมี baseline tail สูงผิดจาก median และลำดับการทดลองทำให้ตีความเป็น write speedup ไม่ได้ กลุ่ม 4 writers ได้ประมาณ 491 / 466 / 455 events/s ตามลำดับ รอบหลักไม่พบ failed operation หรือ InnoDB row lock waits ในกรณี 50k ที่รายงาน การวัดแยก Ticket ต่อ writer จึงยังไม่บอกความเสี่ยงของการแย่ง lock บน Ticket เดียวกัน ใช้ tmpfs จึงอ่าน redo/bytes เป็นตัวนับงานของ InnoDB ได้ แต่ยังอ้าง latency ของ storage production ไม่ได้

พื้นที่ในตารางเป็นค่า `INDEX_LENGTH` ของ secondary indexes รวมใน InnoDB ซึ่งขึ้นกับการจัดสรร page ของ fixture ที่ 100k ดัชนีเต็มเพิ่มประมาณ 9.47 MiB การปัดขึ้นตาม page ทำให้ขนาดของดัชนีแคบกับดัชนีเต็มใกล้กันแม้มีจำนวนคอลัมน์ต่างกัน

## รันยืนยันที่ 100,000 Tickets บน GitHub-hosted runner

ใช้ Ubuntu 24.04, 4 logical CPUs, RAM ประมาณ 15.3 GiB และ MySQL/Prisma/Node เวอร์ชันเดียวกับ WSL วัดใน runner เดียวกันครบ 13 scopes ต่อ variant รวม category แคบที่ยังมีผล 6 Tickets และเปิด Performance Schema สำหรับ CPU, memory และ error counters เพิ่มเติม รอบนี้ยืนยันทั้งผลต่อการอ่านแบบกว้างและแผนสำหรับ scope แคบในสภาพแวดล้อมที่ไม่มีอาการ memory pressure แบบ WSL การสร้างและถอนดัชนีเต็มใช้ 298.78 และ 5.63 ms ตามลำดับ และ runner ยืนยัน cleanup [Hosted run](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45129474440) [Hosted profile JSONL](it-historical-resolution-hosted.jsonl)

| Hosted 100k | เดิม | เต็ม | แคบ |
| --- | ---: | ---: | ---: |
| All 30D p50 / p95 (ms) | 388.66 / 397.09 | 172.18 / 176.83 | 174.25 / 180.41 |
| All 90D p50 / p95 (ms) | 591.71 / 600.61 | 377.76 / 383.57 | 386.70 / 393.84 |
| Combined 30D p95 (ms) | 61.37 | 53.18 | 53.86 |
| Rare category 90D p95 (ms) | 16.84 | 16.94 | 16.82 |
| Rare category 90D rows examined / sent | 135 / 6 | 135 / 6 | 135 / 6 |
| All 30D MySQL aggregate / CPU (ms, diagnostic sample) | 220.67 / 220.64 | 1.59 / 1.59 | 5.24 / 5.23 |
| All 30D rows examined / sent | 308,926 / 2,054 | 2,327 / 2,054 | 2,327 / 2,054 |
| All 90D rows examined / sent | 308,926 / 7,261 | 8,280 / 7,261 | 8,280 / 7,261 |
| Single event p50 / p95 (ms) | 1.03 / 2.05 | 0.96 / 1.13 | 0.89 / 1.07 |
| Small transaction p50 / p95 (ms) | 3.38 / 3.63 | 3.32 / 3.64 | 3.34 / 3.69 |
| Batch 100 p50 / p95 (ms) | 3.91 / 4.17 | 4.04 / 4.24 | 4.03 / 4.18 |
| Batch 500 p50 / p95 (ms) | 16.10 / 16.83 | 16.62 / 21.15 | 16.62 / 18.27 |
| 4 writer transactions p50 / p95 (ms) | 7.03 / 8.44 | 6.01 / 9.77 | 4.89 / 6.70 |
| Mixed Dashboard p95 (ms) | 262.05 | 171.99 | 179.81 |

ไม่มี InnoDB row lock waits, MySQL deadlock errors, lock timeouts หรือ write failures ในทั้งสาม variants ของรอบ hosted และ profiler ไม่ retry การเขียน พื้นที่ memory ที่ Performance Schema รายงานหลังจบ workload อยู่ประมาณ 1.11 GB ทั้งสาม variants เป็นค่าปัจจุบันของ allocation ที่ instrument ไว้ ไม่ใช่ peak memory ตัวนับ redo, I/O, rows inserted และ connections อยู่ใน artifact พบร่องรอย write tail เพิ่มใน batch 500 และ 4 writers ของดัชนีเต็ม แต่ข้อมูล 20 samples ต่อ variant ยังไม่พอแยกต้นทุนของดัชนีจาก noise ใน tail ส่วน p95 ที่เพิ่มใน rare scope บน WSL ไม่เกิดซ้ำในขนาดใกล้เคียงบน hosted runner จึงไม่มีหลักฐานว่ากรณีนี้เปลี่ยนแผนหรือมี regression ของ event aggregation

## ความถูกต้องและสิทธิ์

- รอบ WSL และ hosted เปรียบเทียบ DTO ทั้งชุดด้วย deep equality และ SHA-256 รวม 147 ชุด size/variant/scope และ 3,234 dashboard calls รวม warm-up เทียบ baseline ของ fixture, filter และเวลาชุดเดียวกัน โดยไม่ตัด field ออก จึงตรวจ counts, trends, averages, priority, first response, backlog และ breakdown ทุกมิติด้วย
- Integration fixture ตรวจเหตุการณ์ซ้ำ, resolve → reopen → resolve, earliest resolution ต่างกันระหว่าง 7D และ 30D, Bangkok midnight ขอบล่างรวมและขอบบนไม่รวม, ประวัติเก่านอกช่วง 512 events, scope แบบ type/inactive category, uncategorized และผลว่าง พร้อมเทียบ DTO ก่อนและหลังเพิ่มเหตุการณ์ที่ไม่ควรเปลี่ยนผล
- Integration transaction เปิด snapshot แล้วให้ writer อีก connection commit การ reopen, resolve, เปลี่ยน category, priority และเพิ่ม events ก่อนอ่าน Dashboard จริง ผลใน transaction เดิมเท่ากับ DTO ก่อน commit และ request ใหม่เห็นค่าปัจจุบัน การทดสอบนี้ตรวจ snapshot โดยควบคุมลำดับ commit ส่วน mixed benchmark วัด latency ระหว่างเขียนจริง
- ครอบคลุม active analytics-only, ไม่มี capability, ADMIN ที่ไม่ได้รับ grant, ticket-only, analytics ที่ไม่มี `ALL`, บัญชี inactive, workforce inactive และ filter ไม่ถูกต้อง Unit tests ยืนยันการปฏิเสธก่อนอ่าน aggregate และก่อนเปิด transaction เมื่อ filter ไม่ผ่าน
- Focused local verification ผ่าน 87 unit tests จาก 5 ไฟล์และ 30 integration tests จาก IT Analytics และ Ticket workflow บน MySQL disposable รวมถึง teardown ผ่าน architecture check, TypeScript check และ ESLint ของไฟล์ที่แก้

## การตัดสินใจและขั้นตอนก่อน rollout ในอนาคต

ดัชนีเต็มเป็น candidate ที่มีหลักฐานรองรับมากที่สุดสำหรับการอ่านแบบกว้าง ส่วนดัชนีแคบไม่ให้ประโยชน์ด้านพื้นที่ใน fixture หลักและเพิ่มงาน lookup ยังไม่อนุมัติ migration เพราะต้องยืนยันต้นทุนต่อ workload จริง ความแปรปรวนของกรณี scoped และความเสี่ยง DDL ภายใต้ write load โดยเฉพาะกรณีมี transaction ค้าง รอบทดลองทำ add/drop แบบ `ALGORITHM=INPLACE, LOCK=NONE` บนฐาน disposable เวลาเพิ่มที่ 50k คือ 365.33 ms (เต็ม) และ 403.51 ms (แคบ) ค่านี้วัดตอนที่ไม่มี concurrent DML ระหว่างสร้างดัชนี MySQL ยังต้องใช้ metadata lock แม้ระบุ `LOCK=NONE` [MySQL Online DDL concurrency](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-performance.html) [MySQL Online DDL limitations](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-limitations.html)

ก่อนเสนอ migration แยก ให้ตรวจข้อมูลรวมแบบไม่เปิดเผย Ticket ได้แก่สัดส่วนชนิด/status และช่วงเวลา, scope ที่ใช้จริง, อัตราอ่านต่อเขียนและ active transaction ที่ยาวที่สุด จากนั้นใช้ข้อมูลสังเคราะห์ที่มีสัดส่วนใกล้เคียง ทดสอบ A/B แบบสลับลำดับบน storage ที่เทียบเคียงได้ และวัด repeat รอบ scoped, concurrent writes, retry และ replication lag ใช้เกณฑ์ p95 และ headroom ของระบบจริงตัดสินผล

ถ้าผลรองรับ rollout ให้ตรวจรายการต่อไปนี้ก่อนขออนุมัติ deployment

- ทดสอบ fresh migrate และ upgrade บน disposable database ตรวจชื่อและลำดับคอลัมน์กับ Prisma schema และคงดัชนีเดิม
- ตรวจพื้นที่ index และ DDL temp space, redo, replica lag รวมถึง metadata locks และเวลาที่ใช้ abort ระหว่าง staging run ที่มี DML และ transaction ค้าง
- กำหนดเกณฑ์หยุดและช่วงดำเนินงานจาก write p95, lock waits และ replica lag ของระบบจริง
- จัดทำ forward migration สำหรับถอนดัชนี และตรวจ migration state กับ Prisma schema หลัง rollback

รอบนี้จบที่การทดสอบ add/drop บน disposable instance

## รันซ้ำ

ใช้ checkout ที่มี Node 24.22.1, Docker Compose และ MySQL image ที่ตรวจว่าเป็น 8.0.46 สคริปต์ยืนยัน UUID, database และ account ก่อน migrations, profiling และ DDL และตรวจ teardown หลังเสร็จ

```bash
set -o pipefail
npm ci
TZ=UTC npm run test:integration:mysql -- --profile-it-resolution | tee it-resolution.log
sed -n 's/^IT_RESOLUTION_PROFILE //p' it-resolution.log > it-resolution.jsonl
```

ตั้ง `NHF_IT_RESOLUTION_SIZE` เป็น `10000`, `50000` หรือ `100000` เมื่อต้องการวัดขนาดเดียว ทำซ้ำ fixture เดิมโดยใช้โค้ด baseline และเรียก profiler จาก SHA เดิมผ่าน verified Compose lifecycle ใน directory ชั่วคราว

```bash
set -euo pipefail
legacy_dir=$(mktemp -d)
git archive 32c226e83d8cad36465e1d78d46f06efe902ed73 | tar -x -C "$legacy_dir"
git show a87af91f:scripts/profile-it-resolution-index.mjs > "$legacy_dir/scripts/profile-it-resolution-index.mjs"
(
  cd "$legacy_dir"
  npm ci
  sed -i 's/profile-stock-analytics.mjs/profile-it-resolution-index.mjs/' scripts/run-mysql-integration-tests.mjs
  TZ=UTC npm run test:integration:mysql -- --profile-stock-analytics | tee it-legacy.log
  sed -n 's/^IT_INDEX_PROFILE //p' it-legacy.log > it-historical-resolution-reproduction.jsonl
)
```

ตรวจผลออกของคำสั่งและข้อความ `Cleanup verified` ของ runner ในทั้งสองกรณี
