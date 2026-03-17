/**
 * Performance monitoring utilities
 */

interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(metric: PerformanceMetric) {
  if (process.env.NODE_ENV === "production") {
    // Log to console in production for monitoring
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
    });

    // TODO: Send to analytics service (Google Analytics, Vercel Analytics, etc.)
    // if (window.gtag) {
    //   window.gtag('event', metric.name, {
    //     value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    //     event_label: metric.id,
    //     non_interaction: true,
    //   });
    // }
  }
}

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string) {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (process.env.NODE_ENV === "development" && duration > 100) {
      console.warn(`[Performance] ${componentName} took ${duration.toFixed(2)}ms to render`);
    }

    return duration;
  };
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for rate-limiting expensive operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Lazy load images with Intersection Observer
 */
export function lazyLoadImage(img: HTMLImageElement) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const image = entry.target as HTMLImageElement;
          if (image.dataset.src) {
            image.src = image.dataset.src;
            image.classList.remove("lazy");
            observer.unobserve(image);
          }
        }
      });
    },
    {
      rootMargin: "50px",
    }
  );

  observer.observe(img);
}

/**
 * Preload critical resources
 */
export function preloadResource(href: string, as: string) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
}

/**
 * Check if code splitting should be used based on connection
 */
export function shouldCodeSplit(): boolean {
  if (typeof navigator === "undefined") return true;

  // @ts-ignore - navigator.connection is experimental
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection) return true;

  // Don't code split on slow connections
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}
