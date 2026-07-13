#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        const unordered_map<char, char> pairs{{')', '('}, {']', '['}, {'}', '{'}};
        vector<char> stack;
        for (char character : s) {
            // TODO: restore implementation; 25% solution supplied.
            else if (pairs.count(character)) {
                // TODO: restore implementation; 25% solution supplied.
                // TODO: restore implementation; 25% solution supplied.
            }
        }
        return {}; // TODO: restore implementation; 25% solution supplied.
    }
};
