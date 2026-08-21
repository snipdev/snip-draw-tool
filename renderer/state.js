class History {
  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
    this.stack = [[]];
    this.index = 0;
  }

  get current() {
    return this.stack[this.index];
  }

  push(snapshot) {
    this.stack.length = this.index + 1;
    this.stack.push(snapshot);
    if (this.stack.length > this.maxSteps) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  undo() {
    if (this.index > 0) this.index--;
    return this.current;
  }

  redo() {
    if (this.index < this.stack.length - 1) this.index++;
    return this.current;
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }
  clear() {
    this.stack = [[]];
    this.index = 0;
  }
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
