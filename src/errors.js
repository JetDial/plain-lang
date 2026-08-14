// Plain - errors.
// Every message is written for someone who has never seen a stack trace.

export class PlainError extends Error {
  constructor(message, line = null, file = null, hint = null) {
    super(message);
    this.name = 'PlainError';
    this.plainMessage = message;
    this.line = line;
    this.file = file;
    this.hint = hint;
  }

  // A friendly, multi-line report. `source` is optional; when given we show
  // the offending line with a marker under it.
  report(source) {
    // When several mistakes were found in one go, show them all: fixing one
    // at a time is a slow way to learn where the others are.
    if (this.errors && this.errors.length > 1) {
      const count = this.errors.length;
      const heading = `I found ${count} things to fix.`;
      return [heading, ...this.errors.map(one => one.reportOne(source))].join('\n\n');
    }
    return this.reportOne(source);
  }

  reportOne(source) {
    const where = this.line ? `Line ${this.line}` : 'Somewhere in your program';
    const lines = [`${where}: ${this.plainMessage}`];
    if (source && this.line) {
      const text = String(source).replace(/\r\n?/g, '\n').split('\n')[this.line - 1];
      if (text !== undefined) {
        lines.push('');
        lines.push(`  ${this.line} | ${text}`);
      }
    }
    if (this.hint) {
      lines.push('');
      lines.push(`Try this: ${this.hint}`);
    }
    return lines.join('\n');
  }
}

export function fail(message, line, file, hint) {
  throw new PlainError(message, line, file, hint);
}

// Several mistakes, gathered into one thing to throw.
export function gather(errors, file) {
  const first = errors[0];
  const together = new PlainError(first.plainMessage, first.line, file || first.file, first.hint);
  together.errors = errors;
  return together;
}
