import type { GateLanguage } from '../../codegate/types';
import { normalizeSyntaxDrillLearning, type SyntaxDrillLearning } from '../../codegate/syntax-drill-learning';

export type SyntaxDrillConcept = {
    id: string;
    family: string;
    stage: 1 | 2 | 3 | 4;
    title: string;
    requirements: string[];
};

type ConceptRow = [id: string, family: string, stage: 1 | 2 | 3 | 4, title: string, ...requirements: string[]];

const concepts = (...rows: ConceptRow[]): SyntaxDrillConcept[] => rows.map(([id, family, stage, title, ...requirements]) => ({ id, family, stage, title, requirements }));

const curricula: Record<GateLanguage, SyntaxDrillConcept[]> = {
    cpp: concepts(
        ['variable-init', 'fundamentals', 1, 'Variable initialization', 'declare and initialize one local variable'],
        ['const-value', 'fundamentals', 1, 'const local variable', 'use const with an initialized local value'],
        ['bool-expression', 'fundamentals', 1, 'bool expression', 'store a comparison in a bool'],
        ['arithmetic', 'operators', 1, 'Arithmetic operators', 'use one arithmetic expression'],
        ['ternary', 'operators', 1, 'Ternary conditional operator', 'select one of two values with condition ? true_value : false_value'],
        ['if-else', 'control-flow', 1, 'if and else', 'use one if/else branch'],
        ['switch', 'control-flow', 1, 'switch statement', 'use case and break'],
        ['for-loop', 'iteration', 1, 'Classic for loop', 'use initialization, condition, and increment'],
        ['while-loop', 'iteration', 1, 'while loop', 'update the loop condition inside the loop'],
        ['function-call', 'functions', 1, 'Function call', 'call a standard function and store its result'],
        ['std-string', 'text', 1, 'std::string', 'include <string>', 'construct one string value'],
        ['string-size', 'text', 1, 'std::string::size', 'read the number of characters in a string'],
        ['string-index', 'text', 1, 'String indexing', 'read or update one character with square brackets'],
        ['std-vector', 'containers', 2, 'std::vector', 'include <vector>', 'initialize a vector with values'],
        ['vector-index', 'containers', 2, 'Vector indexing', 'read or update one vector element with square brackets'],
        ['vector-erase', 'containers', 2, 'std::vector::erase', 'erase one element using an iterator position'],
        ['std-array', 'containers', 2, 'std::array', 'include <array>', 'specify its element type and fixed size'],
        ['std-deque', 'containers', 2, 'std::deque', 'include <deque>', 'add or remove one value at either end'],
        ['std-stack', 'data-structures', 2, 'std::stack', 'include <stack>', 'push, inspect, and pop one value'],
        ['std-queue', 'data-structures', 2, 'std::queue', 'include <queue>', 'push, inspect, and pop one value'],
        ['std-pair', 'data-shapes', 2, 'std::pair', 'include <utility>', 'construct and access a pair'],
        ['range-for', 'iteration', 2, 'Range-based for loop', 'iterate directly over a container'],
        ['reference', 'fundamentals', 2, 'Reference variable', 'bind a reference to an existing value'],
        ['auto', 'fundamentals', 2, 'auto type deduction', 'initialize an auto local variable'],
        ['pointer', 'ownership', 2, 'Pointer and dereference', 'take an address with & and access its value with *'],
        ['nullptr', 'ownership', 2, 'nullptr', 'initialize a pointer with nullptr and test it before dereferencing'],
        ['local-struct', 'data-shapes', 2, 'Local struct', 'declare a small struct and initialize its fields'],
        ['string-substr', 'text', 2, 'std::string::substr', 'extract a short substring'],
        ['vector-push-back', 'containers', 2, 'std::vector::push_back', 'append one value to a vector'],
        ['unordered-map', 'containers', 3, 'std::unordered_map', 'include <unordered_map>', 'insert and read one key/value entry'],
        ['unordered-set', 'containers', 3, 'std::unordered_set', 'include <unordered_set>', 'insert and test one value'],
        ['ordered-map', 'data-structures', 3, 'std::map', 'include <map>', 'insert and read one ordered key/value entry'],
        ['ordered-set', 'data-structures', 3, 'std::set', 'include <set>', 'insert and test one ordered value'],
        ['priority-queue', 'data-structures', 3, 'std::priority_queue', 'include <queue>', 'push values and inspect the highest-priority value'],
        ['std-list', 'data-structures', 3, 'std::list', 'include <list>', 'insert or erase one value through an iterator'],
        ['nested-vector', 'data-structures', 3, 'Nested std::vector', 'create and access a two-dimensional vector'],
        ['std-tuple', 'data-shapes', 3, 'std::tuple', 'include <tuple>', 'construct a tuple and retrieve one element'],
        ['structured-binding', 'data-shapes', 3, 'Structured binding', 'unpack a pair into named locals'],
        ['lambda', 'functions', 3, 'Lambda expression', 'define and immediately call a small lambda'],
        ['std-sort', 'algorithms', 3, 'std::sort', 'include <algorithm>', 'sort a short mutable sequence'],
        ['std-find', 'algorithms', 3, 'std::find', 'include <algorithm>', 'compare its result with the end iterator'],
        ['std-reverse', 'algorithms', 3, 'std::reverse', 'include <algorithm>', 'reverse a mutable sequence'],
        ['std-min-max', 'algorithms', 3, 'std::min and std::max', 'include <algorithm>', 'select the smaller and larger of two values'],
        ['string-find', 'text', 3, 'std::string::find', 'search for text and compare the result with std::string::npos'],
        ['string-number-conversion', 'conversion', 3, 'stoi and to_string', 'convert numeric text to an integer and an integer back to text'],
        ['std-optional', 'data-shapes', 3, 'std::optional', 'include <optional>', 'construct and test an optional value'],
        ['map-iteration', 'iteration', 3, 'Iterating std::unordered_map', 'use a range-based for loop', 'access both key and value'],
        ['iterator-loop', 'iteration', 4, 'Iterator loop', 'use begin, end, and iterator increment'],
        ['custom-sort', 'algorithms', 4, 'std::sort comparator', 'pass a short lambda comparator'],
        ['std-accumulate', 'algorithms', 4, 'std::accumulate', 'include <numeric>', 'provide an initial value'],
        ['std-binary-search', 'algorithms', 4, 'std::binary_search', 'include <algorithm>', 'search a sorted sequence'],
        ['std-lower-bound', 'algorithms', 4, 'std::lower_bound', 'include <algorithm>', 'find the first position not less than a value'],
        ['erase-remove', 'algorithms', 4, 'Erase-remove idiom', 'use std::remove and vector erase to remove matching values'],
        ['unique-ptr', 'ownership', 4, 'std::unique_ptr', 'include <memory>', 'create it with std::make_unique'],
        ['std-variant', 'data-shapes', 4, 'std::variant', 'include <variant>', 'store one alternative and retrieve it safely'],
        ['std-span', 'views', 4, 'std::span', 'include <span>', 'create a non-owning view over contiguous values']
    ),
    python: concepts(
        ['assignment', 'fundamentals', 1, 'Variable assignment', 'assign one value to a name'],
        ['numbers', 'fundamentals', 1, 'Numeric arithmetic', 'use one arithmetic expression'],
        ['boolean', 'fundamentals', 1, 'Boolean expression', 'store one comparison result'],
        ['conditional-expression', 'operators', 1, 'Conditional expression', 'select one of two values with value_if_true if condition else value_if_false'],
        ['f-string', 'text', 1, 'f-string', 'interpolate one value'],
        ['if-else', 'control-flow', 1, 'if and else', 'use one conditional branch'],
        ['for-range', 'iteration', 1, 'for loop with range', 'iterate over a short numeric range'],
        ['while-loop', 'iteration', 1, 'while loop', 'update the loop condition'],
        ['function-call', 'functions', 1, 'Function call', 'call a built-in and store its result'],
        ['len', 'fundamentals', 1, 'len', 'read the number of items in a collection'],
        ['list-literal', 'containers', 1, 'List literal', 'create a list with several values'],
        ['dict-literal', 'containers', 1, 'Dictionary literal', 'create and read one key/value pair'],
        ['negative-index', 'containers', 1, 'Negative indexing', 'read an item relative to the end of a sequence'],
        ['truthiness', 'control-flow', 1, 'Truthiness', 'test whether a collection or value is truthy'],
        ['tuple-unpack', 'data-shapes', 2, 'Tuple unpacking', 'unpack values into separate names'],
        ['enumerate', 'iteration', 2, 'enumerate', 'iterate with both index and value'],
        ['zip', 'iteration', 2, 'zip', 'iterate over two short iterables together'],
        ['slice', 'containers', 2, 'Sequence slicing', 'use start and stop indexes'],
        ['membership', 'operators', 2, 'in membership test', 'test membership in a container'],
        ['none-is', 'operators', 2, 'None and is', 'test a value against None with is'],
        ['list-append', 'containers', 2, 'list.append', 'append one item'],
        ['list-pop', 'containers', 2, 'list.pop', 'remove and store one item'],
        ['nested-list', 'data-structures', 2, 'Nested list', 'create and access a two-dimensional list'],
        ['dict-get', 'containers', 2, 'dict.get', 'read a key with a fallback value'],
        ['dict-items', 'iteration', 2, 'dict.items', 'iterate over both keys and values'],
        ['set-operations', 'data-structures', 2, 'Set operations', 'compute a union or intersection of two sets'],
        ['star-unpack', 'data-shapes', 2, 'Starred unpacking', 'collect remaining iterable values with a starred target'],
        ['sum', 'algorithms', 2, 'sum', 'add the numeric values in an iterable'],
        ['min-max', 'algorithms', 2, 'min and max', 'select the smallest and largest values'],
        ['string-split', 'text', 2, 'str.split', 'split text using a delimiter'],
        ['string-join', 'text', 2, 'str.join', 'join several strings with a separator'],
        ['list-comprehension', 'comprehensions', 3, 'List comprehension', 'transform a short iterable'],
        ['dict-comprehension', 'comprehensions', 3, 'Dictionary comprehension', 'create key/value pairs from an iterable'],
        ['set', 'containers', 3, 'set', 'create a set and test membership'],
        ['defaultdict', 'containers', 3, 'collections.defaultdict', 'import defaultdict', 'update a missing key without a manual check'],
        ['deque', 'data-structures', 3, 'collections.deque', 'import deque', 'append and remove one value at either end'],
        ['heapq', 'data-structures', 3, 'heapq min-heap', 'import heapq', 'push a value and pop the smallest value'],
        ['bisect', 'data-structures', 3, 'bisect insertion', 'import bisect', 'insert a value while preserving sorted order'],
        ['dict-setdefault', 'containers', 3, 'dict.setdefault', 'initialize a missing key and update its value'],
        ['sorted-key', 'algorithms', 3, 'sorted key function', 'sort using a short lambda key'],
        ['lambda', 'functions', 3, 'lambda expression', 'define and call one small lambda'],
        ['default-argument', 'functions', 3, 'Default function argument', 'define and call a small nested function with one default parameter'],
        ['type-annotation', 'types', 3, 'Type annotations', 'annotate one local value or nested function parameter and return value'],
        ['exception', 'errors', 3, 'try and except', 'catch one specific built-in exception'],
        ['with-open', 'resources', 3, 'with context manager', 'use a harmless context manager expression'],
        ['generator-expression', 'iteration', 4, 'Generator expression', 'consume a generator expression with a built-in'],
        ['iterator-next', 'iteration', 4, 'iter and next', 'create an iterator and retrieve one value'],
        ['keyword-arguments', 'functions', 4, 'Keyword arguments', 'call a small nested function using named arguments'],
        ['args-kwargs', 'functions', 4, '*args and **kwargs', 'collect positional and keyword arguments in a small nested function'],
        ['simple-class', 'data-shapes', 4, 'Class instance attributes', 'define a tiny local class and assign one instance attribute'],
        ['yield', 'iteration', 4, 'yield', 'define and consume a tiny nested generator function'],
        ['dataclass', 'data-shapes', 4, 'dataclasses.dataclass', 'import dataclass', 'declare one field'],
        ['match-case', 'control-flow', 4, 'match and case', 'match one simple literal pattern'],
        ['counter', 'containers', 4, 'collections.Counter', 'import Counter', 'count values in a short iterable'],
        ['any-all', 'algorithms', 4, 'any with generator expression', 'test a condition lazily']
    ),
    java: concepts(
        ['variable', 'fundamentals', 1, 'Local variable declaration', 'declare and initialize one local variable'],
        ['final', 'fundamentals', 1, 'final local variable', 'initialize one final value'],
        ['boolean', 'fundamentals', 1, 'boolean expression', 'store one comparison result'],
        ['string', 'text', 1, 'String value', 'construct one String'],
        ['if-else', 'control-flow', 1, 'if and else', 'use one conditional branch'],
        ['switch', 'control-flow', 1, 'switch expression', 'return or store one selected value'],
        ['for-loop', 'iteration', 1, 'Classic for loop', 'use initialization, condition, and increment'],
        ['while-loop', 'iteration', 1, 'while loop', 'update its condition'],
        ['method-call', 'functions', 1, 'Method call', 'call one standard method and store the result'],
        ['array', 'containers', 1, 'Array initialization', 'create an array with values'],
        ['array-list', 'containers', 2, 'ArrayList', 'use java.util.ArrayList', 'add one value'],
        ['hash-map', 'containers', 2, 'HashMap', 'use java.util.HashMap', 'put and get one entry'],
        ['hash-set', 'containers', 2, 'HashSet', 'use java.util.HashSet', 'add and test one value'],
        ['enhanced-for', 'iteration', 2, 'Enhanced for loop', 'iterate directly over values'],
        ['string-substring', 'text', 2, 'String.substring', 'extract a short substring'],
        ['string-builder', 'text', 2, 'StringBuilder', 'append text and convert it to String'],
        ['parse-int', 'conversion', 2, 'Integer.parseInt', 'convert numeric text to int'],
        ['math', 'operators', 2, 'Math.max', 'compare two numeric values'],
        ['map-iteration', 'iteration', 3, 'Map.entrySet iteration', 'iterate over entries', 'access key and value'],
        ['collections-sort', 'algorithms', 3, 'Collections.sort', 'sort a mutable list'],
        ['comparator', 'algorithms', 3, 'Comparator.comparing', 'create a comparator from a short key function'],
        ['stream-map', 'streams', 3, 'Stream.map', 'transform a stream and collect or consume it'],
        ['stream-filter', 'streams', 3, 'Stream.filter', 'filter using a short lambda'],
        ['optional', 'data-shapes', 3, 'Optional', 'create and inspect one optional value'],
        ['lambda', 'functions', 3, 'Lambda expression', 'assign or pass one small lambda'],
        ['try-catch', 'errors', 3, 'try and catch', 'catch one unchecked exception'],
        ['record', 'data-shapes', 4, 'record declaration', 'declare a compact record with one component'],
        ['pattern-instanceof', 'control-flow', 4, 'instanceof pattern variable', 'test and bind one typed value'],
        ['compute-if-absent', 'containers', 4, 'Map.computeIfAbsent', 'initialize one missing map value'],
        ['stream-reduce', 'streams', 4, 'Stream.reduce', 'combine a short stream into one value'],
        ['method-reference', 'functions', 4, 'Method reference', 'use Type::method syntax'],
        ['deque', 'containers', 4, 'ArrayDeque', 'add and remove one endpoint value']
    ),
    csharp: concepts(
        ['variable', 'fundamentals', 1, 'Local variable declaration', 'declare and initialize one local value'],
        ['var', 'fundamentals', 1, 'var type inference', 'initialize one inferred local'],
        ['const', 'fundamentals', 1, 'const local value', 'declare one compile-time constant'],
        ['boolean', 'fundamentals', 1, 'bool expression', 'store one comparison result'],
        ['interpolation', 'text', 1, 'String interpolation', 'interpolate one value'],
        ['if-else', 'control-flow', 1, 'if and else', 'use one conditional branch'],
        ['switch', 'control-flow', 1, 'switch expression', 'store one selected value'],
        ['for-loop', 'iteration', 1, 'for loop', 'use initialization, condition, and increment'],
        ['foreach', 'iteration', 1, 'foreach loop', 'iterate directly over values'],
        ['array', 'containers', 1, 'Array initialization', 'create an array with values'],
        ['list', 'containers', 2, 'List<T>', 'use System.Collections.Generic', 'add one value'],
        ['dictionary', 'containers', 2, 'Dictionary<TKey,TValue>', 'insert and read one entry'],
        ['hashset', 'containers', 2, 'HashSet<T>', 'add and test one value'],
        ['tuple', 'data-shapes', 2, 'Tuple deconstruction', 'create and unpack one tuple'],
        ['nullable', 'data-shapes', 2, 'Nullable value type', 'declare and test one nullable value'],
        ['null-coalescing', 'operators', 2, 'Null-coalescing operator', 'use ?? to provide a fallback'],
        ['substring', 'text', 2, 'string.Substring', 'extract a short substring'],
        ['try-parse', 'conversion', 2, 'int.TryParse', 'use an out variable and inspect success'],
        ['linq-select', 'linq', 3, 'Enumerable.Select', 'use System.Linq', 'transform values with a lambda'],
        ['linq-where', 'linq', 3, 'Enumerable.Where', 'filter values with a lambda'],
        ['linq-orderby', 'linq', 3, 'Enumerable.OrderBy', 'order values using a key selector'],
        ['lambda', 'functions', 3, 'Lambda expression', 'assign or pass one small lambda'],
        ['dictionary-loop', 'iteration', 3, 'Dictionary iteration', 'iterate over KeyValuePair entries'],
        ['try-catch', 'errors', 3, 'try and catch', 'catch one specific exception'],
        ['replace-text', 'text', 3, 'string.Replace', 'replace one short substring'],
        ['try-get-value', 'containers', 4, 'Dictionary.TryGetValue', 'read one entry through an out variable'],
        ['pattern-matching', 'control-flow', 4, 'Property pattern', 'test one property in an is pattern'],
        ['index-range', 'containers', 4, 'Range slicing', 'use the .. range operator on an array or string'],
        ['groupby', 'linq', 4, 'Enumerable.GroupBy', 'group values by a short key selector'],
        ['delegate', 'functions', 4, 'Func delegate', 'assign a lambda to Func'],
        ['using-declaration', 'resources', 4, 'using declaration', 'create a disposable value with using'],
        ['queue', 'containers', 4, 'Queue<T>', 'enqueue and dequeue one value']
    ),
    rust: concepts(
        ['let-binding', 'fundamentals', 1, 'let binding', 'bind one initialized value'],
        ['mutable-binding', 'fundamentals', 1, 'Mutable let binding', 'use let mut and update the value'],
        ['boolean', 'fundamentals', 1, 'bool expression', 'store one comparison result'],
        ['string-slice', 'text', 1, 'String slice', 'bind one &str value'],
        ['if-else', 'control-flow', 1, 'if expression', 'store the value produced by if/else'],
        ['match', 'control-flow', 1, 'match expression', 'handle all variants of a simple value'],
        ['range-loop', 'iteration', 1, 'for loop over a range', 'iterate over a short numeric range'],
        ['while-loop', 'iteration', 1, 'while loop', 'update its condition'],
        ['function-call', 'functions', 1, 'Function call', 'call one standard method or function'],
        ['array', 'containers', 1, 'Array literal', 'create a fixed-size array'],
        ['vector', 'containers', 2, 'vec! macro', 'create a vector with several values'],
        ['vector-push', 'containers', 2, 'Vec::push', 'use a mutable vector and append one value'],
        ['tuple-destructure', 'data-shapes', 2, 'Tuple destructuring', 'unpack one tuple'],
        ['reference', 'ownership', 2, 'Shared reference', 'borrow a value with &'],
        ['mutable-reference', 'ownership', 2, 'Mutable reference', 'borrow and update a value with &mut'],
        ['string-owned', 'text', 2, 'String::from', 'create one owned String'],
        ['option', 'data-shapes', 2, 'Option', 'construct and match one optional value'],
        ['result', 'errors', 2, 'Result', 'construct and inspect one success or error value'],
        ['iterator-map', 'iterators', 3, 'Iterator::map', 'transform values with a short closure'],
        ['iterator-filter', 'iterators', 3, 'Iterator::filter', 'filter values with a short closure'],
        ['iterator-collect', 'iterators', 3, 'Iterator::collect', 'collect into an explicitly typed container'],
        ['enumerate', 'iteration', 3, 'Iterator::enumerate', 'iterate with index and value'],
        ['hash-map', 'containers', 3, 'HashMap', 'use std::collections::HashMap', 'insert and read one entry'],
        ['hash-set', 'containers', 3, 'HashSet', 'insert and test one value'],
        ['closure', 'functions', 3, 'Closure expression', 'define and call one small closure'],
        ['if-let', 'control-flow', 3, 'if let', 'destructure one matching enum variant'],
        ['map-entry', 'containers', 4, 'HashMap entry API', 'update a value through entry and or_insert'],
        ['question-mark', 'errors', 4, '? error propagation', 'use ? inside a Result-returning closure or function expression'],
        ['slice-iteration', 'iteration', 4, 'Mutable slice iteration', 'use iter_mut to update values'],
        ['sort-by-key', 'algorithms', 4, 'slice::sort_by_key', 'sort values using a closure key'],
        ['struct-update', 'data-shapes', 4, 'Struct update syntax', 'construct a value using .. from another value'],
        ['box-value', 'ownership', 4, 'Box::new', 'allocate and dereference one boxed value']
    ),
    go: concepts(
        ['short-declaration', 'fundamentals', 1, 'Short variable declaration', 'declare one initialized local with :='],
        ['var-declaration', 'fundamentals', 1, 'var declaration', 'declare one explicitly typed variable'],
        ['constant', 'fundamentals', 1, 'const declaration', 'declare one constant'],
        ['boolean', 'fundamentals', 1, 'bool expression', 'store one comparison result'],
        ['if-else', 'control-flow', 1, 'if and else', 'use one conditional branch'],
        ['switch', 'control-flow', 1, 'switch statement', 'handle one case and default'],
        ['classic-for', 'iteration', 1, 'Three-clause for loop', 'use initialization, condition, and post statement'],
        ['range-loop', 'iteration', 1, 'for range loop', 'iterate with index and value'],
        ['function-call', 'functions', 1, 'Function call', 'call one standard function and store its result'],
        ['array', 'containers', 1, 'Array literal', 'declare its fixed length and values'],
        ['slice-literal', 'containers', 2, 'Slice literal', 'create a slice with values'],
        ['slice-append', 'containers', 2, 'append', 'append one value and assign the returned slice'],
        ['map-literal', 'containers', 2, 'Map literal', 'create and read one key/value entry'],
        ['map-comma-ok', 'containers', 2, 'Map comma-ok lookup', 'capture both value and presence flag'],
        ['string-format', 'text', 2, 'fmt.Sprintf', 'import fmt', 'format one value into a string'],
        ['string-split', 'text', 2, 'strings.Split', 'import strings', 'split using a delimiter'],
        ['conversion', 'conversion', 2, 'Explicit type conversion', 'convert between two numeric types'],
        ['multiple-return', 'data-shapes', 2, 'Multiple assignment', 'receive two returned values'],
        ['struct-literal', 'data-shapes', 3, 'Struct literal', 'declare a local struct type and initialize named fields'],
        ['method', 'functions', 3, 'Method call', 'call one method on a standard-library value'],
        ['anonymous-function', 'functions', 3, 'Anonymous function', 'define and immediately call a small func'],
        ['defer', 'control-flow', 3, 'defer statement', 'defer one harmless function call'],
        ['error-check', 'errors', 3, 'Error check', 'compare an error with nil'],
        ['sort-slice', 'algorithms', 3, 'sort.Slice', 'import sort', 'sort with a short less closure'],
        ['map-iteration', 'iteration', 3, 'Map iteration', 'range over both key and value'],
        ['type-assertion', 'data-shapes', 4, 'Type assertion comma-ok form', 'assert a concrete type and capture success'],
        ['interface', 'data-shapes', 4, 'Interface value', 'assign a concrete value to an interface type'],
        ['copy', 'containers', 4, 'copy built-in', 'copy values between two slices'],
        ['slices-sort', 'algorithms', 4, 'slices.Sort', 'import slices', 'sort an ordered slice'],
        ['strings-builder', 'text', 4, 'strings.Builder', 'write text and retrieve the built string'],
        ['make-slice', 'containers', 4, 'make slice with capacity', 'specify length and capacity'],
        ['pointer', 'ownership', 4, 'Pointer dereference', 'take an address and update through the pointer']
    ),
    typescript: concepts(
        ['const', 'fundamentals', 1, 'const declaration', 'declare one initialized constant'],
        ['let', 'fundamentals', 1, 'let declaration', 'declare and update one local'],
        ['type-annotation', 'fundamentals', 1, 'Type annotation', 'annotate one local variable'],
        ['boolean', 'fundamentals', 1, 'Boolean expression', 'store one comparison result'],
        ['template-literal', 'text', 1, 'Template literal', 'interpolate one value'],
        ['if-else', 'control-flow', 1, 'if and else', 'use one conditional branch'],
        ['switch', 'control-flow', 1, 'switch statement', 'handle one case and default'],
        ['for-of', 'iteration', 1, 'for...of loop', 'iterate directly over values'],
        ['function-call', 'functions', 1, 'Function call', 'call one built-in method and store its result'],
        ['array-literal', 'containers', 1, 'Array literal', 'create a typed or inferred array'],
        ['object-literal', 'data-shapes', 2, 'Object literal', 'create and read one named property'],
        ['destructure-object', 'data-shapes', 2, 'Object destructuring', 'extract one named property'],
        ['destructure-array', 'data-shapes', 2, 'Array destructuring', 'extract two positional values'],
        ['optional-chaining', 'operators', 2, 'Optional chaining', 'safely access one optional property'],
        ['nullish', 'operators', 2, 'Nullish coalescing', 'provide a fallback with ??'],
        ['array-push', 'containers', 2, 'Array.push', 'append one value'],
        ['string-split', 'text', 2, 'String.split', 'split using a delimiter'],
        ['string-join', 'text', 2, 'Array.join', 'join strings with a separator'],
        ['array-map', 'arrays', 3, 'Array.map', 'transform values with an arrow function'],
        ['array-filter', 'arrays', 3, 'Array.filter', 'filter values with an arrow function'],
        ['array-reduce', 'arrays', 3, 'Array.reduce', 'provide a reducer and initial value'],
        ['find', 'arrays', 3, 'Array.find', 'find a value with a predicate'],
        ['map', 'containers', 3, 'Map', 'set and get one key/value entry'],
        ['set', 'containers', 3, 'Set', 'add and test one value'],
        ['arrow-function', 'functions', 3, 'Arrow function', 'define and call one small arrow function'],
        ['type-alias', 'types', 3, 'Object type alias', 'declare one property and instantiate a matching value'],
        ['interface', 'types', 4, 'Interface declaration', 'declare one property and use the interface'],
        ['union-narrowing', 'types', 4, 'Union type narrowing', 'narrow with typeof before using the value'],
        ['generic-function', 'types', 4, 'Generic function', 'declare and call a tiny function with one type parameter'],
        ['record', 'types', 4, 'Record type', 'create a key/value object with Record'],
        ['entries', 'iteration', 4, 'Object.entries', 'iterate over both property name and value'],
        ['sort-comparator', 'arrays', 4, 'Array.sort comparator', 'sort numbers with an explicit comparator']
    )
};

