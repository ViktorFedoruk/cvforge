/* ============================================================
   UNIVERSAL VALIDATION MODULE FOR CV WIZARD
   Works with wizardState + DOM error highlighting
============================================================ */

/* ------------------------------------------------------------
   BASIC HELPERS
------------------------------------------------------------ */

function showFieldError(input, msg) {
  if (!input) return;
  const errorEl = input.parentElement.querySelector(".error-msg");
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }
  input.classList.add("input-error");
}

function clearFieldError(input) {
  if (!input) return;
  const errorEl = input.parentElement.querySelector(".error-msg");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
  input.classList.remove("input-error");
}

/* ------------------------------------------------------------
   INPUT LIMITERS
------------------------------------------------------------ */

function limitLength(input, max) {
  if (!input) return;
  input.addEventListener("input", () => {
    if (input.value.length > max) {
      input.value = input.value.slice(0, max);
    }
  });
}

function sanitizePhone(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\d+]/g, "").slice(0, 16);
  });
}

function sanitizeContact(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\w\-./:@]/g, "");
  });
}

/* ------------------------------------------------------------
   VALIDATION: STEP 1 — PROFILE
------------------------------------------------------------ */

function validateProfileStep() {
  let valid = true;

  const profile = wizardState.profile;

  const get = (id) => document.getElementById(id);

  const titleEl = get("cvTitle");
  const fullNameEl = get("profileFullName");
  const positionEl = get("profilePosition");
  const emailEl = get("profileEmail");
  const phoneEl = get("profilePhone");
  const linkedinEl = get("profileLinkedin");
  const summaryEl = get("profileSummary");

  function req(el, value, msg) {
    clearFieldError(el);
    if (!value.trim()) {
      showFieldError(el, msg);
      valid = false;
    }
  }

  req(titleEl, profile.title, "Введите название резюме");
  req(fullNameEl, profile.full_name, "Введите имя и фамилию");
  req(positionEl, profile.position, "Введите желаемую должность");

  clearFieldError(emailEl);
  if (profile.email) {
    if (profile.email.length > 120) {
      showFieldError(emailEl, "Email слишком длинный");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      showFieldError(emailEl, "Некорректный email");
      valid = false;
    }
  }

  clearFieldError(phoneEl);
  if (profile.phone) {
    const digits = profile.phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      showFieldError(phoneEl, "Некорректный номер телефона");
      valid = false;
    }
  }

  clearFieldError(linkedinEl);
  if (profile.linkedin && profile.linkedin.length > 100) {
    showFieldError(linkedinEl, "Слишком длинная ссылка");
    valid = false;
  }

  document.querySelectorAll("[data-contact]").forEach((input) => {
    const key = input.dataset.contact;
    clearFieldError(input);
    if (wizardState.profile[key] && wizardState.profile[key].length > 100) {
      showFieldError(input, "Слишком длинное значение");
      valid = false;
    }
  });

  clearFieldError(summaryEl);
  if (profile.summary && profile.summary.length > 350) {
    showFieldError(summaryEl, "Описание слишком длинное (максимум 350 символов)");
    valid = false;
  }

  return valid;
}

/* ------------------------------------------------------------
   VALIDATION: ADVANTAGES (TAGS)
------------------------------------------------------------ */

function validateAdvantagesStep() {
  let valid = true;

  wizardState.advantages.forEach((tag) => {
    if (tag.length > 50) {
      alert(`Тег "${tag}" слишком длинный (максимум 50 символов)`);
      valid = false;
    }
  });

  return valid;
}

/* ------------------------------------------------------------
   VALIDATION: STEP 2 — EXPERIENCE
------------------------------------------------------------ */

