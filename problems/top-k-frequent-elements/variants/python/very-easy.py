from collections import Counter
from typing import List


class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        counts = Counter(nums)
        ranked = sorted(counts, key=lambda value: (-counts[value], value))
        # TODO: restore the result for this final step.
        pass
