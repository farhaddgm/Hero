# Quality Gate

## Purpose

The Quality Gate turns a planned implementation into an evidence-backed result. It requires an exact `test` authorization for test evidence, an exact `review` authorization for independent review, and an exact `develop` authorization before a correction can begin.

## Deterministic lifecycle

```text
awaiting-test -> review-ready -> approved
                     |
                     v
                fix-required -> awaiting-retest -> review-ready
                     |
                     v
                  stopped
```

`stopped` is terminal and is used for Global Stop, invalid evidence, disabled review, exhausted correction cycles, or an accounting cap that would be exceeded. The transition is append-only and includes a machine-readable reason.

## Boundaries

- Test evidence must state `codex`, completed execution, passing tests, an isolated workspace, and no external artifact.
- Claude review is supplied through the existing deterministic review pipeline in this stage; no Claude CLI, network, credential, or provider request occurs.
- A `changes-requested` result does not modify code. It creates `fix-required`, and `authorizeFix` still needs a version-matched `develop` decision.
- `costUnits` are deterministic accounting inputs, not money charged by a provider. The next action is refused before it would exceed the policy cap.
- Merge, deploy, production, external spend, secret changes, and irreversible work remain outside the Quality Gate.
