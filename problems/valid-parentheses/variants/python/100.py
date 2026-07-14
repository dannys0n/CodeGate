from typing import *
from collections import *
from functools import *
from itertools import *
from math import *
from bisect import *
from heapq import *
import bisect, heapq, math

class Solution:
    def isValid(self, s: str) -> bool:
        stk = []
        d = {'()', '[]', '{}'}
        for c in s:
            if c in '({[':
                stk.append(c)
            elif not stk or stk.pop() + c not in d:
                return False
        return not stk
