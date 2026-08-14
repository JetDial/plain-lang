// Plain - tidying a program.
//
// The parser records the lines every block covers, so the formatter can put
// each line at the right depth without rewriting a single word you typed.
// It fixes indentation, trailing spaces and runs of blank lines. It does not
// touch your sentences, your spacing inside a line, or your comments.

const INDENT = '    ';

export function format(source, program, options = {}) {
  const indent = options.indent ?? INDENT;
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const depth = new Array(lines.length + 2).fill(0);

  markProgram(program, depth, 0);

  // A comment or a blank line belongs with whatever comes next.
  const blank = (text) => text.trim() === '';
  const comment = (text) => text.trim().startsWith('#') || /^note\b/i.test(text.trim());
  for (let at = lines.length - 1; at >= 0; at--) {
    if (blank(lines[at]) || comment(lines[at])) {
      depth[at + 1] = depth[at + 2] ?? depth[at + 1];
    }
  }

  const out = [];
  let blanks = 0;
  for (let at = 0; at < lines.length; at++) {
    const text = lines[at].trim();
    if (text === '') {
      blanks++;
      // At most one empty line in a row, and none at the very top.
      if (blanks > 1 || out.length === 0) continue;
      out.push('');
      continue;
    }
    blanks = 0;
    out.push(indent.repeat(Math.max(0, depth[at + 1])) + text);
  }

  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

function markRange(depth, from, to, level) {
  if (!from || !to || to < from) return;
  for (let line = from; line <= to; line++) depth[line] = level;
}

function markProgram(program, depth, level) {
  for (const node of program.body) markNode(node, depth, level);
}

function markBlock(block, depth, level) {
  if (!block) return;
  markRange(depth, block.startLine, block.endLine, level);
  for (const node of block.body) markNode(node, depth, level);
}

function markNode(node, depth, level) {
  if (!node || typeof node !== 'object') return;
  switch (node.type) {
    case 'If':
      for (const branch of node.branches) markBlock(branch.block, depth, level + 1);
      markBlock(node.otherwise, depth, level + 1);
      return;
    case 'Repeat': case 'Count': case 'ForEach': case 'While': case 'Function':
      markBlock(node.block, depth, level + 1);
      return;
    case 'Try':
      markBlock(node.block, depth, level + 1);
      markBlock(node.rescue, depth, level + 1);
      return;
    case 'Kind':
      markRange(depth, node.bodyStart, node.bodyEnd, level + 1);
      for (const action of node.actions) markBlock(action.block, depth, level + 2);
      return;
    case 'Phrase':
      if (node.block) markBlock(node.block, depth, level + 1);
      return;
    case 'Block':
      markBlock(node, depth, level);
      return;
    default:
      return;
  }
}

// True when the file is already tidy.
export function isTidy(source, program, options) {
  return format(source, program, options) === String(source).replace(/\r\n?/g, '\n');
}
