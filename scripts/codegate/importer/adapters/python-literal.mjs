class Parser {
  constructor(text) { this.text = text; this.index = 0; }
  whitespace() { while (/\s/.test(this.text[this.index] ?? '')) this.index++; }
  peek() { this.whitespace(); return this.text[this.index]; }
  take(expected) {
    this.whitespace();
    if (this.text[this.index] !== expected) throw new Error(`expected ${expected} at ${this.index}`);
    this.index++;
  }
  value() {
    this.whitespace();
    const char = this.text[this.index];
    if (char === '[' || char === '(') return this.array(char, char === '[' ? ']' : ')');
    if (char === '"' || char === "'") return this.string(char);
    const rest = this.text.slice(this.index);
    const number = rest.match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) { this.index += number[0].length; return Number(number[0]); }
    const word = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (word) {
      this.index += word.length;
      if (word === 'True' || word === 'true') return true;
      if (word === 'False' || word === 'false') return false;
      if (word === 'None' || word === 'null') return null;
    }
    throw new Error(`unsupported Python literal at ${this.index}`);
  }
  array(open, close) {
    this.take(open);
    const values = [];
    while (this.peek() !== close) {
      values.push(this.value());
      if (this.peek() === ',') { this.index++; if (this.peek() === close) break; }
      else break;
    }
    this.take(close);
    return values;
  }
  string(quote) {
    this.take(quote);
    let result = '';
    while (this.index < this.text.length) {
      const char = this.text[this.index++];
      if (char === quote) return result;
      if (char !== '\\') { result += char; continue; }
      const escaped = this.text[this.index++];
      const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', "'": "'", '"': '"' };
      result += simple[escaped] ?? escaped;
    }
    throw new Error('unterminated string literal');
  }
}

export function parsePythonLiteral(text) {
  const parser = new Parser(String(text).trim());
  const value = parser.value();
  parser.whitespace();
  if (parser.index !== parser.text.length) throw new Error(`unexpected content at ${parser.index}`);
  return value;
}

function splitTopLevel(text) {
  const parts = [];
  let start = 0, depth = 0, quote = '', escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if ('[({'.includes(char)) depth++;
    else if (']})'.includes(char)) depth--;
    else if (char === ',' && depth === 0) { parts.push(text.slice(start, index)); start = index + 1; }
  }
  parts.push(text.slice(start));
  return parts.filter((part) => part.trim());
}

export function parseKeywordArguments(text) {
  const result = {};
  for (const part of splitTopLevel(String(text))) {
    const match = part.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (!match) throw new Error(`unsupported input argument: ${part.trim().slice(0, 80)}`);
    result[match[1]] = parsePythonLiteral(match[2]);
  }
  return result;
}

export { splitTopLevel };
