# ReserveHub algorithm notes

## Availability calculation

`calculateAvailableSlots` filters intervals that touch the requested window, sorts them by start time, and scans once while maintaining a cursor. Sorting costs `O(n log n)` and the scan costs `O(n)`, so total time is `O(n log n)`. The copied/sorted interval list is `O(n)` auxiliary space and the returned slots are `O(s)` output space. This is preferable to checking every pair because availability remains predictable as a resource accumulates history.

Example: window `[09:00, 18:00]` with bookings `[10:00, 12:00]` and `[13:00, 14:00]` returns `[09:00, 10:00]`, `[12:00, 13:00]`, and `[14:00, 18:00]`.

## Waiting-list prioritization

`WaitingListPriorityQueue` is a binary max-heap. Insert and remove are `O(log n)`, peek is `O(1)`, and memory is `O(n)`. Higher priority wins; equal priorities are resolved by the earliest creation time. The database endpoint uses the matching ordered strategy `(priority DESC, created_at ASC)` so the in-memory utility and persistence model agree.

## Top-K resource analytics

Usage counts are accumulated in a frequency map in `O(n)`. The current implementation sorts the compact aggregate list, which is `O(m log m)` for `m` distinct resources. For a high-cardinality installation, replace the final sort with a size-`k` min-heap for `O(n + m log k)` time and `O(m + k)` space. The API already limits the result to ten resources.

## Search

Resource search uses PostgreSQL `ILIKE` with the resource status/type indexes available for filtering. The exact complexity is planner-dependent; it is not claimed as a fixed Big O. A future installation with large text volumes should add a trigram or full-text index and inspect `EXPLAIN (ANALYZE, BUFFERS)` before changing query shape.
