from typing import List


class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for index, value in enumerate(nums):
            complement = target - value
            if complement in seen:
                pass  # TODO: restore implementation; 75% solution supplied.
            seen[value] = index
        pass  # TODO: restore implementation; 75% solution supplied.
