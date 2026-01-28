// =============================
// Глобальное состояние CV
// =============================

import { supabase } from "./supabase.js";

export const previewState = {
  cv: null,
  sections: [],
  itemsBySection: {}
};

// =============================
// Защита от некорректного ID
// =============================
function isBadId(id) {
  return !id || id === "undefined" || id === undefined || id === null;
}

// =============================
// Загрузка CV по ID
// =============================
export async function loadCV(cvId) {
  if (isBadId(cvId)) {
    console.warn("loadCV: некорректный cvId:", cvId);
    previewState.cv = null;
    return null;
  }

  const { data, error } = await supabase
    .from("cv")
    .select("*")
    .eq("id", cvId)
    .single();

  if (error) {
    console.error("Ошибка загрузки CV:", error);
    previewState.cv = null;
    return null;
  }

  previewState.cv = data;
  return data;
}

// =============================
// Загрузка секций CV
// =============================
export async function loadSections(cvId) {
  if (isBadId(cvId)) {
    console.warn("loadSections: некорректный cvId:", cvId);
    previewState.sections = [];
    return [];
  }

  const { data, error } = await supabase
    .from("sections")
    .select("*")
    .eq("cv_id", cvId)
    .order("order", { ascending: true });

  if (error) {
    console.error("Ошибка загрузки секций:", error);
    previewState.sections = [];
    return [];
  }

  previewState.sections = data;
  return data;
}

// =============================
// Загрузка всех items по секциям
// =============================
export async function loadAllItems(cvId) {
  if (isBadId(cvId)) {
    console.warn("loadAllItems: некорректный cvId:", cvId);
    previewState.itemsBySection = {};
    return;
  }

  // ВАЖНО: здесь больше НЕ вызываем loadCV и loadSections
  if (!previewState.sections.length) {
    console.warn("loadAllItems: секции ещё не загружены");
    previewState.itemsBySection = {};
    return;
  }

  const sectionIds = previewState.sections
    .map(s => s.id)
    .filter(id => !isBadId(id));

  if (!sectionIds.length) {
    previewState.itemsBySection = {};
    return;
  }

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .in("section_id", sectionIds)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки items:", error);
    previewState.itemsBySection = {};
    return;
  }

  previewState.itemsBySection = {};
  sectionIds.forEach(id => (previewState.itemsBySection[id] = []));

  (data || []).forEach(item => {
    previewState.itemsBySection[item.section_id].push(item);
  });
}

// =============================
// Установка текущего CV
// =============================
export async function setCurrentCV(cvId) {
  if (isBadId(cvId)) {
    console.warn("setCurrentCV: некорректный cvId:", cvId);
    previewState.cv = null;
    previewState.sections = [];
    previewState.itemsBySection = {};
    return;
  }

  await loadCV(cvId);

  await loadSections(cvId);

  await loadAllItems(cvId);
}

// =============================
// Рендер предпросмотра
// =============================
export function renderPreview() {
  if (typeof window.generateCVHTML !== "function") return;

  const preview = document.getElementById("previewRoot");
  if (!preview) return;

  const html = window.generateCVHTML(previewState);
  preview.innerHTML = html;
}
