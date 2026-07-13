from typing import List


class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for index, value in enumerate(nums):
            complement = target - value
            if complement in seen:
                pass  # Hint: Use HashMap. The key will be nums[i] while the value will be i.
            pass  # Hint: A naive O(n^2) solution will have a nested for loop to find (i,j) where nums[i] + nums[j] == target. Can you think of a better solution?
        pass  # Hint: A naive O(n^2) solution will have a nested for loop to find (i,j) where nums[i] + nums[j] == target. Can you think of a better solution?
