const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Audio context for synthesized sound effects
let audioCtx = null;

const torpedoSound = new Audio('sparo.m4a');
torpedoSound.preload = 'auto';

const explosionSound = new Audio('esplosione.m4a');
explosionSound.preload = 'auto';

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTorpedoSound() {
    const instance = torpedoSound.cloneNode(true);
    instance.volume = 0.8;
    instance.play().catch(() => {});
}

function playExplosionSound(size = 'small') {
    const instance = explosionSound.cloneNode(true);
    instance.volume = size === 'large' ? 0.9 : 0.7;
    instance.play().catch(() => {});
}

function playHitSound() {
    if (!audioCtx) return;

    // Metallic clang for hitting but not sinking
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
}

function playGameOverSound() {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(100, audioCtx.currentTime + 0.4);

    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.7);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.7);
}

// Game state
let gameRunning = false;
let score = 0;
let timeLeft = 60;
let timerInterval = null;

// Periscope/crosshair position
let crosshairX = canvas.width / 2;
const crosshairSpeed = 5;

// Track pressed keys for continuous movement
const keys = {
    left: false,
    right: false
};

// Game objects
let ships = [];
let torpedoes = [];
let explosions = [];
let bubbles = [];

// Ship types with different properties
const shipTypes = [
    { name: 'patrol', width: 60, height: 20, speed: 1.5, points: 100, color: '#888', health: 1 },
    { name: 'cargo', width: 100, height: 30, speed: 0.8, points: 200, color: '#666', health: 2 },
    { name: 'destroyer', width: 80, height: 25, speed: 2, points: 150, color: '#777', health: 2 },
    { name: 'submarine', width: 50, height: 15, speed: 1.2, points: 300, color: '#555', depth: 80, health: 1 }
];

// DOM elements
const scoreValue = document.getElementById('score-value');
const timeValue = document.getElementById('time-value');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Event listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Touch support for start/restart buttons
startBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    startGame();
});
restartBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    startGame();
});

// Helper to convert screen coordinates to canvas coordinates
function getCanvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    return (clientX - rect.left) * scaleX;
}

canvas.addEventListener('mousemove', (e) => {
    crosshairX = getCanvasX(e.clientX);
    crosshairX = Math.max(30, Math.min(canvas.width - 30, crosshairX));
});

canvas.addEventListener('click', fireTorpedo);

// Touch zone elements
const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');
const touchFire = document.getElementById('touch-fire');

// Track active touch zones
const touchState = {
    left: false,
    right: false
};

// Helper to update visual state of touch zones
function setTouchZoneActive(zone, active) {
    if (zone) {
        if (active) {
            zone.classList.add('active');
        } else {
            zone.classList.remove('active');
        }
    }
}

// Left touch zone - move left
if (touchLeft) {
    touchLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchState.left = true;
        keys.left = true;
        setTouchZoneActive(touchLeft, true);
    }, { passive: false });

    touchLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchState.left = false;
        keys.left = false;
        setTouchZoneActive(touchLeft, false);
    }, { passive: false });

    touchLeft.addEventListener('touchcancel', (e) => {
        touchState.left = false;
        keys.left = false;
        setTouchZoneActive(touchLeft, false);
    });
}

// Right touch zone - move right
if (touchRight) {
    touchRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchState.right = true;
        keys.right = true;
        setTouchZoneActive(touchRight, true);
    }, { passive: false });

    touchRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchState.right = false;
        keys.right = false;
        setTouchZoneActive(touchRight, false);
    }, { passive: false });

    touchRight.addEventListener('touchcancel', (e) => {
        touchState.right = false;
        keys.right = false;
        setTouchZoneActive(touchRight, false);
    });
}

// Fire touch zone - fire torpedo
if (touchFire) {
    touchFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        setTouchZoneActive(touchFire, true);
        fireTorpedo();
    }, { passive: false });

    touchFire.addEventListener('touchend', (e) => {
        e.preventDefault();
        setTouchZoneActive(touchFire, false);
    }, { passive: false });

    touchFire.addEventListener('touchcancel', (e) => {
        setTouchZoneActive(touchFire, false);
    });
}

