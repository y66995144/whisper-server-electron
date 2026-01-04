# Whisper Server

基于 Electron + Vue3 + Python 的本地语音转文字服务器，提供 OpenAI Whisper API 兼容接口。

## 功能特性

- 🎤 **语音转文字** - 基于 OpenAI Whisper 模型，支持多种语言识别
- ⚡ **高性能推理** - 使用 faster-whisper 加速，CPU 模式下也能快速转录
- 🔌 **API 兼容** - 提供与 OpenAI Whisper API 兼容的 HTTP 接口
- 🎨 **现代化界面** - 深色主题，实时日志显示，状态监控
- 🔧 **灵活配置** - 支持多种模型选择（tiny/base/small/medium/large-v3）
- 📊 **请求统计** - 实时显示已处理请求数量
- 💾 **日志管理** - 支持日志保存和清空

## 使用场景

1. **本地语音转文字服务** - 无需联网，保护隐私
2. **开发测试** - 为需要语音识别功能的应用提供本地 API
3. **替代云服务** - 作为 OpenAI Whisper API 的本地替代方案
4. **批量转录** - 配合客户端批量处理音频文件

## API 接口

### 语音转文字

```
POST /v1/audio/transcriptions
```

**请求参数（multipart/form-data）：**
- `file` - 音频文件（支持 mp3, wav, webm 等格式）
- `language` - 语言代码（可选，默认 `zh`）

**响应示例：**
```json
{
  "text": "识别出的文字内容",
  "language": "zh",
  "duration": 3.5
}
```

### 健康检查

```
GET /health
```

**响应示例：**
```json
{
  "status": "ok",
  "model": "small",
  "requests": 42
}
```

## 模型说明

| 模型 | 大小 | 速度 | 准确度 | 推荐场景 |
|------|------|------|--------|----------|
| tiny | ~75MB | 最快 | 一般 | 快速测试 |
| base | ~150MB | 快 | 较好 | 日常使用 |
| small | ~500MB | 中等 | 好 | **推荐** |
| medium | ~1.5GB | 较慢 | 很好 | 高质量需求 |
| large-v3 | ~3GB | 慢 | 最佳 | 专业场景 |

## 开发

### 环境要求

- Node.js 18+
- Python 3.8+
- pip

### 安装依赖

```bash
# 安装 Node 依赖
npm install

# 安装 Python 依赖
pip install -r python/requirements.txt
```

### 开发模式

```bash
npm run dev:electron
```

### 构建打包

```bash
npm run build:win
```

打包后的安装程序位于 `release/` 目录。

## 技术栈

- **前端**: Electron 28 + Vue 3 + Element Plus + TypeScript
- **后端**: Python + Flask + faster-whisper
- **构建**: Vite + electron-builder

## 配置说明

配置文件自动保存，包括：
- 模型选择
- 端口设置
- 中文数字转换开关
- 开机自启动
- 启动时自动运行服务

## 注意事项

1. 首次启动会下载 Whisper 模型，请确保网络通畅
2. 模型文件缓存在 `~/.cache/huggingface/` 目录
3. 建议使用 small 模型，平衡速度和准确度
4. 端口默认 8000，可自行修改

## License

Apache-2.0
