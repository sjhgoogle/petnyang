const vueData = {
  isLoading: false,
  mentList: {
    cat1_1: {
      title: "고양이1 멘트",
      desc: "어제 애니봤어?",
      ment: "",
      mentArr: ["냥 책임님", "이번에 사내교육으로", "코딩 배우셨다면서요?"],
      initPos: { xPos: 20, yPos: 720 },
      timeSlice: { start: 0.1, end: 2 },
    },
    cat2_1: {
      title: "고양이2 멘트",
      desc: "11시...?",
      mentArr: ["넹"],
      initPos: { xPos: "(w-text_w-20)", yPos: 700 },
      timeSlice: { start: 2.5, end: 3.5 },
    },

    cat1_2: {
      title: "고양이1 멘트",
      desc: "일찍 잤는데 왜 계속 졸아?",
      mentArr: ["오 그러면", "어느 언어 쓰실 줄 아세요?"],
      initPos: { xPos: 20, yPos: 720 },
      timeSlice: { start: 4, end: 8 },
    },

    cat2_2: {
      title: "고양이2 멘트",
      desc: "오..?",
      mentArr: ["C..."],
      initPos: { xPos: "(w-text_w-20)", yPos: 700 },

      timeSlice: { start: 8, end: 11 },
    },
    cat1_3: {
      title: "고양이3 멘트",
      desc: "일찍 잤는데 왜 계속 졸아?",
      mentArr: ["오 C? C++?"],
      initPos: { xPos: 20, yPos: 720 },
      timeSlice: { start: 9.5, end: 11 },
    },

    cat2_3: {
      title: "고양이2 멘트",
      desc: "오전...",
      mentArr: ["ChatGPT용~"],
      initPos: { xPos: "(w-text_w-20)", yPos: 700 },
      timeSlice: { start: 11, end: 11.5 },
    },

    pem1: {
      title: "고양이1 줘팸",
      desc: "팸1...",
      mentArr: ["진실의..."],
      initPos: { xPos: 20, yPos: 1000 },
      timeSlice: { start: 12.5, end: 20 },
    },
    pem2: {
      title: "고양이1 줘팸",
      desc: "팸2...",
      mentArr: ["방으로..."],
      initPos: { xPos: 20, yPos: 1100 },
      timeSlice: { start: 13, end: 20 },
    },
    pem3: {
      title: "고양이1 줘팸",
      desc: "팸3...",
      mentArr: ["입장..."],
      initPos: { xPos: 20, yPos: 1200 },
      timeSlice: { start: 13.5, end: 20 },
    },

    // ################3
  },
};

let vm;

$(function () {
  initVue();
  fns.init();
});

function initVue() {
  vm = Vue.createApp({
    data() {
      return vueData;
    },
    methods: {
      onMainClick() {},

      downloadVideo() {
        const url = document.getElementById("my_video").src;
        console.log("🚀 ~ downloadVideo ~ url:", url);

        const a = document.createElement("a");
        a.href = url;
        a.download = "video.mp4";

        document.body.appendChild(a);
        a.click();

        // Remove the element after triggering the download
        document.body.removeChild(a);
      },

      async onSnedClick(ment) {
        const formData = new FormData();

        const sceneArr = Object.values(vm.mentList);
        formData.append("paramMap", JSON.stringify({ sceneArr: sceneArr }));

        let bgFile = null;

        if (vm.bgFile) {
          bgFile = vm.bgFile;
        } else {
          const response = await fetch("/back.jpg");
          bgFile = await response.blob();
        }

        formData.append("file", bgFile);

        vm.isLoading = true;
        const res = await fetch("/api", {
          method: "POST",
          body: formData,
        });
        vm.isLoading = !true;

        const { fileNm } = await res.json();
        this.waitLoading(fileNm);
      },

      waitLoading(fileNm) {
        // wiat with

        // http://localhost:3000/progress/250716-170210--44b1dce5-9448-4199-bdd5-fdefbc8ac0f6.mp4
        // Request Method
        // GET
        // Status Code
        // 200 OK
        // Remote Address
        // [::1]:3000
        // Referrer Policy
        // strict-origin-when-cross-origin

        document.getElementById("percent_modal").showModal();

        const evtSource = new EventSource(`/progress/${fileNm}`);
        evtSource.onmessage = function (event) {
          const { percent } = JSON.parse(event.data);
          console.log("🚀 ~ waitLoading ~ percent:", percent);
          $("#percent_val").text(`${percent} %`);

          if (percent >= 100) {
            evtSource.close();
            vm.openModal(fileNm);
          }
        };
        evtSource.onerror = function () {
          evtSource.close();
        };
      },

      closeModal() {
        document.getElementById("my_video").pause();
      },
      openModal(fileNm = "") {
        document.getElementById("my_modal").showModal();

        if (fileNm) {
          vm.videoUrl = `/video/${fileNm}`;
          document.getElementById("my_video").src = `/video/${fileNm}`;
        }
      },
      async onFileChange(e) {
        const file = e.target.files[0];
        if (!file) return alert("no file!");

        vm.bgFile = file;
        const url = URL.createObjectURL(file);
        const mainPhone = document.getElementById("mainPhone");
        mainPhone.style.backgroundImage = `url(nuggi-cat.png), url(${url})`;
      },

      async genRandom() {
        vm.isLoading = true;
        const response = await fetch("/genRandom");
        const resJson = await response.json();
        vm.isLoading = !true;

        const mentValues = Object.values(resJson);
        console.log("🚀 ~ genRandom ~ mentValues:", mentValues);

        Object.entries(vm.mentList).forEach(([key, value], index, mom) => {
          value.mentArr = [mentValues[index]];
        });
        console.log("🚀 ~ Object.entries ~ vm.mentList:", vm.mentList);
      },
    },
    mounted() {
      // this.openModal();
    },
  }).mount("#app");
}

function initSetup() {}

const fns = {
  init() {
    const mainPhone = $("#mainPhone");

    setResponsiveWidth();
    window.addEventListener("resize", _.throttle(setResponsiveWidth, 200));

    function setResponsiveWidth() {
      const height = mainPhone.outerHeight();
      const responsiveWidth = height * 0.6;
      // mainPhone.style.width = `${responsiveWidth}px`;

      mainPhone.css("width", `${responsiveWidth}px`);
    }
  },
};
