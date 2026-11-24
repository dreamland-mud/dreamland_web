/* Stacked-alpha video: a cutout figure that moves. An H.264 file cannot carry
   transparency, so the frame is twice as tall as the picture: the top half is
   the colour, the bottom half the alpha as grey (white = opaque). A hidden,
   muted, looping video feeds a WebGL canvas, and the shader puts the two
   halves back together as a premultiplied RGBA picture, so the edges blend
   into whatever is behind the canvas without a halo.

   DLAlphaVideo.create(src, onFail) returns { canvas, video, stop } or null
   when WebGL is missing. The caller puts both nodes in the page (the video
   stays invisible: Safari only decodes a video that is laid out). onFail runs
   once, when the file fails, autoplay is refused or the GL context is lost;
   the caller then shows a still instead. The video pauses while the canvas is
   off screen or the tab is hidden. */
(function () {
    var VERT =
        'attribute vec2 p;' +
        'varying vec2 uv;' +
        'void main() { uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }';
    // h = half a texel of the stacked frame: linear filtering must not reach
    // across the seam between the two halves.
    var FRAG =
        // mediump is 16-bit on mobile GPUs: too coarse to address 1920 rows
        '#ifdef GL_FRAGMENT_PRECISION_HIGH\n' +
        'precision highp float;\n' +
        '#else\n' +
        'precision mediump float;\n' +
        '#endif\n' +
        'varying vec2 uv;' +
        'uniform sampler2D t;' +
        'uniform float h;' +
        'void main() {' +
        '  vec3 c = texture2D(t, vec2(uv.x, min(uv.y * .5, .5 - h))).rgb;' +
        '  float a = texture2D(t, vec2(uv.x, max(.5 + uv.y * .5, .5 + h))).r;' +
        // compression leaves a faint grey haze around 0 and a dip under 1
        '  a = smoothstep(.1, .94, a);' +
        '  gl_FragColor = vec4(c * a, a);' +
        '}';

    function shader(gl, type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }

    function setup(canvas) {
        var gl = null;
        try {
            gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
                || canvas.getContext('experimental-webgl');
        } catch (e) { gl = null; }
        if (!gl) return null;
        var vs = shader(gl, gl.VERTEX_SHADER, VERT), fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return null;
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // a video is not a power of two: no mipmaps, clamped edges
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.clearColor(0, 0, 0, 0);
        return { gl: gl, half: gl.getUniformLocation(prog, 'h') };
    }

    function create(src, onFail) {
        var canvas = document.createElement('canvas');
        var g = setup(canvas);
        if (!g) return null;
        var gl = g.gl;

        var video = document.createElement('video');
        // properties for the autoplay policy, attributes for iOS
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        ['muted', 'loop', 'playsinline', 'disablepictureinpicture'].forEach(function (a) {
            video.setAttribute(a, '');
        });
        video.preload = 'auto';
        video.setAttribute('aria-hidden', 'true');
        video.tabIndex = -1;

        var dead = false, failed = false, onScreen = true, frameCb = 0, rafId = 0, drawn = false, lastTime = -1;

        function fail() {
            if (failed || dead) return;
            failed = true;
            stop();
            if (onFail) onFail();
        }

        // the backing store follows the box and the screen density, never
        // bigger than the picture itself
        function fit() {
            var dpr = window.devicePixelRatio || 1;
            var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
            var vw = video.videoWidth || 540, vh = (video.videoHeight || 1920) / 2;
            var s = Math.min(1, vw / Math.max(w, 1), vh / Math.max(h, 1));
            w = Math.max(1, Math.round(w * s));
            h = Math.max(1, Math.round(h * s));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                if (drawn) paint(false);
            }
        }

        function paint(upload) {
            if (dead || gl.isContextLost()) return;
            if (upload) {
                try {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                } catch (e) { fail(); return; }   // a cross-origin or broken frame
                drawn = true;
            }
            gl.uniform1f(g.half, 0.5 / (video.videoHeight || 1920));
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        // one upload per decoded frame where the browser says when; a
        // per-animation-frame check of currentTime elsewhere
        function loop() {
            if (dead) return;
            if (video.requestVideoFrameCallback) {
                frameCb = video.requestVideoFrameCallback(function () {
                    frameCb = 0;
                    paint(true);
                    loop();
                });
            } else {
                rafId = requestAnimationFrame(function () {
                    rafId = 0;
                    if (video.readyState >= 2 && video.currentTime !== lastTime) {
                        lastTime = video.currentTime;
                        paint(true);
                    }
                    loop();
                });
            }
        }

        function wantPlay() { return onScreen && !document.hidden; }

        function sync() {
            if (dead) return;
            if (!wantPlay()) { video.pause(); return; }
            var p = video.play();
            if (p && p.catch) {
                p.catch(function (e) {
                    // AbortError = a pause or a new source overtook this play
                    if (e && e.name === 'AbortError') return;
                    fail();
                });
            }
        }

        var io = null;
        if (window.IntersectionObserver) {
            io = new IntersectionObserver(function (entries) {
                onScreen = entries[entries.length - 1].isIntersecting;
                sync();
            });
            io.observe(canvas);
        }
        var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
        if (ro) ro.observe(canvas);
        else window.addEventListener('resize', fit);
        document.addEventListener('visibilitychange', sync);

        function lost() { fail(); }
        canvas.addEventListener('webglcontextlost', lost);
        video.addEventListener('error', fail);
        video.addEventListener('loadedmetadata', fit);
        // the first frame is on the canvas: the caller may drop its still
        video.addEventListener('loadeddata', function () {
            fit();
            paint(true);
            canvas.dispatchEvent(new Event('dl-frame'));
        });

        function stop() {
            if (dead) return;
            dead = true;
            if (frameCb && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCb);
            if (rafId) cancelAnimationFrame(rafId);
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            else window.removeEventListener('resize', fit);
            document.removeEventListener('visibilitychange', sync);
            canvas.removeEventListener('webglcontextlost', lost);
            video.removeEventListener('error', fail);
            video.pause();
            video.removeAttribute('src');
            video.load();   // lets the browser drop the decoder
            var lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
        }

        video.src = src;
        loop();
        sync();
        return { canvas: canvas, video: video, stop: stop };
    }

    window.DLAlphaVideo = { create: create };
})();
