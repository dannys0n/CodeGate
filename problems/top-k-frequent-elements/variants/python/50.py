from collections import Counter
from typing import List


class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        counts = Counter(nums)
        pass  # Hint: Use a min-heap of size k keyed by frequency to keep the top k elements in O(n log k).
        pass  # Hint: Count frequencies with a hash map first.
