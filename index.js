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

const csrftoken = getCookie("csrftoken");
const ds_user_id = getCookie("ds_user_id");

const unfollowUserUrlGenerator = (userId) =>
  `https://www.instagram.com/web/friendships/${userId}/unfollow/`;

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

const fetchAllUsers = async (type, pageLimit, onProgress) => {
  const users = [];
  let nextMaxId;
  let pages = 0;
  let scrollCycle = 0;

  while (true) {
    const data = await fetchFriendshipsPage(type, nextMaxId);
    const pageUsers = data.users ?? [];
    users.push(...pageUsers);
    onProgress?.(users.length);

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
      console.log(
        `%c Durmiendo 10 segundos para evitar ser bloqueado temporalmente`,
        "background: #222; color: #FF0000; font-size: 35px;"
      );
      await sleep(10000);
    }
  }

  return users;
};

const logProgress = (followingCount, followersCount, nonFollowers) => {
  console.clear();
  console.log(
    `%c Progreso — siguiendo: ${followingCount} | seguidores: ${followersCount}`,
    "background: #222; color: #bada55; font-size: 28px;"
  );
  console.log(
    `%cEstos usuarios no te siguen (Aún en progreso)`,
    "background: #222; color: #FC4119; font-size: 13px;"
  );
  nonFollowers.forEach((user) =>
    console.log(`https://instagram.com/${user.username}`)
  );
};

const unfollowUsers = async (filteredList) => {
  let b = 0;
  let unfollowSleepCounter = 0;

  for (const user of filteredList) {
    try {
      await fetch(unfollowUserUrlGenerator(user.id), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": csrftoken,
        },
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error al dejar de seguir al usuario:", error);
    }

    await sleep(Math.floor(2000 * Math.random()) + 4000);
    b++;
    unfollowSleepCounter++;

    if (unfollowSleepCounter >= 5) {
      console.log(
        `%cDurmiendo 5 minutos para evitar ser bloqueado temporalmente`,
        "background: #222; color: #FF0000; font-size: 35px;"
      );
      unfollowSleepCounter = 0;
      await sleep(300000);
    }

    console.log(`Dejaste de seguir a ${b}/${filteredList.length}`);
  }

  console.log(
    `%c ¡Todo HECHO!`,
    "background: #222; color: #bada55; font-size: 25px;"
  );
};

const startScript = async () => {
  if (!ds_user_id) {
    console.error("No se encontró la cookie ds_user_id. Inicia sesión en Instagram.");
    return;
  }

  try {
    console.log(
      `%c Escaneando cuentas que sigues...`,
      "background: #222; color: #bada55; font-size: 25px;"
    );

    const followingRaw = await fetchAllUsers(
      "following",
      FOLLOWING_PAGE_SAFETY_LIMIT,
      (count) => {
        console.log(`Siguiendo cargados: ${count}`);
      }
    );

    if (followingRaw.length === 0) {
      console.error("No se pudo cargar tu lista de following.");
      return;
    }

    console.log(
      `%c Escaneando seguidores...`,
      "background: #222; color: #bada55; font-size: 25px;"
    );

    const followersRaw = await fetchAllUsers(
      "followers",
      FOLLOWERS_PAGE_SAFETY_LIMIT,
      (count) => {
        console.log(`Seguidores cargados: ${count}`);
      }
    );

    const followerIds = new Set(
      followersRaw.map((user) => String(user.pk_id ?? user.pk))
    );

    const results = followingRaw.map((user) =>
      toUserNode(user, followerIds.has(String(user.pk_id ?? user.pk)))
    );

    const filteredList = results.filter((user) => !user.follows_viewer);

    logProgress(results.length, followerIds.size, filteredList);

    console.clear();
    console.log(
      `%c ${filteredList.length} usuarios no te siguen`,
      "background: #222; color: #bada55; font-size: 25px;"
    );
    filteredList.forEach((user) =>
      console.log(`https://instagram.com/${user.username}`)
    );

    if (confirm("¿Quieres dejar de seguir a las personas que hemos listado?")) {
      await unfollowUsers(filteredList);
    } else {
      console.log(
        `%c Listo!!`,
        "background: #222; color: #bada55; font-size: 25px;",
        `${encodedMessage}`
      );
    }
  } catch (error) {
    console.error("Error al obtener datos:", error);
  }
};

startScript();
