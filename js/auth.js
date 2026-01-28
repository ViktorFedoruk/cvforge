import { supabase } from './supabase.js';

/* ============================================================
   УТИЛИТЫ ДЛЯ ВАЛИДАЦИИ И ОТОБРАЖЕНИЯ ОШИБОК
============================================================ */

// Показываем ошибку
function showError(input, message) {
  const errorEl = document.getElementById(input.id + "_error");
  if (errorEl) errorEl.textContent = message;

  input.classList.add("input-error");
}

// Очищаем ошибку
function clearError(input) {
  const errorEl = document.getElementById(input.id + "_error");
  if (errorEl) errorEl.textContent = "";

  input.classList.remove("input-error");
}

// Автоскрытие ошибок при вводе
function attachAutoClear(input) {
  input.addEventListener("input", () => clearError(input));
}

// Email маска
function validateEmailFormat(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

// Имя/фамилия: только буквы
function validateName(str) {
  const trimmed = str.trim();
  const regex = /^[A-Za-zА-Яа-яЁё]+$/;
  return regex.test(trimmed);
}

/* ============================================================
   РЕГИСТРАЦИЯ
============================================================ */

export async function register(email, password, firstName, lastName) {
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const firstInput = document.getElementById("firstName");
  const lastInput = document.getElementById("lastName");

  // Автоскрытие ошибок
  [emailInput, passInput, firstInput, lastInput].forEach(attachAutoClear);

  let valid = true;

  // Имя
  if (!firstName.trim()) {
    showError(firstInput, "Введите имя");
    valid = false;
  } else if (!validateName(firstName)) {
    showError(firstInput, "Имя не должно содержать цифры или спецсимволы");
    valid = false;
  }

  // Фамилия
  if (!lastName.trim()) {
    showError(lastInput, "Введите фамилию");
    valid = false;
  } else if (!validateName(lastName)) {
    showError(lastInput, "Фамилия не должна содержать цифры или спецсимволы");
    valid = false;
  }

  // Email
  if (!email.trim()) {
    showError(emailInput, "Введите почтовый адрес");
    valid = false;
  } else if (!validateEmailFormat(email)) {
    showError(emailInput, "Некорректный формат email");
    valid = false;
  }

  // Пароль
  if (!password.trim()) {
    showError(passInput, "Введите пароль");
    valid = false;
  }

  if (!valid) throw new Error("Проверьте корректность данных");

  // Создание пользователя
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    showError(emailInput, "Ошибка регистрации: " + error.message);
    throw error;
  }

  const user = data.user;
  if (!user) throw new Error("Не удалось создать пользователя");

  // Создание профиля
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim()
    });

  if (profileError) {
    showError(firstInput, "Ошибка сохранения профиля");
    throw profileError;
  }

  return data;
}

/* ============================================================
   ЛОГИН
============================================================ */

export async function login(email, password) {
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");

  [emailInput, passInput].forEach(attachAutoClear);

  let valid = true;

  if (!email.trim()) {
    showError(emailInput, "Введите почтовый адрес");
    valid = false;
  } else if (!validateEmailFormat(email)) {
    showError(emailInput, "Некорректный формат email");
    valid = false;
  }

  if (!password.trim()) {
    showError(passInput, "Введите пароль");
    valid = false;
  }

  if (!valid) throw new Error("Не введены данные пользователя");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showError(emailInput, "Неверные логин и пароль");
    showError(passInput, "");
    throw new Error("Неверные логин и пароль");
  }

  return data;
}

/* ============================================================
   ВОССТАНОВЛЕНИЕ ПАРОЛЯ
============================================================ */

export async function resetPassword(email) {
  const emailInput = document.getElementById("email");

  attachAutoClear(emailInput);

  if (!email.trim()) {
    showError(emailInput, "Введите почтовый адрес");
    throw new Error("Введите почтовый адрес");
  }

  if (!validateEmailFormat(email)) {
    showError(emailInput, "Некорректный формат email");
    throw new Error("Некорректный формат email");
  }

  clearError(emailInput);

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth/reset.html'
  });

  if (error) {
    showError(emailInput, "Ошибка отправки письма");
    throw error;
  }

  return data;
}

/* ============================================================
   УСТАНОВКА НОВОГО ПАРОЛЯ
============================================================ */

export async function updatePassword(newPassword) {
  if (!newPassword.trim()) {
    throw new Error("Введите новый пароль");
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
  return data;
}

/* ============================================================
   УДАЛЕНИЕ АККАУНТА
============================================================ */

export async function deleteAccount() {
  const { data: user } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('delete_user');
  if (error) throw error;

  return true;
}

/* ============================================================
   ПРОВЕРКА АВТОРИЗАЦИИ
============================================================ */

export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = '/auth/index.html';
  }
}

/* ============================================================
   ГЛАЗОК ДЛЯ ПАРОЛЯ
============================================================ */

export function initPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);

  if (!input || !toggle) return;

  toggle.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";

    toggle.innerHTML = isHidden
      ? '<i class="fas fa-eye-slash"></i>'
      : '<i class="fas fa-eye"></i>';
  });
}
