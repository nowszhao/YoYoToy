import os
from fastapi import FastAPI, UploadFile, File, WebSocket, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi import Request
import uvicorn
from .chat_service import ChatService
from .config import Config
from pydantic import BaseModel
import logging
import base64
import tempfile
import azure.cognitiveservices.speech as speechsdk

app = FastAPI()
chat_service = ChatService()

# 挂载静态文件
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

# 确保上传目录存在
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

# 添加请求模型
class ChatRequest(BaseModel):
    image_name: str
    message: str

class AudioReplayRequest(BaseModel):
    ssml: str

class SpeechToTextRequest(BaseModel):
    audio_data: str

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    file_path = os.path.join(Config.UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    return {"filename": file.filename}

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        logger.info("Chat request received for image: %s", request.image_name)
        image_path = os.path.join(Config.UPLOAD_FOLDER, request.image_name)
        
        if not os.path.exists(image_path):
            logger.error("Image not found: %s", image_path)
            return {"error": "Image not found"}, 404
            
        logger.info("Processing chat with message length: %s", request.message)
        response = await chat_service.chat_with_image(image_path, request.message)
        logger.info("Got response with length: %d", len(response))
        
        logger.info("Converting response to speech")
        audio_base64 = await chat_service.text_to_speech(response)
        
        if audio_base64:
            logger.info("Audio conversion successful, response size: %d", len(audio_base64))
            return {
                "text": response,
                "audio": audio_base64
            }
        else:
            logger.warning("Audio conversion failed, returning text only")
            return {
                "text": response,
                "audio": None
            }
    except Exception as e:
        logger.exception("Error in chat endpoint: %s", str(e))
        return {"error": str(e)}, 500

@app.post("/analyze")
async def analyze_image(image_name: str):
    try:
        image_path = os.path.join(Config.UPLOAD_FOLDER, image_name)
        if not os.path.exists(image_path):
            return {"error": "Image not found"}, 404
            
        response = await chat_service.analyze_image(image_path)
        audio_base64 = await chat_service.text_to_speech(response)
        
        return {
            "text": response,
            "audio": audio_base64
        }
    except Exception as e:
        logger.error(f"Error in analyze endpoint: {str(e)}")
        return {"error": str(e)}, 500

@app.delete("/images/{filename}")
async def delete_image(filename: str):
    try:
        image_path = os.path.join(Config.UPLOAD_FOLDER, filename)
        if os.path.exists(image_path):
            os.remove(image_path)
            return JSONResponse(content={"success": True})
        else:
            raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/images")
async def get_images():
    try:
        images = []
        for filename in os.listdir(Config.UPLOAD_FOLDER):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                file_path = os.path.join(Config.UPLOAD_FOLDER, filename)
                with open(file_path, "rb") as f:
                    image_data = base64.b64encode(f.read()).decode()
                images.append({
                    "name": filename,
                    "data": f"data:image/png;base64,{image_data}"
                })
        return {"images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/replay-audio")
async def replay_audio(request: AudioReplayRequest):
    try:
        logger.info("Replay audio request received with SSML length: %d", len(request.ssml))
        audio_base64 = await chat_service.text_to_speech(request.ssml, use_cache=True)
        
        if audio_base64:
            logger.info("Audio replay successful, response size: %d", len(audio_base64))
        else:
            logger.warning("Audio replay returned None")
            
        return {"audio": audio_base64}
    except Exception as e:
        logger.exception("Error in replay audio endpoint: %s", str(e))
        return {"error": str(e)}, 500

@app.post("/speech-to-text")
async def speech_to_text(request: SpeechToTextRequest):
    try:
        # 解码 base64 音频数据
        audio_data = base64.b64decode(request.audio_data)
        
        # 使用 ChatService 进行语音识别
        text = chat_service.speech_to_text(audio_data)
        
        if text:
            return {"text": text}
        else:
            return {"error": "Speech recognition failed"}
            
    except Exception as e:
        logger.exception("Error in speech_to_text: %s", str(e))
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 