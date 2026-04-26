// radar.js
// // Главный JS для radar.html: авторизация Firebase + подписки на Realtime DB + управление UI (радар, статус, кнопки).

// --- Firebase config (твои данные) ---
// // Конфиг твоего Firebase-проекта. Эти поля привязаны к конкретному проекту в Firebase Console.
const firebaseConfig = {
// // Объект с параметрами подключения.

  apiKey: "AIzaSyAbV_d5Y-Y1Z6Fgv9s6qEdwOa8ja7a-3EQ",
// // API key проекта (не “пароль”, но идентификатор для клиента).

  authDomain: "sentrygun-lazer.firebaseapp.com",
// // Домен для Firebase Auth (логин/сессии).

  databaseURL: "https://sentrygun-lazer-default-rtdb.europe-west1.firebasedatabase.app",
// // URL твоей Realtime Database (куда читаем/пишем данные).

  projectId: "sentrygun-lazer",
// // ID проекта в Firebase.

  storageBucket: "sentrygun-lazer.appspot.com",
// // Bucket для Firebase Storage (в этом коде не используется).

  messagingSenderId: "424543118066",
// // Для Cloud Messaging (в этом коде не используется).

  appId: "1:424543118066:web:97a60c901fe6d66e2e266b"
// // ID веб-приложения внутри Firebase.
};

firebase.initializeApp(firebaseConfig);
// // Инициализация Firebase SDK.
// // Привязано к <script firebase-app-compat.js> в radar.html (без него будет ошибка).

const auth = firebase.auth();
// // Подключаем модуль Authentication (логин/регистрация/выход).
// // Привязано к <script firebase-auth-compat.js>.

const db   = firebase.database();
// // Подключаем Realtime Database.
// // Привязано к <script firebase-database-compat.js>.

// --- DOM ---
// // Здесь ты связываешь JS с HTML-элементами по их id.
// // Все эти id находятся в radar.html.

const authSection    = document.getElementById("authSection");
// // <section id="authSection" class="auth-wrap"> — секция логина.

const mainPanel      = document.getElementById("mainPanel");
// // <main id="mainPanel"> — основной контент (скрыт в CSS display:none).

const authForm       = document.getElementById("authForm");
// // <form id="authForm"> — форма логина/регистрации (ловим submit).

const authEmail      = document.getElementById("authEmail");
// // <input id="authEmail"> — поле email.

const authPassword   = document.getElementById("authPassword");
// // <input id="authPassword"> — поле пароля.

const authError      = document.getElementById("authError");
// // <div id="authError" class="auth-error"></div> — куда писать ошибки.

const authModeBtn    = document.getElementById("authModeBtn");
// // <button id="authModeBtn"> — кнопка переключения login/register.

const authModeText   = document.getElementById("authModeText");
// // <span id="authModeText"> — текст “нет аккаунта?” / “уже есть?”.

const authSubmit     = document.getElementById("authSubmit");
// // <button id="authSubmit" type="submit"> — кнопка отправки формы (меняем текст).

const logoutBtn      = document.getElementById("logoutBtn");
// // <button id="logoutBtn"> — кнопка выхода (скрыта d-none до логина).

const statusDot      = document.getElementById("statusDot");
// // <div id="statusDot" class="status-dot"></div> — точка статуса (класс online добавляется/убирается).

const statusText     = document.getElementById("statusText");
// // <div id="statusText" class="status-text">...</div> — текст статуса.

const neoRadar       = document.getElementById("neoRadar");
// // <div id="neoRadar" class="neo-radar"> — контейнер круга радара (нужен для размера clientWidth).

const neoDistance    = document.getElementById("neoDistance");
// // <div id="neoDistance" class="radar-distance"> — вывод расстояния.

const neoDot         = document.getElementById("neoDot");
// // <div id="neoDot" class="target-dot"></div> — точка цели (двигается left/top, класс visible).

const neoSweep       = document.getElementById("neoSweep");
// // <div id="neoSweep" class="sweep"></div> — луч радара (вращаем transform: rotate()).

const servoAngleEl   = document.getElementById("servoAngle");
// // <div id="servoAngle"> --°</div> — отображение угла серво.

const servoToggleBtn = document.getElementById("servoToggleBtn");
// // <button id="servoToggleBtn" data-enabled="1"> — управление servoEnabled в DB.

const laserToggleBtn = document.getElementById("laserToggleBtn");
// // <button id="laserToggleBtn" data-enabled="0"> — управление laserEnabled в DB.

let currentAngleDeg = 0;
// // Текущий угол (в градусах) — обновляется из radar/currentAngle.

