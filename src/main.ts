import { createApp } from 'vue'
import App from './App.vue'
import { ElAlert, ElButton, ElCol, ElContainer, ElHeader, ElIcon, ElLink, ElMain, ElMessage, ElRow, ElSlider, ElSwitch, ElTooltip } from 'element-plus'
import 'element-plus/dist/index.css'
createApp(App)
  .use(ElButton)
  .use(ElContainer)
  .use(ElHeader)
  .use(ElMain)
  .use(ElAlert)
  .use(ElCol)
  .use(ElRow)
  .use(ElSwitch)
  .use(ElSlider)
  .use(ElMessage)
  .use(ElLink)
  .use(ElTooltip)
  .use(ElIcon)
  .mount('#app')