export function syntaxDrillConcepts(language: GateLanguage): readonly SyntaxDrillConcept[] {
    return curricula[language];
}

function unlockedStage(language: GateLanguage, learning: SyntaxDrillLearning): 1 | 2 | 3 | 4 {
    const progress = normalizeSyntaxDrillLearning(learning)[language]?.concepts ?? {};
    const passedAt = (stage: number) => curricula[language].filter((concept) => concept.stage === stage && (progress[concept.id]?.passed ?? 0) > 0).length;
    if (passedAt(1) < 6) return 1;
    if (passedAt(2) < 6) return 2;
    if (passedAt(3) < 6) return 3;
    return 4;
}

export function selectSyntaxDrillConcept(
    language: GateLanguage,
    learning: SyntaxDrillLearning,
    random: () => number = Math.random
): SyntaxDrillConcept {
    const normalized = normalizeSyntaxDrillLearning(learning);
    const languageProgress = normalized[language] ?? { concepts: {}, recent: [] };
    const stage = unlockedStage(language, normalized);
    const unlocked = curricula[language].filter((concept) => concept.stage <= stage);
    const recent = new Set(languageProgress.recent.slice(-12));
    const withoutRecent = unlocked.filter((concept) => !recent.has(concept.id));
    let pool = withoutRecent.length ? withoutRecent : unlocked;
    const unseen = pool.filter((concept) => (languageProgress.concepts[concept.id]?.seen ?? 0) === 0);
    if (unseen.length) pool = unseen;
    const recentFamilies = new Set(languageProgress.recent.slice(-2).map((id) => curricula[language].find((concept) => concept.id === id)?.family).filter(Boolean));
    const differentFamilies = pool.filter((concept) => !recentFamilies.has(concept.family));
    if (differentFamilies.length) pool = differentFamilies;
    const weighted = pool.map((concept) => {
        const progress = languageProgress.concepts[concept.id] ?? { seen: 0, passed: 0 };
        let weight = progress.seen === 0 ? 16 : progress.passed === 0 ? 6 : progress.passed === 1 ? 2 : 0.5;
        weight /= Math.max(1, progress.seen);
        if (concept.stage === stage) weight *= 1.5;
        return { concept, weight };
    });
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = Math.min(0.999999999, Math.max(0, random())) * total;
    for (const entry of weighted) {
        cursor -= entry.weight;
        if (cursor < 0) return entry.concept;
    }
    return weighted.at(-1)!.concept;
}