let isRegisterMode = false;
// // Режим формы: false=логин, true=регистрация. Влияет на updateAuthModeUI() и submit.

let lastStatusFromESP = "";
// // Последний текст статуса от ESP (из system/statusText). Используется в setOnlineStatus(true).

// --- status helper ---
// // Функция управления UI статуса (точка + текст).
function setOnlineStatus(online) {
// // online=true = считаем, что данные приходят.

  if (online) {
// // В ветке online включаем зелёный статус.

    statusDot.classList.add("online");
// // Добавляет класс "online" к statusDot.
// // Привязано к CSS: .status-dot.online { background: #22c55e; ... }

    statusText.textContent = lastStatusFromESP || "Connected ✅";
// // Пишем текст статуса.
// // Если ESP прислал system/statusText — покажем его, иначе “Connected ✅”.
  } else {
// // В ветке offline выключаем зелёный статус.

    statusDot.classList.remove("online");
// // Убираем класс online -> точка становится красной (CSS по умолчанию).

    statusText.textContent = "אין נתונים / מנסה להתחבר...";
// // Текст: “нет данных / пытаюсь подключиться...”
  }
}
setOnlineStatus(false);
// // На старте выставляем “offline”, пока не придут данные из базы.

// --- AUTH MODE TOGGLE ---
// // Перерисовка текста UI в зависимости от isRegisterMode.
function updateAuthModeUI() {
// // Меняет надписи в форме: логин/регистрация.

  if (isRegisterMode) {
// // Если режим регистрации.

    authModeText.textContent = "כבר יש לך משתמש?";
// // Текст “уже есть пользователь?”

    authModeBtn.textContent  = "התחברות";
// // На кнопке переключения пишем “вход”.

    authSubmit.textContent   = "הרשמה";
// // На submit пишем “регистрация”.
  } else {
// // Если режим логина.

    authModeText.textContent = "אין לך משתמש?";
// // “нет пользователя?”

    authModeBtn.textContent  = "הרשמה";
// // “регистрация” (переключиться на register).

    authSubmit.textContent   = "התחברות";
// // “вход” на submit.
  }

  authError.textContent = "";
// // Сбрасываем текст ошибки при смене режима.
}

authModeBtn.addEventListener("click", () => {
// // Клик по кнопке режима.

  isRegisterMode = !isRegisterMode;
// // Переключаем режим true/false.

  updateAuthModeUI();
// // Обновляем UI текста/кнопок.
});
updateAuthModeUI();
// // Сразу выставляем правильные надписи при загрузке страницы.

// --- AUTH SUBMIT ---
// // Обработчик отправки формы (логин или регистрация).
authForm.addEventListener("submit", (e) => {
// // Срабатывает, когда нажал submit или Enter в форме.

  e.preventDefault();
// // Отменяем перезагрузку страницы (иначе форма бы обновила страницу).

  authError.textContent = "";
// // Чистим предыдущую ошибку.

  const email = authEmail.value.trim();
// // Берём email из input#authEmail и убираем пробелы по краям.

  const pass  = authPassword.value.trim();
// // Берём пароль из input#authPassword и убираем пробелы.

  if (!email || !pass) {
// // Проверка: оба поля заполнены?

    authError.textContent = "נא למלא אימייל וסיסמה.";
// // Если нет — показываем ошибку в div#authError.

    return;
// // Прерываем submit.
  }

  if (isRegisterMode) {
// // Если это регистрация.

    auth.createUserWithEmailAndPassword(email, pass)
// // Firebase Auth: создать пользователя с email+password.
// // Возвращает Promise, в then приходит cred (credentials).

      .then((cred) => {
// // Успешно создан пользователь.

        const uid = cred.user.uid;
// // Берём уникальный uid пользователя (Firebase Auth user id).

        db.ref("users/" + uid).set({
// // Пишем в Realtime DB ветку users/<uid>.
// // Это НЕ обязательно для Auth, но удобно хранить профиль/метаданные.

          email: email,
// // Сохраняем email.

          createdAt: new Date().toISOString()
// // Сохраняем дату создания (ISO строка).
        });
// // Завершили запись.
      })

      .catch((err) => authError.textContent = err.message);
// // Если ошибка (email уже занят, слабый пароль и т.п.) — показываем err.message.
  } else {
// // Если это логин.

    auth.signInWithEmailAndPassword(email, pass)
// // Firebase Auth: вход по email+password.

      .catch((err) => authError.textContent = err.message);
// // Ошибку входа тоже выводим в authError.
  }
});

