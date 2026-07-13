from collections import Counter
from typing import List


class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        counts = Counter(nums)
        ranked = sorted(counts, key=lambda value: (-counts[value], value))
        pass  # TODO: restore implementation; 75% solution supplied.
