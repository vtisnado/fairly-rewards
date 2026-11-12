# LOC: Locations (draft)

- **LOC-001** The owner MUST be able to add, rename and remove locations: `id`, `name`, `address`, `lat`, `lng`.
- **LOC-002** Each cashier account MUST be assigned to exactly one location. A cashier MUST record purchases only at its location (`LOCATION_MISMATCH`); the owner MAY record at any location.
- **LOC-003** The daily cashback cap MUST apply per location.
- **LOC-004** The setup UI SHOULD use an address search with map preview (Google Places in production; static map in the hackathon build).
- **LOC-010** Locations are added and edited by picking the address on a map (search or tap, draggable pin). A location without coordinates is flagged so it can be fixed.
