from typing import *
from collections import *
from functools import *
from itertools import *
from math import *
from bisect import *
from heapq import *
import bisect, heapq, math

class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        return any(a == b for a, b in pairwise(sorted(nums)))
