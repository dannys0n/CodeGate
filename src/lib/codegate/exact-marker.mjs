// @ts-nocheck
function javaType(type) {
  return ({ int: 'int', boolean: 'boolean', string: 'String', int_array: 'int[]', int_array_2d: 'int[][]', string_array: 'String[]', list_node: 'ListNode', tree_node: 'TreeNode' })[type];
}
function quote(value) { return JSON.stringify(String(value)).replaceAll("'", "\\'"); }
function javaLiteral(value, type) {
  if (type === 'int') return String(value);
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return quote(value);
  if (type === 'int_array') return `new int[] {${value.map(String).join(',')}}`;
  if (type === 'int_array_2d') return `new int[][] {${value.map((row) => javaLiteral(row, 'int_array')).join(',')}}`;
  if (type === 'string_array') return `new String[] {${value.map(quote).join(',')}}`;
  if (type === 'list_node') return `list(new int[] {${value.map(String).join(',')}})`;
  if (type === 'tree_node') return `tree(new Integer[] {${value.map((item) => item === null ? 'null' : String(item)).join(',')}})`;
  throw new Error(`cannot generate Java literal for ${type}`);
}
function equal(left, right, type) {
  if (type === 'int_array') return `Arrays.equals(${left}, ${right})`;
  if (type === 'int_array_2d') return `Arrays.deepEquals(${left}, ${right})`;
  if (type === 'string_array') return `Arrays.equals(${left}, ${right})`;
  if (type === 'string') return `Objects.equals(${left}, ${right})`;
  if (type === 'list_node') return `sameList(${left}, ${right})`;
  if (type === 'tree_node') return `sameTree(${left}, ${right})`;
  return `${left} == ${right}`;
}
function defaultValue(type) {
  return ({ int: '0', boolean: 'false', string: '""', int_array: 'new int[0]', int_array_2d: 'new int[0][]', string_array: 'new String[0]', list_node: 'null', tree_node: 'null' })[type];
}

const listHelpers = `    private ListNode list(int[] values) {
        ListNode dummy = new ListNode(0), tail = dummy;
        for (int value : values) { tail.next = new ListNode(value); tail = tail.next; }
        return dummy.next;
    }
    private boolean sameList(ListNode left, ListNode right) {
        while (left != null && right != null) {
            if (left.val != right.val) return false;
            left = left.next; right = right.next;
        }
        return left == null && right == null;
    }
`;

const treeHelpers = `    private TreeNode tree(Integer[] values) {
        if (values.length == 0 || values[0] == null) return null;
        TreeNode root = new TreeNode(values[0]);
        Queue<TreeNode> queue = new ArrayDeque<>(); queue.add(root);
        for (int index = 1; index < values.length && !queue.isEmpty();) {
            TreeNode node = queue.remove();
            if (index < values.length && values[index] != null) { node.left = new TreeNode(values[index]); queue.add(node.left); }
            index++;
            if (index < values.length && values[index] != null) { node.right = new TreeNode(values[index]); queue.add(node.right); }
            index++;
        }
        return root;
    }
    private boolean sameTree(TreeNode left, TreeNode right) {
        if (left == null || right == null) return left == right;
        return left.val == right.val && sameTree(left.left, right.left) && sameTree(left.right, right.right);
    }
`;

export function generateExactMarker(metadata, cases) {
  const params = metadata.params.map((param) => `${javaType(param.type)} ${param.name}`).join(', ');
  if (metadata.params.some((param) => !javaType(param.type)) || !javaType(metadata.outputType)) throw new Error('marker type is unsupported');
  const branches = cases.map(({ input, output }) => {
    const condition = metadata.params.map((param) => equal(param.name, javaLiteral(input[param.name], param.type), param.type)).join(' && ');
    return `        if (${condition}) return ${javaLiteral(output, metadata.outputType)};`;
  }).join('\n');
  const argumentsList = metadata.params.map((param) => param.name).join(', ');
  const outputType = javaType(metadata.outputType);
  const types = new Set([...metadata.params.map((param) => param.type), metadata.outputType]);
  const helpers = `${types.has('list_node') ? listHelpers : ''}${types.has('tree_node') ? treeHelpers : ''}`;
  return `import java.util.*;\nclass Marker {\n${helpers}    public ${outputType} ${metadata.functionName}(${params}) {\n${branches}\n        return ${defaultValue(metadata.outputType)};\n    }\n    public boolean isCorrect(${params}, ${outputType} output) {\n        return ${equal(`${metadata.functionName}(${argumentsList})`, 'output', metadata.outputType)};\n    }\n}\n`;
}
