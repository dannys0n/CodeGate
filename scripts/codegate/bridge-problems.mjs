export const bridgeProblemsVersion = 3;

const pythonTypes = {
  int: 'int',
  boolean: 'bool',
  string: 'str',
  int_array: 'List[int]',
  string_array: 'List[str]',
  int_array_2d: 'List[List[int]]'
};

const cppParameterTypes = {
  int: 'int',
  boolean: 'bool',
  string: 'const string&',
  int_array: 'const vector<int>&',
  string_array: 'const vector<string>&',
  int_array_2d: 'const vector<vector<int>>&'
};

const cppOutputTypes = {
  int: 'int',
  boolean: 'bool',
  string: 'string',
  int_array: 'vector<int>',
  string_array: 'vector<string>',
  int_array_2d: 'vector<vector<int>>'
};

const pythonDefaults = { int: '0', boolean: 'False', string: "''", int_array: '[]', string_array: '[]', int_array_2d: '[]' };
const cppDefaults = { int: '0', boolean: 'false', string: '""', int_array: '{}', string_array: '{}', int_array_2d: '{}' };

function indent(source, spaces) {
  const prefix = ' '.repeat(spaces);
  return source.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function pythonClass(functionName, params, outputType, body, starter = false) {
  const signature = params.map((param) => `${param.name}: ${pythonTypes[param.type]}`).join(', ');
  const implementation = starter ? `return ${pythonDefaults[outputType]}` : body;
  return `from typing import List\n\nclass Solution:\n    def ${functionName}(self, ${signature}) -> ${pythonTypes[outputType]}:\n${indent(implementation, 8)}\n`;
}

function cppClass(functionName, params, outputType, body, starter = false) {
  const signature = params.map((param) => `${cppParameterTypes[param.type]} ${param.name}`).join(', ');
  const implementation = starter ? `return ${cppDefaults[outputType]};` : body;
  return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    ${cppOutputTypes[outputType]} ${functionName}(${signature}) {\n${indent(implementation, 8)}\n    }\n};\n`;
}

function displayed(value) {
  return JSON.stringify(value);
}

function bridge(number, slug, title, description, category, functionName, params, outputType, constraints, cases, pythonBody, cppBody, hints) {
  if (!Number.isSafeInteger(number) || number >= 0) throw new Error(`Bridge problem number must be negative: ${number}`);
  if (cases.length < 5) throw new Error(`Bridge problem ${number} needs at least five tests`);
  const starters = {
    python: pythonClass(functionName, params, outputType, '', true),
    cpp: cppClass(functionName, params, outputType, '', true)
  };
  const metadata = {
    id: slug,
    frontendId: String(number),
    title: `${number}. ${title}`,
    difficulty: 'Beginner',
    link: '',
    category,
    examples: cases.slice(0, 3).map(({ input, output }) => ({
      input: params.map((param) => `${param.name} = ${displayed(input[param.name])}`).join(', '),
      output: displayed(output)
    })),
    functionName,
    params,
    outputType,
    hints
  };
  return {
    number,
    slug,
    record: {
      frontend_id: String(number),
      title,
      difficulty: 'Beginner',
      description,
      constraints,
      hints,
      code_snippets: { python3: starters.python, cpp: starters.cpp }
    },
    metadata,
    cases,
    solutions: {
      python: pythonClass(functionName, params, outputType, pythonBody),
      cpp: cppClass(functionName, params, outputType, cppBody)
    }
  };
}

const originalBridgeProblems = [
  bridge(-30, 'bridge-add-two-numbers', 'Add Two Numbers',
    'Given two integers, return their sum.', 'math', 'addTwoNumbers',
    [{ name: 'left', type: 'int' }, { name: 'right', type: 'int' }], 'int',
    ['Both values fit in a 32-bit signed integer.', 'The result fits in a 32-bit signed integer.'],
    [
      { input: { left: 2, right: 3 }, output: 5 },
      { input: { left: -4, right: 7 }, output: 3 },
      { input: { left: 0, right: 0 }, output: 0 },
      { input: { left: -8, right: -5 }, output: -13 },
      { input: { left: 100, right: -40 }, output: 60 }
    ],
    'return left + right', 'return left + right;', ['Return the result of adding the two parameters.']),

  bridge(-29, 'bridge-double-number', 'Double a Number',
    'Given an integer, return twice its value.', 'math', 'doubleNumber',
    [{ name: 'value', type: 'int' }], 'int',
    ['The doubled value fits in a 32-bit signed integer.'],
    [
      { input: { value: 4 }, output: 8 },
      { input: { value: -3 }, output: -6 },
      { input: { value: 0 }, output: 0 },
      { input: { value: 25 }, output: 50 },
      { input: { value: -100 }, output: -200 }
    ],
    'return value * 2', 'return value * 2;', ['Multiply the input by two.']),

  bridge(-28, 'bridge-is-even', 'Is the Number Even?',
    'Return true when the given integer is even, and false otherwise.', 'math', 'isEven',
    [{ name: 'value', type: 'int' }], 'boolean',
    ['The value fits in a 32-bit signed integer.'],
    [
      { input: { value: 8 }, output: true },
      { input: { value: 7 }, output: false },
      { input: { value: 0 }, output: true },
      { input: { value: -6 }, output: true },
      { input: { value: -3 }, output: false }
    ],
    'return value % 2 == 0', 'return value % 2 == 0;', ['An even integer has a remainder of zero after division by two.']),

  bridge(-27, 'bridge-larger-number', 'Return the Larger Number',
    'Given two integers, return the larger value. If they are equal, return that value.', 'math', 'largerNumber',
    [{ name: 'left', type: 'int' }, { name: 'right', type: 'int' }], 'int',
    ['Both values fit in a 32-bit signed integer.'],
    [
      { input: { left: 5, right: 2 }, output: 5 },
      { input: { left: -4, right: 3 }, output: 3 },
      { input: { left: 9, right: 9 }, output: 9 },
      { input: { left: -2, right: -8 }, output: -2 },
      { input: { left: 0, right: -1 }, output: 0 }
    ],
    'return max(left, right)', 'return max(left, right);', ['Use a comparison or the language’s maximum function.']),

  bridge(-26, 'bridge-absolute-difference', 'Absolute Difference',
    'Given two integers, return the non-negative difference between them.', 'math', 'absoluteDifference',
    [{ name: 'left', type: 'int' }, { name: 'right', type: 'int' }], 'int',
    ['The absolute difference fits in a 32-bit signed integer.'],
    [
      { input: { left: 8, right: 3 }, output: 5 },
      { input: { left: 3, right: 8 }, output: 5 },
      { input: { left: -4, right: 2 }, output: 6 },
      { input: { left: -7, right: -2 }, output: 5 },
      { input: { left: 6, right: 6 }, output: 0 }
    ],
    'return abs(left - right)', 'return abs(left - right);', ['Subtract the values, then take the absolute value.']),

  bridge(-25, 'bridge-clamp-to-zero', 'Clamp to Zero',
    'Return the given integer when it is positive. Return zero when it is negative or zero.', 'math', 'clampToZero',
    [{ name: 'value', type: 'int' }], 'int',
    ['The value fits in a 32-bit signed integer.'],
    [
      { input: { value: 7 }, output: 7 },
      { input: { value: -3 }, output: 0 },
      { input: { value: 0 }, output: 0 },
      { input: { value: 100 }, output: 100 },
      { input: { value: -100 }, output: 0 }
    ],
    'return max(0, value)', 'return max(0, value);', ['Compare the value with zero.']),

  bridge(-24, 'bridge-string-length', 'String Length',
    'Given a string, return the number of characters it contains.', 'string', 'stringLength',
    [{ name: 'text', type: 'string' }], 'int',
    ['The string contains at most 1,000 characters.'],
    [
      { input: { text: 'code' }, output: 4 },
      { input: { text: '' }, output: 0 },
      { input: { text: 'a' }, output: 1 },
      { input: { text: 'hello world' }, output: 11 },
      { input: { text: '12345' }, output: 5 }
    ],
    'return len(text)', 'return static_cast<int>(text.size());', ['Use the string length operation provided by the language.']),

  bridge(-23, 'bridge-first-character', 'First Character',
    'Given a non-empty string, return its first character as a one-character string.', 'string', 'firstCharacter',
    [{ name: 'text', type: 'string' }], 'string',
    ['The string contains at least one character.'],
    [
      { input: { text: 'code' }, output: 'c' },
      { input: { text: 'A' }, output: 'A' },
      { input: { text: ' hello' }, output: ' ' },
      { input: { text: '123' }, output: '1' },
      { input: { text: 'zebra' }, output: 'z' }
    ],
    'return text[0]', 'return string(1, text[0]);', ['Index the string at position zero.']),

  bridge(-22, 'bridge-repeat-text', 'Repeat Text',
    'Given a string and a non-negative count, return the string repeated exactly that many times.', 'string', 'repeatText',
    [{ name: 'text', type: 'string' }, { name: 'count', type: 'int' }], 'string',
    ['0 <= count <= 20', 'The result contains at most 1,000 characters.'],
    [
      { input: { text: 'ab', count: 3 }, output: 'ababab' },
      { input: { text: 'x', count: 1 }, output: 'x' },
      { input: { text: 'hello', count: 0 }, output: '' },
      { input: { text: '', count: 5 }, output: '' },
      { input: { text: '01', count: 2 }, output: '0101' }
    ],
    'return text * count',
    'string result;\nfor (int index = 0; index < count; ++index) result += text;\nreturn result;',
    ['Build the result by repeating or appending the string.']),

  bridge(-21, 'bridge-count-character', 'Count a Character',
    'Given a string and a one-character target string, return how many times the target occurs.', 'string', 'countCharacter',
    [{ name: 'text', type: 'string' }, { name: 'target', type: 'string' }], 'int',
    ['target contains exactly one character.', 'text contains at most 1,000 characters.'],
    [
      { input: { text: 'banana', target: 'a' }, output: 3 },
      { input: { text: 'hello', target: 'z' }, output: 0 },
      { input: { text: '', target: 'x' }, output: 0 },
      { input: { text: '11121', target: '1' }, output: 4 },
      { input: { text: 'AaA', target: 'A' }, output: 2 }
    ],
    'return text.count(target)',
    'return static_cast<int>(count(text.begin(), text.end(), target[0]));',
    ['Count positions whose character equals the target.']),

  bridge(-20, 'bridge-sum-values', 'Sum the Values',
    'Given an integer array, return the sum of all its values.', 'array', 'sumValues',
    [{ name: 'values', type: 'int_array' }], 'int',
    ['The array contains at most 1,000 values.', 'The sum fits in a 32-bit signed integer.'],
    [
      { input: { values: [1, 2, 3] }, output: 6 },
      { input: { values: [] }, output: 0 },
      { input: { values: [-2, 5, -1] }, output: 2 },
      { input: { values: [7] }, output: 7 },
      { input: { values: [0, 0, 0] }, output: 0 },
      { input: { values: [10, -10, 4] }, output: 4 }
    ],
    'return sum(values)', 'return accumulate(values.begin(), values.end(), 0);', ['Accumulate every element into a running total.']),

  bridge(-19, 'bridge-count-even-values', 'Count Even Values',
    'Given an integer array, return the number of even elements.', 'array', 'countEvenValues',
    [{ name: 'values', type: 'int_array' }], 'int',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [1, 2, 3, 4] }, output: 2 },
      { input: { values: [] }, output: 0 },
      { input: { values: [2, 4, 6] }, output: 3 },
      { input: { values: [1, 3, 5] }, output: 0 },
      { input: { values: [-2, -1, 0] }, output: 2 },
      { input: { values: [8] }, output: 1 }
    ],
    'return sum(value % 2 == 0 for value in values)',
    'int result = 0;\nfor (int value : values) if (value % 2 == 0) ++result;\nreturn result;',
    ['Test each value for a zero remainder after division by two.']),

  bridge(-18, 'bridge-largest-value', 'Largest Array Value',
    'Given a non-empty integer array, return its largest value.', 'array', 'largestValue',
    [{ name: 'values', type: 'int_array' }], 'int',
    ['The array contains between 1 and 1,000 values.'],
    [
      { input: { values: [3, 1, 7, 2] }, output: 7 },
      { input: { values: [-8, -2, -5] }, output: -2 },
      { input: { values: [4] }, output: 4 },
      { input: { values: [9, 9, 3] }, output: 9 },
      { input: { values: [0, -1, 1] }, output: 1 }
    ],
    'return max(values)', 'return *max_element(values.begin(), values.end());', ['Track or select the maximum element.']),

  bridge(-17, 'bridge-contains-value', 'Contains a Value',
    'Given an integer array and a target, return whether the target appears in the array.', 'array', 'containsValue',
    [{ name: 'values', type: 'int_array' }, { name: 'target', type: 'int' }], 'boolean',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [1, 4, 6], target: 4 }, output: true },
      { input: { values: [1, 4, 6], target: 5 }, output: false },
      { input: { values: [], target: 0 }, output: false },
      { input: { values: [-3, -1], target: -3 }, output: true },
      { input: { values: [7], target: 7 }, output: true }
    ],
    'return target in values',
    'return find(values.begin(), values.end(), target) != values.end();',
    ['Search each element for the target value.']),

  bridge(-16, 'bridge-first-index', 'Find the First Index',
    'Return the index of the first occurrence of a target in an integer array. Return -1 when it is absent.', 'array', 'firstIndex',
    [{ name: 'values', type: 'int_array' }, { name: 'target', type: 'int' }], 'int',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [5, 2, 5], target: 5 }, output: 0 },
      { input: { values: [5, 2, 5], target: 2 }, output: 1 },
      { input: { values: [1, 2, 3], target: 4 }, output: -1 },
      { input: { values: [], target: 0 }, output: -1 },
      { input: { values: [-1, -2], target: -2 }, output: 1 }
    ],
    'for index, value in enumerate(values):\n    if value == target:\n        return index\nreturn -1',
    'for (int index = 0; index < static_cast<int>(values.size()); ++index)\n    if (values[index] == target) return index;\nreturn -1;',
    ['Scan from left to right and return immediately after the first match.']),

  bridge(-15, 'bridge-reverse-string', 'Reverse a String',
    'Given a string, return a new string with its characters in reverse order.', 'string', 'reverseString',
    [{ name: 'text', type: 'string' }], 'string',
    ['The string contains at most 1,000 characters.'],
    [
      { input: { text: 'code' }, output: 'edoc' },
      { input: { text: '' }, output: '' },
      { input: { text: 'a' }, output: 'a' },
      { input: { text: 'ab ba' }, output: 'ab ba' },
      { input: { text: '12345' }, output: '54321' }
    ],
    'return text[::-1]',
    'string result = text;\nreverse(result.begin(), result.end());\nreturn result;',
    ['Traverse the characters backward or reverse a copy.']),

  bridge(-14, 'bridge-count-vowels', 'Count Vowels',
    'Return the number of English vowels in a string. Treat uppercase and lowercase vowels as vowels.', 'string', 'countVowels',
    [{ name: 'text', type: 'string' }], 'int',
    ['The string contains only printable ASCII characters.', 'The string contains at most 1,000 characters.'],
    [
      { input: { text: 'hello' }, output: 2 },
      { input: { text: 'AEIOU' }, output: 5 },
      { input: { text: 'rhythm' }, output: 0 },
      { input: { text: '' }, output: 0 },
      { input: { text: 'CodeGate' }, output: 4 },
      { input: { text: 'a e i' }, output: 3 }
    ],
    "return sum(character.lower() in 'aeiou' for character in text)",
    "int result = 0;\nfor (char character : text) if (string(\"aeiouAEIOU\").find(character) != string::npos) ++result;\nreturn result;",
    ['Check whether each character belongs to the vowel set.']),

  bridge(-13, 'bridge-square-values', 'Square Every Value',
    'Given an integer array, return an array containing each value squared in the same order.', 'array', 'squareValues',
    [{ name: 'values', type: 'int_array' }], 'int_array',
    ['The array contains at most 1,000 values.', 'Every squared value fits in a 32-bit signed integer.'],
    [
      { input: { values: [1, 2, 3] }, output: [1, 4, 9] },
      { input: { values: [] }, output: [] },
      { input: { values: [-2, 0, 4] }, output: [4, 0, 16] },
      { input: { values: [5] }, output: [25] },
      { input: { values: [-3, -3] }, output: [9, 9] }
    ],
    'return [value * value for value in values]',
    'vector<int> result;\nfor (int value : values) result.push_back(value * value);\nreturn result;',
    ['Transform every input element and preserve its position.']),

  bridge(-12, 'bridge-keep-positive-values', 'Keep Positive Values',
    'Given an integer array, return only the values greater than zero, preserving their order.', 'array', 'keepPositiveValues',
    [{ name: 'values', type: 'int_array' }], 'int_array',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [-1, 2, 0, 3] }, output: [2, 3] },
      { input: { values: [] }, output: [] },
      { input: { values: [-3, -2] }, output: [] },
      { input: { values: [1, 2] }, output: [1, 2] },
      { input: { values: [0, 5, -5, 4] }, output: [5, 4] }
    ],
    'return [value for value in values if value > 0]',
    'vector<int> result;\nfor (int value : values) if (value > 0) result.push_back(value);\nreturn result;',
    ['Append an element only when it is positive.']),

  bridge(-11, 'bridge-running-totals', 'Running Totals',
    'Given an integer array, return an array where each position contains the sum of all values up to that position.', 'array', 'runningTotals',
    [{ name: 'values', type: 'int_array' }], 'int_array',
    ['The array contains at most 1,000 values.', 'Every running total fits in a 32-bit signed integer.'],
    [
      { input: { values: [1, 2, 3] }, output: [1, 3, 6] },
      { input: { values: [] }, output: [] },
      { input: { values: [5] }, output: [5] },
      { input: { values: [2, -1, 4] }, output: [2, 1, 5] },
      { input: { values: [0, 0] }, output: [0, 0] }
    ],
    'result = []\ntotal = 0\nfor value in values:\n    total += value\n    result.append(total)\nreturn result',
    'vector<int> result;\nint total = 0;\nfor (int value : values) { total += value; result.push_back(total); }\nreturn result;',
    ['Maintain one running sum while traversing the array.']),

  bridge(-10, 'bridge-count-unique-values', 'Count Unique Values',
    'Given an integer array, return the number of distinct values it contains.', 'hash-table', 'countUniqueValues',
    [{ name: 'values', type: 'int_array' }], 'int',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [1, 2, 1, 3] }, output: 3 },
      { input: { values: [] }, output: 0 },
      { input: { values: [5, 5, 5] }, output: 1 },
      { input: { values: [-1, 1, -1] }, output: 2 },
      { input: { values: [1, 2, 3, 4] }, output: 4 }
    ],
    'return len(set(values))',
    'unordered_set<int> unique(values.begin(), values.end());\nreturn static_cast<int>(unique.size());',
    ['A set stores each distinct value once.']),

  bridge(-9, 'bridge-word-lengths', 'Word Lengths',
    'Given an array of strings, return an integer array containing the length of each string.', 'array', 'wordLengths',
    [{ name: 'words', type: 'string_array' }], 'int_array',
    ['The array contains at most 1,000 strings.', 'Each string contains at most 1,000 characters.'],
    [
      { input: { words: ['a', 'code', 'hi'] }, output: [1, 4, 2] },
      { input: { words: [] }, output: [] },
      { input: { words: ['', 'x'] }, output: [0, 1] },
      { input: { words: ['same', 'size'] }, output: [4, 4] },
      { input: { words: ['hello world'] }, output: [11] }
    ],
    'return [len(word) for word in words]',
    'vector<int> result;\nfor (const string& word : words) result.push_back(static_cast<int>(word.size()));\nreturn result;',
    ['Transform each word into its length.']),

  bridge(-8, 'bridge-join-with-dashes', 'Join With Dashes',
    'Given an array of strings, join them in order with one dash between adjacent strings.', 'string', 'joinWithDashes',
    [{ name: 'words', type: 'string_array' }], 'string',
    ['The result contains at most 5,000 characters.'],
    [
      { input: { words: ['one', 'two', 'three'] }, output: 'one-two-three' },
      { input: { words: [] }, output: '' },
      { input: { words: ['solo'] }, output: 'solo' },
      { input: { words: ['', 'x'] }, output: '-x' },
      { input: { words: ['a', '', 'b'] }, output: 'a--b' }
    ],
    "return '-'.join(words)",
    'string result;\nfor (int index = 0; index < static_cast<int>(words.size()); ++index) { if (index) result += \"-\"; result += words[index]; }\nreturn result;',
    ['Add a separator only between elements, not after the last one.']),

  bridge(-7, 'bridge-rotate-left-once', 'Rotate Left Once',
    'Given an integer array, move its first value to the end. Return an empty array unchanged.', 'array', 'rotateLeftOnce',
    [{ name: 'values', type: 'int_array' }], 'int_array',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [1, 2, 3] }, output: [2, 3, 1] },
      { input: { values: [] }, output: [] },
      { input: { values: [5] }, output: [5] },
      { input: { values: [-1, 0] }, output: [0, -1] },
      { input: { values: [4, 4, 2] }, output: [4, 2, 4] }
    ],
    'return values[1:] + values[:1]',
    'if (values.empty()) return {};\nvector<int> result(values.begin() + 1, values.end());\nresult.push_back(values.front());\nreturn result;',
    ['Copy the suffix first, then append the original first element.']),

  bridge(-6, 'bridge-target-frequency', 'Target Frequency',
    'Given an integer array and a target, return how many times the target occurs.', 'hash-table', 'targetFrequency',
    [{ name: 'values', type: 'int_array' }, { name: 'target', type: 'int' }], 'int',
    ['The array contains at most 1,000 values.'],
    [
      { input: { values: [1, 2, 1, 1], target: 1 }, output: 3 },
      { input: { values: [], target: 4 }, output: 0 },
      { input: { values: [2, 3], target: 1 }, output: 0 },
      { input: { values: [-1, -1, 0], target: -1 }, output: 2 },
      { input: { values: [5], target: 5 }, output: 1 }
    ],
    'frequencies = {}\nfor value in values:\n    frequencies[value] = frequencies.get(value, 0) + 1\nreturn frequencies.get(target, 0)',
    'unordered_map<int, int> frequencies;\nfor (int value : values) ++frequencies[value];\nreturn frequencies[target];',
    ['Build a frequency map, then read the target’s count.']),

  bridge(-5, 'bridge-most-frequent-value', 'Most Frequent Value',
    'Return the most frequent value in a non-empty integer array. If several values tie, return the smallest one.', 'hash-table', 'mostFrequentValue',
    [{ name: 'values', type: 'int_array' }], 'int',
    ['The array contains between 1 and 1,000 values.'],
    [
      { input: { values: [1, 2, 2, 3] }, output: 2 },
      { input: { values: [4] }, output: 4 },
      { input: { values: [3, 1, 3, 1] }, output: 1 },
      { input: { values: [-1, -1, 2] }, output: -1 },
      { input: { values: [5, 4, 5, 4, 3] }, output: 4 }
    ],
    'frequencies = {}\nfor value in values:\n    frequencies[value] = frequencies.get(value, 0) + 1\nreturn min(frequencies, key=lambda value: (-frequencies[value], value))',
    'map<int, int> frequencies;\nfor (int value : values) ++frequencies[value];\nint answer = frequencies.begin()->first;\nfor (const auto& [value, count] : frequencies) if (count > frequencies[answer]) answer = value;\nreturn answer;',
    ['Count every value, then compare frequency before value.']),

  bridge(-4, 'bridge-merge-sorted-arrays', 'Merge Two Sorted Arrays',
    'Given two integer arrays sorted in non-decreasing order, return one sorted array containing all their values.', 'two-pointers', 'mergeSortedArrays',
    [{ name: 'left', type: 'int_array' }, { name: 'right', type: 'int_array' }], 'int_array',
    ['Both arrays are sorted in non-decreasing order.', 'Together they contain at most 2,000 values.'],
    [
      { input: { left: [1, 3], right: [2, 4] }, output: [1, 2, 3, 4] },
      { input: { left: [], right: [1, 2] }, output: [1, 2] },
      { input: { left: [1], right: [] }, output: [1] },
      { input: { left: [1, 1], right: [1] }, output: [1, 1, 1] },
      { input: { left: [-3, 5], right: [-2, 4] }, output: [-3, -2, 4, 5] }
    ],
    'result = []\nleft_index = right_index = 0\nwhile left_index < len(left) and right_index < len(right):\n    if left[left_index] <= right[right_index]:\n        result.append(left[left_index]); left_index += 1\n    else:\n        result.append(right[right_index]); right_index += 1\nreturn result + left[left_index:] + right[right_index:]',
    'vector<int> result;\nint i = 0, j = 0;\nwhile (i < static_cast<int>(left.size()) && j < static_cast<int>(right.size())) {\n    if (left[i] <= right[j]) result.push_back(left[i++]); else result.push_back(right[j++]);\n}\nresult.insert(result.end(), left.begin() + i, left.end());\nresult.insert(result.end(), right.begin() + j, right.end());\nreturn result;',
    ['Use one index for each sorted array and repeatedly take the smaller current value.']),

  bridge(-3, 'bridge-balanced-parentheses', 'Balanced Parentheses',
    'Given a string containing only opening and closing parentheses, return whether every opening parenthesis is closed in the correct order.', 'stack', 'balancedParentheses',
    [{ name: 'text', type: 'string' }], 'boolean',
    ['text contains only ( and ).', 'text contains at most 1,000 characters.'],
    [
      { input: { text: '()' }, output: true },
      { input: { text: '(())' }, output: true },
      { input: { text: '()()' }, output: true },
      { input: { text: '' }, output: true },
      { input: { text: '(()' }, output: false },
      { input: { text: ')(' }, output: false },
      { input: { text: '())(' }, output: false }
    ],
    "open_count = 0\nfor character in text:\n    open_count += 1 if character == '(' else -1\n    if open_count < 0:\n        return False\nreturn open_count == 0",
    "int openCount = 0;\nfor (char character : text) {\n    openCount += character == '(' ? 1 : -1;\n    if (openCount < 0) return false;\n}\nreturn openCount == 0;",
    ['Track how many unmatched opening parentheses remain; it must never become negative.']),

  bridge(-2, 'bridge-keep-recent-values', 'Keep Recent Values',
    'Given an integer array and a capacity, return the most recent values that fit in a queue of that capacity. Preserve their original order.', 'queue', 'keepRecentValues',
    [{ name: 'values', type: 'int_array' }, { name: 'capacity', type: 'int' }], 'int_array',
    ['0 <= capacity <= 1,000', 'values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 2, 3, 4], capacity: 2 }, output: [3, 4] },
      { input: { values: [1, 2], capacity: 5 }, output: [1, 2] },
      { input: { values: [1, 2], capacity: 0 }, output: [] },
      { input: { values: [], capacity: 3 }, output: [] },
      { input: { values: [7], capacity: 1 }, output: [7] },
      { input: { values: [-1, 0, 1], capacity: 2 }, output: [0, 1] }
    ],
    'if capacity == 0:\n    return []\nreturn values[-capacity:]',
    'int start = max(0, static_cast<int>(values.size()) - capacity);\nreturn vector<int>(values.begin() + start, values.end());',
    ['A fixed-capacity queue discards its oldest value whenever it grows too large.']),

  bridge(-1, 'bridge-second-largest-distinct', 'Second Largest Distinct Value',
    'Given an integer array containing at least two distinct values, return its second largest distinct value.', 'array', 'secondLargestDistinct',
    [{ name: 'values', type: 'int_array' }], 'int',
    ['The array contains between 2 and 1,000 values.', 'At least two values are distinct.'],
    [
      { input: { values: [1, 3, 2] }, output: 2 },
      { input: { values: [5, 5, 4] }, output: 4 },
      { input: { values: [-3, -1, -2] }, output: -2 },
      { input: { values: [9, 1, 9, 8] }, output: 8 },
      { input: { values: [0, -1] }, output: -1 },
      { input: { values: [2, 4, 3, 4, 2] }, output: 3 }
    ],
    'largest = second = None\nfor value in values:\n    if value == largest or value == second:\n        continue\n    if largest is None or value > largest:\n        second, largest = largest, value\n    elif second is None or value > second:\n        second = value\nreturn second',
    'int largest = INT_MIN, second = INT_MIN;\nfor (int value : values) {\n    if (value > largest) { second = largest; largest = value; }\n    else if (value < largest && value > second) second = value;\n}\nreturn second;',
    ['Track the largest and second-largest distinct values while scanning once.'])
];

const additionalBridgeProblems = [
  bridge(-1, 'bridge-subtract-numbers', 'Subtract Two Numbers',
    'Given two integers, subtract the second from the first.', 'math', 'subtractNumbers',
    [{ name: 'left', type: 'int' }, { name: 'right', type: 'int' }], 'int',
    ['The result fits in a 32-bit signed integer.'],
    [
      { input: { left: 7, right: 3 }, output: 4 },
      { input: { left: 3, right: 7 }, output: -4 },
      { input: { left: 0, right: 0 }, output: 0 },
      { input: { left: -2, right: -5 }, output: 3 },
      { input: { left: 100, right: 1 }, output: 99 }
    ],
    'return left - right', 'return left - right;', ['Subtract right from left.']),

  bridge(-1, 'bridge-multiply-numbers', 'Multiply Two Numbers',
    'Given two integers, return their product.', 'math', 'multiplyNumbers',
    [{ name: 'left', type: 'int' }, { name: 'right', type: 'int' }], 'int',
    ['The product fits in a 32-bit signed integer.'],
    [
      { input: { left: 4, right: 3 }, output: 12 },
      { input: { left: -2, right: 5 }, output: -10 },
      { input: { left: 0, right: 8 }, output: 0 },
      { input: { left: -3, right: -4 }, output: 12 },
      { input: { left: 1, right: 99 }, output: 99 }
    ],
    'return left * right', 'return left * right;', ['Multiply the parameters directly.']),

  bridge(-1, 'bridge-is-positive', 'Is the Number Positive?',
    'Return true only when the given integer is greater than zero.', 'math', 'isPositive',
    [{ name: 'value', type: 'int' }], 'boolean', ['The value fits in a 32-bit signed integer.'],
    [
      { input: { value: 5 }, output: true },
      { input: { value: 0 }, output: false },
      { input: { value: -1 }, output: false },
      { input: { value: 100 }, output: true },
      { input: { value: -100 }, output: false }
    ],
    'return value > 0', 'return value > 0;', ['Compare the value with zero.']),

  bridge(-1, 'bridge-is-divisible', 'Is Divisible?',
    'Given an integer value and a non-zero divisor, return whether the divisor divides the value evenly.', 'math', 'isDivisible',
    [{ name: 'value', type: 'int' }, { name: 'divisor', type: 'int' }], 'boolean',
    ['divisor is not zero.'],
    [
      { input: { value: 12, divisor: 3 }, output: true },
      { input: { value: 10, divisor: 4 }, output: false },
      { input: { value: 0, divisor: 5 }, output: true },
      { input: { value: -9, divisor: 3 }, output: true },
      { input: { value: 7, divisor: -2 }, output: false }
    ],
    'return value % divisor == 0', 'return value % divisor == 0;', ['Check whether the remainder is zero.']),

  bridge(-1, 'bridge-in-inclusive-range', 'Inside an Inclusive Range',
    'Return whether a value lies between a lower and upper bound, including both bounds.', 'math', 'inInclusiveRange',
    [{ name: 'value', type: 'int' }, { name: 'lower', type: 'int' }, { name: 'upper', type: 'int' }], 'boolean',
    ['lower <= upper.'],
    [
      { input: { value: 5, lower: 1, upper: 10 }, output: true },
      { input: { value: 1, lower: 1, upper: 10 }, output: true },
      { input: { value: 10, lower: 1, upper: 10 }, output: true },
      { input: { value: 0, lower: 1, upper: 10 }, output: false },
      { input: { value: -2, lower: -5, upper: -3 }, output: false }
    ],
    'return lower <= value <= upper', 'return lower <= value && value <= upper;', ['Check both range boundaries.']),

  bridge(-1, 'bridge-last-digit', 'Last Decimal Digit',
    'Return the final decimal digit of an integer as a non-negative value.', 'math', 'lastDigit',
    [{ name: 'value', type: 'int' }], 'int', ['The value is not the minimum 32-bit integer.'],
    [
      { input: { value: 123 }, output: 3 },
      { input: { value: -456 }, output: 6 },
      { input: { value: 0 }, output: 0 },
      { input: { value: 9 }, output: 9 },
      { input: { value: -10 }, output: 0 }
    ],
    'return abs(value) % 10', 'return abs(value) % 10;', ['Use the remainder after division by ten.']),

  bridge(-1, 'bridge-last-character', 'Last Character',
    'Given a non-empty string, return its last character as a one-character string.', 'string', 'lastCharacter',
    [{ name: 'text', type: 'string' }], 'string', ['text contains at least one character.'],
    [
      { input: { text: 'code' }, output: 'e' },
      { input: { text: 'A' }, output: 'A' },
      { input: { text: 'hello ' }, output: ' ' },
      { input: { text: '123' }, output: '3' },
      { input: { text: 'zebra' }, output: 'a' }
    ],
    'return text[-1]', 'return string(1, text.back());', ['Use the final valid string position.']),

  bridge(-1, 'bridge-uppercase-text', 'Uppercase Text',
    'Convert every English letter in a string to uppercase and return the result.', 'string', 'uppercaseText',
    [{ name: 'text', type: 'string' }], 'string', ['text contains printable ASCII characters.'],
    [
      { input: { text: 'hello' }, output: 'HELLO' },
      { input: { text: 'Code123' }, output: 'CODE123' },
      { input: { text: '' }, output: '' },
      { input: { text: 'ALREADY' }, output: 'ALREADY' },
      { input: { text: 'a b' }, output: 'A B' }
    ],
    'return text.upper()',
    'string result = text;\nfor (char& character : result) character = static_cast<char>(toupper(static_cast<unsigned char>(character)));\nreturn result;',
    ['Transform each character with the language’s uppercase operation.']),

  bridge(-1, 'bridge-lowercase-text', 'Lowercase Text',
    'Convert every English letter in a string to lowercase and return the result.', 'string', 'lowercaseText',
    [{ name: 'text', type: 'string' }], 'string', ['text contains printable ASCII characters.'],
    [
      { input: { text: 'HELLO' }, output: 'hello' },
      { input: { text: 'Code123' }, output: 'code123' },
      { input: { text: '' }, output: '' },
      { input: { text: 'already' }, output: 'already' },
      { input: { text: 'A B' }, output: 'a b' }
    ],
    'return text.lower()',
    'string result = text;\nfor (char& character : result) character = static_cast<char>(tolower(static_cast<unsigned char>(character)));\nreturn result;',
    ['Transform each character with the language’s lowercase operation.']),

  bridge(-1, 'bridge-remove-spaces', 'Remove Spaces',
    'Return a string with every ordinary space character removed.', 'string', 'removeSpaces',
    [{ name: 'text', type: 'string' }], 'string', ['text contains at most 1,000 printable ASCII characters.'],
    [
      { input: { text: 'a b c' }, output: 'abc' },
      { input: { text: '' }, output: '' },
      { input: { text: 'no-spaces' }, output: 'no-spaces' },
      { input: { text: '  hi  ' }, output: 'hi' },
      { input: { text: '   ' }, output: '' }
    ],
    "return text.replace(' ', '')",
    "string result;\nfor (char character : text) if (character != ' ') result += character;\nreturn result;",
    ['Keep only characters that are not spaces.']),

  bridge(-1, 'bridge-count-words', 'Count Words',
    'Given a string whose words are separated by one or more spaces, return the number of words.', 'string', 'countWords',
    [{ name: 'text', type: 'string' }], 'int', ['text contains letters and ordinary spaces only.'],
    [
      { input: { text: 'hello world' }, output: 2 },
      { input: { text: '' }, output: 0 },
      { input: { text: ' one  two ' }, output: 2 },
      { input: { text: 'single' }, output: 1 },
      { input: { text: '   ' }, output: 0 }
    ],
    'return len(text.split())',
    "int result = 0;\nbool inside = false;\nfor (char character : text) { if (character != ' ' && !inside) ++result; inside = character != ' '; }\nreturn result;",
    ['A word begins at a non-space character that does not continue another word.']),

  bridge(-1, 'bridge-starts-with', 'Starts With',
    'Return whether a string begins with a given prefix.', 'string', 'startsWith',
    [{ name: 'text', type: 'string' }, { name: 'prefix', type: 'string' }], 'boolean',
    ['Both strings contain at most 1,000 characters.'],
    [
      { input: { text: 'codegate', prefix: 'code' }, output: true },
      { input: { text: 'codegate', prefix: 'gate' }, output: false },
      { input: { text: 'abc', prefix: '' }, output: true },
      { input: { text: '', prefix: 'a' }, output: false },
      { input: { text: 'same', prefix: 'same' }, output: true }
    ],
    'return text.startswith(prefix)', 'return text.rfind(prefix, 0) == 0;', ['Compare the prefix with the beginning of the string.']),

  bridge(-1, 'bridge-ends-with', 'Ends With',
    'Return whether a string ends with a given suffix.', 'string', 'endsWith',
    [{ name: 'text', type: 'string' }, { name: 'suffix', type: 'string' }], 'boolean',
    ['Both strings contain at most 1,000 characters.'],
    [
      { input: { text: 'codegate', suffix: 'gate' }, output: true },
      { input: { text: 'codegate', suffix: 'code' }, output: false },
      { input: { text: 'abc', suffix: '' }, output: true },
      { input: { text: '', suffix: 'a' }, output: false },
      { input: { text: 'same', suffix: 'same' }, output: true }
    ],
    'return text.endswith(suffix)',
    'return suffix.size() <= text.size() && text.compare(text.size() - suffix.size(), suffix.size(), suffix) == 0;',
    ['Compare the suffix with the final characters of the string.']),

  bridge(-1, 'bridge-contains-text', 'Contains Text',
    'Return whether a string contains a given substring.', 'string', 'containsText',
    [{ name: 'text', type: 'string' }, { name: 'part', type: 'string' }], 'boolean',
    ['Both strings contain at most 1,000 characters.'],
    [
      { input: { text: 'codegate', part: 'deg' }, output: true },
      { input: { text: 'codegate', part: 'xyz' }, output: false },
      { input: { text: 'abc', part: '' }, output: true },
      { input: { text: '', part: 'a' }, output: false },
      { input: { text: 'same', part: 'same' }, output: true }
    ],
    'return part in text', 'return text.find(part) != string::npos;', ['Use the string substring-search operation.']),

  bridge(-1, 'bridge-remove-character', 'Remove a Character',
    'Remove every occurrence of a one-character target string from the given text.', 'string', 'removeCharacter',
    [{ name: 'text', type: 'string' }, { name: 'target', type: 'string' }], 'string',
    ['target contains exactly one character.'],
    [
      { input: { text: 'banana', target: 'a' }, output: 'bnn' },
      { input: { text: 'hello', target: 'z' }, output: 'hello' },
      { input: { text: '', target: 'x' }, output: '' },
      { input: { text: '111', target: '1' }, output: '' },
      { input: { text: 'AaA', target: 'A' }, output: 'a' }
    ],
    "return text.replace(target, '')",
    'string result;\nfor (char character : text) if (character != target[0]) result += character;\nreturn result;',
    ['Keep only characters different from the target.']),

  bridge(-1, 'bridge-string-palindrome', 'Is the String a Palindrome?',
    'Return whether a string reads the same from left to right and right to left.', 'two-pointers', 'isStringPalindrome',
    [{ name: 'text', type: 'string' }], 'boolean', ['Comparison is case-sensitive and includes every character.'],
    [
      { input: { text: 'level' }, output: true },
      { input: { text: 'code' }, output: false },
      { input: { text: '' }, output: true },
      { input: { text: 'a' }, output: true },
      { input: { text: 'ab ba' }, output: true }
    ],
    'return text == text[::-1]',
    'return equal(text.begin(), text.begin() + text.size() / 2, text.rbegin());',
    ['Compare matching characters from the two ends.']),

  bridge(-1, 'bridge-every-other-character', 'Every Other Character',
    'Return the characters at indexes 0, 2, 4, and so on.', 'string', 'everyOtherCharacter',
    [{ name: 'text', type: 'string' }], 'string', ['text contains at most 1,000 characters.'],
    [
      { input: { text: 'abcdef' }, output: 'ace' },
      { input: { text: 'abcde' }, output: 'ace' },
      { input: { text: '' }, output: '' },
      { input: { text: 'x' }, output: 'x' },
      { input: { text: '12 34' }, output: '1 4' }
    ],
    'return text[::2]',
    'string result;\nfor (int index = 0; index < static_cast<int>(text.size()); index += 2) result += text[index];\nreturn result;',
    ['Advance the index by two after each selected character.']),

  bridge(-1, 'bridge-first-and-last-sum', 'First and Last Sum',
    'Given a non-empty integer array, return the sum of its first and last values.', 'array', 'firstAndLastSum',
    [{ name: 'values', type: 'int_array' }], 'int', ['values contains at least one element.'],
    [
      { input: { values: [1, 2, 3] }, output: 4 },
      { input: { values: [5] }, output: 10 },
      { input: { values: [-2, 4] }, output: 2 },
      { input: { values: [0, 1, 0] }, output: 0 },
      { input: { values: [10, -3, -4] }, output: 6 }
    ],
    'return values[0] + values[-1]', 'return values.front() + values.back();', ['Access both ends of the array.']),

  bridge(-1, 'bridge-smallest-value', 'Smallest Array Value',
    'Given a non-empty integer array, return its smallest value.', 'array', 'smallestValue',
    [{ name: 'values', type: 'int_array' }], 'int', ['values contains at least one element.'],
    [
      { input: { values: [3, 1, 7] }, output: 1 },
      { input: { values: [-8, -2, -5] }, output: -8 },
      { input: { values: [4] }, output: 4 },
      { input: { values: [9, 9, 3] }, output: 3 },
      { input: { values: [0, -1, 1] }, output: -1 }
    ],
    'return min(values)', 'return *min_element(values.begin(), values.end());', ['Track or select the minimum element.']),

  bridge(-1, 'bridge-count-positive-values', 'Count Positive Values',
    'Return how many values in an integer array are greater than zero.', 'array', 'countPositiveValues',
    [{ name: 'values', type: 'int_array' }], 'int', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [-1, 2, 3] }, output: 2 },
      { input: { values: [] }, output: 0 },
      { input: { values: [0, 0] }, output: 0 },
      { input: { values: [1, 2] }, output: 2 },
      { input: { values: [-2, -3] }, output: 0 }
    ],
    'return sum(value > 0 for value in values)',
    'int result = 0;\nfor (int value : values) if (value > 0) ++result;\nreturn result;',
    ['Count elements that pass a greater-than-zero test.']),

  bridge(-1, 'bridge-count-negative-values', 'Count Negative Values',
    'Return how many values in an integer array are less than zero.', 'array', 'countNegativeValues',
    [{ name: 'values', type: 'int_array' }], 'int', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [-1, 2, -3] }, output: 2 },
      { input: { values: [] }, output: 0 },
      { input: { values: [0, 0] }, output: 0 },
      { input: { values: [-1, -2] }, output: 2 },
      { input: { values: [2, 3] }, output: 0 }
    ],
    'return sum(value < 0 for value in values)',
    'int result = 0;\nfor (int value : values) if (value < 0) ++result;\nreturn result;',
    ['Count elements that pass a less-than-zero test.']),

  bridge(-1, 'bridge-count-greater-than', 'Count Values Greater Than a Target',
    'Given an integer array and a target, return how many values are greater than the target.', 'array', 'countGreaterThan',
    [{ name: 'values', type: 'int_array' }, { name: 'target', type: 'int' }], 'int',
    ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 4, 7], target: 3 }, output: 2 },
      { input: { values: [], target: 0 }, output: 0 },
      { input: { values: [2, 2], target: 2 }, output: 0 },
      { input: { values: [-1, 0, 1], target: -2 }, output: 3 },
      { input: { values: [5], target: 4 }, output: 1 }
    ],
    'return sum(value > target for value in values)',
    'int result = 0;\nfor (int value : values) if (value > target) ++result;\nreturn result;',
    ['Compare each element with the target.']),

  bridge(-1, 'bridge-product-values', 'Product of Values',
    'Given an integer array, return the product of all values. Return 1 for an empty array.', 'array', 'productValues',
    [{ name: 'values', type: 'int_array' }], 'int', ['The product fits in a 32-bit signed integer.'],
    [
      { input: { values: [2, 3, 4] }, output: 24 },
      { input: { values: [] }, output: 1 },
      { input: { values: [-2, 5] }, output: -10 },
      { input: { values: [0, 7] }, output: 0 },
      { input: { values: [-2, -3] }, output: 6 }
    ],
    'result = 1\nfor value in values:\n    result *= value\nreturn result',
    'int result = 1;\nfor (int value : values) result *= value;\nreturn result;',
    ['Start at one and multiply every element.']),

  bridge(-1, 'bridge-negate-values', 'Negate Every Value',
    'Return an array where every integer has its sign reversed.', 'array', 'negateValues',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['No value is the minimum 32-bit integer.'],
    [
      { input: { values: [1, -2, 0] }, output: [-1, 2, 0] },
      { input: { values: [] }, output: [] },
      { input: { values: [5] }, output: [-5] },
      { input: { values: [-3, -4] }, output: [3, 4] },
      { input: { values: [0, 0] }, output: [0, 0] }
    ],
    'return [-value for value in values]',
    'vector<int> result;\nfor (int value : values) result.push_back(-value);\nreturn result;',
    ['Multiply each value by negative one.']),

  bridge(-1, 'bridge-absolute-values', 'Absolute Values',
    'Return an array containing the absolute value of every input integer.', 'array', 'absoluteValues',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['No value is the minimum 32-bit integer.'],
    [
      { input: { values: [-1, 2, -3] }, output: [1, 2, 3] },
      { input: { values: [] }, output: [] },
      { input: { values: [0] }, output: [0] },
      { input: { values: [-5, -5] }, output: [5, 5] },
      { input: { values: [4, 3] }, output: [4, 3] }
    ],
    'return [abs(value) for value in values]',
    'vector<int> result;\nfor (int value : values) result.push_back(abs(value));\nreturn result;',
    ['Apply absolute value independently to each element.']),

  bridge(-1, 'bridge-reverse-values', 'Reverse an Array',
    'Return a new integer array with the input values in reverse order.', 'array', 'reverseValues',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 2, 3] }, output: [3, 2, 1] },
      { input: { values: [] }, output: [] },
      { input: { values: [5] }, output: [5] },
      { input: { values: [-1, 0] }, output: [0, -1] },
      { input: { values: [2, 2, 3] }, output: [3, 2, 2] }
    ],
    'return values[::-1]',
    'return vector<int>(values.rbegin(), values.rend());',
    ['Traverse the array from its final element to its first.']),

  bridge(-1, 'bridge-concatenate-arrays', 'Concatenate Two Arrays',
    'Return all values from the first integer array followed by all values from the second.', 'array', 'concatenateArrays',
    [{ name: 'left', type: 'int_array' }, { name: 'right', type: 'int_array' }], 'int_array',
    ['Together the arrays contain at most 2,000 elements.'],
    [
      { input: { left: [1, 2], right: [3, 4] }, output: [1, 2, 3, 4] },
      { input: { left: [], right: [1] }, output: [1] },
      { input: { left: [1], right: [] }, output: [1] },
      { input: { left: [], right: [] }, output: [] },
      { input: { left: [-1], right: [0, 1] }, output: [-1, 0, 1] }
    ],
    'return left + right',
    'vector<int> result = left;\nresult.insert(result.end(), right.begin(), right.end());\nreturn result;',
    ['Append the second array after a copy of the first.']),

  bridge(-1, 'bridge-take-first-values', 'Take the First Values',
    'Given an integer array and a non-negative count, return its first count values, or the entire array when count is larger.', 'array', 'takeFirstValues',
    [{ name: 'values', type: 'int_array' }, { name: 'count', type: 'int' }], 'int_array',
    ['count is non-negative.'],
    [
      { input: { values: [1, 2, 3], count: 2 }, output: [1, 2] },
      { input: { values: [1, 2], count: 5 }, output: [1, 2] },
      { input: { values: [1], count: 0 }, output: [] },
      { input: { values: [], count: 3 }, output: [] },
      { input: { values: [-1, 0, 1], count: 1 }, output: [-1] }
    ],
    'return values[:count]',
    'int end = min(count, static_cast<int>(values.size()));\nreturn vector<int>(values.begin(), values.begin() + end);',
    ['Clamp the ending position to the array length.']),

  bridge(-1, 'bridge-drop-first-values', 'Drop the First Values',
    'Given an integer array and a non-negative count, remove its first count values and return what remains.', 'array', 'dropFirstValues',
    [{ name: 'values', type: 'int_array' }, { name: 'count', type: 'int' }], 'int_array',
    ['count is non-negative.'],
    [
      { input: { values: [1, 2, 3], count: 1 }, output: [2, 3] },
      { input: { values: [1, 2], count: 5 }, output: [] },
      { input: { values: [1], count: 0 }, output: [1] },
      { input: { values: [], count: 3 }, output: [] },
      { input: { values: [-1, 0, 1], count: 2 }, output: [1] }
    ],
    'return values[count:]',
    'int start = min(count, static_cast<int>(values.size()));\nreturn vector<int>(values.begin() + start, values.end());',
    ['Clamp the starting position to the array length.']),

  bridge(-1, 'bridge-duplicate-values', 'Duplicate Every Value',
    'Return an array where each input value appears twice consecutively.', 'array', 'duplicateValues',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 500 elements.'],
    [
      { input: { values: [1, 2] }, output: [1, 1, 2, 2] },
      { input: { values: [] }, output: [] },
      { input: { values: [5] }, output: [5, 5] },
      { input: { values: [-1, 0] }, output: [-1, -1, 0, 0] },
      { input: { values: [2, 2] }, output: [2, 2, 2, 2] }
    ],
    'return [value for value in values for _ in range(2)]',
    'vector<int> result;\nfor (int value : values) { result.push_back(value); result.push_back(value); }\nreturn result;',
    ['Append each encountered value two times.']),

  bridge(-1, 'bridge-target-indices', 'Indexes of a Target',
    'Return every index where a target occurs in an integer array.', 'array', 'targetIndices',
    [{ name: 'values', type: 'int_array' }, { name: 'target', type: 'int' }], 'int_array',
    ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 2, 1], target: 1 }, output: [0, 2] },
      { input: { values: [], target: 0 }, output: [] },
      { input: { values: [2, 3], target: 1 }, output: [] },
      { input: { values: [5, 5], target: 5 }, output: [0, 1] },
      { input: { values: [-1, 0, -1], target: -1 }, output: [0, 2] }
    ],
    'return [index for index, value in enumerate(values) if value == target]',
    'vector<int> result;\nfor (int index = 0; index < static_cast<int>(values.size()); ++index) if (values[index] == target) result.push_back(index);\nreturn result;',
    ['Inspect each index and append it after a match.']),

  bridge(-1, 'bridge-adjacent-differences', 'Adjacent Differences',
    'Return the difference between each value and the value immediately before it.', 'array', 'adjacentDifferences',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [2, 5, 4] }, output: [3, -1] },
      { input: { values: [] }, output: [] },
      { input: { values: [7] }, output: [] },
      { input: { values: [-2, 1] }, output: [3] },
      { input: { values: [3, 3, 3] }, output: [0, 0] }
    ],
    'return [values[index] - values[index - 1] for index in range(1, len(values))]',
    'vector<int> result;\nfor (int index = 1; index < static_cast<int>(values.size()); ++index) result.push_back(values[index] - values[index - 1]);\nreturn result;',
    ['Begin at index one and compare with index minus one.']),

  bridge(-1, 'bridge-count-increases', 'Count Increases',
    'Return how many array values are greater than the value immediately before them.', 'array', 'countIncreases',
    [{ name: 'values', type: 'int_array' }], 'int', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 3, 2, 5] }, output: 2 },
      { input: { values: [] }, output: 0 },
      { input: { values: [7] }, output: 0 },
      { input: { values: [3, 2, 1] }, output: 0 },
      { input: { values: [1, 1, 2] }, output: 1 }
    ],
    'return sum(values[index] > values[index - 1] for index in range(1, len(values)))',
    'int result = 0;\nfor (int index = 1; index < static_cast<int>(values.size()); ++index) if (values[index] > values[index - 1]) ++result;\nreturn result;',
    ['Compare every element after the first with its predecessor.']),

  bridge(-1, 'bridge-longest-word', 'Longest Word',
    'Return the longest word. If several words share the greatest length, return the first one.', 'string', 'longestWord',
    [{ name: 'words', type: 'string_array' }], 'string', ['words is non-empty.'],
    [
      { input: { words: ['a', 'three', 'two'] }, output: 'three' },
      { input: { words: ['same', 'size'] }, output: 'same' },
      { input: { words: ['x'] }, output: 'x' },
      { input: { words: ['', 'hi'] }, output: 'hi' },
      { input: { words: ['cat', 'elephant', 'dog'] }, output: 'elephant' }
    ],
    'return max(words, key=len)',
    'string result = words[0];\nfor (const string& word : words) if (word.size() > result.size()) result = word;\nreturn result;',
    ['Keep the first word unless a strictly longer one appears.']),

  bridge(-1, 'bridge-shortest-word', 'Shortest Word',
    'Return the shortest word. If several words share the smallest length, return the first one.', 'string', 'shortestWord',
    [{ name: 'words', type: 'string_array' }], 'string', ['words is non-empty.'],
    [
      { input: { words: ['three', 'a', 'two'] }, output: 'a' },
      { input: { words: ['same', 'size'] }, output: 'same' },
      { input: { words: ['x'] }, output: 'x' },
      { input: { words: ['', 'hi'] }, output: '' },
      { input: { words: ['horse', 'cat', 'dog'] }, output: 'cat' }
    ],
    'return min(words, key=len)',
    'string result = words[0];\nfor (const string& word : words) if (word.size() < result.size()) result = word;\nreturn result;',
    ['Update the answer only after finding a strictly shorter word.']),

  bridge(-1, 'bridge-remove-duplicates', 'Remove Duplicate Values',
    'Return the values in their original order, keeping only the first occurrence of each value.', 'set', 'removeDuplicates',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 2, 1, 3] }, output: [1, 2, 3] },
      { input: { values: [] }, output: [] },
      { input: { values: [5, 5, 5] }, output: [5] },
      { input: { values: [-1, 0, -1] }, output: [-1, 0] },
      { input: { values: [3, 2, 1] }, output: [3, 2, 1] }
    ],
    'seen = set()\nreturn [value for value in values if not (value in seen or seen.add(value))]',
    'unordered_set<int> seen;\nvector<int> result;\nfor (int value : values) if (seen.insert(value).second) result.push_back(value);\nreturn result;',
    ['Use a set to remember values already appended.']),

  bridge(-1, 'bridge-sorted-unique-values', 'Sorted Unique Values',
    'Return every distinct input value in increasing order.', 'set', 'sortedUniqueValues',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [3, 1, 3, 2] }, output: [1, 2, 3] },
      { input: { values: [] }, output: [] },
      { input: { values: [5, 5] }, output: [5] },
      { input: { values: [-1, 2, -1] }, output: [-1, 2] },
      { input: { values: [2, 1] }, output: [1, 2] }
    ],
    'return sorted(set(values))',
    'set<int> unique(values.begin(), values.end());\nreturn vector<int>(unique.begin(), unique.end());',
    ['A sorted set both removes duplicates and orders the values.']),

  bridge(-1, 'bridge-set-union', 'Union of Two Value Sets',
    'Return the distinct values appearing in either array, in increasing order.', 'set', 'setUnion',
    [{ name: 'left', type: 'int_array' }, { name: 'right', type: 'int_array' }], 'int_array',
    ['Each array contains at most 1,000 elements.'],
    [
      { input: { left: [1, 2], right: [2, 3] }, output: [1, 2, 3] },
      { input: { left: [], right: [] }, output: [] },
      { input: { left: [1], right: [] }, output: [1] },
      { input: { left: [-1, 2], right: [-1, 0] }, output: [-1, 0, 2] },
      { input: { left: [3, 3], right: [2, 2] }, output: [2, 3] }
    ],
    'return sorted(set(left) | set(right))',
    'set<int> values(left.begin(), left.end());\nvalues.insert(right.begin(), right.end());\nreturn vector<int>(values.begin(), values.end());',
    ['Insert both arrays into one sorted set.']),

  bridge(-1, 'bridge-set-intersection', 'Intersection of Two Value Sets',
    'Return the distinct values appearing in both arrays, in increasing order.', 'set', 'setIntersection',
    [{ name: 'left', type: 'int_array' }, { name: 'right', type: 'int_array' }], 'int_array',
    ['Each array contains at most 1,000 elements.'],
    [
      { input: { left: [1, 2], right: [2, 3] }, output: [2] },
      { input: { left: [], right: [1] }, output: [] },
      { input: { left: [1, 1], right: [1] }, output: [1] },
      { input: { left: [-1, 0], right: [-1, 2] }, output: [-1] },
      { input: { left: [3, 2, 1], right: [1, 3] }, output: [1, 3] }
    ],
    'return sorted(set(left) & set(right))',
    'set<int> a(left.begin(), left.end()), b(right.begin(), right.end());\nvector<int> result;\nset_intersection(a.begin(), a.end(), b.begin(), b.end(), back_inserter(result));\nreturn result;',
    ['Convert both arrays to sets, then keep shared values.']),

  bridge(-1, 'bridge-move-zeros-to-end', 'Move Zeros to the End',
    'Return the array with all nonzero values first in their original order, followed by every zero.', 'array', 'moveZerosToEnd',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [0, 1, 0, 2] }, output: [1, 2, 0, 0] },
      { input: { values: [] }, output: [] },
      { input: { values: [0, 0] }, output: [0, 0] },
      { input: { values: [1, 2] }, output: [1, 2] },
      { input: { values: [-1, 0, 3] }, output: [-1, 3, 0] }
    ],
    'return [value for value in values if value != 0] + [0] * values.count(0)',
    'vector<int> result;\nfor (int value : values) if (value != 0) result.push_back(value);\nresult.resize(values.size(), 0);\nreturn result;',
    ['Collect nonzero values, then append the required number of zeros.']),

  bridge(-1, 'bridge-even-before-odd', 'Even Values Before Odd Values',
    'Return all even values in their original order, followed by all odd values in their original order.', 'array', 'evenBeforeOdd',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 2, 3, 4] }, output: [2, 4, 1, 3] },
      { input: { values: [] }, output: [] },
      { input: { values: [2, 4] }, output: [2, 4] },
      { input: { values: [1, 3] }, output: [1, 3] },
      { input: { values: [-1, -2, 0] }, output: [-2, 0, -1] }
    ],
    'return [value for value in values if value % 2 == 0] + [value for value in values if value % 2 != 0]',
    'vector<int> result;\nfor (int value : values) if (value % 2 == 0) result.push_back(value);\nfor (int value : values) if (value % 2 != 0) result.push_back(value);\nreturn result;',
    ['Make one pass for even values and another for odd values.']),

  bridge(-1, 'bridge-query-frequencies', 'Answer Frequency Queries',
    'For each query, return how many times that value occurs in the input array.', 'map', 'queryFrequencies',
    [{ name: 'values', type: 'int_array' }, { name: 'queries', type: 'int_array' }], 'int_array',
    ['The arrays contain at most 1,000 elements each.'],
    [
      { input: { values: [1, 2, 1], queries: [1, 2, 3] }, output: [2, 1, 0] },
      { input: { values: [], queries: [0] }, output: [0] },
      { input: { values: [5, 5], queries: [] }, output: [] },
      { input: { values: [-1, 0, -1], queries: [-1, 0] }, output: [2, 1] },
      { input: { values: [3], queries: [3, 3] }, output: [1, 1] }
    ],
    'counts = {}\nfor value in values: counts[value] = counts.get(value, 0) + 1\nreturn [counts.get(query, 0) for query in queries]',
    'unordered_map<int, int> counts;\nfor (int value : values) ++counts[value];\nvector<int> result;\nfor (int query : queries) result.push_back(counts[query]);\nreturn result;',
    ['Build the frequency map once, then look up every query.']),

  bridge(-1, 'bridge-letter-frequencies', 'Lowercase Letter Frequencies',
    'Return 26 counts for the lowercase English letters from a through z.', 'map', 'letterFrequencies',
    [{ name: 'text', type: 'string' }], 'int_array', ['text contains only lowercase English letters.'],
    [
      { input: { text: 'aba' }, output: [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { input: { text: '' }, output: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { input: { text: 'z' }, output: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
      { input: { text: 'abc' }, output: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { input: { text: 'aaa' }, output: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    ],
    'counts = [0] * 26\nfor character in text: counts[ord(character) - ord("a")] += 1\nreturn counts',
    'vector<int> counts(26);\nfor (char character : text) ++counts[character - \'a\'];\nreturn counts;',
    ['Use each letter offset from a as an array index.']),

  bridge(-1, 'bridge-digit-frequencies', 'Digit Frequencies',
    'Return 10 counts for the integer digits from 0 through 9.', 'map', 'digitFrequencies',
    [{ name: 'digits', type: 'int_array' }], 'int_array', ['Every value is between 0 and 9.'],
    [
      { input: { digits: [1, 2, 1] }, output: [0, 2, 1, 0, 0, 0, 0, 0, 0, 0] },
      { input: { digits: [] }, output: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { input: { digits: [0, 9] }, output: [1, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
      { input: { digits: [5, 5, 5] }, output: [0, 0, 0, 0, 0, 3, 0, 0, 0, 0] },
      { input: { digits: [3, 2, 1, 0] }, output: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0] }
    ],
    'counts = [0] * 10\nfor digit in digits: counts[digit] += 1\nreturn counts',
    'vector<int> counts(10);\nfor (int digit : digits) ++counts[digit];\nreturn counts;',
    ['Each digit can be used directly as its count-array index.']),

  bridge(-1, 'bridge-cancel-adjacent-pairs', 'Cancel Adjacent Equal Pairs',
    'Repeatedly remove adjacent equal characters and return the remaining string.', 'stack', 'cancelAdjacentPairs',
    [{ name: 'text', type: 'string' }], 'string', ['text contains at most 1,000 characters.'],
    [
      { input: { text: 'abbaca' }, output: 'ca' },
      { input: { text: '' }, output: '' },
      { input: { text: 'aa' }, output: '' },
      { input: { text: 'abc' }, output: 'abc' },
      { input: { text: 'azxxzy' }, output: 'ay' }
    ],
    'stack = []\nfor character in text:\n    if stack and stack[-1] == character: stack.pop()\n    else: stack.append(character)\nreturn "".join(stack)',
    'string result;\nfor (char character : text) {\n    if (!result.empty() && result.back() == character) result.pop_back();\n    else result.push_back(character);\n}\nreturn result;',
    ['Use the end of a string or list as a stack.']),

  bridge(-1, 'bridge-rotate-left-by-k', 'Rotate Left by K',
    'Return the array after moving its first k values to the end. An empty array remains empty.', 'queue', 'rotateLeftByK',
    [{ name: 'values', type: 'int_array' }, { name: 'k', type: 'int' }], 'int_array',
    ['k is non-negative.'],
    [
      { input: { values: [1, 2, 3, 4], k: 2 }, output: [3, 4, 1, 2] },
      { input: { values: [], k: 5 }, output: [] },
      { input: { values: [1, 2], k: 0 }, output: [1, 2] },
      { input: { values: [1, 2, 3], k: 4 }, output: [2, 3, 1] },
      { input: { values: [7], k: 9 }, output: [7] }
    ],
    'if not values: return []\nk %= len(values)\nreturn values[k:] + values[:k]',
    'if (values.empty()) return {};\nint offset = k % values.size();\nvector<int> result(values.begin() + offset, values.end());\nresult.insert(result.end(), values.begin(), values.begin() + offset);\nreturn result;',
    ['Reduce k modulo the array length before slicing.']),

  bridge(-1, 'bridge-pair-sum-exists', 'Pair With a Target Sum',
    'Return true if two different array positions contain values whose sum equals the target.', 'set', 'pairSumExists',
    [{ name: 'values', type: 'int_array' }, { name: 'target', type: 'int' }], 'boolean',
    ['values contains at most 1,000 elements.'],
    [
      { input: { values: [2, 7, 1], target: 9 }, output: true },
      { input: { values: [], target: 0 }, output: false },
      { input: { values: [3], target: 6 }, output: false },
      { input: { values: [3, 3], target: 6 }, output: true },
      { input: { values: [-2, 5, 4], target: 2 }, output: true }
    ],
    'seen = set()\nfor value in values:\n    if target - value in seen: return True\n    seen.add(value)\nreturn False',
    'unordered_set<int> seen;\nfor (int value : values) {\n    if (seen.count(target - value)) return true;\n    seen.insert(value);\n}\nreturn false;',
    ['Before storing each value, look for the complement already seen.']),

  bridge(-1, 'bridge-row-sums', 'Matrix Row Sums',
    'Return the sum of each row in an integer matrix.', 'matrix', 'rowSums',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int_array', ['The matrix may be empty.'],
    [
      { input: { matrix: [[1, 2], [3, 4]] }, output: [3, 7] },
      { input: { matrix: [] }, output: [] },
      { input: { matrix: [[]] }, output: [0] },
      { input: { matrix: [[-1, 1], [5]] }, output: [0, 5] },
      { input: { matrix: [[7]] }, output: [7] }
    ],
    'return [sum(row) for row in matrix]',
    'vector<int> result;\nfor (const auto& row : matrix) result.push_back(accumulate(row.begin(), row.end(), 0));\nreturn result;',
    ['Compute one independent sum for each row.']),

  bridge(-1, 'bridge-column-sums', 'Matrix Column Sums',
    'Return the sum of each column in a rectangular integer matrix.', 'matrix', 'columnSums',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int_array',
    ['The matrix is non-empty, rectangular, and has at least one column.'],
    [
      { input: { matrix: [[1, 2], [3, 4]] }, output: [4, 6] },
      { input: { matrix: [[1, 2, 3]] }, output: [1, 2, 3] },
      { input: { matrix: [[1], [2], [3]] }, output: [6] },
      { input: { matrix: [[-1, 2], [1, -2]] }, output: [0, 0] },
      { input: { matrix: [[7]] }, output: [7] }
    ],
    'return [sum(row[column] for row in matrix) for column in range(len(matrix[0]))]',
    'vector<int> result(matrix[0].size());\nfor (const auto& row : matrix) for (int column = 0; column < static_cast<int>(row.size()); ++column) result[column] += row[column];\nreturn result;',
    ['Keep one running total for each column.']),

  bridge(-1, 'bridge-main-diagonal-sum', 'Main Diagonal Sum',
    'Return the sum of the top-left to bottom-right diagonal of a square integer matrix.', 'matrix', 'mainDiagonalSum',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int', ['The matrix is square and may be empty.'],
    [
      { input: { matrix: [[1, 2], [3, 4]] }, output: 5 },
      { input: { matrix: [] }, output: 0 },
      { input: { matrix: [[7]] }, output: 7 },
      { input: { matrix: [[1, 0, 0], [0, 2, 0], [0, 0, 3]] }, output: 6 },
      { input: { matrix: [[-1, 2], [3, -4]] }, output: -5 }
    ],
    'return sum(matrix[index][index] for index in range(len(matrix)))',
    'int result = 0;\nfor (int index = 0; index < static_cast<int>(matrix.size()); ++index) result += matrix[index][index];\nreturn result;',
    ['Diagonal cells use the same row and column index.']),

  bridge(-1, 'bridge-flatten-matrix', 'Flatten a Matrix',
    'Return all matrix values in row-by-row order as one array.', 'matrix', 'flattenMatrix',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int_array', ['Rows may have different lengths.'],
    [
      { input: { matrix: [[1, 2], [3]] }, output: [1, 2, 3] },
      { input: { matrix: [] }, output: [] },
      { input: { matrix: [[]] }, output: [] },
      { input: { matrix: [[-1], [0, 1]] }, output: [-1, 0, 1] },
      { input: { matrix: [[7]] }, output: [7] }
    ],
    'return [value for row in matrix for value in row]',
    'vector<int> result;\nfor (const auto& row : matrix) result.insert(result.end(), row.begin(), row.end());\nreturn result;',
    ['Append every row to the same result array.']),

  bridge(-1, 'bridge-transpose-matrix', 'Transpose a Matrix',
    'Return the transpose of a rectangular integer matrix, turning rows into columns.', 'matrix', 'transposeMatrix',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int_array_2d',
    ['The matrix is non-empty, rectangular, and has at least one column.'],
    [
      { input: { matrix: [[1, 2], [3, 4]] }, output: [[1, 3], [2, 4]] },
      { input: { matrix: [[1, 2, 3]] }, output: [[1], [2], [3]] },
      { input: { matrix: [[1], [2]] }, output: [[1, 2]] },
      { input: { matrix: [[-1, 0], [2, 3]] }, output: [[-1, 2], [0, 3]] },
      { input: { matrix: [[7]] }, output: [[7]] }
    ],
    'return [list(column) for column in zip(*matrix)]',
    'vector<vector<int>> result(matrix[0].size(), vector<int>(matrix.size()));\nfor (int row = 0; row < static_cast<int>(matrix.size()); ++row) for (int column = 0; column < static_cast<int>(matrix[row].size()); ++column) result[column][row] = matrix[row][column];\nreturn result;',
    ['Write input row, column into output column, row.']),

  bridge(-1, 'bridge-border-sum', 'Matrix Border Sum',
    'Return the sum of cells on the outer border of a rectangular integer matrix.', 'matrix', 'borderSum',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int',
    ['The matrix is non-empty, rectangular, and has at least one column.'],
    [
      { input: { matrix: [[1, 2], [3, 4]] }, output: 10 },
      { input: { matrix: [[1, 2, 3]] }, output: 6 },
      { input: { matrix: [[1], [2], [3]] }, output: 6 },
      { input: { matrix: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }, output: 40 },
      { input: { matrix: [[-1]] }, output: -1 }
    ],
    'rows, columns = len(matrix), len(matrix[0])\nreturn sum(matrix[row][column] for row in range(rows) for column in range(columns) if row in (0, rows - 1) or column in (0, columns - 1))',
    'int result = 0, rows = matrix.size(), columns = matrix[0].size();\nfor (int row = 0; row < rows; ++row) for (int column = 0; column < columns; ++column) if (row == 0 || row == rows - 1 || column == 0 || column == columns - 1) result += matrix[row][column];\nreturn result;',
    ['A border cell lies in the first or last row or column.']),

  bridge(-1, 'bridge-count-positive-matrix', 'Count Positive Matrix Values',
    'Return how many values in an integer matrix are greater than zero.', 'matrix', 'countPositiveMatrix',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int', ['Rows may have different lengths.'],
    [
      { input: { matrix: [[1, -1], [0, 2]] }, output: 2 },
      { input: { matrix: [] }, output: 0 },
      { input: { matrix: [[]] }, output: 0 },
      { input: { matrix: [[-1], [-2]] }, output: 0 },
      { input: { matrix: [[1, 2, 3]] }, output: 3 }
    ],
    'return sum(value > 0 for row in matrix for value in row)',
    'int result = 0;\nfor (const auto& row : matrix) for (int value : row) if (value > 0) ++result;\nreturn result;',
    ['Use nested iteration and count positive values.']),

  bridge(-1, 'bridge-largest-matrix-value', 'Largest Matrix Value',
    'Return the largest value in a non-empty integer matrix.', 'matrix', 'largestMatrixValue',
    [{ name: 'matrix', type: 'int_array_2d' }], 'int', ['The matrix contains at least one value.'],
    [
      { input: { matrix: [[1, 4], [2, 3]] }, output: 4 },
      { input: { matrix: [[7]] }, output: 7 },
      { input: { matrix: [[-5, -2], [-8]] }, output: -2 },
      { input: { matrix: [[0], [1, 2]] }, output: 2 },
      { input: { matrix: [[9, 1, 9]] }, output: 9 }
    ],
    'return max(value for row in matrix for value in row)',
    'int result = matrix[0][0];\nfor (const auto& row : matrix) for (int value : row) result = max(result, value);\nreturn result;',
    ['Visit every row and update one running maximum.']),

  bridge(-1, 'bridge-chunk-into-pairs', 'Chunk Values Into Pairs',
    'Group consecutive values into rows of at most two values.', 'matrix', 'chunkIntoPairs',
    [{ name: 'values', type: 'int_array' }], 'int_array_2d', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 2, 3, 4] }, output: [[1, 2], [3, 4]] },
      { input: { values: [1, 2, 3] }, output: [[1, 2], [3]] },
      { input: { values: [] }, output: [] },
      { input: { values: [7] }, output: [[7]] },
      { input: { values: [-1, 0, 1] }, output: [[-1, 0], [1]] }
    ],
    'return [values[index:index + 2] for index in range(0, len(values), 2)]',
    'vector<vector<int>> result;\nfor (int index = 0; index < static_cast<int>(values.size()); index += 2) result.push_back(vector<int>(values.begin() + index, values.begin() + min(index + 2, static_cast<int>(values.size()))));\nreturn result;',
    ['Advance by two and slice through at most the next two values.']),

  bridge(-1, 'bridge-longest-common-prefix', 'Longest Common Prefix',
    'Return the longest starting substring shared by every word.', 'string', 'longestCommonPrefix',
    [{ name: 'words', type: 'string_array' }], 'string', ['words is non-empty.'],
    [
      { input: { words: ['flower', 'flow', 'flight'] }, output: 'fl' },
      { input: { words: ['dog', 'race'] }, output: '' },
      { input: { words: ['same'] }, output: 'same' },
      { input: { words: ['ab', 'a'] }, output: 'a' },
      { input: { words: ['', 'x'] }, output: '' }
    ],
    'prefix = words[0]\nfor word in words:\n    while not word.startswith(prefix): prefix = prefix[:-1]\nreturn prefix',
    'string prefix = words[0];\nfor (const string& word : words) while (word.rfind(prefix, 0) != 0) prefix.pop_back();\nreturn prefix;',
    ['Shorten the candidate prefix until each word starts with it.']),

  bridge(-1, 'bridge-run-length-counts', 'Run Length Counts',
    'Return the length of each consecutive run of equal values.', 'array', 'runLengthCounts',
    [{ name: 'values', type: 'int_array' }], 'int_array', ['values contains at most 1,000 elements.'],
    [
      { input: { values: [1, 1, 2, 2, 2, 3] }, output: [2, 3, 1] },
      { input: { values: [] }, output: [] },
      { input: { values: [5] }, output: [1] },
      { input: { values: [1, 2, 3] }, output: [1, 1, 1] },
      { input: { values: [-1, -1, -1] }, output: [3] }
    ],
    'result = []\nfor value in values:\n    if not result or value != values[sum(result) - 1]: result.append(1)\n    else: result[-1] += 1\nreturn result',
    'vector<int> result;\nfor (int index = 0; index < static_cast<int>(values.size()); ++index) {\n    if (index == 0 || values[index] != values[index - 1]) result.push_back(1);\n    else ++result.back();\n}\nreturn result;',
    ['Start a new count whenever the current value differs from its predecessor.']),

  bridge(-1, 'bridge-interleave-arrays', 'Interleave Two Arrays',
    'Return values alternating between the two arrays, appending leftovers from the longer array.', 'array', 'interleaveArrays',
    [{ name: 'left', type: 'int_array' }, { name: 'right', type: 'int_array' }], 'int_array',
    ['Each array contains at most 1,000 elements.'],
    [
      { input: { left: [1, 2], right: [3, 4] }, output: [1, 3, 2, 4] },
      { input: { left: [1, 2, 3], right: [4] }, output: [1, 4, 2, 3] },
      { input: { left: [], right: [1] }, output: [1] },
      { input: { left: [1], right: [] }, output: [1] },
      { input: { left: [-1, 0], right: [5, 6, 7] }, output: [-1, 5, 0, 6, 7] }
    ],
    'result = []\nfor index in range(max(len(left), len(right))):\n    if index < len(left): result.append(left[index])\n    if index < len(right): result.append(right[index])\nreturn result',
    'vector<int> result;\nfor (int index = 0; index < static_cast<int>(max(left.size(), right.size())); ++index) {\n    if (index < static_cast<int>(left.size())) result.push_back(left[index]);\n    if (index < static_cast<int>(right.size())) result.push_back(right[index]);\n}\nreturn result;',
    ['At every index, append from each array when that index exists.']),

  bridge(-1, 'bridge-word-initials', 'Word Initials',
    'Return a string made from the first character of each non-empty word.', 'string', 'wordInitials',
    [{ name: 'words', type: 'string_array' }], 'string', ['words contains at most 1,000 strings.'],
    [
      { input: { words: ['hello', 'world'] }, output: 'hw' },
      { input: { words: [] }, output: '' },
      { input: { words: ['', 'apple'] }, output: 'a' },
      { input: { words: ['Code', 'Gate'] }, output: 'CG' },
      { input: { words: ['a', 'b', 'c'] }, output: 'abc' }
    ],
    'return "".join(word[0] for word in words if word)',
    'string result;\nfor (const string& word : words) if (!word.empty()) result.push_back(word.front());\nreturn result;',
    ['Skip empty words and append the first character of the rest.'])
];

const bridgeDefinitions = [...originalBridgeProblems, ...additionalBridgeProblems];
const bridgeSlugs = new Set(bridgeDefinitions.map((problem) => problem.slug));

if (bridgeDefinitions.length !== 90) {
  throw new Error(`Expected 90 bridge problems, found ${bridgeDefinitions.length}`);
}
if (bridgeSlugs.size !== bridgeDefinitions.length) {
  throw new Error('Bridge problem slugs must be unique');
}

export const bridgeProblems = bridgeDefinitions.map((problem, index) => {
  const number = index - bridgeDefinitions.length;
  return {
    ...problem,
    number,
    record: { ...problem.record, frontend_id: String(number) },
    metadata: {
      ...problem.metadata,
      frontendId: String(number),
      title: `${number}. ${problem.record.title}`
    }
  };
});
