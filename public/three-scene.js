/**
 * HackO'Ween — Three.js 3D Halloween Scene
 * Features:
 * - 3D flying animated bats with flapping wings and smooth cruising paths
 * - 3D floating ember particles with upward turbulence and depth
 * - Smooth mouse-driven parallax and depth
 * - Dynamic theme lighting adaptation (Light vs Dark)
 */

(function () {
  'use strict';

  let scene, camera, renderer, container;
  let bats = [];
  let embers, emberGeo, emberMat;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let isDarkMode = false;
  let clock = new THREE.Clock();

  // Build a 3D Bat
  function createBat(scale = 0.5) {
    const bat = new THREE.Group();
    const batMat = new THREE.MeshStandardMaterial({
      color: 0x16131c,
      roughness: 0.6,
      metalness: 0.2
    });

    // Body
    const bodyGeo = new THREE.ConeGeometry(0.18, 0.8, 8);
    bodyGeo.rotateX(Math.PI);
    const body = new THREE.Mesh(bodyGeo, batMat);
    bat.add(body);

    // Head with ears
    const headGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const head = new THREE.Mesh(headGeo, batMat);
    head.position.y = 0.38;
    bat.add(head);

    // Left Wing
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(-0.6, 0.35);
    wingShape.lineTo(-1.2, 0.1);
    wingShape.lineTo(-0.9, -0.4);
    wingShape.lineTo(-0.5, -0.2);
    wingShape.lineTo(-0.3, -0.45);
    wingShape.lineTo(0, -0.2);
    wingShape.closePath();

    const wingGeo = new THREE.ShapeGeometry(wingShape);

    const leftWingGroup = new THREE.Group();
    leftWingGroup.position.set(-0.1, 0.1, 0);
    const leftWingMesh = new THREE.Mesh(wingGeo, batMat);
    leftWingMesh.material.side = THREE.DoubleSide;
    leftWingGroup.add(leftWingMesh);
    bat.add(leftWingGroup);

    // Right Wing (mirrored)
    const rightWingGroup = new THREE.Group();
    rightWingGroup.position.set(0.1, 0.1, 0);
    const rightWingMesh = new THREE.Mesh(wingGeo, batMat);
    rightWingMesh.scale.x = -1;
    rightWingMesh.material.side = THREE.DoubleSide;
    rightWingGroup.add(rightWingMesh);
    bat.add(rightWingGroup);

    bat.scale.set(scale, scale, scale);

    return {
      mesh: bat,
      leftWing: leftWingGroup,
      rightWing: rightWingGroup,
      wingSpeed: 10 + Math.random() * 6,
      orbitRadius: 4 + Math.random() * 3,
      orbitSpeed: 0.3 + Math.random() * 0.4,
      orbitOffset: Math.random() * Math.PI * 2,
      baseY: (Math.random() - 0.5) * 3,
      zPos: -2 - Math.random() * 4
    };
  }

  // 3D Glowing Embers
  function createEmbers() {
    const count = 160;
    emberGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      scales[i] = 0.04 + Math.random() * 0.08;
      speeds[i] = 0.4 + Math.random() * 0.8;
    }

    emberGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Circle texture with soft glow
    const cCanvas = document.createElement('canvas');
    cCanvas.width = 64;
    cCanvas.height = 64;
    const cCtx = cCanvas.getContext('2d');
    const grad = cCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 220, 150, 1)');
    grad.addColorStop(0.3, 'rgba(255, 120, 20, 0.85)');
    grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, 64, 64);
    const pTex = new THREE.CanvasTexture(cCanvas);

    emberMat = new THREE.PointsMaterial({
      size: 0.38,
      map: pTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xff8833
    });

    embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers);
  }

  // Setup Lights
  let ambientLight, dirLight, rimLight;
  function setupLighting() {
    ambientLight = new THREE.AmbientLight(0xffeedd, 0.6);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffaa44, 1.2);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);

    rimLight = new THREE.PointLight(0x8844ff, 1.5, 12);
    rimLight.position.set(-6, 2, -2);
    scene.add(rimLight);
  }

  // Update theme colors
  function updateThemeLighting(isDark) {
    isDarkMode = isDark;
    if (isDark) {
      if (ambientLight) ambientLight.color.setHex(0x331a4d);
      if (ambientLight) ambientLight.intensity = 0.5;
      if (dirLight) dirLight.color.setHex(0xff7700);
      if (dirLight) dirLight.intensity = 1.0;
      if (rimLight) rimLight.color.setHex(0x9d4edd);
      if (rimLight) rimLight.intensity = 2.4;
      if (emberMat) emberMat.color.setHex(0xff7722);
    } else {
      if (ambientLight) ambientLight.color.setHex(0xfff2e0);
      if (ambientLight) ambientLight.intensity = 0.85;
      if (dirLight) dirLight.color.setHex(0xff9933);
      if (dirLight) dirLight.intensity = 1.2;
      if (rimLight) rimLight.color.setHex(0xffaa33);
      if (rimLight) rimLight.intensity = 0.8;
      if (emberMat) emberMat.color.setHex(0xe85d00);
    }
  }

  // Init Main Scene
  function initScene() {
    container = document.getElementById('three-container');
    if (!container) return;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 7.5);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);

    setupLighting();
    createEmbers();

    // Spawn 3D Bats
    for (let i = 0; i < 4; i++) {
      const batObj = createBat(0.35 + Math.random() * 0.25);
      scene.add(batObj.mesh);
      bats.push(batObj);
    }

    // Responsive resize
    window.addEventListener('resize', onResize);

    // Mouse tracking for parallax
    window.addEventListener('mousemove', onMouseMove);

    // Sync initial theme
    const isDark = document.body.classList.contains('dark');
    updateThemeLighting(isDark);

    // Animation Loop
    animate();
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseMove(e) {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  // Render loop
  function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Smooth mouse lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Camera subtle parallax
    if (camera) {
      camera.position.x = mouse.x * 0.5;
      camera.position.y = -mouse.y * 0.35;
      camera.lookAt(0, 0, 0);
    }

    // Bat flight and wing flap animation
    bats.forEach(b => {
      const flap = Math.sin(time * b.wingSpeed) * 0.65;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;

      const angle = time * b.orbitSpeed + b.orbitOffset;
      const x = Math.cos(angle) * b.orbitRadius;
      const y = b.baseY + Math.sin(angle * 2) * 0.8;
      const z = b.zPos + Math.sin(angle) * 1.5;

      b.mesh.position.set(x, y, z);
      b.mesh.rotation.y = -angle + Math.PI / 2;
      b.mesh.rotation.z = Math.sin(angle * 2) * 0.2;
    });

    // Rising embers animation
    if (emberGeo) {
      const pos = emberGeo.attributes.position.array;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] += 0.015; // move upward
        pos[i * 3 + 0] += Math.sin(time + i) * 0.004; // gentle drift

        // reset if top
        if (pos[i * 3 + 1] > 7) {
          pos[i * 3 + 1] = -7;
          pos[i * 3 + 0] = (Math.random() - 0.5) * 20;
        }
      }
      emberGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  // Expose global controller
  window.HackOWeen3D = {
    init: initScene,
    setTheme: updateThemeLighting
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScene);
  } else {
    initScene();
  }
})();
