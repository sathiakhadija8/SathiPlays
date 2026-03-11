import { UpcomingEventsGlass } from './events/UpcomingEventsGlass';
import { TimelineGlass } from './timeline/TimelineGlass';
import { LevelCard } from './LevelCard';

export function RightPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden max-[900px]:gap-2">
      <div className="min-h-0 flex-[0.55]">
        <LevelCard />
      </div>
      <div className="min-h-0 flex-[0.9]">
        <UpcomingEventsGlass />
      </div>
      <div className="min-h-0 flex-[1.05]">
        <TimelineGlass />
      </div>
    </div>
  );
}
