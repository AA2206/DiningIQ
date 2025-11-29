// app/onboarding/gender.tsx
import Question from '../../components/Questions';

export default function Gender() {
  return (
    <Question
      title="What's your gender?"
      options={["Male", "Female", "Other"]}
      link="/onboarding/frequency"
      field="gender"
    />
  );
}