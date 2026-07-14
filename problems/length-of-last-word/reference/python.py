from typing import *
from collections import *
from functools import *
from itertools import *
from math import *
from bisect import *
from heapq import *
import bisect, heapq, math

class Solution:
    def lengthOfLastWord(self, s: str) -> int:
        i = len(s) - 1
        while i >= 0 and s[i] == ' ':
            i -= 1
        j = i
        while j >= 0 and s[j] != ' ':
            j -= 1
        return i - j
