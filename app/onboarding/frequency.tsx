// app/onboarding/frequency.tsx
import Question from '../../components/Questions';

export default function Frequency() {
  return (
    <Question
      title="How many times a week do you workout?"
      options={["0-2", "3-5", "6+"]}
      link="/onboarding/metrics"
      field="frequency"
    />
  );
}