const getCookie = (name) => {
  const cookies = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return cookies ? cookies.split("=")[1] : null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodedMessage = "QXV0b3I6IEl2YW4gQWx2YXJleiA=";

const afterUrlGenerator = (afterCursor) =>
  `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24","after":"${afterCursor}"}`;

const unfollowUserUrlGenerator = (userId) =>
  `https://www.instagram.com/web/friendships/${userId}/unfollow/`;

let followedPeople;
const csrftoken = getCookie("csrftoken");
const ds_user_id = getCookie("ds_user_id");
let initialURL = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;
let doNext = true;
const filteredList = [];
let getUnfollowCounter = 0;
let scrollCycle = 0;

const logProgress = () => {
  console.clear();
  console.log(
    `%c Progreso ${getUnfollowCounter}/${followedPeople} (${Math.floor(
      100 * (getUnfollowCounter / followedPeople)
    )}%)`,
    "background: #222; color: #bada55; font-size: 35px;"
  );
  console.log(
    `%cEstos usuarios no te siguen (Aún en progreso)`,
    "background: #222; color: #FC4119; font-size: 13px;"
  );
  filteredList.forEach((user) =>
    console.log(`https://instagram.com/${user.username}`)
  );
};

const fetchData = async (url) => {
  const response = await fetch(url);
  return response.json();
};

const unfollowUsers = async () => {
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
      await sleep(300000); // 5 minutos
    }

    console.log(`Dejaste de seguir a ${b}/${filteredList.length}`);
  }

  console.log(
    `%c ¡Todo HECHO!`,
    "background: #222; color: #bada55; font-size: 25px;"
  );
};

const startScript = async () => {
  while (doNext) {
    try {
      const data = await fetchData(initialURL);

      if (!followedPeople) followedPeople = data.data.user.edge_follow.count;

      doNext = data.data.user.edge_follow.page_info.has_next_page;
      initialURL = afterUrlGenerator(
        data.data.user.edge_follow.page_info.end_cursor
      );
      getUnfollowCounter += data.data.user.edge_follow.edges.length;

      data.data.user.edge_follow.edges
        .filter((edge) => !edge.node.follows_viewer)
        .forEach((edge) => filteredList.push(edge.node));

      logProgress();
      await sleep(Math.floor(400 * Math.random()) + 1000);
      scrollCycle++;

      if (scrollCycle > 6) {
        scrollCycle = 0;
        console.log(
          `%c Durmiendo 10 segundos para evitar ser bloqueado temporalmente`,
          "background: #222; color: #FF0000; font-size: 35px;"
        );
        await sleep(10000);
      }
    } catch (error) {
      console.error("Error al obtener datos:", error);
    }
  }

  console.clear();
  console.log(
    `%c ${filteredList.length} usuarios no te siguen`,
    "background: #222; color: #bada55; font-size: 25px;"
  );
  filteredList.forEach((user) =>
    console.log(`https://instagram.com/${user.username}`)
  );

  if (confirm("¿Quieres dejar de seguir a las personas que hemos listado?")) {
    await unfollowUsers();
  } else {
    console.log(
      `%c Listo!!`,
      "background: #222; color: #bada55; font-size: 25px;",
      `${encodedMessage}`
    );
  }
};

startScript();
