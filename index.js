const INSTAGRAM_WEB_APP_ID = "936619743392459";
const USERS_PER_PAGE = 50;
const FOLLOWING_PAGE_SAFETY_LIMIT = 60;
const FOLLOWERS_PAGE_SAFETY_LIMIT = 250;

const getCookie = (name) => {
  const value = `; ${document.cookie}`.split(`; ${name}=`);
  if (value.length !== 2) return null;
  return value.pop().split(";").shift();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodedMessage = "QXV0b3I6IEl2YW4gQWx2YXJleiA=";

const ds_user_id = getCookie("ds_user_id");

const friendshipsUrlGenerator = (type, maxId, count = USERS_PER_PAGE) => {
  let url = `https://www.instagram.com/api/v1/friendships/${ds_user_id}/${type}/?count=${count}`;
  if (maxId !== undefined) {
    url += `&max_id=${encodeURIComponent(maxId)}`;
  }
  return url;
};

const fetchFriendshipsPage = async (type, maxId, count = USERS_PER_PAGE) => {
  const response = await fetch(friendshipsUrlGenerator(type, maxId, count), {
    credentials: "same-origin",
    headers: {
      "X-IG-App-ID": INSTAGRAM_WEB_APP_ID,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Instagram returned HTTP ${response.status} while fetching ${type}`
    );
  }

  return response.json();
};

const toUserNode = (user, followsViewer) => ({
  id: String(user.pk_id ?? user.pk),
  username: user.username,
  full_name: user.full_name ?? "",
  profile_pic_url: user.profile_pic_url,
  is_private: Boolean(user.is_private),
  is_verified: Boolean(user.is_verified),
  follows_viewer: followsViewer,
});

const createProgressUI = () => {
  const existing = document.getElementById("iu-progress-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "iu-progress-overlay";
  overlay.innerHTML = `
    <style>
      #iu-progress-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(8px);
        font-family: system-ui, -apple-system, sans-serif;
      }
      #iu-progress-card {
        width: min(420px, 90vw);
        padding: 28px 24px;
        border-radius: 16px;
        background: #1a1a1a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
        color: #fff;
      }
      #iu-progress-card h2 {
        margin: 0 0 6px;
        font-size: 1.15rem;
        font-weight: 700;
      }
      #iu-progress-label {
        margin: 0 0 18px;
        color: #a8a8a8;
        font-size: 0.9rem;
      }
      #iu-progress-track {
        height: 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }
      #iu-progress-fill {
        height: 100%;
        width: 0%;
        border-radius: 999px;
        background: linear-gradient(90deg, #22c55e, #4ade80);
        box-shadow: 0 0 14px rgba(74, 222, 128, 0.45);
        transition: width 0.35s ease;
      }
      #iu-progress-meta {
        display: flex;
        justify-content: space-between;
        margin-top: 12px;
        font-size: 0.85rem;
        color: #d4d4d4;
      }
      #iu-progress-percent {
        color: #4ade80;
        font-weight: 700;
      }
    </style>
    <div id="iu-progress-card">
      <h2 id="iu-progress-title">Escaneando</h2>
      <p id="iu-progress-label">Preparando…</p>
      <div id="iu-progress-track">
        <div id="iu-progress-fill"></div>
      </div>
      <div id="iu-progress-meta">
        <span id="iu-progress-count">0 usuarios</span>
        <span id="iu-progress-percent">0%</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector("#iu-progress-title");
  const labelEl = overlay.querySelector("#iu-progress-label");
  const fillEl = overlay.querySelector("#iu-progress-fill");
  const countEl = overlay.querySelector("#iu-progress-count");
  const percentEl = overlay.querySelector("#iu-progress-percent");

  return {
    update({ title, label, count, percent }) {
      if (title) titleEl.textContent = title;
      if (label) labelEl.textContent = label;
      if (typeof count === "number") {
        countEl.textContent = `${count} usuario${count === 1 ? "" : "s"}`;
      }
      const clamped = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
      fillEl.style.width = `${clamped}%`;
      percentEl.textContent = `${clamped}%`;
    },
    done(message) {
      titleEl.textContent = "Listo";
      labelEl.textContent = message;
      fillEl.style.width = "100%";
      percentEl.textContent = "100%";
    },
    remove() {
      overlay.remove();
    },
  };
};

