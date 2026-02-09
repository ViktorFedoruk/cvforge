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

/* ========================================================
   AVATAR CACHE HELPERS
======================================================== */

async function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/*
  ВАЖНО:
  setAvatarSrc по‑прежнему ищет .cv-avatar-placeholder,
  но мы не трогаем сигнатуру, чтобы не ломать существующий код.
*/
function setAvatarSrc(base64) {
  const placeholder = document.querySelector(".cv-avatar-placeholder");
  if (!placeholder) return;

  const img = document.createElement("img");
  img.className = "cv-avatar";
  img.src = base64;
  img.width = 220;
  img.height = 220;
  img.decoding = "async";

  placeholder.replaceWith(img);
}

async function loadAvatarWithCache(url) {
  if (!url) {
    return;
  }

  // 🔑 Кэш теперь привязан к конкретному URL
  const cacheKey = `cv_avatar_${url}`;
  const cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");

  // 1. Показываем кэш мгновенно
  if (cached.base64) {
    setAvatarSrc(cached.base64);
  }

  // 2. Проверяем ETag
  let newETag = null;
  try {
    const head = await fetch(url, { method: "HEAD" });
    newETag = head.headers.get("ETag");
  } catch (e) {
    console.warn("Avatar HEAD failed:", e);
  }

  if (cached.eTag === newETag && cached.base64) {
    return; // кэш актуален
  }

  // 3. Загружаем новый аватар
  try {
    const blob = await fetch(url).then(r => r.blob());
    const base64 = await blobToBase64(blob);

    // 4. Обновляем кэш (уникальный ключ на каждый URL)
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        base64,
        eTag: newETag
      })
    );

    // 5. Обновляем UI
    setAvatarSrc(base64);
  } catch (e) {
    console.warn("Avatar load failed:", e);
  }
}

/* -------------------------------------------------------
   EMPLOYMENT TYPE LABEL (VIEW)
------------------------------------------------------- */
function employmentTypeLabel(value) {
  const map = {
    "": "Не указано",
    full_time: "Полная занятость",
    part_time: "Частичная занятость",
    contract: "Контракт",
    internship: "Стажировка",
    freelance: "Фриланс"
  };
  return map[value] || "Не указано";
}

/* ========================================================
   GENERATE CV HTML
======================================================== */

