"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Slide {
  src: string;
  alt: string;
  caption: string;
}

const INTERVAL = 4000;

/**
 * 자동 순환 슬라이드쇼(크로스페이드, 무한 반복).
 * - 좌우 화살표·하단 점으로 수동 이동, 호버/포커스 시 자동재생 일시정지.
 * - prefers-reduced-motion 사용자는 자동재생을 끄고 수동 조작만 제공(접근성).
 * - 16:9 고정 비율 컨테이너라 슬라이드 전환에도 레이아웃 이동(CLS) 없음.
 */
export function Slideshow({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceRef = useRef(false);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    reduceRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    if (paused || reduceRef.current || slides.length <= 1) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      INTERVAL,
    );
    return () => clearInterval(t);
  }, [paused, slides.length]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="슬라이드쇼"
      aria-label="화면 미리보기"
    >
      {/* 슬라이드 (크로스페이드) */}
      <div className="relative aspect-video overflow-hidden rounded-xl border bg-card shadow-sm">
        {slides.map((s, i) => (
          <Image
            key={s.src}
            src={s.src}
            alt={s.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 960px"
            className={cn(
              "object-cover transition-opacity duration-700 ease-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={i !== index}
          />
        ))}

        {/* 좌우 이동 */}
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="이전 화면"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1.5 text-foreground shadow backdrop-blur transition-colors hover:bg-background"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="다음 화면"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1.5 text-foreground shadow backdrop-blur transition-colors hover:bg-background"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* 캡션 */}
      <p
        aria-live="polite"
        className="mt-3 text-center text-sm text-muted-foreground"
      >
        {slides[index].caption}
      </p>

      {/* 점 인디케이터 */}
      <div className="mt-3 flex justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번째 화면 보기`}
            aria-current={i === index}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
