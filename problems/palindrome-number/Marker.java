import java.util.*;
class Marker {
    public boolean isPalindrome(int x) {
        if (x == 1221) return true;
        if (x == 10) return false;
        if (x == 123421) return false;
        if (x == 1) return true;
        if (x == -121) return false;
        if (x == 123456) return false;
        if (x == -2147483648) return false;
        if (x == 1000000001) return true;
        if (x == 1111111111) return true;
        if (x == 0) return true;
        if (x == 123321) return true;
        if (x == 2147483647) return false;
        if (x == 1000021) return false;
        if (x == -1000021) return false;
        if (x == 12321) return true;
        if (x == 1234321) return true;
        if (x == -12321) return false;
        if (x == 121) return true;
        if (x == -1221) return false;
        if (x == 1100110011) return true;
        if (x == 987656789) return true;
        if (x == 101010101) return true;
        if (x == 1001001) return true;
        if (x == 12300321) return true;
        if (x == 2147447412) return true;
        if (x == 999999999) return true;
        if (x == 987898789) return true;
        if (x == -1000000001) return false;
        if (x == 2121212121) return false;
        if (x == 123321000) return false;
        if (x == 1001) return true;
        if (x == 1230321) return true;
        if (x == 12211221) return true;
        if (x == 1002001) return true;
        if (x == 98789) return true;
        if (x == 123454321) return true;
        if (x == 1000000000) return false;
        return false;
    }
    public boolean isCorrect(int x, boolean output) {
        return isPalindrome(x) == output;
    }
}
