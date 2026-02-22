const https = require("https");

const express = require("express");
const session = require("express-session");
const app = express();
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const fsext = require("fs-extra"); // To handle file copying and moving
const { v4: uuidv4 } = require("uuid");
const { genVideo, progressMap, genVideoASync, VALS } = require("./ffmpeg");
require("dotenv").config();

const SimplePropertiesDb = require("simple-properties-db");
const spd = new SimplePropertiesDb(path.join(__dirname, "db"));
console.log("🚀 ~ spd:", spd);

app.set("trust proxy", 1); // trust first proxy
app.use(
  cors({
    // origin: [
    //   "http://127.0.0.1:5500",
    //   "https://9615-211-118-132-210.ngrok-free.app",
    // ],
    origin: true,
    // methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);
app.use(
  session({
    secret: "@codestates",
    resave: false,
    saveUninitialized: true,

    proxy: true,
    cookie: {
      // domain: "localhost",
      // path: "/",
      // maxAge: 24 * 6 * 60 * 10000,
      sameSite: "none",
      httpOnly: !true,
      secure: true,
    },
  }),
  // session({
  //   secret: "@codestates",
  //   resave: false,
  //   saveUninitialized: true,
  //   cookie: {
  //     // domain: "localhost",
  //     // path: "/",
  //     // maxAge: 24 * 6 * 60 * 10000,
  //     // sameSite: "none",
  //     httpOnly: !true,
  //     secure: !true,
  //   },
  // })
);

// const upload = multer({ dest: 'uploads/' });

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "src/uploads/");
  },
  filename: function (req, file, cb) {
    let mimeType;

    switch (file.mimetype) {
      case "image/jpeg":
        mimeType = "jpg";
        break;
      case "image/png":
        mimeType = "png";
        break;
      case "image/gif":
        mimeType = "gif";
        break;
      case "image/bmp":
        mimeType = "bmp";
        break;
      default:
        mimeType = "jpg";
        break;
    }

    const outputFileName = `${Date.now()}-${uuidv4()}`;

    cb(null, outputFileName + "." + mimeType); //Appending .jpg
  },
});

var upload = multer({ storage: storage });

app.use(express.json());
// app.use(cors());

app.use(express.static(path.join(__dirname, "static")));

app.get("/ping", (req, res) => {
  console.log(req.session);
  console.log(req.session.id);
  console.log(req.sessionId);

  res.send({
    pong: true,
    session: req.session,
  });
});
app.get("/setv/:value", (req, res) => {
  console.log("🚀 ~ app.get ~ req.session:", req.session.id);

  value = req.params.value;
  console.log("🚀 ~ app.get ~ value:", value);
  req.session.userId = value;
  console.log("🚀 ~ app.get ~ req.session:", req.session);

  arr = req.session.arr || [];
  arr.push(value);

  req.session.arr = arr;

  res.send({
    pong: true,
    session: req.session,
  });
});

app.all("/api", upload.single("file"), async (req, res) => {
  // await new Promise((res) => setTimeout(res, 100));
  // return res.json({ a: 1 });

  const file = req.file;
  const paramMap = JSON.parse(req.body.paramMap);
  const sceneArr = paramMap.sceneArr;
  // console.log("🚀 ~ app.all ~ sceneArr:", sceneArr);

  if (!file) {
    res.status(400).send("No file uploaded");
    return;
  }

  console.log("🚀 ~ currentEncodingCount:", VALS);
  // Concurrency check
  if (VALS.CurrentEncodingCount >= VALS.MAX_CONCURRENT_ENCODING) {
    return res.status(400).json({
      error:
        "현재 진행중인 작업이 너무 만은거시에요~ cnt = " +
        VALS.CurrentEncodingCount +
        "",
    });
  }

  const backImgPath = path.join(req.file.path);
  const fileNm = await genVideoASync(sceneArr, backImgPath);

  const newData = {
    fileNm: fileNm,
    filePath: path.join(__dirname, "output", fileNm),
    backImgPath: backImgPath,
    sceneArr: sceneArr,
  };
  // here save to spd
  // const videoList = []
  const videoList = spd.get("video") || [];
  videoList.push(newData);
  spd.set("video", videoList);

  res.json({
    fileNm: fileNm,
  });

  // const returnFile = fs.readFileSync(outputFilePath);
  // res.setHeader("Content-Type", "video/mp4");
  // res.setHeader("Content-Disposition", "attachment; filename=ou1.mp4");
  // res.setHeader("Content-Length", returnFile.length);
  // res.end(returnFile);
});
app.get("/videos", (req, res) => {
  const videoList = spd.get("video") || [];
  res.json(videoList);
});

