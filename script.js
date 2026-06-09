    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const W = 860,
    H = 280;
    const GROUND_Y = H - 44; // the line characters stand ON
    const GRAVITY = 0.58,
    JUMP_VEL = -14;
    const MAX_AMMO = 5,
    AMMO_REGEN = 200,
    BULLET_SPD = 14;

    function resizeCanvas() {
    const w = Math.min(860, window.innerWidth - 32);
    canvas.style.width = w + "px";
    canvas.style.height = (w * H) / W + "px";
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // ── character dimensions (all measured from feet = bottom) ──────────────────
    // Player pixel-art human
    const PW = 32; // collision width
    const PH_STAND = 52; // collision height standing
    const PH_DUCK = 26; // collision height ducking
    const PLAYER_X = 90;

    // Runner enemy
    const RW = 30,
    RH = 52;

    // ── state ────────────────────────────────────────────────────────────────────
    let state = "idle";
    let score = 0,
    best = 0,
    lives = 3;
    let gameSpeed = 5,
    speedTimer = 0,
    frame = 0;
    let ammo = MAX_AMMO,
    ammoTimer = 0,
    lastShot = -30;
    let obstacles = [],
    runners = [],
    bullets = [],
    coins = [],
    particles = [],
    floatTexts = [],
    stars = [];
    let spawnTimer = 0,
    spawnInterval = 90;
    let runnerSpawnTimer = 0,
    runnerSpawnInterval = 390;
    let coinTimer = 0,
    invincible = 0,
    shakeFrames = 0;

    const player = {
    x: PLAYER_X,
    get y() {
        return GROUND_Y - (this.ducking ? PH_DUCK : PH_STAND);
    },
    get h() {
        return this.ducking ? PH_DUCK : PH_STAND;
    },
    get w() {
        return PW;
    },
    vy: 0,
    ducking: false,
    jumping: false,
    legPhase: 0,
    armPhase: 0,
    shooting: 0,
    _y: GROUND_Y - PH_STAND, // actual vertical position (top of bounding box)
    };
    // override y with actual physics position
    Object.defineProperty(player, "y", {
    get() {
        return this._y;
    },
    set(v) {
        this._y = v;
    },
    });

    for (let i = 0; i < 85; i++)
    stars.push({
        x: Math.random() * W,
        y: Math.random() * (GROUND_Y - 20),
        r: Math.random() * 1.4 + 0.3,
        spd: Math.random() * 0.35 + 0.08,
        a: Math.random() * 0.4 + 0.15,
    });

    // ── input ────────────────────────────────────────────────────────────────────
    const keys = {};
    window.addEventListener("keydown", (e) => {
    if (
        ["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS", "KeyF"].includes(e.code)
    )
        e.preventDefault();
    const was = keys[e.code];
    keys[e.code] = true;
    if (!was) {
        if (e.code === "Space" || e.code === "KeyF") {
        tryAction("shoot");
        }
        if (e.code === "ArrowUp" || e.code === "KeyW") {
        tryAction("jump");
        }
        if (e.code === "ArrowDown" || e.code === "KeyS") player.ducking = true;
    }
    });
    window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") player.ducking = false;
    });

    let tX = 0,
    tY = 0;
    canvas.addEventListener(
    "touchstart",
    (e) => {
        tX = e.touches[0].clientX;
        tY = e.touches[0].clientY;
    },
    { passive: true },
    );
    canvas.addEventListener(
    "touchend",
    (e) => {
        const dx = e.changedTouches[0].clientX - tX,
        dy = e.changedTouches[0].clientY - tY;
        if (state === "idle" || state === "gameover" || state === "dead") {
        tryAction("jump");
        return;
        }
        if (Math.abs(dx) > 40) tryAction("shoot");
        else if (dy < -20) tryAction("jump");
        else if (dy > 20) {
        player.ducking = true;
        setTimeout(() => (player.ducking = false), 500);
        } else tryAction("jump");
    },
    { passive: true },
    );
    canvas.addEventListener("click", () => {
    if (state === "idle" || state === "gameover") tryAction("jump");
    });

    function tryAction(a) {
    if (state === "idle" || state === "gameover") {
        startGame();
        return;
    }
    if (state === "dead") {
        respawn();
        return;
    }
    if (a === "jump") doJump();
    if (a === "shoot") doShoot();
    }
    function doJump() {
    if (player.jumping) return;
    player.vy = JUMP_VEL;
    player.jumping = true;
    spawnParts(player.x + PW / 2, GROUND_Y, "#00ffcc", 6);
    }
    function doShoot() {
    if (ammo <= 0) {
        spawnFloat(player.x + 36, player.y + 10, "NO AMMO", "#ff3355");
        return;
    }
    if (frame - lastShot < 10) return;
    ammo--;
    lastShot = frame;
    player.shooting = 14;
    updateAmmoBar();
    const by = (player.y + player.h * 0.38) | 0;
    bullets.push({ x: player.x + PW + 4, y: by, active: true });
    }

    // ── game flow ────────────────────────────────────────────────────────────────
    function startGame() {
    state = "running";
    score = 0;
    lives = 3;
    gameSpeed = 5;
    speedTimer = 0;
    frame = 0;
    ammo = MAX_AMMO;
    ammoTimer = 0;
    lastShot = -30;
    obstacles = [];
    runners = [];
    bullets = [];
    coins = [];
    particles = [];
    floatTexts = [];
    spawnTimer = 0;
    spawnInterval = 90;
    runnerSpawnTimer = 0;
    runnerSpawnInterval = 390;
    coinTimer = 0;
    invincible = 0;
    shakeFrames = 0;
    player._y = GROUND_Y - PH_STAND;
    player.vy = 0;
    player.jumping = false;
    player.ducking = false;
    player.shooting = 0;
    updateHUD();
    updateAmmoBar();
    }
    function respawn() {
    state = "running";
    invincible = 140;
    player._y = GROUND_Y - PH_STAND;
    player.vy = 0;
    player.jumping = false;
    }
    function loseLife() {
    if (invincible > 0) return;
    lives--;
    shakeFrames = 16;
    invincible = 120;
    spawnParts(player.x + PW / 2, player.y + player.h / 2, "#ff3355", 18);
    updateHUD();
    if (lives <= 0) {
        state = "gameover";
        if (score > best) best = score;
        updateHUD();
    } else state = "dead";
    }
    function updateHUD() {
    document.getElementById("scoreVal").textContent = String(score).padStart(
        6,
        "0",
    );
    document.getElementById("bestVal").textContent = String(best).padStart(
        6,
        "0",
    );
    document.getElementById("livesVal").textContent = [
        "♥ ♥ ♥",
        "♥ ♥ ♡",
        "♥ ♡ ♡",
        "♡ ♡ ♡",
    ][Math.max(0, 3 - lives)];
    }
    function updateAmmoBar() {
    const b = document.getElementById("ammoBar");
    b.innerHTML = "";
    for (let i = 0; i < MAX_AMMO; i++) {
        const d = document.createElement("div");
        d.className = "bullet-pip" + (i < ammo ? "" : " empty");
        b.appendChild(d);
    }
    }

    // ── spawn ─────────────────────────────────────────────────────────────────────
    function spawnObstacle() {
    const pool =
        score < 250
        ? ["cactus", "cactus", "low"]
        : score < 700
            ? ["cactus", "low", "bird"]
            : ["cactus", "low", "bird", "bird"];
    const t = pool[(Math.random() * pool.length) | 0];
    if (t === "cactus") {
        const h = (30 + Math.random() * 20) | 0;
        obstacles.push({ x: W + 10, y: GROUND_Y - h, w: 20, h, type: "cactus" });
    } else if (t === "low") {
        obstacles.push({ x: W + 10, y: GROUND_Y - 18, w: 38, h: 18, type: "low" });
    } else {
        const fy = (GROUND_Y - PH_STAND - 16 - Math.random() * 28) | 0;
        obstacles.push({
        x: W + 10,
        y: fy,
        w: 38,
        h: 20,
        type: "bird",
        phase: Math.random() * Math.PI * 2,
        });
    }
    }
    function spawnRunner() {
    const hp = score > 900 ? 3 : score > 350 ? 2 : 1;
    runners.push({
        x: W + 16,
        y: GROUND_Y - RH,
        w: RW,
        h: RH,
        hp,
        maxHp: hp,
        legPhase: 0,
        armPhase: 0,
        hitFlash: 0,
        warned: false,
        runSpd: 1.9 + Math.random() * 0.8 + score / 2200,
    });
    }
    function spawnCoin() {
    coins.push({
        x: W + 10,
        y: (GROUND_Y - PH_STAND - 8 - Math.random() * 36) | 0,
        r: 7,
        collected: false,
        phase: Math.random() * Math.PI * 2,
    });
    }
    function spawnParts(x, y, col, n) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2,
        s = Math.random() * 4 + 1;
        particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: (35 + Math.random() * 20) | 0,
        maxLife: 55,
        col,
        r: Math.random() * 3 + 1,
        });
    }
    }
    function spawnFloat(x, y, txt, col) {
    floatTexts.push({ x, y, txt, col, life: 55, maxLife: 55, vy: -0.85 });
    }

    // ── collision ────────────────────────────────────────────────────────────────
    function hit(ax, ay, aw, ah, bx, by, bw, bh, m = 4) {
    return (
        ax + m < bx + bw - m &&
        ax + aw - m > bx + m &&
        ay + m < by + bh - m &&
        ay + ah - m > by + m
    );
    }

    // ── update ────────────────────────────────────────────────────────────────────
    function update() {
    frame++;
    if (state !== "running") return;

    speedTimer++;
    if (speedTimer % 320 === 0) {
        gameSpeed = Math.min(13, gameSpeed + 0.35);
        spawnInterval = Math.max(42, spawnInterval - 3);
        runnerSpawnInterval = Math.max(200, runnerSpawnInterval - 14);
    }
    if (frame % 6 === 0) {
        score++;
        updateHUD();
    }
    if (invincible > 0) invincible--;
    if (shakeFrames > 0) shakeFrames--;
    if (player.shooting > 0) player.shooting--;

    if (ammo < MAX_AMMO) {
        ammoTimer++;
        if (ammoTimer >= AMMO_REGEN) {
        ammo++;
        ammoTimer = 0;
        updateAmmoBar();
        }
    }

    // player physics — move _y directly
    player.vy += GRAVITY;
    player._y += player.vy;
    const floor = GROUND_Y - (player.ducking ? PH_DUCK : PH_STAND);
    if (player._y >= floor) {
        player._y = floor;
        player.vy = 0;
        player.jumping = false;
    }
    if (!player.ducking) {
        player.legPhase += 0.28;
        player.armPhase += 0.28;
    }

    stars.forEach((s) => {
        s.x -= s.spd;
        if (s.x < 0) s.x = W;
    });

    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
        spawnObstacle();
        spawnTimer = 0;
    }
    obstacles.forEach((o) => {
        o.x -= gameSpeed;
        if (o.type === "bird") o.phase += 0.07;
    });
    obstacles = obstacles.filter((o) => o.x > -80);

    runnerSpawnTimer++;
    if (runnerSpawnTimer >= runnerSpawnInterval) {
        spawnRunner();
        runnerSpawnTimer = 0;
    }
    runners.forEach((r) => {
        r.x -= gameSpeed + r.runSpd;
        r.legPhase += 0.3;
        r.armPhase += 0.3;
        if (r.hitFlash > 0) r.hitFlash--;
    });
    runners = runners.filter((r) => r.x > -80 && r.hp > 0);

    bullets.forEach((b) => {
        b.x += BULLET_SPD;
    });
    bullets = bullets.filter((b) => b.x < W + 20 && b.active);

    // bullet vs runner
    bullets.forEach((b) => {
        if (!b.active) return;
        runners.forEach((r) => {
        if (r.hp <= 0) return;
        if (hit(b.x - 5, b.y - 5, 10, 10, r.x, r.y, r.w, r.h, 0)) {
            b.active = false;
            r.hp--;
            r.hitFlash = 12;
            spawnParts(r.x + r.w / 2, r.y + r.h / 2, "#ff9900", 7);
            if (r.hp <= 0) {
            score += 25;
            updateHUD();
            spawnParts(r.x + r.w / 2, r.y + r.h / 3, "#ff3355", 20);
            spawnFloat(r.x + r.w / 2, r.y - 8, "+25", "#ffcc00");
            } else spawnFloat(r.x + r.w / 2, r.y - 8, "HIT!", "#ff9900");
        }
        });
        obstacles.forEach((o) => {
        if (!b.active || o.type !== "bird") return;
        const oy = o.y + Math.sin(o.phase || 0) * 6;
        if (hit(b.x - 5, b.y - 5, 10, 10, o.x, oy, o.w, o.h, 0)) {
            b.active = false;
            o._dead = true;
            score += 10;
            updateHUD();
            spawnParts(o.x + o.w / 2, oy, "#ff3355", 10);
            spawnFloat(o.x, oy - 8, "+10", "#ffcc00");
        }
        });
    });
    obstacles = obstacles.filter((o) => !o._dead);

    coinTimer++;
    if (coinTimer >= 115) {
        spawnCoin();
        coinTimer = 0;
    }
    coins.forEach((c) => {
        c.x -= gameSpeed;
        c.phase += 0.08;
    });
    coins = coins.filter((c) => c.x > -20 && !c.collected);

    // player vs obstacles
    obstacles.forEach((o) => {
        const oy = o.type === "bird" ? o.y + Math.sin(o.phase || 0) * 6 : o.y;
        if (hit(player.x, player._y, player.w, player.h, o.x, oy, o.w, o.h))
        loseLife();
    });
    // player vs runners
    runners.forEach((r) => {
        if (
        r.hp > 0 &&
        hit(player.x, player._y, player.w, player.h, r.x, r.y, r.w, r.h)
        )
        loseLife();
    });
    // player vs coins
    coins.forEach((c) => {
        const cy = c.y + Math.sin(c.phase) * 5;
        if (
        hit(
            player.x,
            player._y,
            player.w,
            player.h,
            c.x - c.r,
            cy - c.r,
            c.r * 2,
            c.r * 2,
            0,
        )
        ) {
        c.collected = true;
        score += 10;
        updateHUD();
        spawnParts(c.x, cy, "#ffcc00", 7);
        spawnFloat(c.x, cy - 14, "+10", "#ffcc00");
        }
    });

    particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.life--;
    });
    particles = particles.filter((p) => p.life > 0);
    floatTexts.forEach((f) => {
        f.y += f.vy;
        f.life--;
    });
    floatTexts = floatTexts.filter((f) => f.life > 0);
    }

    // ── CHARACTER DRAWING ────────────────────────────────────────────────────────
    // All characters are drawn with FEET anchored to `footY` (= GROUND_Y or runner.y+runner.h)
    // Uses filled shapes for a solid pixel-art look, not just strokes

    function drawPlayerChar(
    footX,
    footY,
    legPh,
    armPh,
    ducking,
    shootingArm,
    flash,
    ) {
    // footX = left edge of character, footY = where feet touch ground
    const cx = footX + 16; // horizontal centre
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ffcc";
    const alpha = flash ? (Math.sin(frame * 0.35) > 0 ? 0.28 : 1) : 1;
    ctx.globalAlpha = alpha;

    if (ducking) {
        // ── DUCK POSE ─────────────────────────────────────────────
        const by = footY - 26;
        // body block
        ctx.fillStyle = "#00cc99";
        ctx.fillRect(cx - 10, by, 20, 18);
        // head attached to body
        ctx.fillStyle = "#00ffcc";
        ctx.fillRect(cx - 8, by - 12, 16, 12);
        // visor strip
        ctx.fillStyle = "#003322";
        ctx.fillRect(cx + 1, by - 10, 8, 7);
        // legs bent back
        ctx.fillStyle = "#009977";
        ctx.fillRect(cx - 10, by + 18, 8, 8);
        ctx.fillRect(cx + 2, by + 18, 8, 8);
        // feet
        ctx.fillStyle = "#00ffcc";
        ctx.fillRect(cx - 13, by + 24, 11, 5);
        ctx.fillRect(cx + 2, by + 24, 11, 5);
    } else {
        // ── STAND / RUN POSE ─────────────────────────────────────
        const t = legPh;
        // leg animation: alternate thigh + shin angles
        const l1 = Math.sin(t) * 18,
        l2 = Math.sin(t + Math.PI) * 18; // thigh swing (pixels)
        const s1 = Math.max(0, Math.sin(t + 0.5)) * 12,
        s2 = Math.max(0, Math.sin(t + Math.PI + 0.5)) * 12; // shin fold

        // ── Legs (drawn first so body overlaps hips) ──
        // Leg 1
        const lh1x = cx - 5,
        lh1y = footY - 20;
        const lf1x = lh1x + l1 * 0.5,
        lf1y = lh1y + 18; // knee
        const la1x = lf1x - s1 * 0.3,
        la1y = footY - 4; // ankle
        ctx.strokeStyle = "#009977";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lh1x, lh1y);
        ctx.lineTo(lf1x, lf1y);
        ctx.lineTo(la1x, la1y);
        ctx.stroke();
        // Leg 2
        const lh2x = cx + 5,
        lh2y = footY - 20;
        const lf2x = lh2x + l2 * 0.5,
        lf2y = lh2y + 18;
        const la2x = lf2x - s2 * 0.3,
        la2y = footY - 4;
        ctx.strokeStyle = "#006655";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(lh2x, lh2y);
        ctx.lineTo(lf2x, lf2y);
        ctx.lineTo(la2x, la2y);
        ctx.stroke();
        // Feet
        ctx.fillStyle = "#00ffcc";
        ctx.fillRect(la1x - 6, footY - 6, 13, 5);
        ctx.fillRect(la2x - 6, footY - 6, 13, 5);

        // ── Torso ──
        const torsoTop = footY - 50;
        ctx.fillStyle = "#00cc99";
        ctx.fillRect(cx - 10, torsoTop, 20, 30);
        // Belt
        ctx.fillStyle = "#005544";
        ctx.fillRect(cx - 10, torsoTop + 26, 20, 4);

        // ── Arms ──
        const ak = Math.sin(armPh) * 14;
        if (shootingArm > 0) {
        // shooting: right arm straight forward
        ctx.strokeStyle = "#ffcc00";
        ctx.shadowColor = "#ffcc00";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx + 10, torsoTop + 6);
        ctx.lineTo(cx + 22, torsoTop + 4);
        ctx.stroke();
        // gun nub
        ctx.fillStyle = "#ffaa00";
        ctx.fillRect(cx + 20, torsoTop + 2, 7, 5);
        // left arm back
        ctx.strokeStyle = "#009977";
        ctx.shadowColor = "#00ffcc";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, torsoTop + 6);
        ctx.lineTo(cx - 18, torsoTop + 6 + ak);
        ctx.stroke();
        } else {
        ctx.strokeStyle = "#009977";
        ctx.shadowColor = "#00ffcc";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - 10, torsoTop + 6);
        ctx.lineTo(cx - 18, torsoTop + 6 + ak);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 10, torsoTop + 6);
        ctx.lineTo(cx + 18, torsoTop + 6 - ak);
        ctx.stroke();
        }

        // ── Head ──
        ctx.fillStyle = "#00ffcc";
        ctx.fillRect(cx - 9, torsoTop - 14, 18, 15);
        // Visor
        ctx.fillStyle = "#002211";
        ctx.fillRect(cx + 1, torsoTop - 12, 8, 8);
        // Helmet top ridge
        ctx.fillStyle = "#00ddaa";
        ctx.fillRect(cx - 9, torsoTop - 16, 18, 3);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
    }

    function drawRunnerChar(footX, footY, legPh, armPh, hitFlash) {
    // Runner faces LEFT (charging at player), footX = left edge, footY = feet
    const cx = footX + 15;
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ff3355";

    const flashing = hitFlash > 0 && Math.floor(hitFlash / 3) % 2 === 0;
    const bodyCol = flashing ? "#ffffff" : "#cc1133";
    const limbCol = flashing ? "#ffffff" : "#991122";
    const skinCol = flashing ? "#ffffff" : "#ff6677";

    const t = legPh;
    const l1 = Math.sin(t) * 16,
        l2 = Math.sin(t + Math.PI) * 16;
    const s1 = Math.max(0, Math.sin(t + 0.5)) * 10,
        s2 = Math.max(0, Math.sin(t + Math.PI + 0.5)) * 10;

    // Legs
    const lh1x = cx + 4,
        lh1y = footY - 20;
    const lf1x = lh1x + l1 * 0.5,
        lf1y = lh1y + 16;
    const la1x = lf1x + s1 * 0.3,
        la1y = footY - 4;
    ctx.strokeStyle = limbCol;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lh1x, lh1y);
    ctx.lineTo(lf1x, lf1y);
    ctx.lineTo(la1x, la1y);
    ctx.stroke();
    const lh2x = cx - 4,
        lh2y = footY - 20;
    const lf2x = lh2x + l2 * 0.5,
        lf2y = lh2y + 16;
    const la2x = lf2x + s2 * 0.3,
        la2y = footY - 4;
    ctx.strokeStyle = flashing ? "#fff" : "#771122";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(lh2x, lh2y);
    ctx.lineTo(lf2x, lf2y);
    ctx.lineTo(la2x, la2y);
    ctx.stroke();
    // Feet (pointing left)
    ctx.fillStyle = flashing ? "#fff" : "#ff3355";
    ctx.fillRect(la1x - 13, footY - 6, 13, 5);
    ctx.fillRect(la2x - 13, footY - 6, 13, 5);

    // Torso
    const torsoTop = footY - 50;
    ctx.fillStyle = bodyCol;
    ctx.fillRect(cx - 9, torsoTop, 18, 30);
    ctx.fillStyle = flashing ? "#fff" : "#aa0022";
    ctx.fillRect(cx - 9, torsoTop + 26, 18, 4);

    // Arms swinging (mirror for left-facing)
    const ak = Math.sin(armPh) * 14;
    ctx.strokeStyle = limbCol;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 9, torsoTop + 6);
    ctx.lineTo(cx - 20, torsoTop + 6 + ak);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 9, torsoTop + 6);
    ctx.lineTo(cx + 20, torsoTop + 6 - ak);
    ctx.stroke();

    // Head (facing left — angry eyes on left side)
    ctx.fillStyle = skinCol;
    ctx.fillRect(cx - 9, torsoTop - 14, 18, 15);
    // Angry eyes (two red dots, left side)
    ctx.fillStyle = flashing ? "#ff0" : "#ff0000";
    ctx.fillRect(cx - 7, torsoTop - 11, 4, 4);
    ctx.fillRect(cx - 7, torsoTop - 5, 4, 3); // angry brow shadow
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - 6, torsoTop - 10, 2, 2);
    // Mouth line
    ctx.fillStyle = "#660011";
    ctx.fillRect(cx - 7, torsoTop - 2, 12, 3);

    ctx.shadowBlur = 0;
    ctx.restore();
    }

    // ── DRAW helpers ──────────────────────────────────────────────────────────────
    function drawGrid() {
    ctx.strokeStyle = "rgba(0,255,204,0.025)";
    ctx.lineWidth = 1;
    const s = 44;
    for (let x = (frame * gameSpeed * 0.3) % s; x < W; x += s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GROUND_Y);
        ctx.stroke();
    }
    }

    function drawGround() {
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    g.addColorStop(0, "rgba(0,255,204,0.15)");
    g.addColorStop(0.6, "rgba(0,255,204,0.03)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.shadowBlur = 7;
    ctx.shadowColor = "#00ffcc";
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // dashes
    ctx.strokeStyle = "rgba(0,255,204,0.13)";
    ctx.lineWidth = 1;
    const dw = 28,
        dg = 52,
        off = (frame * gameSpeed) % (dw + dg);
    for (let x = -dw + off; x < W; x += dw + dg) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + 7);
        ctx.lineTo(x + dw, GROUND_Y + 7);
        ctx.stroke();
    }
    }

    function drawStars() {
    stars.forEach((s) => {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = "#cceeff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    }

    function drawObstacles() {
    obstacles.forEach((o) => {
        const oy = o.type === "bird" ? o.y + Math.sin(o.phase || 0) * 6 : o.y;
        ctx.shadowBlur = 7;
        ctx.shadowColor = "#ff3355";
        ctx.fillStyle = "#ff3355";
        if (o.type === "cactus") {
        ctx.fillRect(o.x + 6, oy, 8, o.h);
        const ah = (o.h * 0.38) | 0;
        ctx.fillRect(o.x, oy + ah, 7, 6);
        ctx.fillRect(o.x + 14, oy + ah + 10, 7, 6);
        ctx.fillRect(o.x, oy + ah - 8, 6, 8);
        ctx.fillRect(o.x + 14, oy + ah + 2, 6, 8);
        } else if (o.type === "low") {
        ctx.fillStyle = "#991133";
        ctx.beginPath();
        ctx.ellipse(
            o.x + o.w / 2,
            oy + o.h / 2,
            o.w / 2,
            o.h / 2,
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#ff3355";
        ctx.beginPath();
        ctx.ellipse(
            o.x + o.w / 2 - 4,
            oy + o.h / 2,
            o.w / 2 - 5,
            o.h / 2 - 2,
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();
        } else {
        ctx.fillStyle = "#ff3355";
        ctx.beginPath();
        ctx.ellipse(
            o.x + o.w / 2,
            oy + o.h / 2,
            o.w / 2,
            o.h / 2,
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();
        const wf = Math.sin((o.phase || 0) * 3) * 5;
        ctx.fillRect(o.x - 10, oy + wf, 14, 5);
        ctx.fillRect(o.x + o.w - 4, oy - wf, 14, 5);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(o.x + o.w * 0.2, oy + o.h * 0.3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(o.x + o.w * 0.2 - 1, oy + o.h * 0.3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        }
        ctx.shadowBlur = 0;
    });
    }

    function drawCoins() {
    coins.forEach((c) => {
        const cy = c.y + Math.sin(c.phase) * 5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ffcc00";
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(c.x, cy, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(c.x - 2, cy - 2, c.r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
    }

    function drawBullets() {
    bullets.forEach((b) => {
        if (!b.active) return;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ffcc00";
        ctx.fillStyle = "#ffee44";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x + 3, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.18 / i;
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.ellipse(b.x - i * 9, b.y, 5 / i, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        }
        ctx.globalAlpha = 1;
    });
    }

    function drawParticles() {
    particles.forEach((p) => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    }

    function drawFloatTexts() {
    floatTexts.forEach((f) => {
        ctx.globalAlpha = f.life / f.maxLife;
        ctx.fillStyle = f.col;
        ctx.shadowBlur = 5;
        ctx.shadowColor = f.col;
        ctx.font = 'bold 11px "Space Mono",monospace';
        ctx.textAlign = "center";
        ctx.fillText(f.txt, f.x, f.y);
        ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    }

    function drawRunners() {
    runners.forEach((r) => {
        if (r.x > W - 80 && !r.warned) {
        ctx.fillStyle = "#ff3355";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ff3355";
        ctx.font = 'bold 12px "Space Mono",monospace';
        ctx.textAlign = "right";
        if (Math.sin(frame * 0.25) > 0)
            ctx.fillText("⚠ INCOMING!", W - 8, GROUND_Y - RH - 12);
        ctx.textAlign = "left";
        ctx.shadowBlur = 0;
        }
        if (r.x <= W - 80) r.warned = true;
        if (r.maxHp > 1 && r.hp > 0) {
        const bx = r.x - 4,
            by = r.y - 13;
        ctx.fillStyle = "#1a0010";
        ctx.fillRect(bx, by, 34, 4);
        ctx.fillStyle = r.hp === r.maxHp ? "#ff3355" : "#ff9900";
        ctx.fillRect(bx, by, 34 * (r.hp / r.maxHp), 4);
        }
        drawRunnerChar(r.x, r.y + r.h, r.legPhase, r.armPhase, r.hitFlash);
    });
    }

    function drawOverlay() {
    if (state === "idle")
        box("OLAIDE RUNNER", "PRESS SPACE  or  ↑  TO START", "#00ffcc");
    else if (state === "dead")
        box(
        "OUCH!",
        `${lives} ${lives === 1 ? "LIFE" : "LIVES"} LEFT — PRESS SPACE TO CONTINUE`,
        "#ff9900",
        );
    else if (state === "gameover") {
        const ex = score >= best ? "  ★ NEW BEST!" : "";
        box(
        "GAME OVER",
        `SCORE: ${String(score).padStart(6, "0")}${ex}\nPRESS SPACE TO RETRY`,
        "#ff3355",
        );
    }
    }
    function box(title, sub, col) {
    ctx.fillStyle = "rgba(8,8,16,0.88)";
    ctx.fillRect(W / 2 - 235, H / 2 - 60, 470, 118);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W / 2 - 235, H / 2 - 60, 470, 118);
    ctx.fillStyle = col;
    ctx.font = 'bold 26px "Space Mono",monospace';
    ctx.textAlign = "center";
    ctx.shadowBlur = 12;
    ctx.shadowColor = col;
    ctx.fillText(title, W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8899aa";
    ctx.font = '10.5px "Space Mono",monospace';
    sub
        .split("\n")
        .forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 10 + i * 18));
    ctx.textAlign = "left";
    }

    // ── MAIN LOOP ─────────────────────────────────────────────────────────────────
    function loop() {
    if (shakeFrames > 0) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3);
    }
    ctx.clearRect(-10, -10, W + 20, H + 20);

    drawStars();
    drawGrid();
    drawGround();
    drawCoins();
    drawObstacles();

    // draw runners
    drawRunners();

    // draw player — feet always on GROUND_Y when not jumping
    drawPlayerChar(
        player.x,
        player._y + player.h,
        player.legPhase,
        player.armPhase,
        player.ducking,
        player.shooting,
        invincible > 0,
    );

    drawBullets();
    drawParticles();
    drawFloatTexts();
    drawOverlay();

    if (shakeFrames > 0) ctx.restore();
    update();
    requestAnimationFrame(loop);
    }

    updateHUD();
    updateAmmoBar();
    loop();