export function generateCVHTML(state) {
  const { cv, cv_profile, experience, skills, advantages, education, expStats } = state;

  const fullName = cv_profile?.full_name || "";
  const position = cv_profile?.position || "";
  const summary = cv_profile?.summary || "";

  const avatarUrl = cv_profile?.avatar_url
    ? `${cv_profile.avatar_url}?width=200&height=200&quality=70`
    : null;

  const html = `
  <div class="cv-root">

    <!-- =====================================================
         PROFILE BLOCK
    ====================================================== -->
    <section class="cv-block cv-profile">

      <!-- AVATAR FIRST -->
      <div class="cv-profile-avatar">
        ${
          avatarUrl
            ? `
              <img 
                class="cv-profile-avatar-img"
                src="${avatarUrl}"
                alt="avatar"
              >
            `
            : `
              <div class="cv-profile-avatar-placeholder">
                <i class="fas fa-user"></i>
              </div>
            `
        }
      </div>

      <!-- TEXT BLOCK -->
      <div class="cv-profile-left">

        <div class="cv-profile-name" data-edit="full_name">${fullName}</div>
        <div class="cv-profile-position" data-edit="position">${position}</div>

        <div class="cv-profile-summary" data-edit="summary">${summary}</div>

        <div class="cv-profile-location" data-edit="location">
          ${cv_profile?.location 
            ? `<div><i class="fas fa-map-marker-alt"></i> <span data-edit="location">${cv_profile.location}</span></div>`
            : ""}
        </div>

        <!-- CONTACTS -->
        <div class="cv-profile-contacts">
          ${cv_profile?.email ? `<div><i class="fas fa-envelope"></i> <span data-edit="email">${cv_profile.email}</span></div>` : ""}
          ${cv_profile?.phone ? `<div><i class="fas fa-phone"></i> <span data-edit="phone">${cv_profile.phone}</span></div>` : ""}
          ${cv_profile?.telegram ? `<div><i class="fab fa-telegram"></i> <span data-edit="telegram">${cv_profile.telegram}</span></div>` : ""}
          ${cv_profile?.github ? `<div><i class="fab fa-github"></i> <span data-edit="github">${cv_profile.github}</span></div>` : ""}
          ${cv_profile?.website ? `<div><i class="fas fa-globe"></i> <span data-edit="website">${cv_profile.website}</span></div>` : ""}
          ${cv_profile?.twitter ? `<div><i class="fab fa-twitter"></i> <span data-edit="twitter">${cv_profile.twitter}</span></div>` : ""}
          ${cv_profile?.instagram ? `<div><i class="fab fa-instagram"></i> <span data-edit="instagram">${cv_profile.instagram}</span></div>` : ""}
          ${cv_profile?.facebook ? `<div><i class="fab fa-facebook"></i> <span data-edit="facebook">${cv_profile.facebook}</span></div>` : ""}
          ${cv_profile?.behance ? `<div><i class="fab fa-behance"></i> <span data-edit="behance">${cv_profile.behance}</span></div>` : ""}
          ${cv_profile?.dribbble ? `<div><i class="fab fa-dribbble"></i> <span data-edit="dribbble">${cv_profile.dribbble}</span></div>` : ""}
        </div>

        <!-- ADVANTAGES -->
        ${
          advantages.length
            ? `
              <div class="cv-profile-advantages">
                ${advantages.map(a => `<span class="cv-adv-tag" data-edit-adv="${a.id}">${a.tag}</span>`).join("")}
              </div>
            `
            : ""
        }

      </div>

    </section>

    <!-- EXPERIENCE --!>
    ${
      experience.length
        ? `
    <section class="cv-block">
      <h2 class="cv-block-title">Опыт работы</h2>

      <div class="cv-exp-total">Общий опыт: ${expStats.totalFormatted}</div>

      <div class="cv-exp-list">
        ${experience
          .map(
            (e) => `
          <div class="cv-exp-item">

            <div class="cv-exp-header">
              <span class="cv-exp-company">${e.company || ""}</span>
              <span class="cv-exp-position">${e.position || ""}</span>
            </div>

            <div class="cv-exp-meta">
              ${
                e.city
                  ? `<i class="fas fa-map-marker-alt"></i> <span class="cv-exp-city">${e.city}</span>`
                  : ""
              }
              ${
                e.employment_type
                  ? `<span class="cv-exp-type">• ${employmentTypeLabel(e.employment_type)}</span>`
                  : ""
              }
            </div>

            <div class="cv-exp-dates">
              <span>${formatDate(e.start_date)}</span>
              —
              <span>${
                e.current ? "По настоящее время" : formatDate(e.end_date)
              }</span>
              <span class="cv-exp-duration">(${e._durationFormatted})</span>
            </div>

            ${
              e.description
                ? `<div class="cv-exp-description">${e.description}</div>`
                : ""
            }

            ${
              e.technologies
                ? `<div class="cv-exp-tech"><strong>Технологии:</strong> ${e.technologies}</div>`
                : ""
            }

            ${
              e.projects
                ? `<div class="cv-exp-projects"><strong>Проекты:</strong> ${e.projects}</div>`
                : ""
            }

          </div>
        `
          )
          .join("")}
      </div>
    </section>
    `
        : ""
    }

    <!-- SKILLS -->
    ${
      skills.length
        ? `
    <section class="cv-block">
      <h2 class="cv-block-title">Навыки</h2>

      <div class="cv-skill-columns">

        <div class="cv-skill-col">
          <h3>Эксперт</h3>
          <div class="cv-skill-tags">
            ${
              sortSkillsMasonry(skills.filter(s => s.level === "expert"))
                .map(s => `<div class="cv-skill-item">${s.name}</div>`)
                .join("") || "<div class='cv-skill-empty'>—</div>"
            }
          </div>
        </div>

        <div class="cv-skill-col">
          <h3>Опытный</h3>
          <div class="cv-skill-tags">
            ${
              sortSkillsMasonry(skills.filter(s => s.level === "used"))
                .map(s => `<div class="cv-skill-item">${s.name}</div>`)
                .join("") || "<div class='cv-skill-empty'>—</div>"
            }
          </div>
        </div>

        <div class="cv-skill-col">
          <h3>Знаком</h3>
          <div class="cv-skill-tags">
            ${
              sortSkillsMasonry(skills.filter(s => s.level === "familiar"))
                .map(s => `<div class="cv-skill-item">${s.name}</div>`)
                .join("") || "<div class='cv-skill-empty'>—</div>"
            }
          </div>
        </div>

      </div>
    </section>
    `
        : ""
    }

    <!-- EDUCATION -->
    ${
      education.length
        ? `
    <section class="cv-block">
      <h2 class="cv-block-title">Образование</h2>

      <div class="cv-edu-list">
        ${education.map(ed => `
          <div class="cv-edu-item">

            <div class="cv-edu-header">
              <span class="cv-edu-inst">${ed.institution || ""}</span>
              —
              <span class="cv-edu-degree">${ed.degree || ""}</span>
            </div>

            <div class="cv-edu-meta">
              ${ed.city ? `<i class="fas fa-map-marker-alt"></i> <span class="cv-edu-city">${ed.city}</span>` : ""}
            </div>

            <div class="cv-edu-dates">
              <span>${formatDate(ed.start_date)}</span>
              —
              <span>${formatDate(ed.end_date)}</span>
            </div>

            ${
              ed.certificate_url
                ? `<div class="cv-edu-certificate"><a href="${ed.certificate_url}" target="_blank">Сертификат</a></div>`
                : ""
            }

            <div class="cv-edu-description">${ed.description || ""}</div>

          </div>
        `).join("")}
      </div>
    </section>
    `
        : ""
    }

  </div>
  `;

  // После генерации HTML — запускаем загрузку аватара
  setTimeout(() => {
    if (avatarUrl) {
      loadAvatarWithCache(avatarUrl);
    } else {
      localStorage.removeItem("cv_avatar");
    }
  }, 0);

  return html;
}

/* --------------------------
   HELPERS
--------------------------- */

function formatDate(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
    });
  } catch {
    return date;
  }
}
