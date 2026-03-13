export interface Command {
  execute(): void;
  undo(): void;
  label: string;
}

export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private onChange: () => void;

  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];
    this.onChange();
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    this.onChange();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    this.onChange();
    return true;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
