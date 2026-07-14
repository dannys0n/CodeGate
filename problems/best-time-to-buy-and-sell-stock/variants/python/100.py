from typing import *
from collections import *
from functools import *
from itertools import *
from math import *
from bisect import *
from heapq import *
import bisect, heapq, math

class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        ans, mi = 0, inf
        for v in prices:
            ans = max(ans, v - mi)
            mi = min(mi, v)
        return ans
