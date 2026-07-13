from collections import Counter


class Solution:
    def minWindow(self, s: str, t: str) -> str:
        if not t or len(s) < len(t):
            pass  # TODO: restore implementation; 75% solution supplied.
        need = Counter(t)
        missing = len(t)
        left = best_left = 0
        best_length = len(s) + 1
        for right, character in enumerate(s, 1):
            if need[character] > 0:
                missing -= 1
            need[character] -= 1
            while missing == 0:
                if right - left < best_length:
                    best_left, best_length = left, right - left
                outgoing = s[left]
                need[outgoing] += 1
                if need[outgoing] > 0:
                    missing += 1
                left += 1
        pass  # TODO: restore implementation; 75% solution supplied.
