(function() {
    'use strict';

    // ============================================================
    // КОНФИГУРАЦИЯ
    // ============================================================
    const CONFIG = {
        CACHE_KEY: '__cvforge_gpu_level_v8',
        CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 дней
        BENCHMARK: {
            GPU_DURATION: 600,
            GPU_DRAW_CALLS: 40,
            CPU_ITERATIONS: 200000,
            FPS_THRESHOLD: {
                HIGH: 50,
                MID: 35,
                LOW: 20
            }
        },
        LAZY_LOAD: {
            ROOT_MARGIN: '200px 0px',
            THRESHOLD: 0.01
        }
    };

    // ============================================================
    // КЭШИРОВАНИЕ С ВРЕМЕНЕМ ЖИЗНИ
    // ============================================================
    const CacheManager = {
        get() {
            try {
                const cached = localStorage.getItem(CONFIG.CACHE_KEY);
                if (!cached) return null;

                const { level, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > CONFIG.CACHE_DURATION;

                return isExpired ? null : level;
            } catch {
                return null;
            }
        },

        set(level) {
            try {
                localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
                    level,
                    timestamp: Date.now()
                }));
            } catch { }
        }
    };

    // ============================================================
    // БЕНЧМАРКИ (оптимизированные)
    // ============================================================
    const Benchmarks = {
        async gpu() {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');

            return new Promise((resolve) => {
                let frames = 0;
                const start = performance.now();

                const render = () => {
                    const now = performance.now();
                    if (now - start > CONFIG.BENCHMARK.GPU_DURATION) {
                        const fps = frames / (CONFIG.BENCHMARK.GPU_DURATION / 1000);
                        resolve(Math.min(fps, 60));
                        return;
                    }

                    // Оптимизированный рендеринг
                    for (let i = 0; i < CONFIG.BENCHMARK.GPU_DRAW_CALLS; i++) {
                        ctx.fillStyle = `rgba(${(frames * 5 + i * 11) % 255}, 120, 200, 0.4)`;
                        ctx.fillRect(
                            Math.random() * canvas.width,
                            Math.random() * canvas.height,
                            40, 40
                        );
                    }

                    frames++;
                    requestAnimationFrame(render);
                };

                requestAnimationFrame(render);
            });
        },

        async realFPS() {
            return new Promise(resolve => {
                let frames = 0;
                const start = performance.now();

                const count = () => {
                    frames++;
                    const now = performance.now();

                    if (now - start >= 1000) {
                        resolve(frames);
                    } else {
                        requestAnimationFrame(count);
                    }
                };

                requestAnimationFrame(count);
            });
        },

        cpu() {
            const start = performance.now();
            let result = 0;

            for (let i = 0; i < CONFIG.BENCHMARK.CPU_ITERATIONS; i++) {
                result += Math.sqrt(i % 100);
            }

            return performance.now() - start;
        },

        getHardwareInfo() {
            return {
                memory: navigator.deviceMemory || 4,
                cores: navigator.hardwareConcurrency || 4,
                connection: navigator.connection?.effectiveType || 'unknown'
            };
        }
    };

    // ============================================================
    // АНАЛИЗ DOM (ленивый)
    // ============================================================
    const DOMMetrics = {
        analyze() {
            // Анализируем только видимые элементы с тяжелыми эффектами
            const heavySelectors = [
                '[style*="backdrop-filter"]',
                '[style*="filter"]',
                '[style*="box-shadow"]',
                '[style*="transform"]',
                '.glass-effect',
                '.blur-effect'
            ].join(',');

            const elements = document.querySelectorAll(heavySelectors);
            let score = 0;

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;

                const area = rect.width * rect.height;
                const weight = area > 100000 ? 1.5 : area > 25000 ? 1.2 : 1;

                score += weight * 10;
            });

            return Math.min(score, 100);
        }
    };

    // ============================================================
    // ПРИНЯТИЕ РЕШЕНИЙ
    // ============================================================
    const DecisionEngine = {
        determineLevel(metrics) {
            const {
                gpuFps,
                realFps,
                cpuMs,
                domScore,
                hardware
            } = metrics;

            // Базовая оценка на основе FPS
            if (gpuFps > CONFIG.BENCHMARK.FPS_THRESHOLD.HIGH &&
                realFps > CONFIG.BENCHMARK.FPS_THRESHOLD.HIGH) {
                return 'gpu-high';
            }

            if (gpuFps > CONFIG.BENCHMARK.FPS_THRESHOLD.MID &&
                realFps > CONFIG.BENCHMARK.FPS_THRESHOLD.MID) {
                return 'gpu-mid';
            }

            if (gpuFps > CONFIG.BENCHMARK.FPS_THRESHOLD.LOW &&
                realFps > CONFIG.BENCHMARK.FPS_THRESHOLD.LOW) {
                return 'gpu-low';
            }

            // Проверка на очень слабые устройства
            if (gpuFps < 15 || realFps < 15 || hardware.memory <= 2) {
                return 'gpu-verylow';
            }

            return 'gpu-low';
        },

        shouldEnableVirtualization(metrics) {
            return metrics.realFps < 30 || metrics.domScore > 50;
        },

        shouldEnableLazyLoading(metrics) {
            return metrics.realFps < 40 || metrics.hardware.memory <= 4;
        }
    };

    // ============================================================
    // СТИЛИ ДЛЯ ПРЕСЕТОВ
    // ============================================================
    const StyleManager = {
        styles: null,

        init() {
            this.styles = document.createElement('style');
            this.styles.id = 'cvforge-performance-presets';
            this.styles.innerHTML = this.generateStyles();
            document.head.appendChild(this.styles);
        },

        generateStyles() {
            return `
                /* GPU-HIGH - максимальные эффекты */
                .gpu-high .glass-effect {
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }
                
                .gpu-high .animated-element {
                    animation-duration: 3s;
                }

                /* GPU-MID - средние эффекты */
                .gpu-mid .glass-effect {
                    backdrop-filter: blur(6px);
                    transition: all 0.2s ease;
                }
                
                .gpu-mid .animated-element {
                    animation-duration: 5s;
                }

                /* GPU-LOW - минимальные эффекты */
                .gpu-low .glass-effect {
                    backdrop-filter: blur(3px);
                    transition: none;
                }
                
                .gpu-low .animated-element,
                .gpu-low [class*="animate"] {
                    animation: none !important;
                    transform: none !important;
                }

                /* GPU-VERYLOW - отключение эффектов */
                .gpu-verylow .glass-effect,
                .gpu-verylow [class*="blur"],
                .gpu-verylow [class*="shadow"] {
                    backdrop-filter: none !important;
                    filter: none !important;
                    box-shadow: none !important;
                    animation: none !important;
                    transform: none !important;
                    transition: none !important;
                    background: #ffffff !important;
                }
                
                /* Lazy loading */
                .lazy-render:not(.hydrated) {
                    content-visibility: auto;
                    contain-intrinsic-size: 0 500px;
                }
                
                /* Виртуализация списков */
                .virtualized-list {
                    overflow-y: auto;
                    position: relative;
                }
                
                .virtualized-item {
                    position: absolute;
                    left: 0;
                    right: 0;
                    will-change: transform;
                }
            `;
        },

        applyLevel(level) {
            // Очищаем предыдущие классы
            document.documentElement.classList.remove(
                'gpu-high', 'gpu-mid', 'gpu-low', 'gpu-verylow'
            );

            // Применяем новый уровень
            document.documentElement.classList.add(level);

            // Добавляем дополнительные классы для специфических страниц
            if (window.location.pathname.includes('/dashboard')) {
                document.documentElement.classList.add('dashboard-view');
            } else if (window.location.pathname.includes('/wizard')) {
                document.documentElement.classList.add('wizard-view');
            } else if (window.location.pathname.includes('/cv/')) {
                document.documentElement.classList.add('cv-view');
            } else if (window.location.pathname.includes('/editor')) {
                document.documentElement.classList.add('editor-view');
            }
        }
    };

    // ============================================================
    // ОПТИМИЗАЦИИ
    // ============================================================
    const Optimizations = {
        enableLazyLoading() {
            const lazyElements = document.querySelectorAll(
                '.lazy-render, [data-lazy]'
            );

            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('hydrated');
                            observer.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: CONFIG.LAZY_LOAD.ROOT_MARGIN,
                    threshold: CONFIG.LAZY_LOAD.THRESHOLD
                });

                lazyElements.forEach(el => observer.observe(el));
            } else {
                // Fallback для старых браузеров
                lazyElements.forEach(el => el.classList.add('hydrated'));
            }
        },

        enableVirtualization(level) {
            if (level === 'gpu-high') return;

            const lists = [
                { selector: '.exp-list', itemSelector: '.exp-item', height: 200 },
                { selector: '.edu-list', itemSelector: '.edu-item', height: 200 }
            ];

            lists.forEach(({ selector, itemSelector, height }) => {
                const container = document.querySelector(selector);
                if (!container) return;

                const items = container.querySelectorAll(itemSelector);
                if (items.length < 10) return;

                container.classList.add('virtualized-list');
                container.style.height = container.offsetHeight + 'px';

                // Простая виртуализация через CSS
                items.forEach((item, index) => {
                    item.classList.add('virtualized-item');
                    item.style.top = (index * height) + 'px';
                });
            });
        },

        enableAdaptiveMonitoring(level) {
            if (level === 'gpu-verylow') return;

            let fpsHistory = [];
            let lastTime = performance.now();
            let frames = 0;

            const checkPerformance = () => {
                frames++;
                const now = performance.now();

                if (now - lastTime >= 1000) {
                    const fps = frames;
                    fpsHistory.push(fps);
                    frames = 0;
                    lastTime = now;

                    if (fpsHistory.length > 5) fpsHistory.shift();

                    const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

                    if (avgFps < 20 && level !== 'gpu-verylow') {
                        // Понижаем уровень если FPS слишком низкий
                        const levels = ['gpu-high', 'gpu-mid', 'gpu-low', 'gpu-verylow'];
                        const currentIndex = levels.indexOf(level);
                        if (currentIndex < levels.length - 1) {
                            StyleManager.applyLevel(levels[currentIndex + 1]);
                        }
                    }
                }

                requestAnimationFrame(checkPerformance);
            };

            requestAnimationFrame(checkPerformance);
        },

        disableHeavyEffects(level) {
            if (level !== 'gpu-verylow') return;

            // Отключаем тяжелые CSS эффекты
            const heavyElements = document.querySelectorAll(
                '[style*="backdrop-filter"], [style*="filter"], [style*="transform"]'
            );

            heavyElements.forEach(el => {
                el.style.backdropFilter = 'none';
                el.style.filter = 'none';
                el.style.transform = 'none';
            });
        }
    };

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    async function init() {
        try {
            // Проверяем кэш
            const cachedLevel = CacheManager.get();
            if (cachedLevel) {
                StyleManager.init();
                StyleManager.applyLevel(cachedLevel);
                return;
            }

            // Ждем загрузки DOM
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve, { once: true });
                });
            }

            // Даем время на отрисовку
            await new Promise(resolve => setTimeout(resolve, 150));

            // Запускаем бенчмарки параллельно
            const [gpuFps, realFps] = await Promise.all([
                Benchmarks.gpu(),
                Benchmarks.realFPS()
            ]);

            const metrics = {
                gpuFps,
                realFps,
                cpuMs: Benchmarks.cpu(),
                domScore: DOMMetrics.analyze(),
                hardware: Benchmarks.getHardwareInfo()
            };

            // Определяем уровень
            const level = DecisionEngine.determineLevel(metrics);

            // Сохраняем в кэш
            CacheManager.set(level);

            // Применяем оптимизации
            StyleManager.init();
            StyleManager.applyLevel(level);

            // Включаем дополнительные оптимизации если нужно
            if (DecisionEngine.shouldEnableLazyLoading(metrics)) {
                Optimizations.enableLazyLoading();
            }

            if (DecisionEngine.shouldEnableVirtualization(metrics)) {
                Optimizations.enableVirtualization(level);
            }

            // Мониторинг производительности
            Optimizations.enableAdaptiveMonitoring(level);
            Optimizations.disableHeavyEffects(level);

            console.log(`[Performance] Applied level: ${level}`, metrics);

        } catch (error) {
            console.error('[Performance] Error:', error);
            // Fallback на безопасный уровень
            StyleManager.init();
            StyleManager.applyLevel('gpu-low');
        }
    }

    // Запускаем
    init();
})();