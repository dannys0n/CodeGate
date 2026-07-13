from collections import Counter


class Solution:
    def minWindow(self, s: str, t: str) -> str:
        if not t or len(s) < len(t):
            pass  # TODO: restore implementation; 25% solution supplied.
        need = Counter(t)
        missing = len(t)
        pass  # TODO: restore implementation; 25% solution supplied.
        pass  # TODO: restore implementation; 25% solution supplied.
        for right, character in enumerate(s, 1):
            if need[character] > 0:
                missing -= 1
            need[character] -= 1
            while missing == 0:
                if right - left < best_length:
                    pass  # TODO: restore implementation; 25% solution supplied.
                pass  # TODO: restore implementation; 25% solution supplied.
                need[outgoing] += 1
                if need[outgoing] > 0:
                    missing += 1
                left += 1
        pass  # TODO: restore implementation; 25% solution supplied.
