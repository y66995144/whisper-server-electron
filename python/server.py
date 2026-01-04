# -*- coding: utf-8 -*-
"""
Whisper 语音转文字服务器 - 命令行版本
供 Electron 调用
"""
import os
import sys
import io
import argparse
import tempfile
import datetime

# 修复 Windows 控制台编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify
from werkzeug.serving import make_server

# 全局变量
model = None
model_name = None
converter = None
request_count = 0


def log(msg):
    """输出日志（会被 Electron 捕获）"""
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)


def load_model(name):
    """加载 Whisper 模型"""
    global model, model_name, converter
    
    if model and model_name == name:
        return True
    
    log(f"[模型] ⏳ 开始加载模型: {name}")
    
    try:
        from faster_whisper import WhisperModel
        start = datetime.datetime.now()
        model = WhisperModel(name, device="cpu", compute_type="int8")
        elapsed = (datetime.datetime.now() - start).total_seconds()
        model_name = name
        log(f"[模型] ✅ 加载完成，耗时: {elapsed:.1f}秒")
        
        # 尝试加载 OpenCC
        try:
            import opencc
            converter = opencc.OpenCC('t2s')
            log("[模型] OpenCC 繁简转换已启用")
        except:
            converter = None
        
        return True
    except Exception as e:
        log(f"[模型] ❌ 加载失败: {e}")
        return False


def create_app(convert_num=True):
    """创建 Flask 应用"""
    global request_count
    
    app = Flask(__name__)
    app.config['JSON_AS_ASCII'] = False

    @app.route("/v1/audio/transcriptions", methods=["POST"])
    def transcribe():
        global request_count
        request_count += 1
        req_id = request_count
        
        if "file" not in request.files:
            log(f"[请求#{req_id}] ❌ 错误: 未提供文件")
            return jsonify({"error": {"message": "No file"}}), 400

        audio_file = request.files["file"]
        language = request.form.get("language", "zh")
        log(f"[请求#{req_id}] ➡️ 收到: {audio_file.filename}, 语言: {language}")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        try:
            start_time = datetime.datetime.now()
            segments, info = model.transcribe(
                tmp_path, language=language or "zh", beam_size=5, best_of=5,
                temperature=0, vad_filter=True, initial_prompt="以下是普通话的句子。"
            )
            text = "".join([seg.text.strip() for seg in segments])
            
            # 繁简转换
            if converter:
                text = converter.convert(text)
            
            # 数字转换
            if convert_num:
                for cn, num in {'零':'0','一':'1','二':'2','三':'3','四':'4','五':'5',
                                '六':'6','七':'7','八':'8','九':'9','十':'10'}.items():
                    text = text.replace(cn, num)
            
            elapsed = (datetime.datetime.now() - start_time).total_seconds()
            log(f"[请求#{req_id}] ✅ 完成: {elapsed:.1f}s, 结果: {text[:50]}...")
            return jsonify({"text": text, "language": info.language, "duration": info.duration})
        except Exception as e:
            log(f"[请求#{req_id}] ❌ 失败: {e}")
            return jsonify({"error": {"message": str(e)}}), 500
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "model": model_name, "requests": request_count})

    return app


def main():
    parser = argparse.ArgumentParser(description='Whisper Server')
    parser.add_argument('--model', default='small', help='模型名称')
    parser.add_argument('--port', type=int, default=8000, help='端口号')
    parser.add_argument('--convert-num', action='store_true', help='转换中文数字')
    args = parser.parse_args()

    log(f"[系统] Whisper Server 启动中...")
    log(f"[系统] 配置 - 模型: {args.model}, 端口: {args.port}")

    # 加载模型
    if not load_model(args.model):
        log("[系统] ❌ 模型加载失败，退出")
        sys.exit(1)

    # 创建并启动服务
    app = create_app(convert_num=args.convert_num)
    server = make_server("0.0.0.0", args.port, app, threaded=True)
    
    log(f"[服务] ✅ 已启动: http://127.0.0.1:{args.port}")
    log(f"[服务] API 端点: POST /v1/audio/transcriptions")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("[服务] 收到停止信号，正在关闭...")
        server.shutdown()


if __name__ == "__main__":
    main()
