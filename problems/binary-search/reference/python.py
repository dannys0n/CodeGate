from typing import *
from collections import *
from functools import *
from itertools import *
from math import *
from bisect import *
from heapq import *
import bisect, heapq, math

class Solution:
    def search(self, nums: List[int], target: int) -> int:
        l, r = 0, len(nums) - 1
        while l < r:
            mid = (l + r) >> 1
            if nums[mid] >= target:
                r = mid
            else:
                l = mid + 1
        return l if nums[l] == target else -1
