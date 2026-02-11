const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'START'; // START, PLAYING, PROPOSAL, END
let score = 0;
const WIN_SCORE = 15; // Hearts needed to fill the meter
let player;
let hearts = [];
let particles = [];
let animationId;
let loveMeter = document.getElementById('love-fill');
let noEscapeCount = 0;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const proposalScreen = document.getElementById('proposal-screen');
const celebrationScreen = document.getElementById('celebration-screen');
const startBtn = document.getElementById('start-btn');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');

// HiDPI Resize Handling (draw in CSS pixels, scale internally for sharp canvas)
function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (player) {
    player.y = window.innerHeight - 100;
  }
}
window.addEventListener('resize', resize);

// Player Object
class Player {
  constructor() {
    this.w = 100;
    this.h = 80;
    this.x = window.innerWidth / 2 - this.w / 2;
    this.y = window.innerHeight - 100;
    this.dx = 0;
  }

  draw() {
    // Minimal basket
    ctx.fillStyle = '#ff4d6d';

    // basket body
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y, this.w / 2, 0, Math.PI, false);
    ctx.fill();

    // handle
    ctx.beginPath();
    ctx.strokeStyle = '#c9184a';
    ctx.lineWidth = 5;
    ctx.arc(this.x + this.w / 2, this.y - 10, this.w / 2, Math.PI, 0, false);
    ctx.stroke();
  }

  update() {
    this.x += this.dx;

    if (this.x < 0) this.x = 0;
    if (this.x + this.w > window.innerWidth) this.x = window.innerWidth - this.w;
  }
}

// Heart Object
class Heart {
  constructor() {
    this.size = Math.random() * 18 + 22; // 22-40px
    this.x = Math.random() * (window.innerWidth - this.size);
    this.y = -this.size;
    this.speed = Math.random() * 2.8 + 2; // 2-4.8
    this.color = `hsl(${Math.random() * 16 + 346}, 95%, 62%)`;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();

    const topCurveHeight = this.size * 0.3;
    ctx.moveTo(this.x, this.y + topCurveHeight);

    // top left curve
    ctx.bezierCurveTo(
      this.x,
      this.y,
      this.x - this.size / 2,
      this.y,
      this.x - this.size / 2,
      this.y + topCurveHeight
    );

    // bottom left curve
    ctx.bezierCurveTo(
      this.x - this.size / 2,
      this.y + (this.size + topCurveHeight) / 2,
      this.x,
      this.y + (this.size + topCurveHeight) / 2,
      this.x,
      this.y + this.size
    );

    // bottom right curve
    ctx.bezierCurveTo(
      this.x,
      this.y + (this.size + topCurveHeight) / 2,
      this.x + this.size / 2,
      this.y + (this.size + topCurveHeight) / 2,
      this.x + this.size / 2,
      this.y + topCurveHeight
    );

    // top right curve
    ctx.bezierCurveTo(
      this.x + this.size / 2,
      this.y,
      this.x,
      this.y,
      this.x,
      this.y + topCurveHeight
    );

    ctx.fill();
  }

  update() {
    this.y += this.speed;
  }
}

