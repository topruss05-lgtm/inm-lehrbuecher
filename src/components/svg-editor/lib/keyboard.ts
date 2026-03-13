export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  label: string;
}

export class KeyboardManager {
  private shortcuts: Shortcut[] = [];
  private handler: (e: KeyboardEvent) => void;

  constructor() {
    this.handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      for (const s of this.shortcuts) {
        if (e.key.toLowerCase() === s.key.toLowerCase() &&
            !!e.ctrlKey === !!s.ctrl &&
            !!e.shiftKey === !!s.shift &&
            !!e.altKey === !!s.alt) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    };
  }

  register(shortcut: Shortcut) {
    this.shortcuts.push(shortcut);
  }

  registerAll(shortcuts: Shortcut[]) {
    this.shortcuts.push(...shortcuts);
  }

  attach() {
    window.addEventListener('keydown', this.handler);
  }

  detach() {
    window.removeEventListener('keydown', this.handler);
  }
}
