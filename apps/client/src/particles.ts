// Sistema de partículas. Las posiciones están en unidades de celda;
// el renderer las convierte a píxeles con la transformación de la vista.

export interface Particle {
  kind: 'dot' | 'ring' | 'text' | 'beam' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // segundos restantes
  maxLife: number;
  color: string;
  size: number; // celdas (dot/spark) o radio final (ring) o px de fuente (text)
  text?: string;
  // beam: línea desde (x,y) hasta (x2,y2); puede tener quiebres
  pts?: [number, number][];
}

const particles: Particle[] = [];
const MAX_PARTICLES = 600;

export function addParticle(p: Particle): void {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

export function burst(x: number, y: number, color: string, count = 8, speed = 2.2): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    addParticle({
      kind: 'dot',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      color,
      size: 0.07 + Math.random() * 0.07,
    });
  }
}

export function ring(x: number, y: number, radius: number, color: string): void {
  addParticle({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, color, size: radius });
}

export function floatText(x: number, y: number, text: string, color: string, size = 15): void {
  addParticle({
    kind: 'text',
    x,
    y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.9,
    life: 1.0,
    maxLife: 1.0,
    color,
    size,
    text,
  });
}

export function beam(pts: [number, number][], color: string): void {
  addParticle({
    kind: 'beam',
    x: pts[0][0],
    y: pts[0][1],
    vx: 0,
    vy: 0,
    life: 0.14,
    maxLife: 0.14,
    color,
    size: 0,
    pts,
  });
}

export function line(x: number, y: number, x2: number, y2: number, color: string): void {
  beam(
    [
      [x, y],
      [x2, y2],
    ],
    color,
  );
}

export function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'dot' || p.kind === 'spark') {
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
  }
}

export function drawParticles(
  g: CanvasRenderingContext2D,
  toX: (x: number) => number,
  toY: (y: number) => number,
  scale: number,
): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    g.globalAlpha = alpha;
    switch (p.kind) {
      case 'dot':
      case 'spark': {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(toX(p.x), toY(p.y), p.size * scale, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'ring': {
        const progress = 1 - p.life / p.maxLife;
        g.strokeStyle = p.color;
        g.lineWidth = Math.max(1.5, 3 * alpha);
        g.beginPath();
        g.arc(toX(p.x), toY(p.y), p.size * scale * (0.3 + progress * 0.7), 0, Math.PI * 2);
        g.stroke();
        break;
      }
      case 'text': {
        g.fillStyle = p.color;
        g.font = `bold ${p.size}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic'; // otros dibujantes (barra de jefe) lo cambian
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 3;
        g.strokeText(p.text ?? '', toX(p.x), toY(p.y));
        g.fillText(p.text ?? '', toX(p.x), toY(p.y));
        break;
      }
      case 'beam': {
        if (!p.pts || p.pts.length < 2) break;
        g.strokeStyle = p.color;
        g.lineWidth = Math.max(1.5, 3.5 * alpha);
        g.beginPath();
        g.moveTo(toX(p.pts[0][0]), toY(p.pts[0][1]));
        for (let i = 1; i < p.pts.length; i++) {
          // pequeño zigzag para que el rayo se sienta eléctrico
          const [ax, ay] = p.pts[i - 1];
          const [bx, by] = p.pts[i];
          const mx = (ax + bx) / 2 + (Math.random() - 0.5) * 0.2;
          const my = (ay + by) / 2 + (Math.random() - 0.5) * 0.2;
          g.quadraticCurveTo(toX(mx), toY(my), toX(bx), toY(by));
        }
        g.stroke();
        break;
      }
    }
  }
  g.globalAlpha = 1;
}

export function clearParticles(): void {
  particles.length = 0;
}
