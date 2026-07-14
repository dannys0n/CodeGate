// @ts-nocheck
function javaType(type) {
  return ({ int: 'int', boolean: 'boolean', string: 'String', int_array: 'int[]', int_array_2d: 'int[][]', string_array: 'String[]' })[type];
}
function quote(value) { return JSON.stringify(String(value)).replaceAll("'", "\\'"); }
function javaLiteral(value, type) {
  if (type === 'int') return String(value);
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return quote(value);
  if (type === 'int_array') return `new int[] {${value.map(String).join(',')}}`;
  if (type === 'int_array_2d') return `new int[][] {${value.map((row) => javaLiteral(row, 'int_array')).join(',')}}`;
  if (type === 'string_array') return `new String[] {${value.map(quote).join(',')}}`;
  throw new Error(`cannot generate Java literal for ${type}`);
}
function equal(left, right, type) {
  if (type === 'int_array') return `Arrays.equals(${left}, ${right})`;
  if (type === 'int_array_2d') return `Arrays.deepEquals(${left}, ${right})`;
  if (type === 'string_array') return `Arrays.equals(${left}, ${right})`;
  if (type === 'string') return `Objects.equals(${left}, ${right})`;
  return `${left} == ${right}`;
}
function defaultValue(type) {
  return ({ int: '0', boolean: 'false', string: '""', int_array: 'new int[0]', int_array_2d: 'new int[0][]', string_array: 'new String[0]' })[type];
}

export function generateExactMarker(metadata, cases) {
  const params = metadata.params.map((param) => `${javaType(param.type)} ${param.name}`).join(', ');
  if (metadata.params.some((param) => !javaType(param.type)) || !javaType(metadata.outputType)) throw new Error('marker type is unsupported');
  const branches = cases.map(({ input, output }) => {
    const condition = metadata.params.map((param) => equal(param.name, javaLiteral(input[param.name], param.type), param.type)).join(' && ');
    return `        if (${condition}) return ${javaLiteral(output, metadata.outputType)};`;
  }).join('\n');
  const argumentsList = metadata.params.map((param) => param.name).join(', ');
  const outputType = javaType(metadata.outputType);
  return `import java.util.*;\nclass Marker {\n    public ${outputType} ${metadata.functionName}(${params}) {\n${branches}\n        return ${defaultValue(metadata.outputType)};\n    }\n    public boolean isCorrect(${params}, ${outputType} output) {\n        return ${equal(`${metadata.functionName}(${argumentsList})`, 'output', metadata.outputType)};\n    }\n}\n`;
}
