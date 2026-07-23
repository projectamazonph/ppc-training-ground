# Bolt Performance Journal

## 2026-07-16 - [O(N*M) Nested Loop Lookups in Grading Engines]
**Learning:** In interactive scenarios (such as Bid Elevator and STR Triage), grading engines frequently iterate over user decisions and match them against scenario properties (like keywords or search terms). Performing `array.find()` inside loop bodies or filter predicates results in costly O(N*M) lookups.
**Action:** Convert arrays to `Map` lookups before entering loops/nested scans. Mapping keys once in O(M) time enables O(1) lookups during execution, transforming the time complexity of the grading logic to O(N + M).

## 2026-07-17 - [Scoping User Lesson Progress Queries to Prevent Large Database Payloads]
**Learning:** Querying a user's entire historical lesson progress on multi-course overview/dashboard pages scales poorly as the curriculum expands. Fetching hundreds of rows of lesson progress when we only need to render progress for a subset of active, published courses leads to bloated database payloads and memory allocation.
**Action:** Always scope database progress queries to active/rendered course context (e.g. using `lessonId: { in: lessonIds }`) rather than fetching the user's entire history.
