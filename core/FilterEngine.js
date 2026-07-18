import { OneEuroFilter } from './OneEuroFilter.js?v=4';

export class FilterEngine {
  constructor(canvas, overlayCanvas) {
    this.canvas = canvas;
    this.overlayCanvas = overlayCanvas;
    this.overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
    
    // Initialize WebGL context
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.gl) {
      console.error("WebGL not supported, falling back to 2D context is not implemented");
      return;
    }

    // Default configuration (sliders range 0 to 2, blend 0 to 1)
    this.blend = 1.0;
    this.showDots = true;
    this.beforeAfter = false;
    this.eye = 1.0;
    this.forehead = 1.0;
    this.chin = 1.0;
    this.nose = 1.0;
    this.mouth = 1.0;

    // Preallocated coordinate arrays (478 landmarks * 3 coordinates)
    this.rawVertices = new Float32Array(1434);
    this.renderVertices = new Float32Array(1434);

    // Initialize One Euro Filters for landmark smoothing (keeps wireframe stable)
    this.landmarkFilters = [];
    for (let i = 0; i < 1434; i++) {
      this.landmarkFilters.push(new OneEuroFilter(1.5, 0.007, 1.0));
    }

    // Setup WebGL Program, Buffers, Textures
    this.initWebGL();
  }

  initWebGL() {
    const gl = this.gl;

    // Vertex Shader Source
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        v_texCoord.y = 1.0 - v_texCoord.y; // Flip Y for webcam texture mapping
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment Shader Source (Direct highly exaggerated comical face parts deformation warp)
    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;

      // Face coordinate spaces
      uniform vec2 u_face_center;
      uniform float u_face_scale;
      uniform float u_face_angle;

      // Key landmark centers in local coordinate space
      uniform vec2 u_eye_left;
      uniform vec2 u_eye_right;
      uniform vec2 u_nose;
      uniform vec2 u_mouth_left;
      uniform vec2 u_mouth_right;
      uniform vec2 u_jaw_center;
      uniform vec2 u_forehead_center;

      // Sliders parameter inputs
      uniform float u_eye_val;
      uniform float u_forehead_val;
      uniform float u_chin_val;
      uniform float u_nose_val;
      uniform float u_mouth_val;

      uniform float u_blend;
      uniform float u_before_after;
      uniform float u_aspect;

      vec2 rotate(vec2 v, float alpha) {
        float c = cos(alpha);
        float s = sin(alpha);
        return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
      }

      void main() {
        // Handle split before/after view
        if (u_before_after > 0.5 && v_texCoord.x < 0.5) {
          gl_FragColor = texture2D(u_texture, v_texCoord);
          return;
        }

        vec2 pixel = v_texCoord;
        
        // Map to aspect-ratio corrected isotropic space (multiply X by aspect)
        vec2 uv_iso = vec2(pixel.x * u_aspect, pixel.y);
        vec2 center_iso = vec2(u_face_center.x * u_aspect, u_face_center.y);
        vec2 d = uv_iso - center_iso;

        // Convert to local face-space coordinates
        vec2 local = rotate(d, -u_face_angle) / u_face_scale;

        // 1. Eye Size deformation (comical small to big)
        // Left Eye
        float dEL = distance(local, u_eye_left);
        if (dEL < 0.22) {
          float w = smoothstep(0.22, 0.0, dEL);
          float k = (u_eye_val < 1.0) ? (1.0 + (1.0 - u_eye_val) * 0.85 * w) : (1.0 - (u_eye_val - 1.0) * 0.65 * w);
          local = u_eye_left + (local - u_eye_left) * k;
        }
        // Right Eye
        float dER = distance(local, u_eye_right);
        if (dER < 0.22) {
          float w = smoothstep(0.22, 0.0, dER);
          float k = (u_eye_val < 1.0) ? (1.0 + (1.0 - u_eye_val) * 0.85 * w) : (1.0 - (u_eye_val - 1.0) * 0.65 * w);
          local = u_eye_right + (local - u_eye_right) * k;
        }

        // 2. Forehead Size deformation (comical small to big)
        float dFH = distance(local, u_forehead_center);
        if (dFH < 0.32) {
          float w = smoothstep(0.32, 0.0, dFH);
          float k = (u_forehead_val < 1.0) ? (1.0 + (1.0 - u_forehead_val) * 0.90 * w) : (1.0 - (u_forehead_val - 1.0) * 0.65 * w);
          local.y = u_forehead_center.y + (local.y - u_forehead_center.y) * k;
        }

        // 3. Chin Size deformation (comical small to big)
        float dJ = distance(local, u_jaw_center);
        if (dJ < 0.28) {
          float w = smoothstep(0.28, 0.0, dJ);
          float k = (u_chin_val < 1.0) ? (1.0 + (1.0 - u_chin_val) * 0.85 * w) : (1.0 - (u_chin_val - 1.0) * 0.65 * w);
          local = u_jaw_center + (local - u_jaw_center) * k;
        }

        // 4. Nose Size deformation (comical smaller to bigger)
        float dN = distance(local, u_nose);
        if (dN < 0.18) {
          float w = smoothstep(0.18, 0.0, dN);
          float k = (u_nose_val < 1.0) ? (1.0 + (1.0 - u_nose_val) * 0.90 * w) : (1.0 - (u_nose_val - 1.0) * 0.65 * w);
          local = u_nose + (local - u_nose) * k;
        }

        // 5. Mouth Size deformation (comical small to big)
        vec2 mouthCenter = (u_mouth_left + u_mouth_right) * 0.5;
        float dM = distance(local, mouthCenter);
        if (dM < 0.24) {
          float w = smoothstep(0.24, 0.0, dM);
          float k = (u_mouth_val < 1.0) ? (1.0 + (1.0 - u_mouth_val) * 0.85 * w) : (1.0 - (u_mouth_val - 1.0) * 0.65 * w);
          local = mouthCenter + (local - mouthCenter) * k;
        }

        // Convert deformed local back to screen texture coordinates (isotropic to normalized)
        vec2 deformed_d = rotate(local * u_face_scale, u_face_angle);
        vec2 deformed_pixel = vec2((center_iso.x + deformed_d.x) / u_aspect, center_iso.y + deformed_d.y);

        // Apply deformation blend fix (mix original UV coordinates and deformed UV coordinates)
        vec2 final_pixel = mix(v_texCoord, deformed_pixel, u_blend);

        gl_FragColor = texture2D(u_texture, clamp(final_pixel, 0.0, 1.0));
      }
    `;

    // Compile Helper function
    const compileShader = (source, type) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);

    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(this.program));
    }

    // Set up full screen quad positions
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    // Set up texture
    this.webcamTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.webcamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  updateParameters(params) {
    this.blend = params.blend;
    this.showDots = params.showDots;
    this.beforeAfter = params.beforeAfter;
    this.eye = params.eye;
    this.forehead = params.forehead;
    this.chin = params.chin;
    this.nose = params.nose;
    this.mouth = params.mouth;
  }

  process(results, dt) {
    const landmarks = results.faceLandmarks[0];
    if (!landmarks) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Smooth landmarks using One Euro Filters
    for (let i = 0; i < 478; i++) {
      const idx = i * 3;
      const rx = landmarks[i].x;
      const ry = landmarks[i].y;
      const rz = landmarks[i].z;

      this.rawVertices[idx] = this.landmarkFilters[idx].filter(rx, dt);
      this.rawVertices[idx + 1] = this.landmarkFilters[idx + 1].filter(ry, dt);
      this.rawVertices[idx + 2] = this.landmarkFilters[idx + 2].filter(rz, dt);
    }

    // 2. Compute Centroid / Translation vector (Face Center in screen space)
    let cx = 0, cy = 0;
    for (let i = 0; i < 478; i++) {
      cx += this.rawVertices[i * 3];
      cy += this.rawVertices[i * 3 + 1];
    }
    cx /= 478; cy /= 478;
    this.faceCenter = { x: cx, y: cy };

    // 3. Compute rotation angle (using eye horizontal direction)
        // 5. Compute key local coordinates relative to center, rotated back (aspect corrected)
    const aspect = w / h;
    const toLocal = (lmIdx) => {
      const idx = lmIdx * 3;
      const rx = (this.rawVertices[idx] - cx) * aspect; // aspect ratio scale
      const ry = this.rawVertices[idx + 1] - cy;
      // Rotate back by -angle
      const c = Math.cos(-this.faceAngle);
      const s = Math.sin(-this.faceAngle);
      const lx = rx * c - ry * s;
      const ly = rx * s + ry * c;
      // Scale normalize
      return { x: lx / this.faceScale, y: ly / this.faceScale };
    };

    // Calculate aspect corrected face angle and scale
    const elx = this.rawVertices[159 * 3] * aspect;
    const ely = this.rawVertices[159 * 3 + 1];
    const erx = this.rawVertices[386 * 3] * aspect;
    const ery = this.rawVertices[386 * 3 + 1];
    this.faceAngle = Math.atan2(ery - ely, erx - elx);

    const dx = erx - elx;
    const dy = ery - ely;
    this.faceScale = Math.sqrt(dx * dx + dy * dy) * 2.5;

    this.localEyeLeft = toLocal(159);
    this.localEyeRight = toLocal(386);
    this.localNose = toLocal(1);
    this.localMouthLeft = toLocal(78);
    this.localMouthRight = toLocal(308);
    this.localJaw = toLocal(152);
    this.localForehead = toLocal(10);

    // Populate render vertices in screen space pixels for overlay dots
    for (let i = 0; i < 478; i++) {
      const idx = i * 3;
      this.renderVertices[idx] = this.rawVertices[idx] * w;
      this.renderVertices[idx + 1] = this.rawVertices[idx + 1] * h;
    }
  }

  render(webcam) {
    const gl = this.gl;
    if (!gl) return;

    // 1. Upload webcam frame to WebGL texture
    gl.bindTexture(gl.TEXTURE_2D, this.webcamTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webcam);

    // 2. Set WebGL viewport & use program
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);

    // Bind vertices positions
    const posAttr = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // 3. Set Uniforms
    const setVec2 = (name, x, y) => {
      const loc = gl.getUniformLocation(this.program, name);
      gl.uniform2f(loc, x, y);
    };
    const setFloat = (name, val) => {
      const loc = gl.getUniformLocation(this.program, name);
      gl.uniform1f(loc, val);
    };

    if (this.faceCenter) {
      setVec2("u_face_center", this.faceCenter.x, this.faceCenter.y);
      setFloat("u_face_scale", this.faceScale);
      setFloat("u_face_angle", this.faceAngle);

      setVec2("u_eye_left", this.localEyeLeft.x, this.localEyeLeft.y);
      setVec2("u_eye_right", this.localEyeRight.x, this.localEyeRight.y);
      setVec2("u_nose", this.localNose.x, this.localNose.y);
      setVec2("u_mouth_left", this.localMouthLeft.x, this.localMouthLeft.y);
      setVec2("u_mouth_right", this.localMouthRight.x, this.localMouthRight.y);
      setVec2("u_jaw_center", this.localJaw.x, this.localJaw.y);
      setVec2("u_forehead_center", this.localForehead.x, this.localForehead.y);
    } else {
      setVec2("u_face_center", 0.5, 0.5);
      setFloat("u_face_scale", 10.0);
      setFloat("u_face_angle", 0.0);

      setVec2("u_eye_left", 0.0, 0.0);
      setVec2("u_eye_right", 0.0, 0.0);
      setVec2("u_nose", 0.0, 0.0);
      setVec2("u_mouth_left", 0.0, 0.0);
      setVec2("u_mouth_right", 0.0, 0.0);
      setVec2("u_jaw_center", 0.0, 0.0);
      setVec2("u_forehead_center", 0.0, 0.0);
    }

    // Set dynamic feature slider levels directly (NO smoothing/interpolation)
    setFloat("u_eye_val", this.eye);
    setFloat("u_forehead_val", this.forehead);
    setFloat("u_chin_val", this.chin);
    setFloat("u_nose_val", this.nose);
    setFloat("u_mouth_val", this.mouth);

    // Set global parameters
    setFloat("u_blend", this.blend);
    setFloat("u_before_after", this.beforeAfter ? 1.0 : 0.0);
    setFloat("u_aspect", this.canvas.width / this.canvas.height);

    // Draw textured quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 4. Render overlay dots and guide lines
    if (this.overlayCtx) {
      const ctx = this.overlayCtx;
      ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      // Draw split view guidelines
      if (this.beforeAfter) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(this.overlayCanvas.width / 2, 0);
        ctx.lineTo(this.overlayCanvas.width / 2, this.overlayCanvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(10, 10, 15, 0.6)";
        ctx.fillRect(10, 10, 80, 24);
        ctx.fillRect(this.overlayCanvas.width - 90, 10, 80, 24);

        ctx.fillStyle = "#ffffff";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BEFORE", 50, 25);
        ctx.fillText("AFTER", this.overlayCanvas.width - 50, 25);
      }

      // Draw wireframe dots
      if (this.showDots && this.faceCenter) {
        ctx.fillStyle = "rgba(0, 255, 210, 0.75)";
        for (let i = 0; i < 478; i++) {
          const idx = i * 3;
          const x = this.renderVertices[idx];
          const y = this.renderVertices[idx + 1];
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }
}
