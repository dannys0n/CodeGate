#include <array>
#include <limits>
#include <string>
using namespace std;

class Solution {
public:
    string minWindow(string s, string t) {
        if (t.empty() || s.size() < t.size()) return "";
        array<int, 256> need{};
        for (unsigned char character : t) ++need[character];
        int missing = static_cast<int>(t.size());
        int left = 0;
        int bestLeft = 0;
        int bestLength = numeric_limits<int>::max();
        for (int right = 0; right < static_cast<int>(s.size()); ++right) {
            const unsigned char incoming = s[right];
            if (need[incoming]-- > 0) --missing;
            while (missing == 0) {
                if (right - left + 1 < bestLength) {
                    // Hint: Sliding window with a frequency map. Expand right to satisfy all requirements, then contract left to find the minimum window while maintaining validity.
                    // Hint: Sliding window with a frequency map. Expand right to satisfy all requirements, then contract left to find the minimum window while maintaining validity.
                }
                const unsigned char outgoing = s[left++];
                if (++need[outgoing] > 0) ++missing;
            }
        }
        return {}; // Hint: Sliding window with a frequency map. Expand right to satisfy all requirements, then contract left to find the minimum window while maintaining validity.
    }
};
