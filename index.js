const express = require('express');
const app = express();
const uuid = require('short-uuid');
const hueHelper = require('./hueHelper.js');

const config = process.env.hasOwnProperty('CONFIG') ? JSON.parse(process.env.CONFIG) : require('./config.js');
let supportedAnimationTypes = ['forward', 'backward', 'evenodd'];
let existingAnimations = [];


const startAnimation = (initialLightStates, transitionTime, transitionDelay, animation, roomScene) => {
  let lightIdArr = Object.keys(initialLightStates);
  let colorStateArr = Object.values(initialLightStates);

  if (animation == 'evenodd') {
    colorStateArr = flipEvenOdd(colorStateArr);
  }

  hueHelper.setColors(lightIdArr, colorStateArr, 0);

  let intervalTimeout = setInterval(() => { //node handles interval returns different from browsers
    //rotate colors
    if (animation == 'forward') {
      colorStateArr = rotateForward(colorStateArr);
    } else if (animation == 'backward') {
      colorStateArr = rotateBackward(colorStateArr);
    } else if (animation == 'evenodd') {
      colorStateArr = flipEvenOdd(colorStateArr);
    }

    //set new colors
    hueHelper.setColors(lightIdArr, colorStateArr, transitionTime);
  }, transitionDelay * 100);

  existingAnimations.push({
    id: uuid.generate(),
    intervalTimeout,
    sceneName: roomScene.name,
    roomName: roomScene.room
  });
}

const stopAnimation = (existingAnimationIndex) => {
  clearInterval(existingAnimations[existingAnimationIndex].intervalTimeout);
  existingAnimations = [
    ...existingAnimations.slice(0, existingAnimationIndex),
    ...existingAnimations.slice(existingAnimationIndex+1, existingAnimationIndex.length)
  ]
}



const rotateForward = (colorStateArr) => {
  return [colorStateArr.pop(), ...colorStateArr];
}

const rotateBackward = (colorStateArr) => {
  colorStateArr.push(colorStateArr.shift());
  return colorStateArr;
}

//takes the first color and applies it to all even number lights
//takes the second color and applies it to all odd number lights
const flipEvenOdd = (colorStateArr) => {
  let firstColorState = colorStateArr[0];
  let secondColorState = colorStateArr[1];
  let newLightStateArr = [];
  for (let i = 0; i < colorStateArr.length; i++) {
    if (i % 2 == 0) {
      newLightStateArr.push(secondColorState);
    } else {
      newLightStateArr.push(firstColorState);
    }
  }
  return newLightStateArr;
}








app.get('/scenes', async (req, res) => {
  let roomSceneList = await hueHelper.getRoomSceneList();
  return res.send(roomSceneList);
});

app.get('/startAnimation', async (req, res) => {
  try {
    let sceneId = (req.query.hasOwnProperty('sceneid')) ? req.query.sceneid : false;
    let transitionTime = (req.query.hasOwnProperty('transitiontime')) ? parseInt(req.query.transitiontime) : config.DEFAULT_TRANSITION_TIME;
    let transitionDelay = (req.query.hasOwnProperty('transitiondelay')) ? parseInt(req.query.transitiondelay) : config.DEFAULT_TRANSITION_DELAY;
    let animation = (req.query.hasOwnProperty('animation')) ? req.query.animation.toLowerCase() : config.DEFAULT_ANIMATION;

    if (!sceneId) {
      return res.status(400).send('Missing required parameter: sceneId');
    }

    let roomSceneList = await hueHelper.getRoomSceneList();
    let roomScene = roomSceneList.find(roomScene => roomScene.sceneId == sceneId);
    if (!roomScene) {
      return res.status(400).send(`sceneid ${sceneId} does not match any known scene.  Value must me one of:\n\n${JSON.stringify(roomSceneList, null, 2)}`);
    }

    if (supportedAnimationTypes.indexOf(animation) < 0) {
      return res.status(400).send(`animation must be one of: ${supportedAnimationTypes.join(', ')}`);
    }

    let initialLightStates = await hueHelper.getSceneLightStates(sceneId);
    let sortedInitialLightStates = await hueHelper.sortSceneLights(initialLightStates);

    if (animation == 'evenodd') {
      if (initialLightStates.length < 2) {
        return res.status(400).send('evenodd animation requires at least 2 lights in scene');
      }
    }

    //stop any animations already running for this roomName
    let existingAnimationIndex = existingAnimations.findIndex(anim => anim.roomName==roomScene.room);
    if (existingAnimationIndex > -1) {
      stopAnimation(existingAnimationIndex);
    }

    startAnimation(sortedInitialLightStates, transitionTime, transitionDelay, animation, roomScene);

    res.send("done");

  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

app.get('/existingAnimations', async (req, res) => {
  let cleanedExistingAnimations = existingAnimations.map(anim => {
    return {
      id: anim.id,
      sceneName: anim.sceneName,
      roomName: anim.roomName
    }
  });
  return res.send(cleanedExistingAnimations);
});

app.get('/stopAnimation', async (req, res) => {
  let id = (req.query.hasOwnProperty('id')) ? req.query.id : false;

  if (!id) {
    return res.status(400).send('Missing required parameter: id');
  }

  let existingAnimationIndex = existingAnimations.findIndex(anim => anim.id==id);
  if (existingAnimationIndex < 0) {
    return res.status(400).send(`id ${id} not recognized as an existing animation`);
  }

  stopAnimation(existingAnimationIndex);

  res.send("done");
});

app.use(`/ui`, express.static('ui'));

//fire it up
app.listen(8080);
console.log('Listening on port 8080');
