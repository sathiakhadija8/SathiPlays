import { WorldPage } from '../../components/world/WorldPage';

export default function HomeWorldPage() {
  return (
    <WorldPage
      title="Home World"
      sections={[
        { title: 'Space Planner', body: 'Placeholder for room resets, routines, and task zones.' },
        { title: 'Home Rhythm', body: 'Placeholder for daily flow and calm-home maintenance plans.' },
      ]}
    />
  );
}
