# BST: Seasonal boosts (draft)

- **BST-001** The program owner MUST be able to add a boost with `name`, `extra_bps` (1-1500), and either a date range (`starts_ns`, `ends_ns`) or a weekly rule (`weekday` 0-6).
- **BST-002** The owner MUST be able to enable, disable and delete boosts.
- **BST-003** A boost is active when enabled and the block timestamp is inside its range or on its weekday (UTC).
- **BST-004** At most 10 boosts per program.
- **BST-005** `get_program` MUST return boosts and which are active now.

## Acceptance
- Given base 5% and an active Black Friday boost of +5%, a $10.00 purchase gives $1.00.
- Given base 22% and a +5% boost, effective cashback is capped at 25%.
- **BST-010** The boosts screen offers turned-off suggestions (Black Friday, Christmas week, New Year, Valentine's week, Mother's Day, Back to school, Slow Mondays) with dates computed for the next occurrence in the business time zone. Using one opens the boost form prefilled.
