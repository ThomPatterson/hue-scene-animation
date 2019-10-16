document.addEventListener("DOMContentLoaded", async (event) => {
  initialLoad();
});

let roomScenes = [];

const initialLoad = async () => {
  let response = await fetch('/scenes');
  roomScenes = await response.json();

  let uniqueRooms = new Set(roomScenes.map(roomScene => roomScene.room));
  if (uniqueRooms.has(undefined)) {
    uniqueRooms.delete(undefined);
  }

  //populate the rooms drop down
  createRoomDropdown(uniqueRooms);

  //show scenes for the first room
  showScenesForRoom(Array.from(uniqueRooms)[0]);

  //show any running animations
  await updateRunningList();

  //attach events
  document.getElementById('startAnimation').addEventListener('click', startAnimation);
  document.getElementById('stopAnimation').addEventListener('click', stopAnimation);
}

const createRoomDropdown = (roomSet) => {
  let roomSelect = document.getElementById('roomList');

  roomSet.forEach(room => {
    let option = document.createElement('option');
    option.value = room;
    option.innerText = room;
    roomSelect.appendChild(option);
  });

  roomSelect.addEventListener('change', (event) => {
    let selectedRoom = event.target.value;
    showScenesForRoom(selectedRoom);
  });
}

const showScenesForRoom = (room) => {
  let filteredRoomScenes = roomScenes.filter(roomScene => roomScene.room==room);

  //clear any existing
  let sceneSelect = document.getElementById('sceneList');
  sceneSelect.innerHTML = '';

  filteredRoomScenes.forEach(roomScene => {
    let option = document.createElement('option');
    option.value = roomScene.sceneId;
    option.innerText = roomScene.name;
    sceneSelect.appendChild(option);
  });
}

const updateRunningList = async () => {
  let response = await fetch('/existingAnimations');
  let runningAnimations = await response.json();

  let runningList = document.getElementById('runningList');
  runningList.innerHTML = '';

  runningAnimations.forEach(anim => {
    let option = document.createElement('option');
    option.value = anim.id;
    option.innerText = `${anim.roomName} - ${anim.sceneName}`;
    runningList.appendChild(option);
  });
}

const startAnimation = async () => {
  let sceneId = document.getElementById('sceneList').value;
  let animation = document.getElementById('animationList').value;
  let transitionTime = document.getElementById('transitionTime').value;
  let transitionDelay = document.getElementById('transitionDelay').value;

  //convert seconds to increments of 100ms
  transitionTime = parseInt(transitionTime) * 10;
  transitionDelay = parseInt(transitionDelay) * 10;

  //do it TODO: error checking :)
  await fetch(`/startAnimation?sceneid=${sceneId}&animation=${animation}&transitiontime=${transitionTime}&transitiondelay=${transitionDelay}`);

  //update the list of running animations
  await updateRunningList();
}

const stopAnimation = async () => {
  let animationId = document.getElementById('runningList').value;

  //do it TODO: error checking :)
  await fetch(`/stopAnimation?id=${animationId}`);

  //update the list of running animations
  await updateRunningList();
}
