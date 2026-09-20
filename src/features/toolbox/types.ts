export type ToolId =
  | 'bored'
  | 'scrolling'
  | 'procrastination'
  | 'overthinking'
  | 'temper'
  | 'selfDoubt'
  | 'appearance'
  | 'roomReset'
  | 'focusTimer'
  | 'messageReset'
  | 'relationshipConnection'
  | 'evening';

export interface ReflectionToolProps {
  date: string;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** Lets a reflection tool hand off into another tool, e.g. Bored → Room Reset. */
  openTool?: (tool: ToolId) => void;
}
