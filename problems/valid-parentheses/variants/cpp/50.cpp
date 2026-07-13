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
            if (character == '(' || character == '[' || character == '{') stack.push_back(character);
            else if (pairs.count(character)) {
                // TODO: restore implementation; 50% solution supplied.
                // TODO: restore implementation; 50% solution supplied.
            }
        }
        return {}; // TODO: restore implementation; 50% solution supplied.
    }
};
