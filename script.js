document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const initialVerticalSwipe = tg.isVerticalSwipesEnabled;

    // --- Элементы DOM ---
    const appContainer = document.querySelector('.app-container');
    const droneTypeControls = document.querySelectorAll('.drone-type .control-button');
    const mainTabControls = document.querySelectorAll('.main-tabs .control-button');
    const componentItems = document.querySelectorAll('.component-item');
    const powerValueEl = document.getElementById('power-value');
    const weightValueEl = document.getElementById('weight-value');
    const rangeValueEl = document.getElementById('range-value');
    const assembleButton = document.getElementById('assemble-button');
    const componentSections = document.querySelectorAll('.component-section');

    // --- Элементы Игры ---
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // --- Состояние приложения ---
    let state = {
        droneType: 'quad',
        activeTab: 'assembly',
        selectedComponents: new Set(),
        stats: { power: 0, weight: 0, range: 0 },
        isGameActive: false
    };

    // --- Характеристики компонентов (не меняем) ---
    const componentStats = { /* ... без изменений ... */ };

    // === ИГРОВАЯ ЛОГИКА ===

    // --- Константы и Настройки Игры ---
    const gravity = 0.1;         // Уменьшаем гравитацию
    const baseThrust = 0.25;     // Уменьшаем базовую тягу
    const rotationSpeed = 0.005;  // Уменьшаем скорость вращения
    const dampingFactor = 0.98;  // Увеличиваем сопротивление воздуха
    const maxRotationSpeed = 0.1; // Ограничение скорости вращения
    const groundLevel = 20;

    let drone = {
        x: 50,
        y: 50,
        vx: 0,
        vy: 0,
        angle: 0, // Теперь угол не ограничен
        angularVelocity: 0, // Добавляем угловую скорость
        width: 35,
        height: 18,
        isThrusting: false,
        thrustPower: 0, // Мощность тяги (0-1)
        horizontalInput: 0
    };

    let gameLoopInterval = null;
    let pointer = {
        isDown: false,
        x: null, // Текущая X координата активного касания/клика
        y: null, // Текущая Y координата активного касания/клика
        canvasCenterX: 0 // Центр канваса по X (для расчета управления)
    };

    function setupCanvas() {
        requestAnimationFrame(() => {
            const containerRect = gameContainer.getBoundingClientRect();
            canvas.width = containerRect.width;
            canvas.height = containerRect.height;
            pointer.canvasCenterX = canvas.width / 2; // Обновляем центр

             // Сбросим позицию и состояние дрона
             drone.x = canvas.width / 4;
             drone.y = canvas.height / 2;
             drone.vx = 0;
             drone.vy = 0;
             drone.angle = 0;
             drone.targetAngle = 0;
             drone.horizontalInput = 0;
             console.log(`Canvas ready: ${canvas.width}x${canvas.height}`);
        });
    }

    function drawDrone() {
        ctx.save(); // Сохраняем текущее состояние контекста (трансформации и стили)

        // Перемещаем начало координат в центр дрона
        ctx.translate(drone.x + drone.width / 2, drone.y + drone.height / 2);
        // Поворачиваем систему координат
        ctx.rotate(drone.angle);

        // Рисуем элементы дрона относительно нового центра (0, 0)

        // Корпус
        ctx.fillStyle = '#555';
        ctx.fillRect(-drone.width / 2, -drone.height / 2, drone.width, drone.height);

        // Пропеллеры
        const propSize = 8;
        const propOffset = drone.width * 0.35; // Смещаем чуть ближе к центру
        const propSpeed = Date.now() / 50;
        ctx.fillStyle = '#aaa';

        // Левый пропеллер (относительно центра дрона)
        ctx.save();
        ctx.translate(-propOffset, -drone.height / 2); // Смещение к левому краю и чуть выше
        ctx.rotate(propSpeed);
        ctx.fillRect(-propSize / 2, -propSize / 2, propSize, propSize / 3);
        ctx.restore();

        // Правый пропеллер
        ctx.save();
        ctx.translate(propOffset, -drone.height / 2); // Смещение к правому краю и чуть выше
        ctx.rotate(-propSpeed);
        ctx.fillRect(-propSize / 2, -propSize / 2, propSize, propSize / 3);
        ctx.restore();

        // Индикатор тяги (под центром дрона)
        if (drone.isThrusting) {
            ctx.fillStyle = 'rgba(255, 180, 0, 0.7)';
            ctx.beginPath();
            // Рисуем треугольник под центром повернутого дрона
            ctx.moveTo(-5, drone.height / 2);
            ctx.lineTo(5, drone.height / 2);
            ctx.lineTo(0, drone.height / 2 + 10);
            ctx.fill();
        }

        ctx.restore(); // Восстанавливаем исходное состояние контекста
    }

    function updateGame() {
        // Обновление вращения с ограничением
        drone.angularVelocity += drone.horizontalInput * rotationSpeed;
        drone.angularVelocity = Math.max(-maxRotationSpeed, 
                               Math.min(maxRotationSpeed, drone.angularVelocity));
        drone.angularVelocity *= 0.95; // Больше затухания для вращения
        drone.angle += drone.angularVelocity;

        // Рассчитываем вектор тяги с более плавным управлением
        if (drone.isThrusting) {
            const thrustForce = baseThrust * (0.5 + drone.thrustPower * 0.5); // Минимум 50% тяги
            const thrustX = Math.sin(drone.angle) * thrustForce;
            const thrustY = -Math.cos(drone.angle) * thrustForce;
            
            // Более плавное ускорение
            drone.vx += thrustX * 0.8;
            drone.vy += thrustY * 0.8;
        }

        // Ограничение максимальной скорости
        const maxSpeed = 5;
        const currentSpeed = Math.sqrt(drone.vx * drone.vx + drone.vy * drone.vy);
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            drone.vx *= scale;
            drone.vy *= scale;
        }

        // Применяем гравитацию
        drone.vy += gravity;

        // Затухание скорости
        drone.vx *= dampingFactor;
        drone.vy *= dampingFactor;

        // Обновление позиции
        drone.x += drone.vx;
        drone.y += drone.vy;

        // Обработка столкновений со стенами
        if (drone.y + drone.height > canvas.height - groundLevel) {
            drone.y = canvas.height - drone.height - groundLevel;
            // Проверяем силу удара
            if (Math.abs(drone.vy) > 3 || Math.abs(drone.vx) > 3) {
                console.log("Crash!");
                stopGame();
                return;
            }
            drone.vy = 0;
            drone.vx *= 0.5; // Сильное трение при касании земли
            drone.angularVelocity *= 0.5; // Замедление вращения при касании
        }

        // Остальные границы
        if (drone.y < 0) { drone.y = 0; drone.vy = 0; }
        if (drone.x < 0) { drone.x = 0; drone.vx = 0; }
        if (drone.x + drone.width > canvas.width) {
            drone.x = canvas.width - drone.width;
            drone.vx = 0;
        }
    }

    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Рисуем землю
        ctx.fillStyle = '#2E8B57';
        ctx.fillRect(0, canvas.height - groundLevel, canvas.width, groundLevel);

        // Рисуем дрон
        drawDrone();

        // (Опционально) Рисуем отладочную информацию
        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.fillText(`VX: ${drone.vx.toFixed(2)} VY: ${drone.vy.toFixed(2)} A: ${(drone.angle * 180 / Math.PI).toFixed(1)}`, 10, 20);
        ctx.fillText(`Input: ${drone.horizontalInput.toFixed(2)} Thrust: ${drone.isThrusting}`, 10, 40);
        if(pointer.isDown) ctx.fillText(`PtrX: ${pointer.x}`, 10, 60);
    }

    function gameLoop() {
        if (!state.isGameActive) return;
        updateGame();
        drawGame();
    }

    function startGame() {
        if (state.isGameActive) return;
        console.log("Starting game...");
        state.isGameActive = true;

        tg.disableVerticalSwipes();
        document.body.classList.add('game-active');

        setupCanvas(); // Устанавливаем размеры и сбрасываем дрон

        tg.BackButton.show();
        tg.BackButton.onClick(stopGame);

        pointer.isDown = false; // Сбрасываем состояние указателя
        pointer.x = null;

        // Добавляем универсальные обработчики событий
        gameContainer.addEventListener('pointerdown', handlePointerDown);
        gameContainer.addEventListener('pointermove', handlePointerMove);
        gameContainer.addEventListener('pointerup', handlePointerUp);
        gameContainer.addEventListener('pointercancel', handlePointerUp); // Обрабатываем отмену так же, как и up
        gameContainer.addEventListener('pointerleave', handlePointerUp); // Если указатель ушел за пределы

        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, 1000 / 60);

        setTimeout(drawGame, 0); // Первый кадр
    }

    function stopGame() {
        if (!state.isGameActive) return;
        console.log("Stopping game...");
        state.isGameActive = false;

        tg.enableVerticalSwipes();
        document.body.classList.remove('game-active');

        tg.BackButton.offClick(stopGame);
        tg.BackButton.hide();

        // Убираем обработчики
        gameContainer.removeEventListener('pointerdown', handlePointerDown);
        gameContainer.removeEventListener('pointermove', handlePointerMove);
        gameContainer.removeEventListener('pointerup', handlePointerUp);
        gameContainer.removeEventListener('pointercancel', handlePointerUp);
        gameContainer.removeEventListener('pointerleave', handlePointerUp);


        if (gameLoopInterval) {
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
        }

         // Сбрасываем состояние указателя и дрона
         pointer.isDown = false;
         drone.isThrusting = false;
         drone.horizontalInput = 0;
    }

    // --- Обработчики Управления ---

    function updateHorizontalInput() {
        if (!pointer.isDown || pointer.x === null) {
            drone.horizontalInput = 0;
            return;
        }

        // Рассчитываем горизонтальный ввод от -1 до 1
        const deltaX = pointer.x - pointer.canvasCenterX;
        drone.horizontalInput = deltaX / (pointer.canvasCenterX);

        // Рассчитываем мощность тяги на основе Y координаты касания
        // Инвертируем значение, так как Y растет вниз
        const relativeY = 1 - (pointer.y / canvas.height);
        drone.thrustPower = Math.max(0, Math.min(1, relativeY));
    }

    function handlePointerDown(event) {
        if (!state.isGameActive) return;
        pointer.isDown = true;
        drone.isThrusting = true;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        updateHorizontalInput();
        
        if (typeof event.pointerId !== 'undefined') {
            gameContainer.setPointerCapture(event.pointerId);
        }
    }

    function handlePointerMove(event) {
        if (!state.isGameActive || !pointer.isDown) return;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        updateHorizontalInput();
    }

    function handlePointerUp(event) {
       // event.preventDefault();
        if (!state.isGameActive || !pointer.isDown) return; // Игнорируем, если уже отпустили

        pointer.isDown = false;
        drone.isThrusting = false; // Отпускание выключает тягу
        drone.horizontalInput = 0; // Сбрасываем ввод для выравнивания
        pointer.x = null;

        if (typeof event.pointerId !== 'undefined') {
            gameContainer.releasePointerCapture(event.pointerId);
        }
        console.log("Pointer Up");
    }

    // === КОНЕЦ ИГРОВОЙ ЛОГИКИ ===


    // --- Функции основного интерфейса (без изменений) ---
    function updateStatsDisplay() {
        powerValueEl.textContent = `${state.stats.power}%`;
        weightValueEl.textContent = `${state.stats.weight}%`;
        rangeValueEl.textContent = `${state.stats.range}%`;
        assembleButton.disabled = state.selectedComponents.size < 2;
    }

    // Пересчет статистики на основе выбранных компонентов
    function calculateStats() {
        state.stats = {
            power: 0,
            weight: 0,
            range: 0
        };

        state.selectedComponents.forEach(componentName => {
            const stats = componentStats[componentName];
            if (stats) {
                state.stats.power += stats.power;
                state.stats.weight += stats.weight;
                state.stats.range += stats.range;
            }
        });

        // Ограничиваем значения от 0 до 100
        state.stats.power = Math.max(0, Math.min(100, state.stats.power));
        state.stats.weight = Math.max(0, Math.min(100, state.stats.weight));
        state.stats.range = Math.max(0, Math.min(100, state.stats.range));

        updateStatsDisplay();
    }

    // Обработка переключения контролов (тип дрона и табы)
    function handleControlSwitch(event, controls) {
        const clickedButton = event.currentTarget;
        
        // Определяем тип переключателя по наличию атрибута data-
        const isTypeSwitch = clickedButton.hasAttribute('data-type');
        const value = isTypeSwitch ? clickedButton.dataset.type : clickedButton.dataset.tab;

        // Обновляем состояние
        if (isTypeSwitch) {
            state.droneType = value;
        } else {
            state.activeTab = value;
            // Показываем/скрываем соответствующие секции
            componentSections.forEach(section => {
                section.style.display = section.id === `${value}-content` ? 'block' : 'none';
            });
        }

        // Обновляем визуальное состояние кнопок
        controls.forEach(btn => btn.classList.toggle('active', btn === clickedButton));
    }

    // Обновляем назначение обработчиков
    droneTypeControls.forEach(button => {
        button.addEventListener('click', (e) => handleControlSwitch(e, droneTypeControls));
    });

    mainTabControls.forEach(button => {
        button.addEventListener('click', (e) => handleControlSwitch(e, mainTabControls));
    });

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

        calculateStats(); // Пересчитываем и обновляем статы
    }

    // Назначение обработчиков для компонентов
    componentItems.forEach(item => {
        item.addEventListener('click', handleComponentClick);
    });
    function handleAssembleClick() { startGame(); }


    // --- Назначение обработчиков (без изменений) ---
    droneTypeControls.forEach(button => { button.addEventListener('click', (e) => handleControlSwitch(e, droneTypeControls)); });
    mainTabControls.forEach(button => { button.addEventListener('click', (e) => handleControlSwitch(e, mainTabControls)); });
    componentItems.forEach(item => { item.addEventListener('click', handleComponentClick); });
    assembleButton.addEventListener('click', handleAssembleClick);

    // --- Инициализация (без изменений) ---
    calculateStats();
    tg.BackButton.hide(); // Убедимся что кнопка скрыта при старте

    // --- Обработчик изменения размера окна (без изменений) ---
    window.addEventListener('resize', () => {
        setTimeout(() => { if (state.isGameActive) { setupCanvas(); } }, 100);
    });

    // --- Обработка нестабильности viewport (без изменений) ---
     tg.onEvent('viewportChanged', (event) => {
         if (state.isGameActive && !event.isStateStable) { stopGame(); }
     });

}); // Конец DOMContentLoaded