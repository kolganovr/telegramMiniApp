document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); // Сообщаем Telegram, что приложение готово
    tg.expand(); // Растягиваем приложение на весь экран

    // --- Элементы DOM ---
    const droneTypeControls = document.querySelectorAll('.drone-type .control-button');
    const mainTabControls = document.querySelectorAll('.main-tabs .control-button');
    const componentItems = document.querySelectorAll('.component-item');
    const powerValueEl = document.getElementById('power-value');
    const weightValueEl = document.getElementById('weight-value');
    const rangeValueEl = document.getElementById('range-value');
    const assembleButton = document.getElementById('assemble-button');
    const componentSections = document.querySelectorAll('.component-section'); // Все секции с контентом табов

    // --- Состояние приложения ---
    let state = {
        droneType: 'quad', // 'quad' или 'hexa'
        activeTab: 'assembly', // 'assembly', 'test', 'settings'
        selectedComponents: new Set(), // Храним названия выбранных компонентов
        stats: {
            power: 0,
            weight: 0,
            range: 0
        }
    };

    // --- Условные характеристики компонентов (ПРОСТЫЕ ЗАГЛУШКИ) ---
    // В реальном приложении здесь будет сложная логика или данные с сервера
    const componentStats = {
        motors: { power: 25, weight: 15, range: 0 },
        battery: { power: 0, weight: 20, range: 40 },
        gps: { power: -5, weight: 5, range: 10 },
        camera: { power: -10, weight: 10, range: -5 },
        gyro: { power: -2, weight: 3, range: 0 },
        radio: { power: -3, weight: 5, range: 55 }
    };

    // --- Функции ---

    // Обновление отображения статистики
    function updateStatsDisplay() {
        powerValueEl.textContent = `${state.stats.power}%`;
        weightValueEl.textContent = `${state.stats.weight}%`;
        rangeValueEl.textContent = `${state.stats.range}%`;

        // Пример: активировать кнопку "Собрать", если выбрано хотя бы 2 компонента
        assembleButton.disabled = state.selectedComponents.size < 2;
        // Здесь можно добавить проверку максимального веса и т.д.
    }

    // Пересчет статистики на основе выбранных компонентов
    function calculateStats() {
        // Сбрасываем статы к базовым значениям (пока 0)
        state.stats.power = 0;
        state.stats.weight = 0;
        state.stats.range = 0;

        // Добавляем характеристики каждого выбранного компонента
        state.selectedComponents.forEach(componentName => {
            const stats = componentStats[componentName];
            if (stats) {
                state.stats.power += stats.power;
                state.stats.weight += stats.weight;
                state.stats.range += stats.range;
            }
        });

        // Ограничим значения (например, от 0 до N) - опционально
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

        calculateStats(); // Пересчитываем и обновляем статы
    }

    // Обработка переключения сегментированных контролов (типы, табы)
    function handleControlSwitch(event, controls) {
        const clickedButton = event.currentTarget;
        const dataKey = Object.keys(clickedButton.dataset)[0]; // 'type' или 'tab'
        const dataValue = clickedButton.dataset[dataKey];

        // Обновляем состояние
        state[dataKey === 'type' ? 'droneType' : 'activeTab'] = dataValue;

        // Обновляем внешний вид кнопок
        controls.forEach(btn => {
            btn.classList.toggle('active', btn === clickedButton);
        });

        // Показываем/скрываем контент для табов
        if (dataKey === 'tab') {
            componentSections.forEach(section => {
                section.style.display = section.id === `${dataValue}-content` ? 'block' : 'none';
            });
            console.log(`Переключились на таб: ${state.activeTab}`); // Для отладки
            // Здесь можно будет загружать разный контент для разных табов
        } else {
            console.log(`Выбран тип дрона: ${state.droneType}`); // Для отладки
             // Здесь может быть логика, влияющая на доступные компоненты или базовые статы
             calculateStats(); // Пересчитать статы, если тип дрона на них влияет
        }
    }

    // Обработка нажатия на кнопку "Собрать дрон"
    function handleAssembleClick() {
        if (state.selectedComponents.size < 2) {
            tg.showAlert('Нужно выбрать хотя бы два компонента!');
            return;
        }

        // Формируем данные для отправки (пример)
        const dataToSend = {
            droneType: state.droneType,
            components: Array.from(state.selectedComponents),
            finalStats: state.stats
        };

        console.log("Собранный дрон:", dataToSend);
        tg.showConfirm(`Собрать ${state.droneType}-дрон с компонентами: ${dataToSend.components.join(', ')}?`, (confirmed) => {
           if (confirmed) {
                // В реальном приложении - отправка данных боту
                // tg.sendData(JSON.stringify(dataToSend));

                tg.showAlert(`Отлично! Дрон собран (в консоли).\nМощность: ${state.stats.power}%\nВес: ${state.stats.weight}%\nДальность: ${state.stats.range}%`);
                // Можно добавить tg.close() если после сборки приложение должно закрыться
                // tg.close();
           }
        });
    }


    // --- Назначение обработчиков ---

    // Переключение типа дрона
    droneTypeControls.forEach(button => {
        button.addEventListener('click', (e) => handleControlSwitch(e, droneTypeControls));
    });

    // Переключение основных табов
    mainTabControls.forEach(button => {
        button.addEventListener('click', (e) => handleControlSwitch(e, mainTabControls));
    });

    // Клики по компонентам
    componentItems.forEach(item => {
        item.addEventListener('click', handleComponentClick);
    });

    // Клик по кнопке "Собрать дрон"
    assembleButton.addEventListener('click', handleAssembleClick);

    // --- Инициализация ---
    calculateStats(); // Рассчитать и показать начальные статы (нули)
    // Устанавливаем начальное состояние кнопки "Собрать"
    assembleButton.disabled = state.selectedComponents.size < 2;

    // Пример использования кнопок Telegram (если понадобится в будущем)
    // tg.MainButton.setText("Завершить сборку");
    // tg.MainButton.onClick(() => {
    //     handleAssembleClick(); // Можно вызывать ту же функцию
    // });
    // if (state.selectedComponents.size >= 2) {
    //    tg.MainButton.show();
    // } else {
    //    tg.MainButton.hide();
    // }
    // Нужно будет обновлять состояние MainButton в calculateStats()

}); // Конец DOMContentLoaded