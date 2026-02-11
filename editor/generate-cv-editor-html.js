/* ========================================================
   SKILLS — MASONRY SORT (по длине name)
======================================================== */
function sortSkillsMasonry(skills) {
  if (!skills || skills.length <= 2) return skills;

  const sorted = [...skills].sort((a, b) => a.name.length - b.name.length);

  const mid = Math.floor(sorted.length / 2);
  const short = sorted.slice(0, mid);
  const long = sorted.slice(mid);

  const result = [];
  let i = 0, j = 0;

  while (i < long.length || j < short.length) {
    if (i < long.length) result.push(long[i++]);
    if (j < short.length) result.push(short[j++]);
  }

  return result;
}

export function generateCVEditorHTML(data) {
  const { cv, cv_profile, experience, skills, advantages, education } = data;

  const toRU = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  return `
  <div class="cv-editor-root">

    <!-- =====================================================
         PROFILE BLOCK (EDITOR)
    ====================================================== -->
    <section class="editor-section">
      <h2>Основная информация</h2>

      <div class="editor-grid-2">

        <!-- AVATAR BLOCK -->
        <div class="editor-avatar-block">
            <div id="avatar_preview" class="avatar-preview-circle ${cv_profile.avatar_url ? "has-image" : ""}">
                ${
                cv_profile.avatar_url
                    ? `<img class="editor-avatar-img">`
                    : `<i class="fa-solid fa-user"></i>`
                }
            </div>

            <div class="avatar-actions">
                <button id="avatar_upload_btn" class="topbar-btn ${cv_profile.avatar_url ? "hidden" : ""}">Загрузить</button>
                <button id="avatar_change_btn" class="topbar-btn ${cv_profile.avatar_url ? "" : "hidden"}">Изменить</button>
                <button id="avatar_delete_btn" class="topbar-btn danger ${cv_profile.avatar_url ? "" : "hidden"}">Удалить</button>
            </div>

            <input id="avatar_file" type="file" accept="image/*" class="hidden">
            <div id="avatar_error" class="avatar-error"></div>
        </div>
        
        <div class="editor-userinfo-block">
            <div>
            <label>Название резюме<span class="required">*</span></label>
            <input type="text" placeholder="Введите название резюме" data-field="cv.title" value="${cv.title || ""}">
            <div class="error-msg"></div>
            </div>

            <div>
            <label>Полное имя<span class="required">*</span></label>
            <input type="text" placeholder="Имя и фамилия" data-field="cv_profile.full_name" value="${cv_profile.full_name || ""}">
            <div class="error-msg"></div>
            </div>

            <div>
            <label>Желаемая позиция<span class="required">*</span></label>
                <div class="position-input-wrapper">
                    <input 
                    type="text" placeholder="Например: QA Engineer"
                    data-field="cv_profile.position"
                    data-job-title-input
                    value="${cv_profile.position || ""}"
                    >
                    <div class="position-suggestions"></div>
                </div>
            <div class="error-msg"></div>
            </div>

            <div>
            <label>Локация</label>
                <div class="city-input-wrapper">
                    <input 
                    type="text" placeholder="Город, страна"
                    data-field="cv_profile.location"
                    data-city-input
                    value="${cv_profile.location || ""}"
                    >
                    <div class="city-dropdown-container"></div>
                </div>
            <div class="error-msg"></div>
            </div>
        </div>

      </div>

      <label>О себе</label>
      <textarea data-field="cv_profile.summary" placeholder="2–3 предложения о твоём опыте.">${cv_profile.summary || ""}</textarea>

      <h3>Контакты</h3>
      <div class="editor-grid-2">
        <div><label>Email</label><input type="text" placeholder="you@example.com" data-field="cv_profile.email" value="${cv_profile.email || ""}"><div class="error-msg"></div></div>
        <div><label>Телефон</label><input type="text" placeholder="+375 ..." data-field="cv_profile.phone" value="${cv_profile.phone || ""}"><div class="error-msg"></div></div>
        <div><label>LinkedIn</label><input type="text" placeholder="https://linkedin.com/in/..." data-field="cv_profile.linkedin" value="${cv_profile.linkedin || ""}"><div class="error-msg"></div></div>
        <div><label>Telegram</label><input type="text" placeholder="Telegram" data-field="cv_profile.telegram" value="${cv_profile.telegram || ""}"><div class="error-msg"></div></div>
        <div><label>GitHub</label><input type="text" placeholder="GitHub" data-field="cv_profile.github" value="${cv_profile.github || ""}"><div class="error-msg"></div></div>
        <div><label>Website</label><input type="text" placeholder="Website" data-field="cv_profile.website" value="${cv_profile.website || ""}"><div class="error-msg"></div></div>
        <div><label>Twitter</label><input type="text" placeholder="Twitter" data-field="cv_profile.twitter" value="${cv_profile.twitter || ""}"><div class="error-msg"></div></div>
        <div><label>Instagram</label><input type="text" placeholder="Instagram" data-field="cv_profile.instagram" value="${cv_profile.instagram || ""}"><div class="error-msg"></div></div>
        <div><label>Facebook</label><input type="text" placeholder="Facebook" data-field="cv_profile.facebook" value="${cv_profile.facebook || ""}"><div class="error-msg"></div></div>
        <div><label>Behance</label><input type="text" placeholder="Behance" data-field="cv_profile.behance" value="${cv_profile.behance || ""}"><div class="error-msg"></div></div>
        <div><label>Dribbble</label><input type="text" placeholder="Dribbble" data-field="cv_profile.dribbble" value="${cv_profile.dribbble || ""}"><div class="error-msg"></div></div>
      </div>
    </section>


    <!-- =====================================================
        ADVANTAGES (EDITOR)
    ====================================================== -->
    <section class="editor-section">
        <h2>Преимущества</h2>

        <div class="editor-list editor-list-tags">
            ${advantages
            .map(
                (a) => `
                <div class="adv-tag">
                    <span class="adv-tag-label">${a.tag}</span>
                    <button class="adv-tag-delete" data-delete-adv="${a.id}">×</button>
                </div>
                `
            )
            .join("")}
        </div>

        <div class="adv-input-row">
            <input id="advantageInput" type="text" placeholder="Новое преимущество">
            <button class="add-btn" data-add="advantage">Добавить</button>
        </div>

        <div id="advantagesSuggestions" class="adv-suggestions"></div>
    </section>


    <!-- =====================================================
        EXPERIENCE (EDITOR)
    ====================================================== -->
    <section class="editor-section">
        <h2>Опыт работы</h2>

        <div class="editor-list">
            ${experience
            .map(
                (e) => `
            <div class="editor-exp-block">

                <div class="editor-grid-2">
                <div>
                    <label>Компания<span class="required">*</span></label>
                    <input class="field-input" type="text" placeholder="Название компании" data-exp-company="${e.id}" value="${e.company || ""}">
                </div>

                <div>
                    <label>Должность<span class="required">*</span></label>
                    <input class="field-input" type="text" placeholder="Например: QA Engineer" data-exp-position="${e.id}" value="${e.position || ""}">
                </div>
                </div>

                <div class="editor-grid-2">
                    <div>
                        <label>Город</label>

                        <div class="city-input-wrapper">
                        <input 
                            class="field-input"
                            type="text" placeholder="Город, Страна"
                            data-exp-city="${e.id}"
                            data-city-input
                            value="${e.city || ""}"
                        >
                        <div class="city-dropdown-container"></div>
                        </div>
                    </div>

                    <div>
                        <label>Тип занятости</label>

                        <div class="select-input-wrapper" data-exp-type="${e.id}">
                            <input 
                                type="text"
                                class="field-input select-input"
                                value="${e.employment_type ? employmentTypeLabel(e.employment_type) : ''}"
                                placeholder="Не указано"
                                readonly
                            >
                            <span class="select-input-arrow"></span>

                            <div class="select-input-dropdown">
                                <div class="select-option" data-value="">Не указано</div>
                                <div class="select-option" data-value="full_time">Полная занятость</div>
                                <div class="select-option" data-value="part_time">Частичная занятость</div>
                                <div class="select-option" data-value="contract">Контракт</div>
                                <div class="select-option" data-value="internship">Стажировка</div>
                                <div class="select-option" data-value="freelance">Фриланс</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="editor-grid-2">
                <div>
                    <label>Дата начала<span class="required">*</span></label>
                    <input class="field-input" type="text" data-exp-start="${e.id}" data-date-input value="${toRU(e.start_date)}">
                </div>

                <div>
                    <label>Дата окончания<span class="required">*</span></label>
                    <input class="field-input" type="text" data-exp-end="${e.id}" data-date-input value="${toRU(e.end_date)}">

                    <label class="checkbox-row">
                    <input type="checkbox" data-exp-current="${e.id}" ${e.current ? "checked" : ""}>
                    Работаю здесь
                    </label>
                </div>
            </div>

                <div>
                <label>Описание / обязанности</label>
                <textarea class="field-input" placeholder="Кратко опиши, чем занимался." data-exp-description="${e.id}">${e.description || ""}</textarea>
                </div>

                <button class="delete-btn" data-delete-exp="${e.id}">×</button>
            </div>
            `
            )
            .join("")}
        </div>

        <button class="add-btn-2" data-add="experience">+ Добавить опыт</button>
    </section>

    <!-- =====================================================
        SKILLS (EDITOR)
    ====================================================== -->
    <section class="editor-section">
    <h2>Навыки</h2>

    <div class="skills-columns editor-skills-columns">

        <!-- EXPERT -->
        <div class="skills-column" data-level="expert">
        <h3>Эксперт</h3>
        <div class="skills-list" data-skill-list="expert">
            ${sortSkillsMasonry(
            skills.filter(s => s.level === "expert")
            )
            .map(
                s => `
                <div class="tag-pill skill-pill"
                    draggable="true"
                    data-skill-id="${s.id}"
                    data-level="${s.level}">
                <span>${s.name}</span>
                <button class="skill-delete-btn" data-delete-skill="${s.id}">×</button>
                </div>
            `
            )
            .join("")}
        </div>
        </div>

        <!-- USED -->
        <div class="skills-column" data-level="used">
        <h3>Опытный</h3>
        <div class="skills-list" data-skill-list="used">
            ${sortSkillsMasonry(
            skills.filter(s => s.level === "used")
            )
            .map(
                s => `
                <div class="tag-pill skill-pill"
                    draggable="true"
                    data-skill-id="${s.id}"
                    data-level="${s.level}">
                <span>${s.name}</span>
                <button class="skill-delete-btn" data-delete-skill="${s.id}">×</button>
                </div>
            `
            )
            .join("")}
        </div>
        </div>

        <!-- FAMILIAR -->
        <div class="skills-column" data-level="familiar">
        <h3>Знаком</h3>
        <div class="skills-list" data-skill-list="familiar">
            ${sortSkillsMasonry(
            skills.filter(s => s.level === "familiar")
            )
            .map(
                s => `
                <div class="tag-pill skill-pill"
                    draggable="true"
                    data-skill-id="${s.id}"
                    data-level="${s.level}">
                <span>${s.name}</span>
                <button class="skill-delete-btn" data-delete-skill="${s.id}">×</button>
                </div>
            `
            )
            .join("")}
        </div>
        </div>

    </div>

    <div class="skill-add-row">
        <input id="skillNameInput" type="text" placeholder="Новый навык">
        <button class="add-btn" data-add="skill">Добавить</button>
    </div>

    <div id="skillsSuggestions" class="tags-suggestions"></div>
    </section>

    <!-- =====================================================
        EDUCATION (EDITOR)
    ====================================================== -->
    <section class="editor-section">
        <h2>Образование и курсы</h2>

        <div class="editor-list">
            ${education
            .map(
                (ed) => `
            <div class="editor-edu-block">

                <div class="editor-grid-2">

                <div>
                    <label>Учебное заведение / курс</label>
                    <div class="university-input-wrapper">
                      <input 
                        class="field-input"
                        type="text"
                        placeholder="Название университета или курса"
                        data-edu-inst="${ed.id}"
                        data-university-input
                        value="${ed.institution || ""}"
                      >
                      <div class="university-dropdown-container"></div>
                    </div>
                </div>

                <div>
                    <label>Степень / программа</label>
                    <input 
                      class="field-input"
                      type="text"
                      placeholder="Например: Бакалавр, Курс по тестированию"
                      data-edu-degree="${ed.id}"
                      value="${ed.degree || ""}"
                    >
                </div>

                </div>

                <div class="editor-grid-2">
                <div>
                    <label>Город</label>

                    <div class="city-input-wrapper">
                      <input 
                        class="field-input"
                        type="text"
                        placeholder="Город, Страна"
                        data-edu-city="${ed.id}"
                        data-city-input
                        value="${ed.city || ""}"
                      >
                      <div class="city-dropdown-container"></div>
                    </div>

                </div>
                </div>

                <div class="editor-grid-2">

                <div>
                    <label>Дата начала</label>
                    <input 
                      class="field-input"
                      type="text"
                      data-edu-start="${ed.id}"
                      data-date-input
                      value="${toRU(ed.start_date)}"
                    >
                </div>

                <div>
                    <label>Дата окончания</label>
                    <input 
                      class="field-input"
                      type="text"
                      data-edu-end="${ed.id}"
                      data-date-input
                      value="${toRU(ed.end_date)}"
                    >
                </div>

                </div>

                <div>
                <label>Описание</label>
                <textarea 
                    placeholder="Кратко опиши, что это за обучение."
                    class="field-input"
                    data-edu-description="${ed.id}"
                >${ed.description || ""}</textarea>
                </div>

                <button class="delete-btn" data-delete-edu="${ed.id}">×</button>
            </div>
            `
            )
            .join("")}
        </div>

        <button class="add-btn-2" data-add="education">+ Добавить образование</button>
    </section>


    <!-- =====================================================
         AVATAR CROP MODAL
    ====================================================== -->
    <div id="avatarCropModal" class="avatar-modal">
      <div class="avatar-modal-content">
        <div id="avatarCropArea" class="avatar-crop-area"></div>

        <input id="avatarZoom" type="range" min="0.2" max="5" step="0.01">

        <div class="avatar-modal-actions">
            <button id="avatarCancel" class="avatar-btn avatar-btn-cancel">Отмена</button>
            <button id="avatarApply" class="avatar-btn avatar-btn-apply">Применить</button>
        </div>
      </div>
    </div>

  </div>
  `;
}
