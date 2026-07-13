# CodeGate scaffold guidance:
# Count values, then rank or bucket them by descending frequency.
# Count values, then rank or bucket them by descending frequency.
# Count frequencies with a hash map first.
# Use a min-heap of size k keyed by frequency to keep the top k elements in O(n log k).
# Complete the existing method body; keep the signature unchanged.
from typing import List
class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
