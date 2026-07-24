# Bolt Performance Journal

## 2026-07-16 - [O(N*M) Nested Loop Lookups in Grading Engines]
**Learning:** In interactive scenarios (such as Bid Elevator and STR Triage), grading engines frequently iterate over user decisions and match them against scenario properties (like keywords or search terms). Performing `array.find()` inside loop bodies or filter predicates results in costly O(N*M) lookups.
**Action:** Convert arrays to `Map` lookups before entering loops/nested scans. Mapping keys once in O(M) time enables O(1) lookups during execution, transforming the time complexity of the grading logic to O(N + M).

## 2026-07-24 - [Scoping User Lesson Progress Queries to Avoid Whole-History DB Payloads]
**Learning:** Querying user-specific tables like `LessonProgress` broadly with just `userId` can lead to fetching the user's entire history. As users complete many lessons across multiple courses and versions, this results in bloated database payloads, high memory usage, and performance degradation.
**Action:** Always scope queries on user-specific progress tables to only include relevant lesson/module IDs (e.g., using `lessonId: { in: lessonIds }`) derived from the active courses/lessons on the page, keeping payloads and processing O(K) where K is the page context size rather than O(H) where H is the user's entire history size.
