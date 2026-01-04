<template>
  <div class="app-container">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-left">
        <el-icon :size="28" class="logo-icon"><Microphone /></el-icon>
        <h1>Whisper Server</h1>
      </div>
      <div class="header-right">
        <el-button text @click="showSettings = true">
          <el-icon :size="20"><Setting /></el-icon>
        </el-button>
        <el-button text @click="showAbout = true">
          <el-icon :size="20"><InfoFilled /></el-icon>
        </el-button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 状态卡片 -->
      <div class="status-card" :class="{ running: serverRunning }">
        <div class="status-indicator">
          <div class="status-dot" :class="{ active: serverRunning, loading: loading }"></div>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <el-button 
          :type="serverRunning ? 'danger' : 'primary'" 
          size="large"
          :loading="loading"
          @click="toggleServer"
          class="control-btn"
        >
          <el-icon v-if="!loading" :size="18">
            <VideoPlay v-if="!serverRunning" />
            <VideoPause v-else />
          </el-icon>
          {{ serverRunning ? '停止服务' : '启动服务' }}
        </el-button>
      </div>

      <!-- 配置区域 -->
      <div class="config-section">
        <div class="config-item">
          <label><el-icon><Cpu /></el-icon> 模型</label>
          <el-select v-model="config.model" :disabled="serverRunning" style="width: 160px">
            <el-option label="tiny (最快)" value="tiny" />
            <el-option label="base" value="base" />
            <el-option label="small (推荐)" value="small" />
            <el-option label="medium" value="medium" />
            <el-option label="large-v3 (最准)" value="large-v3" />
          </el-select>
        </div>
        <div class="config-item">
          <label><el-icon><Connection /></el-icon> 端口</label>
          <el-input v-model="config.port" :disabled="serverRunning" style="width: 120px" />
        </div>
        <div class="config-item">
          <el-checkbox v-model="config.convertNum" :disabled="serverRunning">
            中文数字转阿拉伯数字
          </el-checkbox>
        </div>
      </div>

      <!-- 日志区域 -->
      <div class="log-section">
        <div class="log-header">
          <span><el-icon><Document /></el-icon> 运行日志</span>
          <div class="log-actions">
            <el-button text size="small" @click="saveLogs" :disabled="logs.length === 0">
              <el-icon><Download /></el-icon> 保存
            </el-button>
            <el-button text size="small" @click="clearLogs">
              <el-icon><Delete /></el-icon> 清空
            </el-button>
          </div>
        </div>
        <div class="log-content" ref="logContainer">
          <div v-for="(log, index) in logs" :key="index" class="log-line" :class="getLogClass(log)">
            {{ log }}
          </div>
          <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
        </div>
      </div>

      <!-- 请求统计 -->
      <div class="stats-section" v-if="serverRunning">
        <div class="stat-item">
          <el-icon :size="24"><Timer /></el-icon>
          <div class="stat-info">
            <span class="stat-value">{{ requestCount }}</span>
            <span class="stat-label">已处理请求</span>
          </div>
        </div>
        <div class="stat-item">
          <el-icon :size="24"><Link /></el-icon>
          <div class="stat-info">
            <span class="stat-value">http://127.0.0.1:{{ config.port }}</span>
            <span class="stat-label">服务地址</span>
          </div>
        </div>
      </div>
    </main>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="系统设置" width="400px" class="settings-dialog">
      <el-form label-width="140px">
        <el-form-item label="开机自动启动">
          <el-switch v-model="config.autoStart" />
        </el-form-item>
        <el-form-item label="启动时自动运行服务">
          <el-switch v-model="config.autoRun" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

    <!-- 关于对话框 -->
    <el-dialog v-model="showAbout" title="关于" width="360px" class="about-dialog">
      <div class="about-content">
        <el-icon :size="64" class="about-icon"><Microphone /></el-icon>
        <h2>Whisper Server</h2>
        <p class="version">版本 1.0.0</p>
        <p class="desc">基于 OpenAI Whisper 模型</p>
        <p class="desc">使用 faster-whisper 加速推理</p>
        <p class="author">开发者: Hi</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="showAbout = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 退出确认对话框 -->
    <el-dialog 
      v-model="showExitConfirm" 
      title="" 
      width="400px" 
      :show-close="false"
      :close-on-click-modal="false"
      class="exit-dialog"
    >
      <div class="exit-content">
        <div class="exit-icon">
          <el-icon :size="56" color="#f56c6c"><WarningFilled /></el-icon>
        </div>
        <h3>确定要退出吗？</h3>
        <p v-if="serverRunning">服务正在运行中，退出将停止服务</p>
        <p v-else>确认退出 Whisper Server</p>
      </div>
      <template #footer>
        <div class="exit-buttons">
          <el-button size="large" @click="showExitConfirm = false">取消</el-button>
          <el-button size="large" type="danger" @click="confirmExit">确定退出</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

interface Config {
  model: string
  port: string
  convertNum: boolean
  autoStart: boolean
  autoRun: boolean
}

const config = reactive<Config>({
  model: 'small',
  port: '8000',
  convertNum: true,
  autoStart: false,
  autoRun: false
})

const serverRunning = ref(false)
const loading = ref(false)
const logs = ref<string[]>([])
const requestCount = ref(0)
const showSettings = ref(false)
const showAbout = ref(false)
const showExitConfirm = ref(false)
const logContainer = ref<HTMLElement | null>(null)

const statusText = computed(() => {
  if (loading.value) return '处理中...'
  return serverRunning.value ? `运行中 (端口 ${config.port})` : '未启动'
})

import { computed } from 'vue'