const estimatePercent = (loaded, phaseStart, phaseEnd) => {
  const local = 100 * (1 - 1 / (1 + loaded / 150));
  return phaseStart + (local / 100) * (phaseEnd - phaseStart);
};

const fetchAllUsers = async (type, pageLimit, onProgress) => {
  const users = [];
  let nextMaxId;
  let pages = 0;
  let scrollCycle = 0;

  while (true) {
    const data = await fetchFriendshipsPage(type, nextMaxId);
    const pageUsers = data.users ?? [];
    users.push(...pageUsers);
    onProgress?.(users.length, pages + 1);

    const hasMore = Boolean(data.next_max_id) && data.has_more !== false;
    if (!hasMore || pageUsers.length === 0) break;

    pages += 1;
    if (pages >= pageLimit) {
      console.warn(
        `Stopping ${type} scan early: hit the safety cap of ${pageLimit} pages.`
      );
      break;
    }

    nextMaxId = data.next_max_id;
    await sleep(Math.floor(1500 * Math.random()) + 500);
    scrollCycle += 1;

    if (scrollCycle > 6) {
      scrollCycle = 0;
      onProgress?.(users.length, pages, true);
      await sleep(10000);
    }
  }

  return users;
};

const startScript = async () => {
  if (!ds_user_id) {
    console.error("No se encontró la cookie ds_user_id. Inicia sesión en Instagram.");
    return;
  }

  const progress = createProgressUI();

  try {
    progress.update({
      title: "Paso 1 de 2",
      label: "Cargando cuentas que sigues…",
      count: 0,
      percent: 0,
    });

    const followingRaw = await fetchAllUsers(
      "following",
      FOLLOWING_PAGE_SAFETY_LIMIT,
      (count, _pages, sleeping) => {
        progress.update({
          title: "Paso 1 de 2",
          label: sleeping
            ? "Pausa breve para evitar bloqueos…"
            : "Cargando cuentas que sigues…",
          count,
          percent: estimatePercent(count, 0, 45),
        });
      }
    );

    if (followingRaw.length === 0) {
      progress.remove();
      console.error("No se pudo cargar tu lista de following.");
      return;
    }

    progress.update({
      title: "Paso 2 de 2",
      label: "Cargando tus seguidores…",
      count: 0,
      percent: 45,
    });

    const followersRaw = await fetchAllUsers(
      "followers",
      FOLLOWERS_PAGE_SAFETY_LIMIT,
      (count, _pages, sleeping) => {
        progress.update({
          title: "Paso 2 de 2",
          label: sleeping
            ? "Pausa breve para evitar bloqueos…"
            : "Cargando tus seguidores…",
          count,
          percent: estimatePercent(count, 45, 95),
        });
      }
    );

    const followerIds = new Set(
      followersRaw.map((user) => String(user.pk_id ?? user.pk))
    );

    const results = followingRaw.map((user) =>
      toUserNode(user, followerIds.has(String(user.pk_id ?? user.pk)))
    );

    const filteredList = results.filter((user) => !user.follows_viewer);

    progress.done(`${filteredList.length} usuarios no te siguen`);
    await sleep(900);
    progress.remove();

    console.clear();
    console.log(
      `%c ${filteredList.length} usuarios no te siguen`,
      "background: #222; color: #bada55; font-size: 25px;"
    );
    filteredList.forEach((user) =>
      console.log(`https://instagram.com/${user.username}`)
    );

    alert(
      `Resumen: de las ${results.length} cuentas que sigues, ${filteredList.length} no te siguen de vuelta.`
    );
    console.log(
      `%c Listo!!`,
      "background: #222; color: #bada55; font-size: 25px;",
      `${encodedMessage}`
    );
  } catch (error) {
    progress.remove();
    console.error("Error al obtener datos:", error);
  }
};

startScript();