// --- LOGOUT ---
// // Обработчик выхода.
logoutBtn.addEventListener("click", () => auth.signOut());
// // При клике вызываем auth.signOut() — Firebase удалит сессию пользователя.

// --- AUTH STATE ---
// // Слушаем изменение состояния авторизации (вошёл/вышел/перезагрузил страницу).
auth.onAuthStateChanged((user) => {
// // Этот колбэк вызывается всегда при изменении логина, и один раз при старте.

  if (user) {
// // Если user существует — значит авторизован.

    authSection.style.display = "none";
// // Прячем секцию логина.
// // Привязано к HTML: <section id="authSection">

    mainPanel.style.display   = "block";
// // Показываем main.
// // В CSS main изначально display:none.

    logoutBtn.classList.remove("d-none");
// // Показываем кнопку “יציאה” (убираем Bootstrap класс скрытия).

    attachRealtimeListeners();
// // Подключаем слушатели Realtime DB (угол, дистанция, статусы, кнопки).
  } else {
// // Если user = null — значит не авторизован.

    mainPanel.style.display   = "none";
// // Прячем main контент.

    authSection.style.display = "flex";
// // Показываем auth (у тебя .auth-wrap = flex для центрирования).

    logoutBtn.classList.add("d-none");
// // Прячем logout кнопку.
  }
});

// --- REALTIME LISTENERS ---
// // Защита от повторного подключения подписок.
let listenersAttached = false;
// // Если true — подписки уже повешены.

