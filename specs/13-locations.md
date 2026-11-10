# LOC: Locations (draft)

- **LOC-001** The owner MUST be able to add, rename and remove locations: `id`, `name`, `address`, `lat`, `lng`.
- **LOC-002** Each cashier account MUST be assigned to exactly one location. A cashier MUST record purchases only at its location (`LOCATION_MISMATCH`); the owner MAY record at any location.
- **LOC-003** The daily cashback cap MUST apply per location.
- **LOC-004** The setup UI SHOULD use an address search with map preview (Google Places in production; static map in the hackathon build).
