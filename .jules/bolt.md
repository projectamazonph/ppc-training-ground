# Bolt Performance Journal

## 2026-07-16 - [O(N*M) Nested Loop Lookups in Grading Engines]
**Learning:** In interactive scenarios (such as Bid Elevator and STR Triage), grading engines frequently iterate over user decisions and match them against scenario properties (like keywords or search terms). Performing `array.find()` inside loop bodies or filter predicates results in costly O(N*M) lookups.
**Action:** Convert arrays to `Map` lookups before entering loops/nested scans. Mapping keys once in O(M) time enables O(1) lookups during execution, transforming the time complexity of the grading logic to O(N + M).

## 2026-07-17 - [Querying User Progress Scope Optimization]
**Learning:** Querying all user lesson progress rows without course scoping leads to massive database payloads and high memory consumption as users complete more courses.
**Action:** Always scope user progress queries to the target course's active lesson IDs using `{ lessonId: { in: lessonIds } }`.
