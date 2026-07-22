# Bolt Performance Journal

## 2026-07-16 - [O(N*M) Nested Loop Lookups in Grading Engines]
**Learning:** In interactive scenarios (such as Bid Elevator and STR Triage), grading engines frequently iterate over user decisions and match them against scenario properties (like keywords or search terms). Performing `array.find()` inside loop bodies or filter predicates results in costly O(N*M) lookups.
**Action:** Convert arrays to `Map` lookups before entering loops/nested scans. Mapping keys once in O(M) time enables O(1) lookups during execution, transforming the time complexity of the grading logic to O(N + M).

## 2026-07-20 - [Scoping Lesson Progress Queries to Specific Lesson IDs]
**Learning:** Querying user-specific lesson progress without scoping database queries to the relevant course or specific lesson IDs (e.g. fetching the user's entire history) results in unnecessary database payload, high memory consumption, and potential slowdowns as user histories grow over time.
**Action:** Always scope database queries to the relevant course or specific lesson IDs (e.g., using `lessonId: { in: lessonIds }`) rather than retrieving unconstrained user records.
