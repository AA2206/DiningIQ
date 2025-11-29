// app/onboarding/diet.tsx
import Question from '../../components/Questions';

export default function Diet() {
  return (
    <Question
      title="Do you follow a specific diet?"
      options={["Classic", "Pescetarian", "Vegetarian", "Vegan"]}
      link="/onboarding/other"
      field="diet"
    />
  );
}