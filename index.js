let video;
let poseNet;
let poses = [];
let previousDrawingKeypoint;
let drawingCanvas;

const PART_RIGHT_WRIST = "rightWrist";
const PART_LEFT_WRIST = "leftWrist";
const PART_RIGHT_EAR = "rightEar";
const PART_LEFT_EAR = "leftEar";

let isDrawing = false;
let timeDrawingToggleChanged;
let lineColor = "#FE6B31";


const stringNotDrawingRightHanded = "[Not drawing]<br/>- Put your right hand at the starting position<br/>- Touch your face with your left hand to start drawing";
const stringDrawingRightHanded = "[Drawing]<br/>- Use your right hand to draw<br/>- Touch your face with your left hand to stop drawing";

const stringNotDrawingLeftHanded = "[Not drawing]<br/>- Put your left hand at the starting position<br/>- Touch your face with your right hand to start drawing";
const stringDrawingLeftHanded = "[Drawing]<br/>- Use your left hand to draw<br/>- Touch your face with your right hand to stop drawing";

let isRightHanded = true;

function setup() {
  const canvas = createCanvas(800, 600);
  canvas.parent("canvas-wrapper");

  drawingCanvas = createGraphics(width, height);

  background(102);

  video = createCapture(VIDEO);
  video.size(width, height);

  // Create a new poseNet method with a single detection
  poseNet = ml5.poseNet(
    video,
    {
      flipHorizontal: true,
      minConfidence: 0.5,
      maxPoseDetections: 1,
      scoreThreshold: 0.5,
      detectionType: "single",
    },
    modelReady
  );

  // This sets up an event that fills the global variable "poses"
  // with an array every time new poses are detected
  poseNet.on("pose", function (results) {
    poses = results;
  });
  // Hide the video element, and just show the canvas
  video.hide();

  isDrawing = false;
  select("#drawing-state").html(isRightHanded ? stringNotDrawingRightHanded:  stringNotDrawingLeftHanded);
  timeDrawingToggleChanged = millis();

  select("#erase").mouseClicked(() => {
    drawingCanvas.clear();
  });
  select("#download").mouseClicked(() => {
    saveCanvas(drawingCanvas, 'myPieceOfArt.jpg');
  });

  const colorPicker = select("#color-picker");
  colorPicker.changed(() => {
    lineColor = colorPicker.value()
  });

  const radioRightHanded = select("#radio-right-handed");
  const radioLeftHanded = select("#radio-left-handed");

  radioRightHanded.changed(() => {
    console.log(radioRightHanded.value());
    isRightHanded = true;
    updateDrawingInstructions();

  });
  radioLeftHanded.changed(() => {
    console.log(radioLeftHanded.value());
    isRightHanded = false;
    updateDrawingInstructions();

  });
}

function modelReady() {
  select("#loading").hide();
}

function draw() {
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  // We can call both functions to draw all keypoints and the skeletons
  // drawKeypoints();
  //   drawSkeleton();
  if (isDrawing) {
    drawLineFromDrawingKeypoint();
  }

  image(drawingCanvas, 0, 0, width, height);

  detectDrawingToggle();
}

// A function to draw ellipses over the detected keypoints
function drawKeypoints() {
  // Loop through all the poses detected
  for (let i = 0; i < poses.length; i += 1) {
    // For each pose detected, loop through all the keypoints
    const pose = poses[i].pose;
    for (let j = 0; j < pose.keypoints.length; j += 1) {
      // A keypoint is an object describing a body part (like rightArm or leftShoulder)
      const keypoint = pose.keypoints[j];
      // Only draw an ellipse is the pose probability is bigger than 0.2
      if (keypoint.score > 0.2) {
        fill(255, 0, 0);
        noStroke();
        ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
      }
    }
  }
}

// A function to draw the skeletons
function drawSkeleton() {
  // Loop through all the skeletons detected
  for (let i = 0; i < poses.length; i += 1) {
    const skeleton = poses[i].skeleton;
    // For every skeleton, loop through all body connections
    for (let j = 0; j < skeleton.length; j += 1) {
      const partA = skeleton[j][0];
      const partB = skeleton[j][1];
      stroke(255, 0, 0);
      line(
        partA.position.x,
        partA.position.y,
        partB.position.x,
        partB.position.y
      );
    }
  }
}

function drawLineFromDrawingKeypoint() {
  for (let i = 0; i < poses.length; i += 1) {
    const pose = poses[i].pose;
    const drawingKeypoint = pose[isRightHanded ? PART_RIGHT_WRIST : PART_LEFT_WRIST];

    if (drawingKeypoint && drawingKeypoint.confidence > 0.55) {
      if (previousDrawingKeypoint) {
        drawingCanvas.stroke(lineColor);
        drawingCanvas.strokeWeight(20);
        drawingCanvas.line(
          previousDrawingKeypoint.x,
          previousDrawingKeypoint.y,
          drawingKeypoint.x,
          drawingKeypoint.y
        );
      }

      previousDrawingKeypoint = drawingKeypoint;
    }
  }
}

function detectDrawingToggle() {
    const timeSinceDrawingToggleChanged = millis() - timeDrawingToggleChanged;
    if(timeSinceDrawingToggleChanged < 2 * 1000) {
        return;
    }
    for (let i = 0; i < poses.length; i += 1) {
        const pose = poses[i].pose;
        const nonDrawingKeypoint = pose[isRightHanded ? PART_LEFT_WRIST : PART_RIGHT_WRIST];
        const leftEar = pose[PART_LEFT_EAR];
        const rightEar = pose[PART_RIGHT_EAR];

        if (!nonDrawingKeypoint || (!leftEar && !rightEar)) {
            return;
        }

        if(nonDrawingKeypoint.confidence < 0.5) {
            return;
        }

        let minDistFromEars = 999999999999;
        if (leftEar) {
            const distFromLeftEar = Math.sqrt(Math.pow(leftEar.x - nonDrawingKeypoint.x, 2) - Math.pow(leftEar.y - nonDrawingKeypoint.y, 2));
            if(!isNaN(distFromLeftEar)) {
                minDistFromEars = distFromLeftEar < minDistFromEars ? distFromLeftEar : minDistFromEars;
            }
        }
        if(rightEar) {
            const distFromRightEar = Math.sqrt(Math.pow(rightEar.x - nonDrawingKeypoint.x, 2) - Math.pow(rightEar.y - nonDrawingKeypoint.y, 2));
            if(!isNaN(distFromRightEar)) {
                minDistFromEars = distFromRightEar < minDistFromEars ? distFromRightEar : minDistFromEars;
            }
        }
        if(minDistFromEars < 20) {
            console.log("Touching face");
            timeDrawingToggleChanged = millis();
            isDrawing = !isDrawing;
            previousDrawingKeypoint = undefined;

            updateDrawingInstructions();
        }
        
      }
}


function updateDrawingInstructions() {
  const drawingState = select("#drawing-state");
  drawingState.html(isDrawing ? (isRightHanded ? stringDrawingRightHanded :  stringDrawingLeftHanded) : (isRightHanded ? stringNotDrawingRightHanded :  stringNotDrawingLeftHanded));
  drawingState.removeClass(isDrawing ? "red-text" : "green-text");
  drawingState.addClass(isDrawing ? "green-text" :"red-text");
}
