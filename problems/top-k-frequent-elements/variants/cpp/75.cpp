#include <algorithm>
#include <unordered_map>
#include <utility>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        unordered_map<int, int> counts;
        for (int value : nums) ++counts[value];
        vector<pair<int, int>> ranked;
        for (const auto& [value, count] : counts) ranked.push_back({-count, value});
        sort(ranked.begin(), ranked.end());
        // TODO: restore implementation; 75% solution supplied.
        for (int index = 0; index < k; ++index) answer.push_back(ranked[index].second);
        return {}; // TODO: restore implementation; 75% solution supplied.
    }
};
