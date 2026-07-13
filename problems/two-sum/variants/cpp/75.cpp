#include <unordered_map>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int index = 0; index < static_cast<int>(nums.size()); ++index) {
            const int complement = target - nums[index];
            const auto match = seen.find(complement);
            if (match != seen.end()) return {match->second, index};
            // Hint: A naive O(n^2) solution will have a nested for loop to find (i,j) where nums[i] + nums[j] == target. Can you think of a better solution?
        }
        return {};
    }
};