app.get("/progress/:fileNm", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const fileNm = req.params.fileNm;

  const interval = setInterval(() => {
    console.log(345, progressMap);
    const percent = progressMap[fileNm] || -1;

    res.write(`data: ${JSON.stringify({ percent })}\n\n`);
    if (percent >= 100) {
      res.write(`data: ${JSON.stringify({ percent })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on("close", () => clearInterval(interval));
});

app.delete("/video/:fileNm", (req, res) => {
  const fileNm = req.params.fileNm;
  let videoList = spd.get("video") || [];
  const idx = videoList.findIndex((v) => v.fileNm === fileNm);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  // Remove from DB
  const [removed] = videoList.splice(idx, 1);
  spd.set("video", videoList);

  // Remove video file
  try {
    if (removed.filePath && fs.existsSync(removed.filePath)) {
      fs.unlinkSync(removed.filePath);
    }
    // Remove background image if exists and is a file
    if (removed.backImgPath && fs.existsSync(removed.backImgPath)) {
      fs.unlinkSync(removed.backImgPath);
    }
  } catch (e) {
    // Ignore file errors
  }

  res.json({ ok: true });
});

app.get("/video/:fileNm", (req, res) => {
  const fileNm = req.params.fileNm;
  const filePath = path.join(__dirname, "output", fileNm);
  res.sendFile(filePath);
});

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({
  // model: "gemini-1.5-flash",
  model: "gemini-3-flash-preview",
  generationConfig: {
    // "temperature": 1,
    // "top_p": 0.95,
    // "top_k": 64,
    // "max_output_tokens": 8192,
    response_mime_type: "application/json",
  },
});

// p1_1: 내가 듣기로 너 요즘 컴퓨터 언어를 배우고 있다며, 맞아?
// p2_1: 응, 맞아.
// p1_2: 어떤 언어를 사용하고 있어?
// p2_2: C...
// p1_3: 오! C야, 아니면 C++야?
// p2_3: ChatGPT.
// p1_4: 정신 좀 차려.
// p1_5: 공부좀 더하자.
// p1_6: 친구야!!

const prompt = `
내가 농담 하나 할게. 플레이어1과 플레이어2가 있어. 플레이어1이 질문을 하고, 플레이어2가 대답을 해. 그런데 플레이어2의 대답이 너무 이상해서 플레이어1이 플레이어2를 벌주게 돼. 
예시를 보여줄게. 이제부터 플레이어1은 'p1', 플레이어2는 'p2'로 할게. 

p1_1: 내가 듣기로 너 요즘 컴퓨터 언어를 배우고 있다며, 맞아?
p2_1: 응, 맞아.
p1_2: 어떤 언어를 사용하고 있어?
p2_2: C...
p1_3: 오! C야, 아니면 C++야?
p2_3: ChatGPT.
p1_4: C++
p1_5: 자바
p1_6: 파이썬 이자식아!!

이런 형식의 농담을 하나 만들어줘
p2_2 에서 p2_3 로 가면서 완전히 반전이 되는게 포인트야! 첫 글자가 같거나 비슷한걸로 가도록해줘
말 하는 순서는 위와 정확히 똑같아야하고 
위처럼 총 9줄이어야해 순서가 정확히 똑같아야해 
꼭 컴퓨터 관련아니라 완전히 랜덤으로 해줘
결과값은 {"p1_1": "say1", "p2_1" : "say2", "p1_2": "say3", ...} 이런식으로 해줘

수위를 약간 강하게 해줘
거듭 이야기하지만 위랑 대화순서가 완전하게 일치해야해
`;

app.get("/genRandom", async (req, res) => {
  try {
    console.log("🚀 ~ process.env.GEMINI_KEY:", process.env.GEMINI_KEY);
    console.log("🚀 ~ process.env.GEMINI_KEY:", process.env.GEMINI_KEY);

    const result = await model.generateContent([prompt]).catch((err) => {
      console.log("🚀 ~gem  err:", err);
    });
    const textResult = result.response.text();
    console.log(textResult);
    const jsonResult = JSON.parse(textResult);
    console.log("🚀 ~ app.get ~ jsonResult:", jsonResult);
    res.json(jsonResult);
  } catch (error) {
    console.log(error);
    res.json({ error: error.message });
  }
});
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// const server = https
//   .createServer(
//     {
//       key: fs.readFileSync("./key.pem"),
//       cert: fs.readFileSync("./cert.pem"),
//     },
//     app
//   )
//   .listen(3333, () => {
//     console.log("Server is running on port 3000");
//   });

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Prevent server from crashing on uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally: notify admin or log to a file
});

// Prevent server from crashing on unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  // Optionally: notify admin or log to a file
});
