import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createNeutralAvatar, disposeAvatar } from "../signing/neutralAvatar";
import { loadGLTF, loadMotion, SequencePlayer } from "../signing/motion";
import type { Catalog, Plan } from "../signing/pipeline";
export interface Frame {
  index: number;
  local: number;
  inTransition: boolean;
  time: number;
  duration: number;
  ended: boolean;
}
interface Props {
  catalog: Catalog | null;
  plan: Plan | null;
  playing: boolean;
  speed: number;
  replay: number;
  onLoading: () => void;
  onReady: () => void;
  onError: (error: string) => void;
  onFrame: (frame: Frame) => void;
}
export function Avatar(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    latest.current.onLoading();
    const abort = new AbortController();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      latest.current.onError(
        "3D rendering is unavailable. Enable WebGL or try another browser.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Upper-body 3D avatar. A neutral pose is not a sign.",
    );
    renderer.domElement.setAttribute("role", "img");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight("#e4e5ff", "#413054", 2.3));
    const key = new THREE.DirectionalLight("#fff0e6", 3);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#8a76ff", 3);
    rim.position.set(2, 2, -2);
    scene.add(rim);
    let root: THREE.Object3D | null = null,
      player: SequencePlayer | null = null;
    let frameId = 0,
      previous = performance.now(),
      lastEmit = 0,
      lastReplay = latest.current.replay;
    let bounds = new THREE.Box3();
    const center = new THREE.Vector3(),
      size = new THREE.Vector3(1.2, 1.8, 0.6);
    function resize() {
      if (!container) return;
      const width = container.clientWidth,
        height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      // Include horizontal reach beyond the neutral model bounds: hands must not be cropped.
      const distance =
        Math.max(
          size.y / 2 / Math.tan(halfFov),
          Math.max(size.x, props.plan ? size.y * 1.2 : size.x) /
            2 /
            (Math.tan(halfFov) * camera.aspect),
        ) * 1.25;
      camera.position.set(center.x, center.y, center.z + distance + size.z / 2);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    function render(now: number) {
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (player) {
        if (lastReplay !== latest.current.replay) {
          player.seek(0);
          lastReplay = latest.current.replay;
        }
        const frame = player.seek(
          player.time +
            (latest.current.playing && !document.hidden
              ? delta * latest.current.speed
              : 0),
        );
        if (now - lastEmit > 65) {
          latest.current.onFrame(frame);
          lastEmit = now;
        }
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    async function initialize() {
      const model = props.catalog?.rig.url
        ? (await loadGLTF(props.catalog.rig.url, abort.signal)).scene
        : createNeutralAvatar();
      if (abort.signal.aborted) {
        disposeAvatar(model);
        return;
      }
      root = model;
      scene.add(root);
      root.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(root);
      bounds.getCenter(center);
      bounds.getSize(size);
      resize();
      frameId = requestAnimationFrame(render);
      if (props.plan) {
        const clips = await Promise.all(
          props.plan.signs.map((asset) =>
            loadMotion(asset, model, abort.signal),
          ),
        );
        if (abort.signal.aborted) return;
        player = new SequencePlayer(model, clips, props.plan.transitionSeconds);
      }
      latest.current.onReady();
    }
    const timeout = window.setTimeout(() => {
      abort.abort();
      latest.current.onError(
        "Avatar or animation loading timed out. Check the assets and retry.",
      );
    }, 20000);
    void initialize()
      .then(() => clearTimeout(timeout))
      .catch((error) => {
        clearTimeout(timeout);
        if (!abort.signal.aborted)
          latest.current.onError(
            error instanceof Error ? error.message : "Avatar failed to load.",
          );
      });
    return () => {
      clearTimeout(timeout);
      abort.abort();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      player?.dispose();
      if (root) disposeAvatar(root);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [props.catalog, props.plan]);
  return <div ref={host} className="avatar-canvas" />;
}
