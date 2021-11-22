<template>
  <div>
    <video
      ref="baseVideoPlayer"
      style="position:fixed; left: -9999px; top: -9999px"
      :src="sourceUrl" />
    <el-alert
      title="暂时仅支持本地上传视频编辑。"
      center
      type="success"
      :closable="false" />
    <el-container>
      <input
        type="file"
        ref="inputEl"
        @change="fileChange($event)"
        accept=".mp4,.avi">
      <el-header>
        <el-button
          @click="inputEl.click()"
          type="primary">
          上传视频
        </el-button>

        <el-button
          @click="transcode"
          type="primary">
          预览结果
        </el-button>

        <el-link
          :disabled="!resultUrl"
          :href="resultUrl"
          download="output.mp4">
          保存视频
        </el-link>
      </el-header>
      <el-main>
        <el-row :gutter="20">
          <el-col :span="12">
            <p>原视频</p>
            <div class="video-box">
              <video
                :src="sourceUrl"
                controls
                @loadedmetadata="handleLoaded($event)"
                ref="oldVideoPlayer" />
              <div
                class="slice-box"
                v-show="isCutting">
                <div id="scale" />
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <p>效果预览</p>
            <video
              :src="resultUrl"
              controls />
          </el-col>
        </el-row>
        <div
          class="edit-box"
          v-show="showEditBox">
          <el-row>
            <el-col :span="3">
              视频剪辑
            </el-col>
            <el-col :span="10">
              <el-slider
                v-model="splitTimeArr"
                range
                :max="duration"
                :step="0.001"
                :format-tooltip="formatTooltip" />
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="3">
              画面尺寸裁剪
            </el-col>
            <el-col :span="10">
              <el-switch
                v-model="isCutting"
                active-color="#409eff"
                inactive-color="#666" />
              <el-tooltip
                class="item"
                effect="dark"
                content="若裁剪区域超出视频范围，则自动填充灰色背景"
                placement="right">
                <span class="help-icon">?</span>
              </el-tooltip>
            </el-col>
          </el-row>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script lang="ts">
  import { defineComponent, ref, onMounted } from "vue";
  import { createFFmpeg } from "@ffmpeg/ffmpeg";
  import { ElMessage } from "element-plus";

  export default defineComponent({
    name: "App",
    setup() {
      const inputEl = ref(null);
      const baseVideoPlayer = ref(null);
      const oldVideoPlayer = ref(null);
      const sourceUrl = ref("");
      const resultUrl = ref("");
      let file: { type: string | string[]; arrayBuffer: () => any; } | null = null;
      const duration = ref(0); // 视频总时长
      const splitTimeArr = ref([0, 0]);
      const showEditBox = ref(false);
      const isCutting = ref(false);
      let father = null;
      let box = null;
      let scale = null;
      const fileChange = e => {
        showEditBox.value = false;
        if (!e.target.files.length) {
          return;
        }
        file = e.target.files[0];
        if (!file.type.includes("video")) {
          return ElMessage.error(
            "文件格式错误，当前仅支持MP4/AVI格式的视频文件！"
          );
        }
        sourceUrl.value = URL.createObjectURL(file);
        resultUrl.value = "";
      };
      const handleLoaded = e => {
        duration.value = +e.target.duration;
        showEditBox.value = true;
        splitTimeArr.value[1] = e.target.duration;
      };
      const ffmpeg = createFFmpeg();
      async function transcode() {
        ffmpeg.isLoaded() || (await ffmpeg.load());
        const arrayBuffer = await file.arrayBuffer();
        ffmpeg.FS("writeFile", "test.mp4", new Uint8Array(arrayBuffer));
        const runScript = [
          "-ss",
          formatTooltip(splitTimeArr.value[0]),
          "-i",
          "test.mp4",
          "-t",
          "" + (splitTimeArr.value[1] - splitTimeArr.value[0])
        ];
        if (isCutting.value) {
          // 获取显示视频与原视频缩放比例
          const { clientWidth: ow, clientHeight: oh } = oldVideoPlayer.value;
          const { clientWidth: bw, clientHeight: bh } = baseVideoPlayer.value;
          const scaleX = ow / bw;
          const scaleY = oh / bh;
          const realScale = scaleX < scaleY ? scaleX : scaleY;
          // video标签中视频实际尺寸
          const realWidth = baseVideoPlayer.value.clientWidth * realScale;
          const realHeight = baseVideoPlayer.value.clientHeight * realScale;
          // video标签四周多余的黑边
          let surplusX = (oldVideoPlayer.value.clientWidth - realWidth) / 2;
          let surplusY = (oldVideoPlayer.value.clientHeight - realHeight) / 2;

          // 裁剪框的位置
          let {
            offsetHeight: h,
            offsetWidth: w,
            offsetTop: y,
            offsetLeft: x
          } = box;
          // 按比例还原在原视频中位置
          const fmtnum = num => Math.floor(num / realScale);
          runScript.push(
            "-vf",
            `pad=${fmtnum(realWidth) + fmtnum(surplusX * 2)}:` +
              `${fmtnum(realHeight) + fmtnum(surplusY * 2)}:` +
              `${fmtnum(surplusX)}:` +
              `${fmtnum(surplusY)}:` +
              `0xcccccc` +
              `,crop=${fmtnum(w)}:${fmtnum(h)}:${fmtnum(x)}:${fmtnum(y)}`
          );
        }
        runScript.push("test1.mp4");
        await ffmpeg.run(...runScript);
        const data = ffmpeg.FS("readFile", "test1.mp4");
        const url = URL.createObjectURL(
          new Blob([data.buffer], {
            type: "video/mp4"
          })
        );
        resultUrl.value = url;
      }
      const formatTooltip = val => {
        let hh = Math.floor(val / 3600);
        let mm = Math.floor((val - hh * 3600) / 60);
        let ss = Math.floor(val - hh * 3600 - mm * 60);
        const ms = +(val - Math.floor(val)).toFixed(3).split(".")[1];
        return (
          `${hh > 10 ? hh : "0" + hh}:` +
          `${mm > 10 ? mm : "0" + mm}:` +
          `${ss > 10 ? ss : "0" + ss}.` +
          `${ms}`
        );
      };
      onMounted(() => {
        father = document.getElementsByClassName("video-box")[0];
        box = document.getElementsByClassName("slice-box")[0];
        scale = document.getElementById("scale");
        // 裁剪框移动效果
        box.onmousedown = function(ev) {
          let oEvent = ev;
          // 浏览器有一些裁剪框的默认事件,这里要阻止
          oEvent.preventDefault();
          let disX = oEvent.clientX - box.offsetLeft;
          let disY = oEvent.clientY - box.offsetTop;
          father.onmousemove = function(ev) {
            oEvent = ev;
            oEvent.preventDefault();
            let x = oEvent.clientX - disX;
            let y = oEvent.clientY - disY;

            // 图形移动的边界判断
            x = x <= 0 ? 0 : x;
            x =
              x >= father.offsetWidth - box.offsetWidth
                ? father.offsetWidth - box.offsetWidth
                : x;
            y = y <= 0 ? 0 : y;
            y =
              y >= father.offsetHeight - box.offsetHeight
                ? father.offsetHeight - box.offsetHeight
                : y;
            box.style.left = x + "px";
            box.style.top = y + "px";
          };
          // 图形移出父盒子取消移动事件,防止移动过快触发鼠标移出事件,导致鼠标弹起事件失效
          father.onmouseleave = function() {
            father.onmousemove = null;
            father.onmouseup = null;
          };
          // 鼠标弹起后停止移动
          father.onmouseup = function() {
            father.onmousemove = null;
            father.onmouseup = null;
          };
        };
        // 裁剪框缩放效果
        scale.onmousedown = function(e) {
          // 阻止冒泡,避免缩放时触发移动事件
          e.stopPropagation();
          e.preventDefault();
          let pos = {
            w: box.offsetWidth,
            h: box.offsetHeight,
            x: e.clientX,
            y: e.clientY
          };
          father.onmousemove = function(ev) {
            ev.preventDefault();
            // 设置裁剪框的最小缩放为30*30
            let w = Math.max(30, ev.clientX - pos.x + pos.w);
            let h = Math.max(30, ev.clientY - pos.y + pos.h);
            // console.log(w,h)

            // 设置裁剪框的最大宽高
            w =
              w >= father.offsetWidth - box.offsetLeft
                ? father.offsetWidth - box.offsetLeft
                : w;
            h =
              h >= father.offsetHeight - box.offsetTop
                ? father.offsetHeight - box.offsetTop
                : h;
            box.style.width = w + "px";
            box.style.height = h + "px";
          };
          father.onmouseleave = function() {
            father.onmousemove = null;
            father.onmouseup = null;
          };
          father.onmouseup = function() {
            father.onmousemove = null;
            father.onmouseup = null;
          };
        };
      });
      return {
        inputEl,
        baseVideoPlayer,
        oldVideoPlayer,
        sourceUrl,
        resultUrl,
        fileChange,
        transcode,
        showEditBox,
        handleLoaded,
        formatTooltip,
        duration,
        splitTimeArr,
        isCutting
      };
    }
  });
