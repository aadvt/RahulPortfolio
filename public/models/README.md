# 3D Models Directory

Place your custom 3D model files in this folder.

## Recommended Format

1. **GLB / GLTF**: This is the standard, most optimized format for React Three Fiber and Three.js.
   - Prefer `.glb` as it's a single, self-contained binary file containing geometry, textures, and materials.
   - If using `.gltf`, make sure to include any separate texture images in this folder as well.

## Usage in Code

You can load these models using the `useGLTF` hook from `@react-three/drei` in your React components:

```javascript
import { useGLTF } from '@react-three/drei';

function CustomModel() {
  const { scene } = useGLTF('/models/your-model-file.glb');
  return <primitive object={scene} />;
}
```
