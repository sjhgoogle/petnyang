const { spawn } = require("child_process");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dayjs = require("dayjs");
const progressMap = {}; // { [fileNm]: percent }
const durationMap = {}; // Add this if you don't have it

function genFFmpegArgs(args, isSmallVm = false) {
  if (!isSmallVm) {
    return spawn("ffmpeg", args);
  } else {
    const safeArgs = args.includes("-threads")
      ? args
      : [...args, "-threads", "1"];
    const process = spawn("nice", [
      "-n",
      "19", // Lowest CPU priority
      "ionice",
      "-c3", // Lowest IO priority
      "ffmpeg",
      ...safeArgs,
    ]);
    return process;
  }
}

function executeFFmpeg(args, outputFileName) {
  return new Promise((resolve, reject) => {
    const isSmallVm = !true;
    const ffmpegProcess = genFFmpegArgs(args, isSmallVm);
    let stderrBuffer = "";

    ffmpegProcess.stdout.on("data", (data) => {});

    ffmpegProcess.stderr.on("data", (data) => {
      const str = data.toString();
      // console.log(str); // FFmpeg 로그 전체를 콘솔에 출력 (디버깅용)
      // console.log("----divide----");
      stderrBuffer += str; // 새로 받은 데이터를 버퍼에 누적

      // 디버깅을 위해 FFmpeg 로그 조각을 그대로 출력합니다.
      // 실제 운영 환경에서는 이 로그가 너무 많아질 수 있으므로 주의하거나 필요에 따라 제거하세요.
      console.log(str.trim()); // trim()으로 공백 제거

      // 1. 메인 비디오의 Duration 파싱 (가장 먼저 발견되는 Duration 사용)
      // durationMap[outputFileName]이 아직 설정되지 않았을 때만 파싱을 시도합니다.
      // 'Input #0'이 직접적으로 보이지 않더라도, FFmpeg는 첫 번째 입력 파일의 Duration을 먼저 출력합니다.
      if (!durationMap[outputFileName]) {
        // 전체 stderrBuffer에서 'Duration:' 패턴을 찾습니다.
        // 가장 먼저 발견되는 'Duration'이 메인 비디오의 길이일 가능성이 높습니다.
        const durationMatch = stderrBuffer.match(
          /Duration: (\d+):(\d+):([\d.]+)/
        );

        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          durationMap[outputFileName] = hours * 3600 + minutes * 60 + seconds;
          console.log(
            `[FFmpeg] '${outputFileName}'의 총 길이: ${durationMap[
              outputFileName
            ].toFixed(2)} 초 (로그에서 첫 번째 발견된 Duration 사용)`
          );
          // Duration을 찾았으면, 버퍼의 이전 내용을 잘라내어 메모리 사용량을 최적화할 수 있습니다.
          // 하지만 Duration은 초기에만 필요하므로 필수는 아닙니다.
          // stderrBuffer = stderrBuffer.substring(stderrBuffer.indexOf(durationMatch[0]) + durationMatch[0].length);
        }
      }

      // 2. 현재 처리 시간(time) 파싱 및 진행률 계산
      // 'time=' 정보는 각 'frame=' 라인에 포함되어 있으므로, 현재 받은 'str'에서 바로 찾습니다.
      const timeMatch = str.match(/time=(\d+):(\d+):([\d.]+)/);
      if (durationMap[outputFileName] && timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseFloat(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;

        const percent = Math.min(
          100,
          Math.round((currentTime / durationMap[outputFileName]) * 100)
        );

        // 진행률이 이전과 다를 때만 업데이트하여 불필요한 로그를 줄입니다.
        if (progressMap[outputFileName] !== percent) {
          progressMap[outputFileName] = percent;
          console.log(
            `[FFmpeg Progress] '${outputFileName}': ${progressMap[outputFileName]}%`
          );

          // 여기서 WebSocket 등을 통해 클라이언트에게 진행률을 전송하는 로직을 추가할 수 있습니다.
          // 예: socket.emit('ffmpegProgress', { file: outputFileName, progress: percent });
        }
      }
      console.log(1323, progressMap);
    });

    ffmpegProcess.on("close", (code) => {
      // progressMap[fileNm] = 100;

      if (code === 0) {
        console.log("FFmpeg process completed successfully");
        progressMap[outputFileName] = 101; // 수동으로 100%로 설정
        resolve();
      } else {
        console.error(`FFmpeg process exited with code ${code}`);
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    ffmpegProcess.on("error", (error) => {
      console.error(`FFmpeg process error: ${error.message}`);
      reject(error);
    });
  });
}

const GREEN_VIDEO = path.join(__dirname, "videos/cat-concat.mp4");
const BACK_IMG = path.join(__dirname, "videos/back2.jpg");
const OUTPUT_VIDEO = path.join(__dirname, "output/ou1.mp4");

// dev상태거나 윈도우에서는 슬래쉬 치환
let FONT_PATH = "";
const FONT_DIR = path.join(__dirname, "fonts/BMJUA_TTF.TTF");
// if is window replace
if (process.platform === "win32") {
  FONT_PATH = FONT_DIR.replace(/\\/g, "/");
} else {
  FONT_PATH = FONT_DIR;
}

// const DEFAULT_OPTION = ""

const DEFAULT_OPTION = `fontsize=48:fontcolor=white:fontfile='${FONT_PATH}':box=1:boxcolor=black@0.5:boxborderw=5`;
const LINE_GAP = 70;

/**
 * 옵션 - 순서가 바뀌면 안되는경우가 있음 기준모르겠음 enable이 일단뒤로감
 * text fontfile DEFAULT(fontsize fontcolor fontfile box boxcolor boxborderw) enable
 */

const Q1Opt = {
  mentArr: ["어제 애니봤어?", "몇시에 잤어?", "오쪼라고ss"],
  initPos: { xPos: 10, yPos: 700 },
  timeSlice: { start: 0.1, end: 2 },
};
const A1Opt = {
  mentArr: ["11시..."],
  initPos: { xPos: "(w-text_w-10)", yPos: 700 },
  timeSlice: { start: 2.5, end: 3.5 },
};
const Q2Opt = {
  mentArr: ["일찍 잤는데", "왜 계속 졸아?"],
  initPos: { xPos: 10, yPos: 700 },
  timeSlice: { start: 4, end: 8 },
};
const A2Opt = {
  mentArr: ["오..."],
  initPos: { xPos: "(w-text_w-10)", yPos: 700 },
  timeSlice: { start: 8, end: 11 },
};
const A22Opt = {
  mentArr: ["오전..."],
  initPos: { xPos: "(w-text_w-10)", yPos: 700 },
  timeSlice: { start: 11, end: 11.5 },
};

const P1Opt = {
  mentArr: ["줘팸1..."],
  initPos: { xPos: "10", yPos: 1000 },
  timeSlice: { start: 12.5, end: 20 },
};
const P2Opt = {
  mentArr: ["줘팸2..."],
  initPos: { xPos: "10", yPos: 1100 },
  timeSlice: { start: 13, end: 20 },
};
const P3Opt = {
  mentArr: ["줘팸3..."],
  initPos: { xPos: "10", yPos: 1200 },
  timeSlice: { start: 13.5, end: 20 },
};

/**
 * 멘트가 엔터키로 여러줄일때 적당한 LINE_GAP으로 살짝띄운 스크립트를 반환해준다
 *
 * mentArr: ["어제 애니봤어?", "몇시에 잤어?", "오쪼라고"],
 * initPos: { xPos:10, yPos: 700 },
 * timeSlice: { start: 0.1, end: 2 },
 *
 * 일경우 3줄의 drawtext 스크립트를 반환
 *
 * [
 *  '`drawtext=text='zbzbz':fontfile='C:/Windows/Fonts/HMKMRHD.TTF':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`,
 *  '`drawtext=text='!한글!조아!':fontfile='${FONT_PATH}':fontcolor=white:fontsize=24:x=(w-text_w)/3:y=(h-text_h)/2,drawtext=text='Custom Font':fontfile='C:/Windows/Fonts/HMKMRHD.TTF':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='!!한글!조아!':fontfile='${FONT_PATH}':fontcolor=white:fontsize=24:x=(w-text_w)/5:y=(h-text_h)/2`,
 *  '`drawtext=text='!한글!조아!':x=10:y=700:${DEFAULT_OPTION}:enable='between(t,2.5,3.5)'`,
 * ]
 */
function multiScriptMaker(scene) {
  const { mentArr, initPos, timeSlice } = scene;

  const multipleScripts = mentArr.map((ment, idx) => {
    const combinedDrawText =
      `drawtext=text='${ment}'` +
      `:x=${initPos.xPos}:y=${initPos.yPos + idx * LINE_GAP}` +
      `:${DEFAULT_OPTION}` +
      `:enable='between(t,${timeSlice.start},${timeSlice.end})'`;

    return combinedDrawText;
  });
  return multipleScripts;
}

// ```
// ffmpeg
// -i C:\Users\user\Desktop\project\private\petnyang\src\videos\cat-concat.mp4
// -i C:\Users\user\Desktop\project\private\petnyang\src\videos\backz.jpg
// -ss 0 -t 20
// -filter_complex
//   [1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[bg1080]
//   ;[0:v]colorkey=0x00FE00:0.4:0.05[nuggi]
//   ;[bg1080][nuggi]overlay=(W-w)/2:(H-h)/2[bg_concat]
//   ;[bg_concat]
//     drawtext=text='undefined':x=10:y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,0.1,2)'
//     ,drawtext=text='11시...':x=(w-text_w-10):y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,2.5,3.5)'
//     ,drawtext=text='q22 안녕@@':x=10:y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,4,8)'
//     ,drawtext=text='오...':x=(w-text_w-10):y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,8,11)'
//     ,drawtext=text='오전...':x=(w-text_w-10):y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,11,11.5)'
//     ,drawtext=text='줘팸1...':x=10:y=1000:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,12.5,20)'
//     ,drawtext=text='줘팸2...':x=10:y=1100:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,13,20)'
//     ,drawtext=text='줘팸3...':x=10:y=1200:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,13.5,20)'
// C:\Users\user\Desktop\project\private\petnyang\src\output\ou1.mp4 -y

// ```;
/**
   * 
   * @param {*} sceneArr 
   * @param {*} backImgPath 
   * @param {*} outputFileName 
   * @returns 
   * 
   * -i C:\Users\user\Desktop\project\private\petnyang\src\videos\cat-concat.mp4
    -i C:\Users\user\Desktop\project\private\petnyang\src\videos\backz.jpg
    -ss 0 -t 20
    -filter_complex
      [1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[bg1080]
      ;[0:v]colorkey=0x00FE00:0.4:0.05[nuggi]
      ;[bg1080][nuggi]overlay=(W-w)/2:(H-h)/2[bg_concat]
      ;[bg_concat]
        drawtext=text='undefined':x=10:y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,0.1,2)'
        ,drawtext=text='11시...':x=(w-text_w-10):y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,2.5,3.5)'
        ,drawtext=text='q22 안녕@@':x=10:y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,4,8)'
        ,drawtext=text='오...':x=(w-text_w-10):y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,8,11)'
        ,drawtext=text='오전...':x=(w-text_w-10):y=700:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,11,11.5)'
        ,drawtext=text='줘팸1...':x=10:y=1000:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,12.5,20)'
        ,drawtext=text='줘팸2...':x=10:y=1100:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,13,20)'
        ,drawtext=text='줘팸3...':x=10:y=1200:fontsize=48:fontcolor=white:fontfile='C:/Users/user/Desktop/project/private/petnyang/src/fonts/HMKMRHD.TTF':box=1:boxcolor=black@0.5:boxborderw=5:enable='between(t,13.5,20)'
    C:\Users\user\Desktop\project\private\petnyang\src\output\ou1.mp4 -y
   */

function genScript(sceneArr, backImgPath, outputFilePath) {
  // 한 씬(scene) 에서 한마디라도 여러줄이 될수있는데, 구분하지말고 여러줄 자체를 drawtext로 다넣어준다
  const drawTextScripts = sceneArr.map((scene) => {
    const drawTextScriptsArr = multiScriptMaker(scene);
    return drawTextScriptsArr;
  });

  // 한줄씩 테스트방법 : 뒤키워드 [bg1080]을 지우고 나머지 세라인을 지운다 파라미터를 넘기는느낌인데, 넘겨서 쓰던지 OR 안넘기던지
  const FILTER_COMPLEX_OPTIONS = [
    [
      "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[bg1080]",
    ], // 이미지를 늘린다음 1080으로 비율맞춤
    "[0:v]colorkey=0x00FE00:0.4:0.05[nuggi]", // 기존영상의 녹색 누끼제거
    "[bg1080][nuggi]overlay=(W-w)/2:(H-h)/2[bg_concat]", // 이미지배경과 누끼제거영상을 합성
    `[bg_concat]${drawTextScripts.flat().join(",")}`, // 합성한 영상에 텍스트를 추가
  ];

  // const BACK_IMG = path.join(__dirname, `videos/backz.jpg`);

  // OUTPUT_VIDEO;

  return [
    "-i",
    GREEN_VIDEO,
    "-i",
    backImgPath,
    "-ss",
    "0",
    "-t",
    "15", // 총20초인데 17초정도끊으면 줘팸타임 끝남
    "-filter_complex",
    FILTER_COMPLEX_OPTIONS.join(";"),
    outputFilePath,
    "-y", // Overwrite the output file if it exists
  ];
}

/**
 *
 * @returns outputFilePath
 */
async function genVideo(sceneArr, backImgPath) {
  const fileNm = `${dayjs().format("YYMMDD-HHmmss")}--${uuidv4()}.mp4`;
  return new Promise(async (resolve, reject) => {
    const outputFilePath = path.join(__dirname, "output", fileNm);

    // const outputFilePath = `${Date.now()}-${uuidv4()}.mp4`;
    const runFfmpegArgs = genScript(sceneArr, backImgPath, outputFilePath);
    // console.log("🚀 ~ returnnewPromise ~ runFfmpegArgs:", runFfmpegArgs);

    // console.log("full command >> ", runFfmpegArgs.join(" "));
    // resolve(outputFilePath);

    try {
      await executeFFmpeg(runFfmpegArgs);
      resolve(fileNm);
    } catch (error) {
      reject(error);
    }

    // executeFFmpeg(newArgs)
    //   .then(() => {
    //     console.log("FFmpeg command executed successfully");
    //     resolve();
    //   })
    //   .catch((error) => {
    //     console.error("FFmpeg command failed:", error);
    //     reject(error);
    //   });
  });
}

const VALS = {
  MAX_CONCURRENT_ENCODING: 1,
  CurrentEncodingCount: 0,
};

async function genVideoASync(sceneArr, backImgPath) {
  if (VALS.CurrentEncodingCount >= VALS.MAX_CONCURRENT_ENCODING) {
    throw new Error(
      "현재 코딩중인 영상이 너무 많은것이에요~ job: " +
        VALS.CurrentEncodingCount
    );
  }
  VALS.CurrentEncodingCount = VALS.CurrentEncodingCount + 1;

  const fileNm = `${dayjs().format("YYMMDD-HHmmss")}--${uuidv4()}.mp4`;
  const outputFilePath = path.join(__dirname, "output", fileNm);
  const runFfmpegArgs = genScript(sceneArr, backImgPath, outputFilePath);
  // console.log("🚀 ~ runFfmpegArgs:", runFfmpegArgs);
  // console.log("full", runFfmpegArgs.join(" "));

  // ffmpeg를 백그라운드에서 실행 (await 하지 않음)
  executeFFmpeg(runFfmpegArgs, fileNm)
    .then(() => {
      console.log(`FFmpeg done: ${fileNm}`);
    })
    .catch((error) => {
      console.error(`FFmpeg failed: ${fileNm}`, error);
    })
    .finally(() => {
      VALS.CurrentEncodingCount = VALS.CurrentEncodingCount - 1;
    });

  // fileNm을 즉시 반환
  return fileNm;
}

module.exports = {
  genVideo,
  progressMap,
  genVideoASync,
  VALS,
};

// 이것만 테스트할때사용
if (require.main === module) {
  const TEXT_ARR = [
    // `drawtext=text='@@Custom Font':fontfile='C:/Windows/Fonts/HMKMRHD.TTF':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`,
    // `drawtext=text='!한글!조아!':fontfile='${FONT_PATH}':fontcolor=white:fontsize=24:x=(w-text_w)/3:y=(h-text_h)/2,drawtext=text='Custom Font':fontfile='C:/Windows/Fonts/HMKMRHD.TTF':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='!!한글!조아!':fontfile='${FONT_PATH}':fontcolor=white:fontsize=24:x=(w-text_w)/5:y=(h-text_h)/2`,
    // `drawtext=text='!한글!조아!':x=10:y=700:${DEFAULT_OPTION}:enable='between(t,2.5,3.5)'`,
    ...multiScriptMaker(Q1Opt),
    ...multiScriptMaker(A1Opt),
    ...multiScriptMaker(Q2Opt),
    ...multiScriptMaker(A2Opt),
    ...multiScriptMaker(A22Opt),
    ...multiScriptMaker(P1Opt),
    ...multiScriptMaker(P2Opt),
    ...multiScriptMaker(P3Opt),
  ];
  const FILTER_OPTIONS = [
    "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2", // 이미지를 늘린다음 1080으로 비율맞춤
    // "[0:v]colorkey=0x00FE00:0.4:0.05[nuggi]", // 기존영상의 녹색 누끼제거
    // "[bg1080][nuggi]overlay=(W-w)/2:(H-h)/2[bg_concat]", // 이미지배경과 누끼제거영상을 합성
    // `[bg_concat]${TEXT_ARR.join(",")}`, // 합성한 영상에 텍스트를 추가
  ];
  // wer(FILTER_OPTIONS)

  const args = [
    "-i",
    GREEN_VIDEO,
    "-i",
    BACK_IMG,
    "-ss",
    "0",
    "-t",
    "20",
    "-filter_complex",
    FILTER_OPTIONS.join(";"),
    OUTPUT_VIDEO,
    "-y", // Overwrite the output file if it exists
  ];
  console.log("🚀 ~ args:", args);

  // This block will run only if the script is executed directly, not when required as a module.
  console.log("This script is executed directly.");
  // Place your main script logic here.
  executeFFmpeg(args)
    .then(() => console.log("FFmpeg command executed successfully"))
    .catch((error) => console.error("FFmpeg command failed:", error));
}