function validateExperienceStep() {
  let valid = true;

  wizardState.experience.forEach((exp, index) => {
    const card = experienceListEl.children[index];
    if (!card) return;

    const getField = (name) => card.querySelector(`[data-field="${name}"]`);

    const companyEl = getField("company");
    const positionEl = getField("position");
    const startEl = getField("start_date");
    const endEl = getField("end_date");

    [companyEl, positionEl, startEl, endEl].forEach(clearFieldError);

    // Автоматическая логика: если нет даты окончания → считаем "работаю сейчас"
    if (!exp.end_date || !exp.end_date.trim()) {
      exp.current = true;
    }

    if (!exp.company.trim()) {
      showFieldError(companyEl, "Введите название компании");
      valid = false;
    }

    if (!exp.position.trim()) {
      showFieldError(positionEl, "Введите должность");
      valid = false;
    }

    if (!exp.start_date.trim()) {
      showFieldError(startEl, "Укажите дату начала");
      valid = false;
    }

    if (!exp.current) {
      if (!exp.end_date.trim()) {
        showFieldError(endEl, "Укажите дату окончания");
        valid = false;
      } else if (exp.start_date && exp.end_date < exp.start_date) {
        showFieldError(endEl, "Дата окончания раньше начала");
        valid = false;
      }
    }

    const cityEl = getField("city");
    const techEl = getField("technologies");
    const projEl = getField("projects");
    const descEl = getField("description");

    if (exp.city && exp.city.length > 80) {
      showFieldError(cityEl, "Слишком длинное значение");
      valid = false;
    }
    if (exp.technologies && exp.technologies.length > 350) {
      showFieldError(techEl, "Слишком длинное значение");
      valid = false;
    }
    if (exp.projects && exp.projects.length > 350) {
      showFieldError(projEl, "Слишком длинное значение");
      valid = false;
    }
    if (exp.description && exp.description.length > 350) {
      showFieldError(descEl, "Слишком длинное описание");
      valid = false;
    }
  });

  return valid;
}

/* ------------------------------------------------------------
   VALIDATION: STEP 3 — SKILLS
------------------------------------------------------------ */

function validateSkillsStep() {
  let valid = true;

  ["expert", "used", "familiar"].forEach(level => {
    if (wizardState.skills[level].length > 15) {
      alert(`В секции "${level}" слишком много навыков (максимум 15)`);
      valid = false;
    }
  });

  ["expert", "used", "familiar"].forEach(level => {
    wizardState.skills[level].forEach(name => {
      if (name.length > 30) {
        alert(`Навык "${name}" слишком длинный (максимум 30 символов)`);
        valid = false;
      }
    });
  });

  return valid;
}

/* ------------------------------------------------------------
   VALIDATION: STEP 4 — EDUCATION
------------------------------------------------------------ */

function validateEducationStep() {
  let valid = true;

  wizardState.education.forEach((edu, index) => {
    const card = educationListEl.children[index];
    if (!card) return;

    const getField = (name) => card.querySelector(`[data-field="${name}"]`);

    const startEl = getField("start_date");
    const endEl = getField("end_date");

    clearFieldError(startEl);
    clearFieldError(endEl);

    if (edu.start_date && edu.end_date && edu.end_date < edu.start_date) {
      showFieldError(endEl, "Дата окончания раньше начала");
      valid = false;
    }

    const instEl = getField("institution");
    const degreeEl = getField("degree");
    const cityEl = getField("city");
    const certEl = getField("certificate_url");
    const descEl = getField("description");

    if (edu.institution && edu.institution.length > 120) {
      showFieldError(instEl, "Слишком длинное название");
      valid = false;
    }
    if (edu.degree && edu.degree.length > 120) {
      showFieldError(degreeEl, "Слишком длинное значение");
      valid = false;
    }
    if (edu.city && edu.city.length > 80) {
      showFieldError(cityEl, "Слишком длинное значение");
      valid = false;
    }
    if (edu.certificate_url && edu.certificate_url.length > 200) {
      showFieldError(certEl, "Слишком длинная ссылка");
      valid = false;
    }
    if (edu.description && edu.description.length > 350) {
      showFieldError(descEl, "Описание слишком длинное");
      valid = false;
    }
  });

  return valid;
}

/* ------------------------------------------------------------
   MASTER VALIDATION ENTRY POINT
------------------------------------------------------------ */

function validateStep(step) {
  switch (step) {
    case 1: return validateProfileStep();
    case 2: return validateExperienceStep();
    case 3: return validateSkillsStep();
    case 4: return validateEducationStep();
    default: return true;
  }
}

/* ------------------------------------------------------------
   DATA VALIDATION (EDITOR)
------------------------------------------------------------ */

