"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MainBottomNav } from "@/components/MainBottomNav";

interface LoadingGameProps {
  statusText: string;
}

interface Obstacle {
  x: number;
  stackLevel: number;
}

const GROUND_Y = 80;
const JUMP_VELOCITY = -13;
const GRAVITY = 0.6;
const MAX_JUMPS = 2;
const BG_SIZE_PERCENT = 300;

/**
 * משחק המתנה - עטוף במעטפת עקבית לשאר עמודי האפליקציה: כותרת עם כפתור
 * חזור + לוגו triplace, פס התקדמות למעלה (לא למטה), אזור המשחק במרכז,
 * ובר ניווט תחתון של האפליקציה. מוצג בזמן בניית המסלול ברקע (~30 שניות).
 */
export function LoadingGame({ statusText }: LoadingGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const obstaclesRef = useRef<HTMLDivElement>(null);
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [roundKey, setRoundKey] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    const container = containerRef.current;
    const obstaclesLayer = obstaclesRef.current;
    const bgLayer = bgLayerRef.current;
    if (!player || !container || !obstaclesLayer || !bgLayer) return;

    let posY = 0;
    let velocityY = 0;
    let jumpsUsed = 0;
    let speed = 0.9;
    let score = 0;
    let running = true;
    let rafId: number;
    let bgPositionPercent = 0;

    function wavesForScore(currentScore: number): number {
      if (currentScore < 4) return 1;
      if (currentScore < 9) return 2;
      return 3;
    }

    let obstacles: Obstacle[] = [{ x: 100, stackLevel: 0 }];

    function renderObstacles() {
      obstaclesLayer.innerHTML = "";
      for (const obs of obstacles) {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.left = `${obs.x}%`;
        el.style.bottom = `${100 - GROUND_Y}%`;
        el.style.width = "12%";
        el.style.aspectRatio = "0.85";
        if (obs.stackLevel > 0) el.style.transform = "translateY(-90%)";
        const img = document.createElement("img");
        img.src = "/images/game/suitcase-transparent-transparent.png";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        el.appendChild(img);
        obstaclesLayer.appendChild(el);
      }
    }

    function jump() {
      if (!running || jumpsUsed >= MAX_JUMPS) return;
      velocityY = JUMP_VELOCITY;
      jumpsUsed += 1;
    }

    function handlePointer() {
      jump();
    }
    container.addEventListener("pointerdown", handlePointer);

    function spawnWave() {
      const waveCount = wavesForScore(score);
      const newObstacles: Obstacle[] = [];
      for (let i = 0; i < waveCount; i++) {
        const stacked = waveCount >= 2 && i === waveCount - 1 && Math.random() > 0.4;
        newObstacles.push({ x: 100 + i * 16, stackLevel: 0 });
        if (stacked) newObstacles.push({ x: 100 + i * 16, stackLevel: 1 });
      }
      obstacles = obstacles.concat(newObstacles);
    }

    spawnWave();

    function loop() {
      if (!running) return;

      bgPositionPercent += speed * 0.25;
      if (bgPositionPercent >= 100) bgPositionPercent = 0;
      bgLayer.style.backgroundPositionX = `${bgPositionPercent}%`;

      velocityY += GRAVITY;
      posY += velocityY;
      if (posY > 0) {
        posY = 0;
        velocityY = 0;
        jumpsUsed = 0;
      }
      player.style.transform = `translateY(${posY}%)`;

      obstacles = obstacles.map((o) => ({ ...o, x: o.x - speed })).filter((o) => o.x > -20);

      const rightmost = obstacles.length > 0 ? Math.max(...obstacles.map((o) => o.x)) : -100;
      if (rightmost < 55) spawnWave();

      for (const o of obstacles) {
        if (o.stackLevel === 0 && o.x < 20 && o.x + speed >= 20) {
          score += 1;
          speed = Math.min(speed + 0.05, 2.4);
          if (scoreRef.current) scoreRef.current.textContent = `ניקוד: ${score}`;
        }
      }

      renderObstacles();

      const playerLeft = 6;
      const playerRight = 24;
      for (const o of obstacles) {
        const obsLeft = o.x;
        const obsRight = o.x + 12;
        const overlapX = obsLeft < playerRight && obsRight > playerLeft;
        if (!overlapX) continue;

        const requiredJumpHeight = o.stackLevel > 0 ? -55 : -22;
        if (posY > requiredJumpHeight) {
          running = false;
          setFinalScore(score);
          setGameOver(true);
          return;
        }
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      container.removeEventListener("pointerdown", handlePointer);
    };
  }, [roundKey]);

  function handleRetry() {
    setGameOver(false);
    setFinalScore(0);
    setRoundKey((k) => k + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* כותרת - לוגו triplace + כפתור חזור, בפינה שמאלית עליונה - אותו
          מבנה בדיוק כמו בשאר עמודי האפליקציה (סדר: לוגו קודם, אז כפתור,
          עם מיקום absolute left-2 שכבר עבד נכון בעמודים אחרים) */}
      <div className="relative h-14 px-4 pt-4">
        <div className="absolute left-2 top-4 flex items-center gap-2">
          <Image src="/images/trip-triplace-logo.png" alt="" width={130} height={40} className="object-contain" />
          <Link
            href="/home"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-ink"
            aria-label="חזרה לדף הבית"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* פס התקדמות - למעלה, מתחת לכותרת */}
      <div className="px-6 pb-2">
        <p className="mb-2 text-center text-sm font-medium text-ink-secondary">{statusText}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-secondary">
          <div
            className="h-full w-1/3 rounded-pill"
            style={{
              background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
              animation: "loadingBarSlide 1.4s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* אזור המשחק - תופס את כל הרוחב הפנוי, בלי מרווח לבן מיותר */}
      <div className="flex flex-1 flex-col justify-start px-0">
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-gray-300"
          style={{ aspectRatio: "9 / 16", touchAction: "manipulation", maxHeight: "100%" }}
        >
          <div
            ref={bgLayerRef}
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/images/game/runway-bg-wide.png)",
              backgroundSize: `${BG_SIZE_PERCENT}% 100%`,
              backgroundRepeat: "no-repeat",
              backgroundPositionY: "top",
            }}
          />

          <p ref={scoreRef} className="absolute right-4 top-4 text-lg font-bold text-white drop-shadow">
            ניקוד: 0
          </p>

          <div
            ref={playerRef}
            className="absolute"
            style={{ left: "6%", width: "18%", aspectRatio: "1", bottom: `${100 - GROUND_Y}%` }}
          >
            <Image src="/images/game/tripy-run-transparent.png" alt="" fill className="object-contain" />
          </div>

          <div ref={obstaclesRef} className="absolute inset-0" />

          <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/90 drop-shadow">
            הקישו כדי לקפוץ (אפשר פעמיים!)
          </p>

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
              <p className="text-xl font-bold text-white">כמעט הפספסתם את הטיסה!</p>
              <p className="text-base text-white/90">ניקוד סופי: {finalScore}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-pill bg-white px-6 py-2 text-base font-semibold text-ink"
              >
                שחקו שוב
              </button>
            </div>
          )}
        </div>
      </div>

      {/* בר ניווט תחתון - עקבי לשאר עמודי האפליקציה */}
      <MainBottomNav active="ai" />

      <style jsx>{`
        @keyframes loadingBarSlide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </div>
  );
}
