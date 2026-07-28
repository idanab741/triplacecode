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
  kind: "suitcase" | "cone";
}

interface Collectible {
  x: number;
  kind: "ticket" | "passport";
  collected: boolean;
}

const GROUND_Y = 80;
const JUMP_VELOCITY = -13;
const GRAVITY = 0.6;
const MAX_JUMPS = 2;
const BG_TILE_COUNT = 10; // מספיק אריחים כדי לכסות בנוחות זמן המתנה טיפוסי

export function LoadingGame({ statusText }: LoadingGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const highScoreRef = useRef<HTMLParagraphElement>(null);
  const obstaclesRef = useRef<HTMLDivElement>(null);
  const collectiblesRef = useRef<HTMLDivElement>(null);
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [roundKey, setRoundKey] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const highScoreStore = useRef(0);

  useEffect(() => {
    const player = playerRef.current;
    const container = containerRef.current;
    const obstaclesLayer = obstaclesRef.current;
    const collectiblesLayer = collectiblesRef.current;
    const bgLayer = bgLayerRef.current;
    if (!player || !container || !obstaclesLayer || !collectiblesLayer || !bgLayer) return;

    // מנקים שאריות מסבב קודם
    obstaclesLayer!.innerHTML = "";
    collectiblesLayer!.innerHTML = "";
    bgLayer!.innerHTML = "";

    // רקע רגיל - חוזר על עצמו אוטומטית (repeat-x), בהנחה שהתמונה עצמה
    // כבר "תפורה" נכון (קצה שמאל = קצה ימין), בלי צורך במירור/אריחים ידניים
    bgLayer!.style.backgroundImage = "url(/images/game/runway-bg-wide.png)";
    bgLayer!.style.backgroundSize = "auto 100%";
    bgLayer!.style.backgroundRepeat = "repeat-x";
    bgLayer!.style.backgroundPositionY = "top";

    let posY = 0;
    let velocityY = 0;
    let jumpsUsed = 0;
    let speed = 0.8;
    let score = 0;
    let running = true;
    let rafId: number;
    let bgOffsetPx = 0;

    if (highScoreRef.current) highScoreRef.current.textContent = `שיא: ${highScoreStore.current}`;

    function wavesForScore(currentScore: number): number {
      if (currentScore < 6) return 1;
      if (currentScore < 12) return 2;
      return 3;
    }

    let obstacles: Obstacle[] = [{ x: 100, stackLevel: 0, kind: "suitcase" }];
    let collectibles: Collectible[] = [];

    const obstacleElements: HTMLDivElement[] = [];

    function renderObstacles() {
      while (obstacleElements.length < obstacles.length) {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.bottom = `${100 - GROUND_Y}%`;
        el.style.transition = "none";
        const img = document.createElement("img");
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        el.appendChild(img);
        obstaclesLayer!.appendChild(el);
        obstacleElements.push(el);
      }
      for (let i = 0; i < obstacleElements.length; i++) {
        const el = obstacleElements[i];
        const obs = obstacles[i];
        if (!obs) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        el.style.left = `${obs.x}%`;
        el.style.width = obs.kind === "cone" ? "9%" : "12%";
        el.style.aspectRatio = obs.kind === "cone" ? "0.6" : "0.85";
        el.style.transform = obs.stackLevel > 0 ? "translateY(-90%)" : "";
        const img = el.querySelector("img") as HTMLImageElement;
        const src =
          obs.kind === "cone"
            ? "/images/game/cone-transparent.png"
            : "/images/game/suitcase-transparent-transparent.png";
        if (img.src.indexOf(src) === -1) img.src = src;
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
    container!.addEventListener("pointerdown", handlePointer);

    function spawnWave() {
      const waveCount = wavesForScore(score);
      const gapWithinWave = Math.max(20, 40 - score * 1.5);
      const newObstacles: Obstacle[] = [];
      for (let i = 0; i < waveCount; i++) {
        const isCone = false; // קונוסים מושבתים עד שהתמונה תהיה מוכנה
        const stacked = waveCount >= 2 && i === waveCount - 1 && Math.random() > 0.4 && !isCone;
        newObstacles.push({ x: 100 + i * gapWithinWave, stackLevel: 0, kind: isCone ? "cone" : "suitcase" });
        if (stacked) newObstacles.push({ x: 100 + i * gapWithinWave, stackLevel: 1, kind: "suitcase" });
      }
      obstacles = obstacles.concat(newObstacles);
    }

    spawnWave();

    function loop() {
      if (!running) return;

      bgOffsetPx -= speed * 4;
      bgLayer!.style.backgroundPositionX = `${bgOffsetPx}px`;

      velocityY += GRAVITY;
      posY += velocityY;
      if (posY > 0) {
        posY = 0;
        velocityY = 0;
        jumpsUsed = 0;
      }
      player!.style.transform = `translateY(${posY}%)`;

      obstacles = obstacles.map((o) => ({ ...o, x: o.x - speed })).filter((o) => o.x > -20);
      collectibles = collectibles.map((c) => ({ ...c, x: c.x - speed })).filter((c) => c.x > -20 && !c.collected);

      const rightmost = obstacles.length > 0 ? Math.max(...obstacles.map((o) => o.x)) : -100;
      const waveTriggerThreshold = Math.min(65, 15 + score * 3);
      if (rightmost < waveTriggerThreshold) spawnWave();

      for (const o of obstacles) {
        if (o.stackLevel === 0 && o.x < 20 && o.x + speed >= 20) {
          score += 1;
          speed = Math.min(speed + 0.08, 4);
          if (scoreRef.current) scoreRef.current.textContent = `ניקוד: ${score}`;
        }
      }

      renderObstacles();

      const playerLeft = 10;
      const playerRight = 20;
      for (const o of obstacles) {
        const obsLeft = o.x + 3;
        const obsRight = o.x + 9;
        const overlapX = obsLeft < playerRight && obsRight > playerLeft;
        if (!overlapX) continue;

        const requiredJumpHeight = o.stackLevel > 0 ? -30 : -6;
        if (posY > requiredJumpHeight) {
          running = false;
          setFinalScore(score);
          if (score > highScoreStore.current) {
            highScoreStore.current = score;
            setIsNewHighScore(true);
          } else {
            setIsNewHighScore(false);
          }
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
      container!.removeEventListener("pointerdown", handlePointer);
    };
  }, [roundKey]);

  function handleRetry() {
    setGameOver(false);
    setFinalScore(0);
    setIsNewHighScore(false);
    setRoundKey((k) => k + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
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

      <div className="flex flex-1 flex-col justify-start px-0">
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-gray-300"
          style={{ aspectRatio: "9 / 16", touchAction: "manipulation", maxHeight: "100%" }}
        >
          <div ref={bgLayerRef} className="absolute inset-0" />

          <div className="absolute right-4 top-4 flex flex-col items-end gap-0.5">
            <p ref={scoreRef} className="text-lg font-bold text-white drop-shadow">
              ניקוד: 0
            </p>
            <p ref={highScoreRef} className="text-xs font-medium text-white/80 drop-shadow">
              שיא: 0
            </p>
          </div>

          <div
            ref={playerRef}
            className="absolute"
            style={{ left: "6%", width: "21%", aspectRatio: "1", bottom: `${100 - GROUND_Y}%` }}
          >
            <Image src="/images/game/tripy-run-transparent.png" alt="" fill className="object-contain" />
          </div>

          <div ref={obstaclesRef} className="absolute inset-0" />
          <div ref={collectiblesRef} className="absolute inset-0" />

          <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/90 drop-shadow">
            הקישו כדי לקפוץ (אפשר פעמיים!)
          </p>

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
              <p className="text-xl font-bold text-white">כמעט הפספסתם את הטיסה!</p>
              {isNewHighScore && <p className="text-sm font-bold text-yellow-300">שיא חדש! 🎉</p>}
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
