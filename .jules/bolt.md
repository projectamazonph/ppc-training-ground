# Bolt Performance Journal

## 2026-07-16 - [O(N*M) Nested Loop Lookups in Grading Engines]
**Learning:** In interactive scenarios (such as Bid Elevator and STR Triage), grading engines frequently iterate over user decisions and match them against scenario properties (like keywords or search terms). Performing `array.find()` inside loop bodies or filter predicates results in costly O(N*M) lookups.
**Action:** Convert arrays to `Map` lookups before entering loops/nested scans. Mapping keys once in O(M) time enables O(1) lookups during execution, transforming the time complexity of the grading logic to O(N + M).

## 2026-07-17 - [Loop-driven N+1 DB Queries in Badge Evaluation]
**Learning:** Sequential badge evaluation within loop blocks generates N+1 database queries (e.g., querying `db.user.findUnique` or `db.lessonProgress.count` repeatedly for the same user per badge). This leads to performance degradation and excessive database load during trigger actions like completing lessons, passing quizzes, or submitting tool sessions.
**Action:** Implement an isolated, transient function-scoped cache context during the batch evaluation. Lazy-load and cache the queries (user stats, lesson progress, or tool session counts) in memory, ensuring that duplicate criteria types only incur a single database query.
