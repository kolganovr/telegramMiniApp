// Получаем объект Telegram Web App
const tg = window.Telegram.WebApp;

// Функция, которая выполнится, когда приложение будет готово
tg.ready();

// Показываем информацию о пользователе (если доступна)
const userInfoDiv = document.getElementById('user-info');
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    userInfoDiv.innerHTML = `Привет, ${user.first_name}! (ID: ${user.id})`;
} else {
    userInfoDiv.innerHTML = 'Не удалось получить данные пользователя.';
}

// Находим кнопку закрытия
const closeButton = document.getElementById('close-button');

// Добавляем обработчик события на клик по кнопке
closeButton.addEventListener('click', () => {
    // Закрываем Mini App
    tg.close();
});

// Расширяем приложение на весь экран (опционально)
tg.expand();