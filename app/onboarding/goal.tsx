// app/onboarding/goal.tsx
import Question from '../../components/Questions';

export default function Goal() {
  return (
    <Question
      title="What is your goal?"
      options={["Build Muscle", "Get Lean", "Improve Fitness"]}
      link="/onboarding/diet"
      field="goal"
    />
  );
}