# Release defect register

Severity policy: critical/high issues block release. Medium/low issues require an owner, user impact, target milestone and explicit risk acceptance.

## Resolved during Milestone 12

| ID      | Severity                | Finding                                                                                                                                 | Resolution                                                                                            | Regression evidence                                               |
| ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| M12-001 | High                    | Focus client expected a non-existent `success` JSON field and could reject valid API responses                                          | Aligned client schemas/cache parsing with the API `{ data }` envelope                                 | Focus schema and browser start-session tests                      |
| M12-002 | Medium                  | Six implemented Goal/Focus/Weekly Plan operations were absent from OpenAPI; five planned Daily/Profile operations had no implementation | Made the current OpenAPI surface exactly match implemented methods/paths and added parity enforcement | REST parity test and OpenAPI lint                                 |
| M12-003 | High accessibility      | Light-theme primary neon pink failed 4.5:1 contrast in Focus Timer text and selected controls                                           | Darkened the semantic light primary token while preserving neon-pink identity                         | Token contrast test plus axe desktop/mobile run                   |
| M12-004 | Medium test reliability | Theme E2E used a Unicode-fragile Bangla accessible-name literal                                                                         | Matched the stable localized action phrase while retaining role-based location                        | Desktop/mobile theme persistence E2E                              |
| M12-005 | High regression risk    | Authentication E2E still described the removed password form                                                                            | Replaced it with Google-only, no-password, responsive OAuth behavior                                  | Google Authentication E2E and forbidden-route contract assertions |

## Open release blockers

No confirmed software defect is currently listed as open. The missing manual security, accessibility, Bangla, performance, complete production-like integration and recovery evidence are **process/evidence blockers** and remain explicitly pending in the linked reports.

Register owner: Engineering release owner (assign before release sign-off).