function attachRealtimeListeners() {
// // Функция вешает .on("value") на нужные ветки Firebase + обработчики кнопок.

  if (listenersAttached) return;
// // Если уже подключали — выходим, чтобы не сделать двойные подписки/двойные клики.

  listenersAttached = true;
// // Помечаем, что подписки подключены.

  // 0) статус от ESP
// // Слушаем текстовый статус, который пишет ESP в базу.
  db.ref("system/statusText").on("value", snap => {
// // Подписка на изменение узла system/statusText.

    const v = snap.val();
// // Значение из базы.

    if (v === null) return;
// // Если узел пуст — ничего не делаем.

    lastStatusFromESP = String(v);
// // Запоминаем статус как строку.

    statusText.textContent = lastStatusFromESP;
// // Пишем статус в UI: div#statusText.
  });

  // 1) угол серво
// // Слушаем текущий угол, который пишет ESP (или другой код) в radar/currentAngle.
  db.ref("radar/currentAngle").on("value", snap => {
// // Подписка на radar/currentAngle.

    const v = snap.val();
// // Значение угла.

    if (v === null) {
// // Если нет данных:

      servoAngleEl.textContent = "--°";
// // UI: показываем заглушку.

      return;
// // Выходим.
    }

    currentAngleDeg = Number(v);
// // Обновляем переменную угла.

    servoAngleEl.textContent = currentAngleDeg.toFixed(0) + "°";
// // Обновляем UI значение угла (округляем до целого).

    neoSweep.style.transform = `rotate(${currentAngleDeg - 90}deg)`;
// // Вращаем луч радара.
// // -90 потому что в CSS луч направлен вправо, а тебе надо согласовать с “0° вверх/вправо” (как ты задумал).
// // Привязано к HTML: div#neoSweep и CSS .sweep { transform-origin: 0% 50%; }.
  });

  // 2) дистанция + точка на радаре
// // Слушаем расстояние в сантиметрах, которое приходит от датчика и пишется в radar/distanceCm.
  db.ref("radar/distanceCm").on("value", snap => {
// // Подписка на radar/distanceCm.

    const v = snap.val();
// // Значение дистанции.

    if (v === null) {
// // Если данных нет:

      neoDistance.innerHTML = "--<small>ס״מ</small>";
// // Показываем заглушку в div#neoDistance (через innerHTML, чтобы оставить <small>).

      neoDot.classList.remove("visible");
// // Прячем точку цели.
// // Привязано к CSS: .target-dot.visible { opacity: 1; }

      setOnlineStatus(false);
// // Ставим статус “offline/нет данных”.

      return;
// // Выходим.
    }

    setOnlineStatus(true);
// // Есть дистанция — считаем, что система онлайн.

    const dist = Number(v);
// // Преобразуем дистанцию в число.

    neoDistance.innerHTML = dist.toFixed(0) + "<small>ס״מ</small>";
// // Обновляем текст дистанции, округляем до 0 знаков.

    const radarSize = neoRadar.clientWidth; // авто под размер
// // Берём реальную ширину круга (360px или 300px на мобиле).
// // Привязано к CSS и @media, где меняется размер .neo-radar.

    const maxDist = 200;
// // Максимальная дистанция для “масштаба” радара.
// // Всё что больше 200 будет рисоваться на внешнем круге.

    const norm = Math.min(dist, maxDist) / maxDist;
// // Нормализация 0..1: clamp по maxDist.

    const r = (radarSize / 2) * norm;
// // Радиус от центра: половина размера * norm.

    const angleRad = (currentAngleDeg - 90) * Math.PI / 180;
// // Перевод градусов в радианы для Math.cos/sin.
// // -90 опять же для согласования ориентации.

    const cx = radarSize / 2;
// // Центр X круга.

    const cy = radarSize / 2;
// // Центр Y круга.

    const x = cx + r * Math.cos(angleRad);
// // Вычисляем X координату точки по полярным координатам (r, angle).

    const y = cy + r * Math.sin(angleRad);
// // Вычисляем Y координату.

    neoDot.style.left = (x - 4) + "px";
// // Ставим left для точки.
// // -4 потому что точка 8px, и надо центрировать её по координате.

    neoDot.style.top  = (y - 4) + "px";
// // Ставим top для точки (аналогично).

    neoDot.classList.add("visible");
// // Делаем точку видимой (opacity=1).
  });

  // 3) control/servoEnabled
// // Логика кнопки серво: читает control/servoEnabled и пишет туда новое значение.

  function updateServoButton(enabled) {
// // Внутренняя функция обновления внешнего вида кнопки серво.

    servoToggleBtn.dataset.enabled = enabled ? "1" : "0";
// // Запоминаем текущее состояние в data-enabled (атрибут HTML dataset).

    servoToggleBtn.textContent = enabled ? "כיבוי סרבו" : "הפעלת סרבו";
// // Текст кнопки: если включено — “выключить”, иначе “включить”.

    servoToggleBtn.classList.toggle("btn-outline-light", !enabled);
// // Если НЕ включено — добавляем стиль btn-outline-light (светлая рамка).

    servoToggleBtn.classList.toggle("btn-outline-warning", enabled);
// // Если включено — добавляем btn-outline-warning (жёлтая рамка).
  }

  db.ref("control/servoEnabled").on("value", snap => {
// // Подписка на состояние серво в базе.

    let enabled = snap.val();
// // Считываем значение (может быть true/false или 1/0).

    if (enabled === null) {
// // Если значения нет (первый запуск базы):

      enabled = true;
// // По умолчанию серво включено.

      db.ref("control/servoEnabled").set(true);
// // Записываем дефолт в базу, чтобы ESP тоже видел.
    }

    updateServoButton(!!enabled);
// // Обновляем UI. !! превращает в true/false.
  });

  servoToggleBtn.addEventListener("click", () => {
// // При клике переключаем значение.

    const current = servoToggleBtn.dataset.enabled === "1";
// // Читаем текущее состояние из data-enabled.

    db.ref("control/servoEnabled").set(!current);
// // Пишем противоположное значение в базу.
  });

  // 4) control/laserEnabled
// // Логика лазера аналогична серво: читает control/laserEnabled и пишет туда.

  function updateLaserButton(enabled) {
// // Обновляет внешний вид кнопки лазера.

    laserToggleBtn.dataset.enabled = enabled ? "1" : "0";
// // Сохраняем состояние в data-enabled.

    laserToggleBtn.textContent = enabled ? "לייזר ON" : "לייזר OFF";
// // Текст кнопки.

    laserToggleBtn.classList.toggle("btn-outline-danger", !enabled);
// // Если выключено — красная обводка.

    laserToggleBtn.classList.toggle("btn-outline-success", enabled);
// // Если включено — зелёная обводка.
  }

  db.ref("control/laserEnabled").on("value", snap => {
// // Подписка на состояние лазера.

    let enabled = snap.val();
// // Читаем значение.

    if (enabled === null) {
// // Если в базе ещё ничего нет:

      enabled = false; // по умолчанию лазер выключен
// // Дефолт: выключено.

      db.ref("control/laserEnabled").set(false);
// // Записываем дефолт в базу.
    }

    updateLaserButton(!!enabled);
// // Обновляем UI.
  });

  laserToggleBtn.addEventListener("click", () => {
// // Клик по кнопке лазера.

    const current = laserToggleBtn.dataset.enabled === "1";
// // Читаем текущее состояние из data-enabled.

    db.ref("control/laserEnabled").set(!current);
// // Пишем противоположное в Firebase.
  });
}
// // Конец attachRealtimeListeners().