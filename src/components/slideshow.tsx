"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Slide {
  src: string;
  alt: string;
  title: string;
  desc: string;
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

  const arrowCls =
    "hidden size-11 shrink-0 items-center justify-center rounded-full border bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-all duration-300 hover:scale-105 hover:bg-background hover:text-foreground active:scale-95 sm:inline-flex";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="슬라이드쇼"
      aria-label="화면 미리보기"
    >
      {/* 화살표는 프레임 바깥에 (모바일은 숨기고 점으로 이동) */}
      <div className="flex items-center gap-3 sm:gap-5">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="이전 화면"
          className={arrowCls}
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* 슬라이드 (부드러운 크로스페이드 + 미세 줌) */}
        <div className="relative aspect-video flex-1 overflow-hidden rounded-2xl border bg-card shadow-lg">
          {slides.map((s, i) => (
            <Image
              key={s.src}
              src={s.src}
              alt={s.alt}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 880px"
              className={cn(
                "object-cover transition-all duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                i === index ? "scale-100 opacity-100" : "scale-105 opacity-0",
              )}
              aria-hidden={i !== index}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="다음 화면"
          className={arrowCls}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* 제목 + 설명 (전환마다 부드럽게 등장) */}
      <div aria-live="polite" className="mt-5 text-center">
        <div
          key={index}
          className="duration-500 ease-out animate-in fade-in slide-in-from-bottom-2"
        >
          <h3 className="text-lg font-bold tracking-tight">
            {slides[index].title}
          </h3>
          <p className="mx-auto mt-1.5 max-w-xl text-sm text-muted-foreground">
            {slides[index].desc}
          </p>
        </div>
      </div>

      {/* 점 인디케이터 */}
      <div className="mt-4 flex justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번째 화면 보기`}
            aria-current={i === index}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
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
