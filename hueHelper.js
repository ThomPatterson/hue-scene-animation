const axios = require('axios');
const config = process.env.hasOwnProperty('CONFIG') ? JSON.parse(process.env.CONFIG) : require('./config.js');


const localHueApi = axios.create({
  baseURL: `http://${config.HUE_BRIDGE_ADDRESS}/api/${config.HUE_BRIDGE_USERNAME}`,
  headers: {
    'Content-Type': 'application/json'
  }
});


//returns an object where key is groupID and value is the name of the room
const getRoomList = async () => {
  let response = await localHueApi.get('/groups');
  let rooms = {}
  for (let [key, value] of Object.entries(response.data)) {
    if (value.type.toLowerCase() == 'room') {
      rooms[key] = value.name;
    }
  }
  return rooms;
}

//returns an array of scenes
const getSceneList = async () => {
  let response = await localHueApi.get('/scenes');
  let scenes = [];
  for (let [key, value] of Object.entries(response.data)) {
    if (value.type.toLowerCase() == 'groupscene') {
      scenes.push({
        sceneId: key,
        name: value.name,
        groupId: value.group
      });
    }
  }
  return scenes;
}

const getSceneLightStates = async (sceneId) => {
  let response = await localHueApi.get(`/scenes/${sceneId}`);
  return response.data.lightstates;
}

const getLightNames = async () => {
  let response = await localHueApi.get('/lights');
  let lights = {}
  for (let [key, value] of Object.entries(response.data)) {
    lights[key] = value.name;
  }
  return lights;
}



const getRoomSceneList = async () => {
  let rooms = await getRoomList();
  let scenes = await getSceneList();

  //correlate scenes to rooms
  let updatedScenes = scenes.map(scene => {
    let room = rooms[scene.groupId]
    return {
      ...scene,
      room
    }
  });

  return updatedScenes;
}


const sortSceneLights = async (initialLightStates, roomGroupId) => {
  //get the ids of the lights
  let lightIdsInScene = Object.keys(initialLightStates);

  //check if this room has an override in the config
  if (config.hasOwnProperty('ROOM_LIGHT_ORDER_OVERRIDES')) {
    let i = config.ROOM_LIGHT_ORDER_OVERRIDES.findIndex(room => room.group == roomGroupId);
    if (i > -1) {
      //verify light IDs in override match light IDs in initialLightStates
      let a = [...config.ROOM_LIGHT_ORDER_OVERRIDES[i].lightsOrder];
      let b = [...lightIdsInScene];
      if (a.sort().join('-') == b.sort().join('-')) {
        return sortSceneLightsByOverride(initialLightStates, config.ROOM_LIGHT_ORDER_OVERRIDES[i].lightsOrder);
      } else {
        console.log(`Room with groupID=${roomGroupId} has override, but light IDs don't match what was found in the scene (${JSON.stringify(lightIdsInScene)})`);
      }
    }
  }

  return await sortSceneLightsByName(initialLightStates);
}

/*
  sort the lights in a scene as specfied by the config file
*/
const sortSceneLightsByOverride = (initialLightStates, lightsOrder) => {
  let sortedInitialLightStates = {}

  lightsOrder.forEach(lightId => {
    sortedInitialLightStates[`id-${lightId}`] = initialLightStates[lightId];
  });
  console.log('sorted by override');

  return sortedInitialLightStates;
}

/*
  hue light IDs won't necessarily be in the same order as the lights are installed
  e.g.
  16 = Dining 4
  17 = Dining 1
  18 = Dining 3
  19 = Dining 2
  20 = Dining 5

  assuming that the user named their lights sequentially, sort the lights in the
  lightstates to correspond to the order the lights are actually installed in
*/
const sortSceneLightsByName = async (initialLightStates) => {
  //get the ids of the lights
  let lightIdsInScene = Object.keys(initialLightStates);
  let lightNames = await getLightNames();
  let lightsInScene = lightIdsInScene.map(lightId => lightNames[lightId]);
  lightsInScene.sort();

  let sortedInitialLightStates = {}

  lightsInScene.forEach(lightName => {
    //figure out which ID is associated with this name
    let lightId;
    lightIdsInScene.forEach(id => {
      if (lightNames[id] == lightName) {
        lightId = id;
      }
    });

    //order isn't maintained with numeric keys, so prefix with id- and strip it off later
    sortedInitialLightStates[`id-${lightId}`] = initialLightStates[lightId];
  });

  console.log('sorted by name');

  return sortedInitialLightStates;
}

const setColors = (lightIdArr, colorStateArr, transitiontime) => {
  let i = 0;
  lightIdArr.forEach((prefixedLightId) => {
    let lightId = prefixedLightId.split('-')[1];
    localHueApi.put(`/lights/${lightId}/state`, {
      ...colorStateArr[i++],
      transitiontime
    });
  });
}

module.exports = {
  getRoomSceneList,
  getSceneLightStates,
  sortSceneLights,
  setColors
}
