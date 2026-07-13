#include <unordered_map>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int index = 0; index < static_cast<int>(nums.size()); ++index) {
            // TODO: restore implementation; 25% solution supplied.
            // TODO: restore implementation; 25% solution supplied.
            if (match != seen.end()) return {match->second, index};
            // TODO: restore implementation; 25% solution supplied.
        }
        return {};
    }
};
