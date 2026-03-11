import { MoodGlass } from './MoodGlass';
import { CycleGlass } from './cycle/CycleGlass';

export function LeftPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-0 overflow-hidden">
      <div className="min-h-0 flex-[0.95]">
        <MoodGlass />
      </div>
      <div className="min-h-0 flex-[1.05]">
        <CycleGlass />
      </div>
    </div>
  );
}
