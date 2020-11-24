var SpeechRecognition =
  SpeechRecognition || window.webkitSpeechRecognition || null;
var SpeechRecognitionEvent =
  SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent || null;

let face = "",
  text = "",
  hat = "",
  loc = [0, 0];
let model, webcam, recognition, socket;
let users = {};
let user_divs = {};

function update() {
  if (!socket) {
    return;
  }
  socket.emit("update", { loc: loc, face: face, text: text });
}

let colors = [
  "#ff6347",
  "#ff6d3c",
  "#ff7732",
  "#ff8127",
  "#ff8b1c",
  "#ff9512",
  "#ff9e07",
  "#ffa800",
  "#ffaf00",
  "#ffb700",
  "#ffbe00",
  "#ffc600",
  "#ffcd00",
  "#ffd500",
  "#e6db0f",
  "#bfe027",
  "#99e53e",
  "#73ea55",
  "#4df06c",
  "#26f583",
  "#00fa9a",
  "#00e896",
  "#00d592",
  "#00c38e",
  "#00b18a",
  "#009f87",
  "#008c83",
  "#007a86",
  "#006699",
  "#0053ac",
  "#0040c0",
  "#002dd3",
  "#001ae6",
  "#0006f9"
];

function getIdx(id, max_val) {
  var hash = 0,
    i,
    chr;
  for (i = 0; i < id.length; i++) {
    chr = id.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash % max_val);
}

function render() {
  document.body.style.backgroundPosition = -loc[0] + "px " + -loc[1] + "px";
  for (let user_id in users) {
    let user = users[user_id];
    if (Date.now() > user.time + 5000) {
      delete users[user.id];
      user_divs[user.id].remove();
      delete user_divs[user.id];
      continue;
    }
    let off_x = user.loc[0] - loc[0];
    let off_y = user.loc[1] - loc[1];
    if (!(user.id in user_divs)) {
      user_divs[user.id] = document.createElement("div");
      user_divs[user.id].style.color = colors[getIdx(user.id, colors.length)];
      //"hsl(" + getIdx(user.id, 36) * 10 + ",100%, 30%)";

      let face = document.createElement("pre");
      let text = document.createElement("code");

      user_divs[user.id].style.position = "absolute";
      face.classList.add("face");
      text.classList.add("text");

      user_divs[user.id].appendChild(face);
      user_divs[user.id].appendChild(text);

      document.body.appendChild(user_divs[user.id]);
    }

    user_divs[user.id].children[0].textContent = user.face;
    user_divs[user.id].children[1].textContent = user.text;
    let rect = user_divs[user.id].getBoundingClientRect();
    user_divs[user.id].style.left =
      window.innerWidth / 2 + off_x - rect.width / 2;
    user_divs[user.id].style.top =
      window.innerHeight / 2 + off_y - rect.height / 2;
  }
}

function init_sockets() {
  socket = io.connect();
  socket.on("update", function(d) {
    users[d.id] = d;
    render();
  });
}

async function init_facemodel() {
  tf.setBackend("wasm");
  //setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@2.4.0/dist/`);

  model = await faceLandmarksDetection.load(
    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
  );
}

async function init_webcam() {
  // Convenience function to setup a webcam
  webcam = new tmImage.Webcam(200, 200, false); // width, height, flip
  await webcam.setup(); // request access to the webcam
  document.getElementById("webcam-container").appendChild(webcam.webcam);
  for (let i = 0; i < 100; ++i) {
    document
      .getElementById("webcam-container")
      .prepend(document.createElement("br"));
  }
  let wc = document.getElementsByTagName("video")[0];
  wc.setAttribute("playsinline", true);
  wc.muted = "true";
  wc.id = "webcamVideo";
  await webcam.play();
}

function init_speech() {
  if (!SpeechRecognition) {
    document.getElementById("user").children[1].innerHTML =
      "[use chrome/firefox]";
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let timeout = null;
  recognition.onresult = function(event) {
    let results = event.results;
    let idx = results.length - 1;
    let res = results[idx];
    let str = "";
    for (let i of res) {
      str += i.transcript;
    }
    str = str.trim();

    if (timeout) {
      clearTimeout(timeout);
    }
    if (text != str) {
      text = str;
      update();
    }
    if (res.isFinal) {
      if (str == "give me a hat") {
        hat = prompt("please enter your 3 character hat");
        if (hat.length != 3) {
          alert("that's not three characters!");
        }
      }
      str = "<b>" + str + "</b>";
    }

    document.getElementById("user").children[1].innerHTML = str;

    timeout = setTimeout(function() {
      document.getElementById("user").children[1].textContent = "";
      update();
    }, Math.max(str.split(" ").length * 500, 2000));
  };
  recognition.onend = function() {
    recognition.start();
  };
  recognition.start();
}

function init_bindings() {
  document.addEventListener("keydown", function(d) {
    let dont_update = false;
    let incr = 10;
    if (d.key == "ArrowDown") {
      loc[1] += incr;
    } else if (d.key == "ArrowUp") {
      loc[1] -= incr;
    } else if (d.key == "ArrowLeft") {
      loc[0] -= incr;
    } else if (d.key == "ArrowRight") {
      loc[0] += incr;
    } else {
      dont_update = true;
    }
    if (!dont_update) {
      render();
      update();
    }
  });
}

// Load the image model and setup the webcam
async function init(target) {
  target.disabled = true;
  target.textContent = "initializing network...";
  init_sockets();

  target.textContent = "downloading model...";
  await init_facemodel();

  target.textContent = "activating webcam...";
  await init_webcam();

  target.textContent = "initializing speech recognition...";
  init_speech();

  target.textContent = "initializing key bindings...";
  init_bindings();

  target.textContent = "starting...";

  window.requestAnimationFrame(loop);
  document.getElementById("webcam-container").appendChild(webcam.canvas);
  target.remove();
  update();
}

async function loop() {
  webcam.update();
  await predict();
  window.requestAnimationFrame(loop);
}

async function predict() {
  const predictions = await model.estimateFaces({
    input: webcam.canvas
  });
  let norm = (p0, p1) => {
    let d0 = p0[0] - p1[0];
    let d1 = p0[1] - p1[1];
    let d2 = p0[2] - p1[2];
    return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
  };

  let str = "";

  for (let i = 0; i < predictions.length; i++) {
    const keypoints = predictions[i].scaledMesh;
    let closed_right =
      norm(keypoints[159], keypoints[145]) * 2 <
      norm(keypoints[158], keypoints[160]);
    let closed_left =
      norm(keypoints[386], keypoints[374]) * 2 <
      norm(keypoints[387], keypoints[385]);
    let mouth = norm(keypoints[13], keypoints[14]);
    let closed_mouth = norm(keypoints[13], keypoints[12]);
    let wide_mouth = norm(keypoints[308], keypoints[78]) / 1.2;
    let m_str = mouth < closed_mouth ? "-" : mouth > wide_mouth ? "O" : "o";
    if (str.length) {
      str += "  ";
    }
    str += (closed_left ? "-" : "*") + m_str + (closed_right ? "-" : "*");
    if (hat) {
      str = hat + "\n" + str;
    }
  }

  document.getElementById("user").children[0].textContent = str;
  if (face != str) {
    face = str;
    update();
  }
}
