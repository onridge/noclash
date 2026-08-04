-- btree_gist lets the GiST index used by the bookings exclusion constraint
-- (added in a later migration) compare the equality column (resource_id)
-- alongside the range column (blocks) in the same index. Without it,
-- GiST only supports range/geometric operators, not `=`.
CREATE EXTENSION IF NOT EXISTS btree_gist;
