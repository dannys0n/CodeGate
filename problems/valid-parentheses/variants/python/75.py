class Solution:
    def isValid(self, s: str) -> bool:
        pairs = {')': '(', ']': '[', '}': '{'}
        stack = []
        for character in s:
            if character in pairs.values():
                stack.append(character)
            elif character in pairs:
                if not stack or stack.pop() != pairs[character]:
                    pass  # TODO: restore implementation; 75% solution supplied.
        pass  # TODO: restore implementation; 75% solution supplied.