onMounted(async () => {
  await loadConfig()
  
  window.electronAPI.onServerLog((log: string) => {
    addLog(log.trim())
  })
  
  window.electronAPI.onServerStatus((status: any) => {
    serverRunning.value = status.running
    if (status.error) {
      addLog(`[错误] ${status.error}`)
    }
  })

  // 监听窗口关闭事件
  window.electronAPI.onBeforeClose(() => {
    showExitConfirm.value = true
  })

  // 检查是否需要自动启动
  if (config.autoRun) {
    await startServer()
  }
})

onUnmounted(() => {
  window.electronAPI.removeAllListeners()
})

async function loadConfig() {
  try {
    const saved = await window.electronAPI.getConfig()
    Object.assign(config, saved)
  } catch (e) {
    console.error('加载配置失败', e)
  }
}

async function saveSettings() {
  try {
    await window.electronAPI.saveConfig({ ...config })
    ElMessage.success('设置已保存')
    showSettings.value = false
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

async function toggleServer() {
  if (serverRunning.value) {
    await stopServer()
  } else {
    await startServer()
  }
}

async function startServer() {
  loading.value = true
  addLog(`[系统] 正在启动服务... 模型: ${config.model}, 端口: ${config.port}`)
  
  try {
    const result = await window.electronAPI.startServer({ ...config })
    if (result.success) {
      serverRunning.value = true
      requestCount.value = 0
      addLog(`[系统] ✅ 服务已启动: http://127.0.0.1:${config.port}`)
      await window.electronAPI.saveConfig({ ...config })
    } else {
      addLog(`[系统] ❌ 启动失败: ${result.error}`)
      ElMessage.error(result.error || '启动失败')
    }
  } catch (e: any) {
    addLog(`[系统] ❌ 启动异常: ${e.message}`)
    ElMessage.error('启动失败')
  } finally {
    loading.value = false
  }
}

async function stopServer() {
  loading.value = true
  try {
    await window.electronAPI.stopServer()
    serverRunning.value = false
    addLog(`[系统] 服务已停止`)
  } catch (e) {
    ElMessage.error('停止失败')
  } finally {
    loading.value = false
  }
}

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.push(`[${time}] ${msg}`)
  
  // 限制日志数量
  if (logs.value.length > 500) {
    logs.value = logs.value.slice(-300)
  }
  
  // 滚动到底部
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })

  // 统计请求数
  if (msg.includes('请求#')) {
    requestCount.value++
  }
}

function clearLogs() {
  logs.value = []
  addLog('[系统] 日志已清空')
}

async function saveLogs() {
  if (logs.value.length === 0) {
    ElMessage.warning('暂无日志可保存')
    return
  }
  try {
    const content = logs.value.join('\n')
    const result = await window.electronAPI.saveLogs(content)
    if (result.success) {
      ElMessage.success(`日志已保存到: ${result.path}`)
    } else if (result.cancelled) {
      // 用户取消，不提示
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

function getLogClass(log: string) {
  if (log.includes('❌') || log.includes('错误') || log.includes('失败')) return 'error'
  if (log.includes('✅') || log.includes('完成') || log.includes('成功')) return 'success'
  if (log.includes('⏳') || log.includes('加载')) return 'loading'
  return ''
}

function confirmExit() {
  window.electronAPI.confirmClose()
}
</script>

<style scoped>
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  color: #409eff;
}

.header-left h1 {
  font-size: 22px;
  font-weight: 600;
  background: linear-gradient(90deg, #409eff, #67c23a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-right {
  display: flex;
  gap: 8px;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 20px;
  overflow: hidden;
}

.status-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
}

.status-card.running {
  border-color: rgba(103, 194, 58, 0.3);
  background: rgba(103, 194, 58, 0.05);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #909399;
  transition: all 0.3s;
}

.status-dot.active {
  background: #67c23a;
  box-shadow: 0 0 12px rgba(103, 194, 58, 0.6);
  animation: pulse 2s infinite;
}

.status-dot.loading {
  background: #e6a23c;
  animation: blink 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text {
  font-size: 18px;
  font-weight: 500;
}

.control-btn {
  min-width: 140px;
}

.config-section {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 16px 20px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-item label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #a3a3a3;
  font-size: 14px;
}

.log-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
  min-height: 200px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.log-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.log-line {
  padding: 2px 0;
  color: #a3a3a3;
}

.log-line.error {
  color: #f56c6c;
}

.log-line.success {
  color: #67c23a;
}

.log-line.loading {
  color: #e6a23c;
}

.log-empty {
  color: #606266;
  text-align: center;
  padding: 40px;
}

.stats-section {
  display: flex;
  gap: 20px;
}

.stat-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 16px 20px;
}

.stat-item .el-icon {
  color: #409eff;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

/* 对话框样式 */
.about-content {
  text-align: center;
  padding: 20px 0;
}

.about-icon {
  color: #409eff;
  margin-bottom: 16px;
}

.about-content h2 {
  margin-bottom: 8px;
}

.about-content .version {
  color: #909399;
  margin-bottom: 16px;
}

.about-content .desc {
  color: #606266;
  font-size: 14px;
  margin-bottom: 4px;
}

.about-content .author {
  color: #909399;
  font-size: 13px;
  margin-top: 16px;
}

/* 退出对话框样式 */
.exit-content {
  text-align: center;
  padding: 20px 0;
}

.exit-icon {
  margin-bottom: 20px;
}

.exit-content h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #fff;
}

.exit-content p {
  color: #909399;
  font-size: 14px;
}

.exit-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.exit-buttons .el-button {
  min-width: 100px;
}
</style>
