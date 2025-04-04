document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); // Сообщаем Telegram, что приложение готово
    tg.expand(); // Растягиваем приложение на весь экран

    // Отключаем вертикальный свайп для закрытия Mini App, пока игра активна
    // (восстанавливаем при выходе)
    const initialVerticalSwipe = tg.isVerticalSwipesEnabled;


    // --- Элементы DOM ---
    const appContainer = document.querySelector('.app-container'); // Получаем основной контейнер
    const droneTypeControls = document.querySelectorAll('.drone-type .control-button');
    const mainTabControls = document.querySelectorAll('.main-tabs .control-button');
    const componentItems = document.querySelectorAll('.component-item');
    const powerValueEl = document.getElementById('power-value');
    const weightValueEl = document.getElementById('weight-value');
    const rangeValueEl = document.getElementById('range-value');
    const assembleButton = document.getElementById('assemble-button');
    const componentSections = document.querySelectorAll('.component-section'); // Все секции с контентом табов

    // --- Элементы Игры ---
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // --- Состояние приложения ---
    let state = {
        droneType: 'quad', // 'quad' или 'hexa'
        activeTab: 'assembly', // 'assembly', 'test', 'settings'
        selectedComponents: new Set(), // Храним названия выбранных компонентов
        stats: {
            power: 0,
            weight: 0,
            range: 0
        },
        isGameActive: false // Флаг, активна ли игра
    };

    // --- Условные характеристики компонентов (ПРОСТЫЕ ЗАГЛУШКИ) ---
    const componentStats = {
        motors: { power: 25, weight: 15, range: 0 },
        battery: { power: 0, weight: 20, range: 40 },
        gps: { power: -5, weight: 5, range: 10 },
        camera: { power: -10, weight: 10, range: -5 },
        gyro: { power: -2, weight: 3, range: 0 },
        radio: { power: -3, weight: 5, range: 55 }
    };


    // === ИГРОВАЯ ЛОГИКА ===

    let drone = {
        x: 50,
        y: 50,
        vy: 0, // Вертикальная скорость
        width: 35, // Немного увеличил
        height: 18,
        thrust: 0.18, // Немного увеличил тягу
        isThrusting: false
    };

    const gravity = 0.07; // Немного увеличил гравитацию
    let gameLoopInterval = null;

    function setupCanvas() {
        requestAnimationFrame(() => {
            const containerRect = gameContainer.getBoundingClientRect();
            canvas.width = containerRect.width;
            canvas.height = containerRect.height;

             // Сбросим позицию дрона при ресайзе/старте
             drone.x = canvas.width / 4;
             drone.y = canvas.height / 2;
             drone.vy = 0;
             console.log(`Canvas resized: ${canvas.width}x${canvas.height}`);
        });
    }

    function drawDrone() {
        // Корпус
        ctx.fillStyle = '#555'; // Темно-серый корпус
        ctx.fillRect(drone.x, drone.y, drone.width, drone.height);

        // Пропеллеры (анимированные для вида)
        const propSize = 8;
        const propOffset = 5;
        const propSpeed = Date.now() / 50; // Скорость вращения
        ctx.fillStyle = '#aaa'; // Светло-серые пропеллеры

        // Левый пропеллер
        ctx.save();
        ctx.translate(drone.x + propOffset, drone.y);
        ctx.rotate(propSpeed);
        ctx.fillRect(-propSize / 2, -propSize / 2, propSize, propSize / 3);
        ctx.restore();

        // Правый пропеллер
        ctx.save();
        ctx.translate(drone.x + drone.width - propOffset, drone.y);
        ctx.rotate(-propSpeed); // В другую сторону
        ctx.fillRect(-propSize / 2, -propSize / 2, propSize, propSize / 3);
        ctx.restore();

        // Индикатор тяги (огонек снизу)
        if (drone.isThrusting) {
            ctx.fillStyle = 'rgba(255, 180, 0, 0.7)'; // Оранжевый полупрозрачный
            ctx.beginPath();
            ctx.moveTo(drone.x + drone.width / 2 - 5, drone.y + drone.height);
            ctx.lineTo(drone.x + drone.width / 2 + 5, drone.y + drone.height);
            ctx.lineTo(drone.x + drone.width / 2, drone.y + drone.height + 10);
            ctx.fill();
        }
    }

    function updateGame() {
        // Применяем гравитацию
        drone.vy += gravity;

        // Применяем тягу
        if (drone.isThrusting) {
            drone.vy -= drone.thrust;
        }

        // Максимальная скорость падения (чтобы не ускорялся бесконечно)
        if (drone.vy > 5) {
             drone.vy = 5;
        }
        // Максимальная скорость подъема
        if (drone.vy < -4) {
            drone.vy = -4;
        }


        // Обновляем позицию дрона
        drone.y += drone.vy;

        // Ограничение по экрану
        if (drone.y < 0) { // Потолок
            drone.y = 0;
            drone.vy = 0;
        }
        if (drone.y + drone.height > canvas.height - 20) { // Земля (20px высота)
            drone.y = canvas.height - drone.height - 20;
            drone.vy = 0;
            // Можно добавить эффект "отскока" или "крушения"
            // drone.vy *= -0.3; // Маленький отскок
        }
    }

    function drawGame() {
        // Очистка canvas
        // Оставляем фон контейнера #game-container
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Рисуем землю
        ctx.fillStyle = '#2E8B57'; // SeaGreen
        ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

        // Рисуем дрон
        drawDrone();
    }

    function gameLoop() {
        if (!state.isGameActive) return; // Останавливаемся, если игра больше не активна
        updateGame();
        drawGame();
    }

    function startGame() {
        if (state.isGameActive) return;
        console.log("Starting game...");
        state.isGameActive = true;

        // Отключаем свайп для закрытия
        tg.disableVerticalSwipes();

        document.body.classList.add('game-active');

        setupCanvas(); // Устанавливаем размеры ПЕРЕД первым запуском цикла

        tg.BackButton.show();
        tg.BackButton.onClick(stopGame);

        drone.isThrusting = false;

        // Добавляем слушатели (touchstart/end предпочтительнее для мобильных)
        gameContainer.addEventListener('touchstart', handleThrustStart, { passive: false });
        gameContainer.addEventListener('touchend', handleThrustEnd);
        gameContainer.addEventListener('touchcancel', handleThrustEnd);
        // Добавим и для мыши для тестов на ПК
        gameContainer.addEventListener('mousedown', handleThrustStart);
        gameContainer.addEventListener('mouseup', handleThrustEnd);
        gameContainer.addEventListener('mouseleave', handleThrustEnd); // Остановить тягу, если мышь ушла с canvas

        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, 1000 / 60); // ~60 FPS

        // Первый кадр сразу после настройки, чтобы не было пустого экрана
         setTimeout(drawGame, 0);
    }

    function stopGame() {
        if (!state.isGameActive) return;
        console.log("Stopping game...");
        state.isGameActive = false;

        // Восстанавливаем свайп для закрытия
        tg.enableVerticalSwipes();

        document.body.classList.remove('game-active');

        tg.BackButton.offClick(stopGame);
        tg.BackButton.hide();

        // Убираем слушатели управления
        gameContainer.removeEventListener('touchstart', handleThrustStart);
        gameContainer.removeEventListener('touchend', handleThrustEnd);
        gameContainer.removeEventListener('touchcancel', handleThrustEnd);
        gameContainer.removeEventListener('mousedown', handleThrustStart);
        gameContainer.removeEventListener('mouseup', handleThrustEnd);
        gameContainer.removeEventListener('mouseleave', handleThrustEnd);


        if (gameLoopInterval) {
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
        }
    }

     function handleThrustStart(event) {
        // Предотвращаем стандартное поведение только для touch событий
        if (event.type.startsWith('touch')) {
            event.preventDefault();
        }
        if (!state.isGameActive) return; // Не реагировать, если игра не активна
        drone.isThrusting = true;
     }
     function handleThrustEnd() {
         if (!state.isGameActive) return;
         drone.isThrusting = false;
     }

    // === КОНЕЦ ИГРОВОЙ ЛОГИКИ ===


    // --- Функции основного интерфейса ---

    // Обновление отображения статистики
    function updateStatsDisplay() {
        powerValueEl.textContent = `${state.stats.power}%`;
        weightValueEl.textContent = `${state.stats.weight}%`;
        rangeValueEl.textContent = `${state.stats.range}%`;
        assembleButton.disabled = state.selectedComponents.size < 2;
    }

    // Пересчет статистики на основе выбранных компонентов
    function calculateStats() {
        state.stats.power = 0;
        state.stats.weight = 0;
        state.stats.range = 0;

        state.selectedComponents.forEach(componentName => {
            const stats = componentStats[componentName];
            if (stats) {
                state.stats.power += stats.power;
                state.stats.weight += stats.weight;
                state.stats.range += stats.range;
            }
        });

        state.stats.power = Math.max(0, state.stats.power);
        state.stats.weight = Math.max(0, state.stats.weight);
        state.stats.range = Math.max(0, state.stats.range);

        updateStatsDisplay();
    }

    // Обработка выбора компонента
    function handleComponentClick(event) {
        const button = event.currentTarget;
        const componentName = button.dataset.component;

        if (state.selectedComponents.has(componentName)) {
            state.selectedComponents.delete(componentName);
            button.classList.remove('selected');
        } else {
            state.selectedComponents.add(componentName);
            button.classList.add('selected');
        }
        calculateStats();
    }

    // Обработка переключения сегментированных контролов (типы, табы)
    function handleControlSwitch(event, controls) {
        const clickedButton = event.currentTarget;
        const dataKey = Object.keys(clickedButton.dataset)[0];
        const dataValue = clickedButton.dataset[dataKey];

        // Обновляем активную кнопку
        controls.forEach(btn => {
            btn.classList.toggle('active', btn === clickedButton);
        });

        if (dataKey === 'type') {
            state.droneType = dataValue;
            console.log(`Выбран тип дрона: ${state.droneType}`);
            // Возможно, пересчет статов или доступных компонентов в будущем
             calculateStats(); // Пересчитать статы, если тип дрона на них влияет (пока не влияет)
        } else if (dataKey === 'tab') {
             state.activeTab = dataValue;
            // Показываем/скрываем контент для табов
            componentSections.forEach(section => {
                 section.style.display = section.id === `${dataValue}-content` ? 'block' : 'none';
            });
            console.log(`Переключились на таб: ${state.activeTab}`);
        }
    }

    // Обработка нажатия на кнопку "Собрать дрон" (теперь запускает игру)
    function handleAssembleClick() {
        // Условие блокировки кнопки уже проверяется в updateStatsDisplay
        // Просто запускаем игру
        startGame();
    }


    // --- Назначение обработчиков ---
    droneTypeControls.forEach(button => {
        button.addEventListener('click', (e) => handleControlSwitch(e, droneTypeControls));
    });
    mainTabControls.forEach(button => {
        button.addEventListener('click', (e) => handleControlSwitch(e, mainTabControls));
    });
    componentItems.forEach(item => {
        item.addEventListener('click', handleComponentClick);
    });
    assembleButton.addEventListener('click', handleAssembleClick);

    // --- Инициализация ---
    calculateStats(); // Рассчитать и показать начальные статы

    // --- Обработчик изменения размера окна ---
    window.addEventListener('resize', () => {
        // Даем небольшую задержку перед ресайзом canvas, чтобы избежать лишних перерисовок
        setTimeout(() => {
            if (state.isGameActive) {
                 setupCanvas();
            }
        }, 100); // 100ms задержка
    });

    // Остановка игры при закрытии/сворачивании приложения (на всякий случай)
    // Документация говорит, что BackButton.onClick сработает при закрытии свайпом,
    // но добавим listener для надежности
     tg.onEvent('viewportChanged', (event) => {
         // Если окно свернулось (стало не isExpanded), останавливаем игру
         if (state.isGameActive && !event.isStateStable) {
             // Возможно, стоит добавить проверку на !tg.isExpanded, если доступно
              console.warn('Viewport changed unstable, stopping game just in case.');
              stopGame();
         }
     });


     // Инициализируем состояние кнопки Назад (скрыта)
     tg.BackButton.hide();

}); // Конец DOMContentLoaded