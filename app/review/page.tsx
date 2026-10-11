import ReviewStage from '@/components/showcase/ReviewStage';

// Internal harness for the img2threejs screenshot-feedback gate. Renders one
// generated model at one named review viewpoint, with no chrome, so a headless
// capture can be fed straight into make_comparison_sheet.py.
//
// /review?asset=skateboard&view=hero-three-quarter
export const metadata = { title: 'img2threejs review stage' };

export default function ReviewPage() {
  return <ReviewStage />;
}