function validateProfileData(profile) {
  const errors = [];

  if (!profile.full_name || !profile.full_name.trim()) {
    errors.push("Введите имя и фамилию");
  }

  if (!profile.position || !profile.position.trim()) {
    errors.push("Введите желаемую должность");
  }

  if (profile.email) {
    if (profile.email.length > 120) {
      errors.push("Email слишком длинный");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errors.push("Некорректный email");
    }
  }

  if (profile.phone) {
    const digits = profile.phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      errors.push("Некорректный номер телефона");
    }
  }

  if (profile.linkedin && profile.linkedin.length > 100) {
    errors.push("Ссылка LinkedIn слишком длинная");
  }

  // дополнительные контакты
  const contactFields = [
    "telegram", "github", "website",
    "twitter", "instagram", "facebook",
    "behance", "dribbble"
  ];

  contactFields.forEach(key => {
    if (profile[key] && profile[key].length > 100) {
      errors.push(`Поле ${key} слишком длинное`);
    }
  });

  if (profile.summary && profile.summary.length > 350) {
    errors.push("Описание слишком длинное (максимум 350 символов)");
  }

  return errors;
}

function validateExperienceData(experienceList) {
  const errors = [];

  experienceList.forEach((exp, i) => {
    if (!exp.company || !exp.company.trim()) {
      errors.push(`Опыт #${i + 1}: укажите компанию`);
    }

    if (!exp.position || !exp.position.trim()) {
      errors.push(`Опыт #${i + 1}: укажите должность`);
    }

    if (!exp.start_date || !exp.start_date.trim()) {
      errors.push(`Опыт #${i + 1}: укажите дату начала`);
    }

    // логика "работаю сейчас"
    const current = exp.current || !exp.end_date;

    if (!current) {
      if (!exp.end_date || !exp.end_date.trim()) {
        errors.push(`Опыт #${i + 1}: укажите дату окончания`);
      } else if (exp.start_date && exp.end_date < exp.start_date) {
        errors.push(`Опыт #${i + 1}: дата окончания раньше начала`);
      }
    }

    if (exp.city && exp.city.length > 80) {
      errors.push(`Опыт #${i + 1}: город слишком длинный`);
    }
    if (exp.technologies && exp.technologies.length > 350) {
      errors.push(`Опыт #${i + 1}: слишком длинный список технологий`);
    }
    if (exp.projects && exp.projects.length > 350) {
      errors.push(`Опыт #${i + 1}: слишком длинный список проектов`);
    }
    if (exp.description && exp.description.length > 350) {
      errors.push(`Опыт #${i + 1}: описание слишком длинное`);
    }
  });

  return errors;
}

function validateSkillsData(skills) {
  const errors = [];

  const levels = ["expert", "used", "familiar"];

  levels.forEach(level => {
    if (skills[level].length > 15) {
      errors.push(`В секции "${level}" слишком много навыков (максимум 15)`);
    }

    skills[level].forEach(name => {
      if (name.length > 30) {
        errors.push(`Навык "${name}" слишком длинный (максимум 30 символов)`);
      }
    });
  });

  return errors;
}

function validateEducationData(educationList) {
  const errors = [];

  educationList.forEach((edu, i) => {
    if (edu.start_date && edu.end_date && edu.end_date < edu.start_date) {
      errors.push(`Образование #${i + 1}: дата окончания раньше начала`);
    }

    if (edu.institution && edu.institution.length > 120) {
      errors.push(`Образование #${i + 1}: слишком длинное название`);
    }
    if (edu.degree && edu.degree.length > 120) {
      errors.push(`Образование #${i + 1}: слишком длинное значение`);
    }
    if (edu.city && edu.city.length > 80) {
      errors.push(`Образование #${i + 1}: слишком длинный город`);
    }
    if (edu.certificate_url && edu.certificate_url.length > 200) {
      errors.push(`Образование #${i + 1}: слишком длинная ссылка`);
    }
    if (edu.description && edu.description.length > 350) {
      errors.push(`Образование #${i + 1}: описание слишком длинное`);
    }
  });

  return errors;
}

function validateFullCV(cv) {
  const errors = [];

  errors.push(...validateProfileData(cv.cv_profile));
  errors.push(...validateExperienceData(cv.experience));

  const skillsByLevel = {
    expert: cv.skills.filter(s => s.level === "expert").map(s => s.name),
    used: cv.skills.filter(s => s.level === "used").map(s => s.name),
    familiar: cv.skills.filter(s => s.level === "familiar").map(s => s.name)
  };
  errors.push(...validateSkillsData(skillsByLevel));

  errors.push(...validateEducationData(cv.education));

  return errors;
}