// Prevent default touch behavior on canvas to avoid scrolling
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameRunning) {
        e.preventDefault();
        fireTorpedo();
    }
    if (e.code === 'ArrowLeft') {
        e.preventDefault();
        keys.left = true;
    }
    if (e.code === 'ArrowRight') {
        e.preventDefault();
        keys.right = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') {
        keys.left = false;
    }
    if (e.code === 'ArrowRight') {
        keys.right = false;
    }
});

function startGame() {
    initAudio();
    gameRunning = true;
    score = 0;
    timeLeft = 60;
    ships = [];
    torpedoes = [];
    explosions = [];
    bubbles = [];

    scoreValue.textContent = score;
    timeValue.textContent = timeLeft;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timeValue.textContent = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameRunning = false;
    clearInterval(timerInterval);
    playGameOverSound();
    finalScore.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function fireTorpedo() {
    if (!gameRunning) return;
    if (torpedoes.length >= 4) return; // Limit active torpedoes

    playTorpedoSound();

    torpedoes.push({
        x: crosshairX,
        y: canvas.height - 60,
        speed: 4,
        width: 6,
        height: 20
    });

    // Add bubble effect
    for (let i = 0; i < 5; i++) {
        bubbles.push({
            x: crosshairX + (Math.random() - 0.5) * 20,
            y: canvas.height - 50,
            radius: Math.random() * 4 + 2,
            speed: Math.random() * 2 + 1,
            alpha: 1
        });
    }
}

function spawnShip() {
    const type = shipTypes[Math.floor(Math.random() * shipTypes.length)];
    const fromLeft = Math.random() > 0.5;
    const depth = type.depth || (Math.random() * 60 + 30);

    ships.push({
        x: fromLeft ? -type.width : canvas.width,
        y: depth,
        width: type.width,
        height: type.height,
        speed: (fromLeft ? 1 : -1) * type.speed,
        points: type.points,
        color: type.color,
        name: type.name,
        health: type.health,
        maxHealth: type.health,
        damaged: false
    });
}

function createExplosion(x, y, size) {
    // Fire core particles
    for (let i = 0; i < 20; i++) {
        explosions.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 2,
            radius: Math.random() * size + 5,
            alpha: 1,
            type: 'fire',
            life: 1
        });
    }

    // Smoke particles
    for (let i = 0; i < 12; i++) {
        explosions.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 3 - 1,
            radius: Math.random() * size * 1.5 + 8,
            alpha: 0.8,
            type: 'smoke',
            life: 1
        });
    }

    // Debris particles
    for (let i = 0; i < 10; i++) {
        explosions.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.8) * 8,
            radius: Math.random() * 4 + 2,
            alpha: 1,
            type: 'debris',
            life: 1,
            rotation: Math.random() * Math.PI * 2
        });
    }

    // Water splash
    for (let i = 0; i < 8; i++) {
        explosions.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + size,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 6 - 3,
            radius: Math.random() * 6 + 3,
            alpha: 0.7,
            type: 'splash',
            life: 1
        });
    }
}

