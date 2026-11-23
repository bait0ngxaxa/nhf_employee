# Routine Scheduler performance

## ขอบเขตและ baseline

เปรียบเทียบกับ `main` ที่ `f913204e57d576d74c06e252f76e4cb19bcd3165` หลัง PR #23 และ #24 บน MySQL 8 แบบ disposable ด้วยข้อมูลสังเคราะห์. งานนี้ครอบคลุม occurrence generation, reconciliation และพฤติกรรม reminder/outbox ที่ scheduler เรียกใช้.

การรัน baseline 250 Tasks ซ้ำได้ p50 1,138.51 ms, p95 1,273.58 ms, 1,509 SELECTs, 250 DELETEs และ BEGIN/COMMIT 250/250 ใน sample ที่แยก SQL ตามตาราง. ผลหลักสอดคล้องกับ baseline เดิมที่ p95 1,277.49 ms. รอบ baseline ที่เพิ่ม server instrumentation วัด CPU sampling แยกได้ 224 จาก 1,205 samples ภายใต้ `toBangkokCalendarDate`. จำนวน samples นี้รวมเวลารอและ overhead รอบการวัด จึงใช้ระบุจุดที่ควรทดลองลดงาน. [รันยืนยัน baseline](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45103984505) · [รัน baseline พร้อม CPU profile](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45104325009)

## Root cause และลำดับการทำงานเดิม

| ขั้นตอน | SQL ต่อ recurring Task ใน steady state ของ fixture | เหตุผลที่ต้องทำหรือผลที่พบ |
|---|---:|---|
| Active Task discovery | 1 ต่อรอบ | อ่านเฉพาะ IDs ของ active non-manual Tasks |
| โหลด Task และ generation inputs | 3 SELECT | Task row, task assignees, active reminder rules. ใช้ตรวจสถานะล่าสุด, สร้าง assignee snapshot เมื่อสร้าง occurrence และคำนวณ generation window จาก rule ที่กว้างที่สุด |
| ตรวจ reconciliation safety | 1 SELECT | ตรวจ effective และ original due dates นอกขอบเขต. การคำนวณ schedule และ contract window รันใน Node |
| อ่าน future occurrence | 2 SELECT | หนึ่ง SELECT อ่าน rows ตาม task และ effective due date อีก SELECT โหลด occurrence assignees ถึงแม้ scheduler ส่ง `previousAssignees` เป็น `undefined` |
| Reconcile stale periods | 1 DELETE | ตรวจ valid period keys แล้วเรียก DELETE เสมอ ใน fixture steady state ไม่มีแถวถูกลบ |
| Lookup / update / upsert | 0 ใน fixture steady state | Lookup ด้วย unique key เมื่อไม่พบในช่วง future เช่น มี override ย้าย occurrence ไปอดีต. Update เมื่อ dates/version เปลี่ยน และ upsert เมื่อยังไม่มี occurrence |
| Transaction | 1 SET, 1 BEGIN, 1 COMMIT | Prisma interactive transaction ที่ Serializable. แต่ละ Task เริ่มหลัง Task ก่อนหน้าจบ |
| Reminder discovery, eligibility และ recipients | ระดับรอบ | โหลด occurrence ตั้งแต่วันนี้ พร้อม Task, rules, occurrence assignees, employee และ user. ประเมินเวลาเริ่มส่งและเวลาหมดอายุใน Node และดึง ALL-reader scope เมื่อมีกฎที่ใช้ |
| Outbox | ระดับรอบ | Batch อ่าน unique event keys แล้ว INSERT เฉพาะ candidates ที่ไม่พบ. Unique key ป้องกัน concurrent insert ซ้ำ. Contract reminders ทำขั้นตอนแยกตาม Task และวันหมดสัญญา |