// Particle Effect
class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.size = opts.size ?? Math.random() * 5 + 2;
    this.speedX = opts.speedX ?? (Math.random() - 0.5) * 4;
    this.speedY = opts.speedY ?? (Math.random() - 0.5) * 4;
    this.life = opts.life ?? 100;
    this.color = opts.color ?? 'rgba(255, 255, 255, 0.85)';
    this.kind = opts.kind ?? 'spark'; // spark | confetti
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.25;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    this.life -= 2;
  }

  draw() {
    ctx.globalAlpha = Math.max(0, this.life / 100);
    ctx.fillStyle = this.color;

    if (this.kind === 'confetti') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillRect(-this.size, -this.size / 2, this.size * 2, this.size);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

// Input Handling
function handleInput(e) {
  if (!player) return;

  if (e.type === 'touchmove') {
    // prevent page scroll while playing
    e.preventDefault();
  }

  if (e.type === 'mousemove' || e.type === 'touchmove') {
    const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
    player.x = clientX - player.w / 2;
  }
}

window.addEventListener('mousemove', handleInput);
window.addEventListener('touchmove', handleInput, { passive: false });

// Game Functions
function spawnHeart() {
  // Slightly higher spawn rate on mobile (shorter sessions)
  const mobileBoost = window.innerWidth < 600 ? 0.008 : 0;
  if (Math.random() < 0.02 + mobileBoost) {
    hearts.push(new Heart());
  }
}

function updateGame() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Draw background playfield elements even when in proposal (keeps the scene alive)
  if (player) {
    player.update();
    player.draw();
  }

  if (gameState === 'PLAYING') {
    spawnHeart();

    for (let i = hearts.length - 1; i >= 0; i--) {
      const heart = hearts[i];
      heart.update();
      heart.draw();

      // Collision detection (simple)
      if (heart.y + heart.size > player.y && heart.x > player.x && heart.x < player.x + player.w) {
        hearts.splice(i, 1);
        score++;
        createSpark(heart.x, heart.y);
        updateScore();

        if (score >= WIN_SCORE) {
          triggerProposal();
        }
      } else if (heart.y > window.innerHeight) {
        hearts.splice(i, 1);
      }
    }
  } else {
    // If not playing, still render remaining hearts for a moment (soft freeze)
    hearts.forEach((heart) => heart.draw());
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw();
    if (p.life <= 0) particles.splice(i, 1);
  }

  animationId = requestAnimationFrame(updateGame);
}

function createSpark(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push(new Particle(x, y));
  }
}

function burstConfetti() {
  const count = window.innerWidth < 600 ? 140 : 200;
  for (let i = 0; i < count; i++) {
    particles.push(
      new Particle(Math.random() * window.innerWidth, -10, {
        kind: 'confetti',
        size: Math.random() * 5 + 2,
        speedX: (Math.random() - 0.5) * 10,
        speedY: Math.random() * 6 + 2,
        life: 140,
        color: `hsla(${Math.random() * 360}, 90%, 65%, 0.95)`,
      })
    );
  }
}

function updateScore() {
  const percentage = Math.min(100, (score / WIN_SCORE) * 100);
  loveMeter.style.width = `${percentage}%`;
}

function triggerProposal() {
  gameState = 'PROPOSAL';

  // Small delay for a smoother transition
  setTimeout(() => {
    proposalScreen.classList.remove('hidden');
    proposalScreen.classList.add('active');
  }, 450);
}

function startGame() {
  resize();
  player = new Player();
  hearts = [];
  particles = [];
  score = 0;
  noEscapeCount = 0;
  updateScore();
  gameState = 'PLAYING';

  startScreen.classList.remove('active');
  startScreen.classList.add('hidden');

  if (!animationId) updateGame();
}

// Event Listeners
startBtn.addEventListener('click', startGame);

yesBtn.addEventListener('click', () => {
  gameState = 'END';

  proposalScreen.classList.remove('active');
  proposalScreen.classList.add('hidden');

  celebrationScreen.classList.remove('hidden');
  celebrationScreen.classList.add('active');

  burstConfetti();
});

// "No" button runs away (but stays in-bounds + stops after a few tries)
noBtn.addEventListener('mouseover', moveNoButton);
noBtn.addEventListener('touchstart', moveNoButton, { passive: true });

function moveNoButton() {
  noEscapeCount++;
  if (noEscapeCount >= 8) return;

  const padding = 16;
  const maxX = window.innerWidth - noBtn.offsetWidth - padding;
  const maxY = window.innerHeight - noBtn.offsetHeight - padding;

  const x = Math.max(padding, Math.random() * Math.max(padding, maxX));
  const y = Math.max(padding, Math.random() * Math.max(padding, maxY));

  noBtn.style.position = 'fixed';
  noBtn.style.left = `${x}px`;
  noBtn.style.top = `${y}px`;
}

// Initialize
resize();
updateGame();