function update() {
    // Update crosshair position based on held keys
    if (keys.left) {
        crosshairX = Math.max(30, crosshairX - crosshairSpeed);
    }
    if (keys.right) {
        crosshairX = Math.min(canvas.width - 30, crosshairX + crosshairSpeed);
    }

    // Spawn ships
    if (Math.random() < 0.02 && ships.length < 6) {
        spawnShip();
    }

    // Update ships
    ships = ships.filter(ship => {
        ship.x += ship.speed;
        return ship.x > -ship.width - 10 && ship.x < canvas.width + 10;
    });

    // Update torpedoes
    torpedoes = torpedoes.filter(torpedo => {
        torpedo.y -= torpedo.speed;

        // Check collision with ships
        for (let i = ships.length - 1; i >= 0; i--) {
            const ship = ships[i];
            if (torpedo.x > ship.x &&
                torpedo.x < ship.x + ship.width &&
                torpedo.y < ship.y + ship.height &&
                torpedo.y > ship.y) {
                // Hit!
                ship.health--;

                if (ship.health <= 0) {
                    // Ship destroyed!
                    score += ship.points;
                    scoreValue.textContent = score;
                    createExplosion(torpedo.x, ship.y + ship.height / 2, ship.width / 4);

                    // Large ships make bigger explosion sound
                    if (ship.maxHealth > 1) {
                        playExplosionSound('large');
                    } else {
                        playExplosionSound('small');
                    }

                    ships.splice(i, 1);
                } else {
                    // Ship damaged but not destroyed
                    ship.damaged = true;
                    playHitSound();
                    // Create smaller hit effect
                    for (let j = 0; j < 5; j++) {
                        explosions.push({
                            x: torpedo.x,
                            y: ship.y + ship.height / 2,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4,
                            radius: Math.random() * 5 + 2,
                            alpha: 1,
                            type: 'fire',
                            life: 0.5
                        });
                    }
                }
                return false;
            }
        }

        return torpedo.y > -20;
    });

    // Update explosions
    explosions = explosions.filter(exp => {
        exp.x += exp.vx;
        exp.y += exp.vy;
        exp.life -= 0.02;

        if (exp.type === 'fire') {
            exp.vy -= 0.05; // fire rises
            exp.radius *= 0.97;
            exp.alpha = exp.life;
        } else if (exp.type === 'smoke') {
            exp.vy -= 0.02; // smoke rises slowly
            exp.radius *= 1.02; // smoke expands
            exp.alpha = exp.life * 0.6;
        } else if (exp.type === 'debris') {
            exp.vy += 0.3; // debris falls
            exp.rotation += 0.2;
            exp.alpha = exp.life;
        } else if (exp.type === 'splash') {
            exp.vy += 0.2; // gravity on water
            exp.alpha = exp.life * 0.7;
        } else {
            exp.vy += 0.1;
            exp.alpha -= 0.02;
        }

        return exp.life > 0 && exp.alpha > 0;
    });

    // Update bubbles
    bubbles = bubbles.filter(bubble => {
        bubble.y -= bubble.speed;
        bubble.alpha -= 0.02;
        bubble.x += (Math.random() - 0.5) * 0.5;
        return bubble.alpha > 0;
    });
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw water surface
    ctx.fillStyle = '#003366';
    ctx.fillRect(0, 0, canvas.width, 25);

    // Draw waves
    ctx.strokeStyle = '#4488bb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 20) {
        const waveY = 20 + Math.sin((x + Date.now() / 200) * 0.1) * 3;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    // Draw ships
    ships.forEach(ship => {
        ctx.save();

        if (ship.name === 'patrol') {
            // Patrol boat - sleek, fast military vessel
            // Hull
            const patrolHull = ctx.createLinearGradient(ship.x, ship.y, ship.x, ship.y + ship.height);
            patrolHull.addColorStop(0, '#708292');
            patrolHull.addColorStop(0.6, '#556574');
            patrolHull.addColorStop(1, '#3d4a56');
            ctx.fillStyle = patrolHull;
            ctx.beginPath();
            ctx.moveTo(ship.x, ship.y + ship.height * 0.7);
            ctx.quadraticCurveTo(ship.x + ship.width * 0.1, ship.y + ship.height, ship.x + ship.width * 0.3, ship.y + ship.height);
            ctx.lineTo(ship.x + ship.width * 0.9, ship.y + ship.height);
            ctx.quadraticCurveTo(ship.x + ship.width, ship.y + ship.height * 0.5, ship.x + ship.width, ship.y + ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.15, ship.y + ship.height * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2f3a43';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Waterline stripe
            ctx.strokeStyle = 'rgba(220, 230, 240, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.12, ship.y + ship.height * 0.65);
            ctx.lineTo(ship.x + ship.width * 0.92, ship.y + ship.height * 0.65);
            ctx.stroke();

            // Deck
            const patrolDeck = ctx.createLinearGradient(ship.x, ship.y, ship.x, ship.y + ship.height * 0.3);
            patrolDeck.addColorStop(0, '#556575');
            patrolDeck.addColorStop(1, '#414f5c');
            ctx.fillStyle = patrolDeck;
            ctx.fillRect(ship.x + ship.width * 0.15, ship.y + ship.height * 0.1, ship.width * 0.7, ship.height * 0.25);

            // Bridge
            ctx.fillStyle = '#34414d';
            ctx.fillRect(ship.x + ship.width * 0.35, ship.y - ship.height * 0.3, ship.width * 0.25, ship.height * 0.4);
            ctx.fillStyle = '#4b5c6a';
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.35, ship.y - ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.6, ship.y - ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.56, ship.y - ship.height * 0.42);
            ctx.lineTo(ship.x + ship.width * 0.39, ship.y - ship.height * 0.42);
            ctx.closePath();
            ctx.fill();

            // Windows
            ctx.fillStyle = '#8af';
            ctx.fillRect(ship.x + ship.width * 0.38, ship.y - ship.height * 0.2, ship.width * 0.05, ship.height * 0.15);
            ctx.fillRect(ship.x + ship.width * 0.48, ship.y - ship.height * 0.2, ship.width * 0.05, ship.height * 0.15);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(ship.x + ship.width * 0.385, ship.y - ship.height * 0.19, ship.width * 0.02, ship.height * 0.05);
            ctx.fillRect(ship.x + ship.width * 0.485, ship.y - ship.height * 0.19, ship.width * 0.02, ship.height * 0.05);

            // Gun turret
            ctx.fillStyle = '#2a3a4a';
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.75, ship.y + ship.height * 0.2, ship.height * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(ship.x + ship.width * 0.8, ship.y + ship.height * 0.1, ship.width * 0.15, ship.height * 0.1);
            ctx.fillStyle = '#1f2c38';
            ctx.fillRect(ship.x + ship.width * 0.83, ship.y + ship.height * 0.08, ship.width * 0.1, ship.height * 0.05);

        } else if (ship.name === 'cargo') {
            // Cargo ship - large container vessel
            // Hull
            const cargoHull = ctx.createLinearGradient(ship.x, ship.y, ship.x, ship.y + ship.height);
            cargoHull.addColorStop(0, '#a4571f');
            cargoHull.addColorStop(0.6, '#7c3f16');
            cargoHull.addColorStop(1, '#5a2c10');
            ctx.fillStyle = cargoHull;
            ctx.beginPath();
            ctx.moveTo(ship.x, ship.y + ship.height * 0.6);
            ctx.lineTo(ship.x + ship.width * 0.08, ship.y + ship.height);
            ctx.lineTo(ship.x + ship.width * 0.92, ship.y + ship.height);
            ctx.lineTo(ship.x + ship.width, ship.y + ship.height * 0.4);
            ctx.lineTo(ship.x + ship.width * 0.95, ship.y + ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.05, ship.y + ship.height * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#3f1f0b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Waterline stripe
            ctx.fillStyle = '#1b1f2a';
            ctx.fillRect(ship.x + ship.width * 0.08, ship.y + ship.height * 0.78, ship.width * 0.84, ship.height * 0.07);

            // Deck line
            ctx.strokeStyle = '#5a3010';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.05, ship.y + ship.height * 0.35);
            ctx.lineTo(ship.x + ship.width * 0.95, ship.y + ship.height * 0.35);
            ctx.stroke();

            // Containers
            const colors = ['#c41', '#28c', '#2a2', '#fc0'];
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = colors[i];
                ctx.fillRect(ship.x + ship.width * (0.12 + i * 0.17), ship.y - ship.height * 0.1, ship.width * 0.14, ship.height * 0.4);
                ctx.strokeStyle = '#333';
                ctx.strokeRect(ship.x + ship.width * (0.12 + i * 0.17), ship.y - ship.height * 0.1, ship.width * 0.14, ship.height * 0.4);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillRect(ship.x + ship.width * (0.12 + i * 0.17) + ship.width * 0.02, ship.y - ship.height * 0.08, ship.width * 0.03, ship.height * 0.36);
            }

            // Bridge at back
            ctx.fillStyle = '#f4efe1';
            ctx.fillRect(ship.x + ship.width * 0.82, ship.y - ship.height * 0.5, ship.width * 0.12, ship.height * 0.8);
            ctx.fillStyle = '#6af';
            ctx.fillRect(ship.x + ship.width * 0.84, ship.y - ship.height * 0.4, ship.width * 0.08, ship.height * 0.2);
            ctx.fillStyle = '#d9d3c4';
            ctx.fillRect(ship.x + ship.width * 0.84, ship.y - ship.height * 0.12, ship.width * 0.08, ship.height * 0.08);

            // Smokestack
            ctx.fillStyle = '#d44';
            ctx.fillRect(ship.x + ship.width * 0.78, ship.y - ship.height * 0.7, ship.width * 0.04, ship.height * 0.3);
            ctx.fillStyle = '#a22';
            ctx.fillRect(ship.x + ship.width * 0.785, ship.y - ship.height * 0.7, ship.width * 0.03, ship.height * 0.05);

        } else if (ship.name === 'destroyer') {
            // Destroyer - military warship
            // Hull
            const destroyerHull = ctx.createLinearGradient(ship.x, ship.y, ship.x, ship.y + ship.height);
            destroyerHull.addColorStop(0, '#6c7e8d');
            destroyerHull.addColorStop(0.6, '#556472');
            destroyerHull.addColorStop(1, '#3f4a55');
            ctx.fillStyle = destroyerHull;
            ctx.beginPath();
            ctx.moveTo(ship.x, ship.y + ship.height * 0.5);
            ctx.lineTo(ship.x + ship.width * 0.1, ship.y + ship.height);
            ctx.lineTo(ship.x + ship.width * 0.9, ship.y + ship.height);
            ctx.lineTo(ship.x + ship.width, ship.y + ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.92, ship.y + ship.height * 0.2);
            ctx.lineTo(ship.x + ship.width * 0.08, ship.y + ship.height * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2c343d';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Deck edge
            ctx.strokeStyle = 'rgba(210, 220, 230, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.12, ship.y + ship.height * 0.62);
            ctx.lineTo(ship.x + ship.width * 0.9, ship.y + ship.height * 0.62);
            ctx.stroke();

            // Superstructure
            ctx.fillStyle = '#4a5967';
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.25, ship.y + ship.height * 0.2);
            ctx.lineTo(ship.x + ship.width * 0.3, ship.y - ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.55, ship.y - ship.height * 0.3);
            ctx.lineTo(ship.x + ship.width * 0.6, ship.y + ship.height * 0.2);
            ctx.fill();
            ctx.fillStyle = '#3d4b58';
            ctx.fillRect(ship.x + ship.width * 0.32, ship.y - ship.height * 0.15, ship.width * 0.18, ship.height * 0.12);

            // Radar mast
            ctx.fillStyle = '#405060';
            ctx.fillRect(ship.x + ship.width * 0.4, ship.y - ship.height * 0.8, ship.width * 0.03, ship.height * 0.5);
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.35, ship.y - ship.height * 0.7);
            ctx.lineTo(ship.x + ship.width * 0.5, ship.y - ship.height * 0.7);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#405060';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.43, ship.y - ship.height * 0.74, ship.width * 0.03, 0, Math.PI * 2);
            ctx.strokeStyle = '#2f3b46';
            ctx.stroke();

            // Forward gun
            ctx.fillStyle = '#405060';
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.15, ship.y + ship.height * 0.1, ship.height * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(ship.x + ship.width * 0.18, ship.y, ship.width * 0.12, ship.height * 0.12);
            ctx.fillStyle = '#2f3b46';
            ctx.fillRect(ship.x + ship.width * 0.2, ship.y - ship.height * 0.02, ship.width * 0.08, ship.height * 0.05);

            // Rear gun
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.75, ship.y + ship.height * 0.1, ship.height * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(ship.x + ship.width * 0.78, ship.y + ship.height * 0.02, ship.width * 0.1, ship.height * 0.1);
            ctx.fillStyle = '#2f3b46';
            ctx.fillRect(ship.x + ship.width * 0.8, ship.y, ship.width * 0.06, ship.height * 0.05);

        } else if (ship.name === 'submarine') {
            // Enemy submarine
            // Main hull
            const subHull = ctx.createLinearGradient(ship.x, ship.y, ship.x, ship.y + ship.height);
            subHull.addColorStop(0, '#4a4a4a');
            subHull.addColorStop(0.5, '#2f2f2f');
            subHull.addColorStop(1, '#1f1f1f');
            ctx.fillStyle = subHull;
            ctx.beginPath();
            ctx.ellipse(ship.x + ship.width * 0.5, ship.y + ship.height * 0.5, ship.width * 0.5, ship.height * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#141414';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Midline stripe
            ctx.strokeStyle = '#5b5b5b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ship.x + ship.width * 0.1, ship.y + ship.height * 0.5);
            ctx.lineTo(ship.x + ship.width * 0.9, ship.y + ship.height * 0.5);
            ctx.stroke();

            // Conning tower
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(ship.x + ship.width * 0.4, ship.y - ship.height * 0.3, ship.width * 0.2, ship.height * 0.5);
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(ship.x + ship.width * 0.42, ship.y - ship.height * 0.22, ship.width * 0.16, ship.height * 0.1);

            // Periscope
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(ship.x + ship.width * 0.48, ship.y - ship.height * 0.8, ship.width * 0.04, ship.height * 0.5);
            ctx.fillStyle = '#2c2c2c';
            ctx.fillRect(ship.x + ship.width * 0.46, ship.y - ship.height * 0.82, ship.width * 0.08, ship.height * 0.04);

            // Propeller area
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.moveTo(ship.x, ship.y + ship.height * 0.3);
            ctx.lineTo(ship.x - ship.width * 0.05, ship.y + ship.height * 0.5);
            ctx.lineTo(ship.x, ship.y + ship.height * 0.7);
            ctx.fill();
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ship.x - ship.width * 0.02, ship.y + ship.height * 0.5, ship.height * 0.12, 0, Math.PI * 2);
            ctx.stroke();

            // Hull details
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(ship.x + ship.width * 0.5, ship.y + ship.height * 0.5, ship.width * 0.45, ship.height * 0.35, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(180, 180, 180, 0.6)';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(ship.x + ship.width * (0.3 + i * 0.12), ship.y + ship.height * 0.5, ship.height * 0.06, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw damage effects for damaged ships
        if (ship.damaged) {
            // Fire
            const fireX = ship.x + ship.width * 0.5;
            const fireY = ship.y;
            const flicker = Math.sin(Date.now() / 50) * 3;

            ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
            ctx.beginPath();
            ctx.ellipse(fireX + flicker, fireY - 5, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
            ctx.beginPath();
            ctx.ellipse(fireX - flicker, fireY - 3, 5, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Smoke trail
            ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
            for (let s = 0; s < 3; s++) {
                const smokeOffset = (Date.now() / 100 + s * 20) % 60;
                ctx.beginPath();
                ctx.arc(fireX + Math.sin(smokeOffset / 5) * 5, fireY - 15 - smokeOffset, 6 + smokeOffset / 10, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    });

    // Draw bubbles
    bubbles.forEach(bubble => {
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 200, 255, ${bubble.alpha})`;
        ctx.fill();
    });

    // Draw torpedoes
    torpedoes.forEach(torpedo => {
        ctx.fillStyle = '#ff0';
        ctx.fillRect(
            torpedo.x - torpedo.width / 2,
            torpedo.y,
            torpedo.width,
            torpedo.height
        );

        // Torpedo trail
        ctx.fillStyle = 'rgba(255, 255, 200, 0.5)';
        ctx.fillRect(
            torpedo.x - 2,
            torpedo.y + torpedo.height,
            4,
            30
        );
    });

    // Draw explosions
    explosions.forEach(exp => {
        ctx.save();

        if (exp.type === 'fire') {
            // Fire with gradient from yellow core to red/orange edge
            const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
            gradient.addColorStop(0, `rgba(255, 255, 200, ${exp.alpha})`);
            gradient.addColorStop(0.3, `rgba(255, 200, 50, ${exp.alpha})`);
            gradient.addColorStop(0.7, `rgba(255, 100, 0, ${exp.alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(200, 50, 0, ${exp.alpha * 0.3})`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (exp.type === 'smoke') {
            // Dark smoke
            ctx.fillStyle = `rgba(40, 40, 40, ${exp.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (exp.type === 'debris') {
            // Debris pieces
            ctx.translate(exp.x, exp.y);
            ctx.rotate(exp.rotation);
            ctx.fillStyle = `rgba(80, 60, 40, ${exp.alpha})`;
            ctx.fillRect(-exp.radius, -exp.radius / 2, exp.radius * 2, exp.radius);
        } else if (exp.type === 'splash') {
            // Water splash
            ctx.fillStyle = `rgba(150, 200, 255, ${exp.alpha})`;
            ctx.beginPath();
            ctx.ellipse(exp.x, exp.y, exp.radius, exp.radius * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Fallback
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 200, 0, ${exp.alpha})`;
            ctx.fill();
        }

        ctx.restore();
    });

    // Draw periscope view / crosshair at bottom
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(crosshairX, canvas.height - 80);
    ctx.lineTo(crosshairX, canvas.height - 30);
    ctx.stroke();

    // Crosshair circle
    ctx.beginPath();
    ctx.arc(crosshairX, canvas.height - 55, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Horizontal ticks
    ctx.beginPath();
    ctx.moveTo(crosshairX - 25, canvas.height - 55);
    ctx.lineTo(crosshairX - 10, canvas.height - 55);
    ctx.moveTo(crosshairX + 10, canvas.height - 55);
    ctx.lineTo(crosshairX + 25, canvas.height - 55);
    ctx.stroke();

    // Draw submarine base
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height + 20, 150, 50, 0, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.fillRect(crosshairX - 3, canvas.height - 30, 6, 30);
}

function gameLoop() {
    if (!gameRunning) return;

    update();
    draw();

    requestAnimationFrame(gameLoop);
}

// Responsive canvas sizing
const canvasWrapper = document.getElementById('canvas-wrapper');
const touchZones = document.getElementById('touch-zones');

// Base dimensions
const BASE_WIDTH = 800;
const BASE_HEIGHT = 500;

function resizeCanvas() {
    if (!canvasWrapper) return;

    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const isPortrait = wrapperRect.height > wrapperRect.width;

    let targetWidth, targetHeight;

    if (isPortrait) {
        // Portrait mode: use a taller aspect ratio
        // Keep width at 800 but increase height to better fill portrait screens
        const portraitRatio = wrapperRect.width / wrapperRect.height;
        targetWidth = BASE_WIDTH;
        // Calculate height to match screen ratio, but cap it
        targetHeight = Math.min(BASE_WIDTH / portraitRatio, 1000);
    } else {
        // Landscape mode: use original dimensions
        targetWidth = BASE_WIDTH;
        targetHeight = BASE_HEIGHT;
    }

    // Update canvas internal resolution
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Keep crosshair in bounds
        crosshairX = Math.max(30, Math.min(canvas.width - 30, crosshairX));

        // Redraw if game isn't running
        if (!gameRunning) {
            draw();
        }
    }

    // Calculate CSS size to fit container
    const canvasAspect = targetWidth / targetHeight;
    const containerAspect = wrapperRect.width / wrapperRect.height;

    let cssWidth, cssHeight;
    if (containerAspect > canvasAspect) {
        cssHeight = wrapperRect.height;
        cssWidth = cssHeight * canvasAspect;
    } else {
        cssWidth = wrapperRect.width;
        cssHeight = cssWidth / canvasAspect;
    }

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    // Position touch zones to match canvas
    if (touchZones) {
        const canvasRect = canvas.getBoundingClientRect();
        const offsetLeft = canvasRect.left - wrapperRect.left;
        const offsetTop = canvasRect.top - wrapperRect.top;

        touchZones.style.left = offsetLeft + 'px';
        touchZones.style.top = offsetTop + 'px';
        touchZones.style.width = cssWidth + 'px';
        touchZones.style.height = cssHeight + 'px';
    }
}

// Debounce resize events
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 100);
}

// Listen for resize and orientation changes
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
    // Delay for orientation change to complete
    setTimeout(resizeCanvas, 200);
});

// Initial resize
resizeCanvas();

// Initial draw
draw();