</script>

<style lang="less">
  .el-container {
    margin-top: 30px;
    input {
      display: none;
    }
    .el-header {
      a {
        margin-left: 10px;
      }
    }
    .el-main {
      background-color: #aaa;
      min-height: 100vh;
      .el-row {
        margin: 10px 0;
        align-items: center;
        .el-col {
          p {
            color: #fff;
            font-weight: 700;
            font-size: 20px;
          }
          video {
            width: 100%;
            height: 500px;
            display: inline-block;
            vertical-align: middle;
            background-color: #cfc;
          }
          .video-box {
            position: relative;
            .slice-box {
              position: absolute;
              left: 0;
              top: 0;
              border: 2px dotted #f88;
              width: 100%;
              height: 100%;
              box-sizing: border-box;
              #scale {
                width: 8px;
                height: 8px;
                overflow: hidden;
                cursor: se-resize;
                position: absolute;
                right: -4px;
                bottom: -4px;
                background-color: #f88;
              }
            }
          }
          .help-icon {
            font-weight: 900;
            color: #666;
            border: 2px solid #666;
            border-radius: 50%;
            display: inline-block;
            width: 16px;
            height: 16px;
            text-align: center;
            vertical-align: middle;
            cursor: pointer;
            font-size: 12px;
            margin-left: 10px;
          }
        }
      }
    }
  }
</style>
