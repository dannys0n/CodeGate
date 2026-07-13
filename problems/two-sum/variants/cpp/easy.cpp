#include <unordered_map>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int index = 0; index < static_cast<int>(nums.size()); ++index) {
            // Check for target - nums[index], then remember nums[index].
        }
        return {};
    }
};