จุดที่ตัดออกได้จาก call chain คือการอ่าน relation เมื่อไม่มี previous template ให้เปรียบเทียบ และ DELETE ที่พิสูจน์ได้ว่าไม่มีแถวเข้าเงื่อนไข. ฝั่ง Node สร้าง formatter ใหม่ทุกครั้งที่อ่าน due date, original date หรือ Bangkok date ของรอบ scheduler.

## การเปลี่ยนแปลงและหลักประกัน

1. อ่าน occurrence assignees เมื่อมี `previousAssignees` เท่านั้น ทั้ง future read และ fallback unique lookup. Mutation ที่แก้ template ยังอ่าน snapshot เพื่อแยกว่า occurrence ใช้ template เดิมหรือถูกปรับราย occurrence. Task assignees ยังถูกอ่านเพื่อใช้สร้าง occurrence และ scheduler ยังอ่าน recipient graph จาก occurrence ที่บันทึกแล้ว.
2. ข้าม recurring stale DELETE เมื่อช่วง future ที่อ่านครอบคลุมช่วง DELETE และทุกแถวที่อ่านมี period key ที่ตรงกับ candidate. กรณีช่วงไม่ครอบคลุมหรือเจอ stale key ใช้ predicate SQL เดิม รวมถึงกฎ collation เดิม. การ cleanup สำหรับ manual task ยังใช้ path ของ manual. ทุก call site ของ generation ใช้ Serializable. การอ่านช่วงภายใน InnoDB transaction จึงให้ shared next-key locks ซึ่งคุ้มครอง rows และช่องว่างของช่วงก่อน commit. [MySQL 8.0 isolation](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html) · [InnoDB next-key locks](https://dev.mysql.com/doc/refman/8.0/en/innodb-next-key-locking.html)
3. ใช้ `Intl.DateTimeFormat` ตัวเดียวต่อ module ด้วย locale, time zone และ options เดิม. ทุก Date ยังผ่าน `formatToParts` และใช้การอ่าน year/month/day แบบเดิม.

ที่ยังต้องทำทุกรอบคือ validation ของ horizon, safety reads, การสร้าง candidate sets, ตรวจ due dates, original due dates, overrides และ versions. การเห็น version ตรงกันเพียงอย่างเดียวไม่รับประกันว่า persisted state ตรงกับ candidate. มี lookup สำรองสำหรับ occurrence ที่ effective due date อยู่นอกชุด future และคง upsert กับการรับมือ unique conflicts. Reminder discovery และ contract reminders รักษาช่วงเดิม เพราะการลดช่วงส่งผลต่อ scheduler counters และอาจตัด rules ที่มี horizon ยาว. งานนี้ประเมินสอง scheduler ที่ overlap กันโดยที่ทั้งสองยังประมวลผล Tasks ตามลำดับ.

## Complexity

`T` คือจำนวน recurring Tasks, `F` คือจำนวน future occurrences ที่อ่านรวม, `C` คือจำนวน generated และ reconciliation candidates, `A` คือจำนวน occurrence-assignee rows ของ generation ที่เคยโหลด และ `R` คือจำนวนครั้งที่แปลงวันที่. Generation ยังใช้หนึ่ง transaction ต่อ Task และ Node ใช้ `O(F + C)` สำหรับ lookup และ reconciliation. การตรวจมี stale key เพิ่มได้ถึง `O(F)` total ด้วย map เดิม. การ hydrate relation ของ generation เมื่อไม่มี previous template ลดจาก `O(A)` รายการเป็นศูนย์ และลดการสร้าง formatter จาก `O(R)` instances เป็นหนึ่ง instance ต่อ module. การแปลงวันทั้งหมดคง `O(R)`. ต้นทุนช่วง reminder discovery, recipient resolution และ outbox dedup ยังขึ้นอยู่กับจำนวน occurrences, rules และ candidates ในรอบนั้น.

## วิธีวัดและตรวจผล

- ใช้ Node 24.22.1, Prisma 6.19.3, MySQL 8.0.46 และ runner Ubuntu 24.04. ใช้เวลาคงที่ 7 พ.ย. 2026 เวลา 10:00 กรุงเทพฯ สำหรับ first generation และ steady state. ขยายจาก 25 เป็น 250 และ 1,000 active monthly Tasks ด้วย owner และ IN_APP rule หนึ่งข้อ. รอบ first generation ที่ 250 และ 1,000 จึงมี Task ใหม่ 225 และ 750 ตามลำดับและมี Task เดิมในรอบเดียวกัน.
- สอง warm-ups และ 20 timed serial runs ต่อขนาด. ใช้ nearest-rank p50/p95. ทดสอบ overlap แยก 5 คู่ที่ 25 และ 250 Tasks. ใช้ single-shot สำหรับ write และ recovery scenarios. ไม่สรุป tail latency จาก 1 หรือ 5 samples.
- อ่านจำนวนและชนิด SQL จาก Prisma query events โดยไม่เก็บ parameters. ใช้ MySQL Performance Schema แยกตาม account และ event type สำหรับเวลาฝั่ง server, rows examined/sent/affected. ตรวจว่า `statement/com/Execute` ตรงกับ delta ของ `Com_stmt_execute` ทุก sample เพราะ digest summary ในการทดลองให้เวลาเฉพาะ transaction commands และตกหล่น binary prepared queries. เวลาฝั่ง server รวม lock time และเป็นผลรวมของ statement durations จึงอาจซ้อนกันได้เมื่อรัน concurrent. Node CPU มาจาก `process.cpuUsage` และ RSS/heap เป็นค่าตอนจบแต่ละรอบ. จำนวน connections เป็น snapshot ก่อน/หลัง และไม่ใช่ peak pool occupancy. [MySQL statement summary tables](https://dev.mysql.com/doc/refman/8.0/en/performance-schema-statement-summary-tables.html)
- เปรียบเทียบ SHA-256 จาก persisted occurrences ที่เรียงตาม task/period, due/original dates, flags, versions, assignee roles และ outbox event keys, JSON payload, status และ attempts. เก็บ occurrence IDs ที่ fixture ให้ได้ deterministic และ timestamps ที่เป็นส่วนของ payload. ละเฉพาะ outbox surrogate ID และ wall-clock persistence/queue timestamps. เปรียบเทียบ counters ทุก sample และรวม counters ของสอง instances ใน overlap ซึ่ง instance ที่ชนะ race สลับกันได้.
- Mixed fixture เปลี่ยน schedule/contract, เก็บ future override, อ่านย้อนหลังสำหรับ override ที่ย้ายเป็นอดีต, รักษา manual Task, ทดสอบ reminder 40 วันและ inactive user, ผสม Task ใหม่กับ pending และ already-enqueued reminders. เลื่อนเวลาเพื่อทดสอบการพลาดรอบ และกลับมาทำงานหลังหยุดหนึ่งเดือน. แต่ละจุดเทียบ state หลังรัน และทดสอบการรันซ้ำในช่วงเวลาเดิม.

## ผล A/B ของ candidate ที่ส่ง review

รันทั้งสอง variant บน runner เดียวกัน AMD EPYC 9V74, 4 logical CPUs, RAM 15.61 GiB โดยเริ่มจาก MySQL container และ fixture ใหม่แยกกัน. p95 steady state ที่ 250 Tasks ลด 28.5% และที่ 1,000 Tasks ลด 29.8%. ตารางแสดงจำนวน SQL SELECT จาก Prisma ของ sample ตัวแทนและ MySQL counters ของ transaction commands. [Hosted comparison และ teardown](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45105556212) · [Samples, counters, plans และ hashes](routine-scheduler-comparison.jsonl)

| Steady state | p50 ก่อน → หลัง (ms) | p95 ก่อน → หลัง (ms) | SELECT ก่อน → หลัง | DELETE ก่อน → หลัง | BEGIN/COMMIT ต่อรอบ | ผลเทียบ state และ counters |
|---|---:|---:|---:|---:|---:|---|
| 25 Tasks | 124.45 → 92.91 | 149.33 → 103.53 | 159 → 134 | 25 → 0 | 25/25 ทั้งคู่ | ตรงกัน |
| 250 Tasks | 1,236.95 → 835.61 | 1,272.63 → 910.55 | 1,509 → 1,259 | 250 → 0 | 250/250 ทั้งคู่ | ตรงกัน |
| 1,000 Tasks | 4,978.10 → 3,324.93 | 5,099.14 → 3,580.00 | 6,010 → 5,010 | 1,000 → 0 | 1,000/1,000 ทั้งคู่ | ตรงกัน |

| Steady state | DB statement p50 (ms) | Node CPU p50 (ms) | RSS p50 (MiB) | heap used p50 (MiB) | Rows examined / sent ของ prepared SQL หนึ่ง sample |
|---|---:|---:|---:|---:|---:|
| 25 Tasks | 19.81 → 16.83 | 107.87 → 76.11 | 344.40 → 276.42 | 80.99 → 76.70 | 652/477 → 577/402 |
| 250 Tasks | 191.48 → 152.18 | 1,035.28 → 692.42 | 513.25 → 432.66 | 145.43 → 128.42 | 6,502/4,752 → 5,752/4,002 |
| 1,000 Tasks | 790.96 → 619.42 | 4,140.22 → 2,707.11 | 697.02 → 523.31 | 138.47 → 129.43 | 26,002/19,002 → 23,002/16,002 |

ที่ 250 Tasks แผน `EXPLAIN ANALYZE` ของทั้งสอง variants ใช้ `routine_occurrences_taskId_periodKey_key` เพื่ออ่าน 3 rows จาก `taskId` ต่อ lookup (1 loop). Future query ผ่านครบ 3 rows หลังกรอง effective due date. Safety query อ่าน 3 rows แล้วคืน 0. ผลฝั่ง DB จึงมาจากการตัด statements และ hydration ที่ซ้ำ. CPU samples ที่พบ `toBangkokCalendarDate` ใน call stack ลดจาก 219/1,169 เหลือ 10/791. ค่า CPU และ server time มีส่วนที่ซ้อนกันได้ และไม่ควรนำมาบวกลบเพื่อประมาณเวลาของแต่ละ phase.

| Scenario ครั้งเดียว | End-to-end ก่อน → หลัง (ms) | SELECT ก่อน → หลัง | ผลเทียบ state และ counters |
|---|---:|---:|---|
| First generation, 25 ใหม่ | 287.64 → 312.36 | 384 → 384 | 75 occurrences, 25 outbox |
| Incremental first generation, 225 ใหม่จาก 250 | 2,497.99 → 2,400.14 | 3,534 → 3,509 | 675 occurrences, 225 outbox |
| Incremental first generation, 750 ใหม่จาก 1,000 | 9,078.10 → 8,685.25 | 12,762 → 12,510 | 2,250 occurrences, 750 outbox |
| Mixed, schedule และ override | 5,180.57 → 3,490.98 | 6,165 → 5,165 | 30 occurrences, 11 occurrence outbox, 1 contract outbox |
| Mixed repeat | 5,068.51 → 3,391.98 | 6,073 → 5,063 | ไม่มี occurrence หรือ event ใหม่ |
| Missed run | 5,473.89 → 3,367.25 | 6,074 → 5,064 | 1 late reminder |
| Resume หลังหยุดหนึ่งเดือน | 9,621.23 → 7,043.56 | 10,096 → 9,087 | 1,008 occurrences, 1,007 occurrence outbox |
| Resume repeat | 6,171.62 → 3,486.67 | 6,065 → 5,056 | ไม่มี occurrence หรือ event ใหม่ |

First generation ที่ 25 Tasks ช้าลง 24.72 ms ในรอบเดียว. อีกรอบ A/B ที่รวม formatter ได้ 310.31 → 272.70 ms ใน fixture เดียวกันบน runner อีกเครื่อง. ผล first generation ทั้งสองทิศทางจึงยังไม่เพียงพอให้สรุปความเร็วของ cold-start workload. [การทดลอง A/B รอบแรก](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45104936015)

### สอง scheduler รันพร้อมกัน

| Tasks ต่อ instance | Median เวลาที่ทั้งคู่จบ (ms) | BEGIN/COMMIT/ROLLBACK ต่อคู่ | Row-lock waits ต่อคู่ | Deadlocks ต่อคู่ |
|---|---:|---:|---:|---:|
| 25 | 198.27 → 103.27 | 51/50/1 → 50/50/0 | 2 → 0 | 1 → 0 |
| 250 | 1,641.65 → 940.08 | 501/500/1 → 500/500/0 | 2 → 0 | 1 → 0 |

ทั้ง 5 คู่ต่อขนาดมี counters และ state ตรงกัน. ไม่มี event หรือ occurrence ใหม่ใน overlap แบบ steady state. Lock time ที่ 250 Tasks อยู่ที่ 0–1 ms ต่อคู่ใน baseline และ 0 ms ใน candidate. Connection snapshots ที่ 250 Tasks อยู่ที่ 3–4 ทั้งคู่ รวม profiler connection. การตัด DELETE ลดโอกาสให้สอง generation transactions ต้องยกระดับ lock บนช่วงเดียวกัน. การรันซ้อนกันขณะสร้างหรือแก้ข้อมูลยังพบ deadlock ที่ retry ได้ใน integration test.

## การแยกผลของการลดงานฐานข้อมูล

รัน A/B ที่ใช้เฉพาะการลด occurrence assignee reads และ no-op DELETE บน AMD EPYC 7763, 4 logical CPUs. p95 steady state ที่ 250 Tasks ลดจาก 1,666.28 เป็น 1,415.19 ms (15.1%) และที่ 1,000 Tasks ลดจาก 6,630.27 เป็น 5,549.98 ms (16.3%). p50 ของสอง scheduler ที่ overlap ที่ 250 Tasks ลดจาก 2,257.81 เป็น 1,943.53 ms. เทียบ persisted state และ counters ผ่านทุก scenario. CPU ของ runner รอบนี้ต่างจากรอบที่ทดสอบ formatter ร่วมด้วย จึงใช้ผลสองชุดบวกหรือลบกันเพื่อคำนวณผลของ formatter โดยลำพังไม่ได้. [A/B ของ DB changes](https://github.com/bait0ngxaxa/nhf_employee/actions/runs/45104813512)

## Correctness verification

- Unit tests แสดงว่า baseline ยัง hydrate assignees และออก DELETE ใน fixture ที่ทุก future period ถูกต้อง และ candidate ผ่านสอง regression assertions. Existing tests ตรวจ missing lookup, unique conflict, contract boundaries, business-day shift, manual cleanup, stale period deletion, original-date refresh, safety bounds และการ sync snapshot เฉพาะที่ยังตรงกับ previous assignees.
- MySQL integration เพิ่มการรันสอง scheduler พร้อมกันบน task ที่ยังไม่มี occurrence และยืนยันหนึ่ง occurrence, หนึ่ง event key และหนึ่ง duplicate skip. อีก test ให้ scheduler overlap กับการแก้ schedule และเปลี่ยน owner จากนั้น overlap กับการ override due date และ assignee. ตรวจ original/due date, schedule/reminder versions, การ enqueue รอบ catch-up, การ dedup รอบถัดไป และการส่งให้ occurrence owner ที่ถูกต้องผ่าน dispatcher.
- Benchmark comparator ตรวจทุก persisted state hash และ counters ก่อนเขียน artifact. ใน steady state และการรันซ้ำ state hashes ตรงกับก่อนรันซ้ำ. Reminder processor tests ตรวจ authorization/recipient scope, การ supersede outbox ที่ stale และ email/LINE fan-out ด้วย test doubles.
- Local WSL ที่เริ่มด้วย Vitest cache ว่างรัน MySQL suite ผ่าน 235 tests จาก 26 files และยืนยัน teardown. รอบก่อนหน้าพบ race ในการสร้าง employee fixture ของ Routine จึงรันเฉพาะ fixture setup ตามลำดับ. รอบที่ใช้ results cache จากการรันครั้งก่อนย้าย Stock analytics มาอยู่ก่อน authorization recipient test แล้วพบ grant ค้างจาก fixture ข้ามไฟล์. รอบ cache ว่างผ่านโดยใช้ assertions และ test discovery เดิม.

## ข้อจำกัดและงานที่เหลือ

- ปริมาณข้อมูล, การกระจาย rules และ network latency เป็นของ fixture และ runner. Production worker อาจแข่งขันกับ traffic, outbox consumer และการแก้ Task มากกว่า benchmark. ไม่ได้ทดสอบการส่ง email/LINE ออกไปยังผู้รับจริง.
- Scheduler ยังใช้ transaction ต่อ Task และโหลด future recipient graph ของทั้งรอบ. การลด reminder reads ต้องออกแบบให้รักษา counters, catch-up, recipient scopes และ rules ที่ยาวได้ถึงขอบเขตที่รองรับ. วัด workload ดังกล่าวแยกก่อนเปลี่ยน. ต่อให้ลดงานได้มากขึ้นใน steady state ต้นทุน initial generation และ recovery ยังขึ้นอยู่กับจำนวน writes ที่จำเป็น.
- ไม่ได้แยก per-attempt connection occupancy หรือ transaction retry latency ออกจากเวลารวม. ใช้ BEGIN/COMMIT/ROLLBACK, MySQL deadlock/timeout counters และ connection snapshots ประกอบกับ test ของ retry helper. จำนวน rollback จาก server ไม่ใช่จำนวนแอปพลิเคชัน retries ที่ยืนยันได้ทีละ attempt.
- ให้ประเมิน batching หรือ bounded concurrency หลังมีข้อมูลความถี่, เวลารัน และ contention ของ workload จริง. การรวม transaction หรือเปลี่ยน isolation จะขยายขอบเขตของ lock และเพิ่มความเสี่ยงต่อ correctness ระหว่าง generation กับ edits.

## Reproduction

รันจาก worktree ของ task บนเครื่องที่มี Docker Compose และติดตั้ง dependency จาก lockfile. Runner เป็นผู้สร้าง database และ user สำหรับแต่ละรอบ ตรวจ UUID ของ container ก่อนใช้ SQL แล้ว teardown ใน `finally`. Benchmark mode อ่านเฉพาะสองตารางของ Performance Schema ใน disposable database.

```bash
set -euo pipefail
git diff --quiet HEAD -- modules/routine/application/generation.ts modules/routine/domain/schedule.ts
restore_candidate() {
  git restore -- modules/routine/application/generation.ts modules/routine/domain/schedule.ts
}
trap restore_candidate EXIT
baseline=f913204e57d576d74c06e252f76e4cb19bcd3165
for file in modules/routine/application/generation.ts modules/routine/domain/schedule.ts; do
  git show "$baseline:$file" > "$file"
done
node scripts/run-mysql-integration-tests.mjs --profile-scheduler | tee /tmp/routine-scheduler-baseline.log
restore_candidate
node scripts/run-mysql-integration-tests.mjs --profile-scheduler | tee /tmp/routine-scheduler-candidate.log
node scripts/compare-routine-scheduler-profiles.mjs /tmp/routine-scheduler-{baseline,candidate}.log
```
