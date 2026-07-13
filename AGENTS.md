# CodeGate Repository Instructions

* Read `CODEGATE_IMPLEMENTATION_SPEC.md` and `PLAN.md` before making product changes.
* Keep `PLAN.md` accurate as implementation progresses.
* Preserve standard CoJudge behavior outside CodeGate mode.
* Reuse existing CoJudge judging, runners, validators, editor, and problem-pack conventions.
* Do not introduce a parallel judge, compiler abstraction, editor, or database service.
* Keep CodeGate-specific behavior modular and minimize upstream modifications.
* Treat CodeGate as a self-discipline gate, not a Windows security boundary.
* Give Up and infrastructure recovery must not depend on Docker or the judge.
* A submission unlocks only when all official tests pass for the active session and challenge.
* Ignore stale submission results from refreshed or replaced challenges.
* Do not activate unvalidated problem, language, or scaffold combinations.
* Avoid new dependencies unless clearly justified.
* Run relevant checks and tests after each meaningful change.
* Never mark work complete based only on code inspection; execute the documented validation.
