import ShowcaseGallery from '@/components/showcase/ShowcaseGallery';

export const metadata = {
  title: '3D Asset Showcase | Rahul',
  description:
    'Procedural Three.js models reconstructed from reference photos with the img2threejs pipeline.',
};

export default function ShowcasePage() {
  return <ShowcaseGallery />;
}
