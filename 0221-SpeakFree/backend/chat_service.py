import os
import base64
from openai import OpenAI
import azure.cognitiveservices.speech as speechsdk
from .config import Config
import hashlib
from pathlib import Path
import logging
import tempfile

# 设置日志
logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        self.client = OpenAI(
            api_key=Config.OPENAI_API_KEY,
            base_url=Config.OPENAI_BASE_URL,
        )
        
        # Azure 语音配置
        self.speech_config = speechsdk.SpeechConfig(
            subscription=Config.AZURE_SPEECH_KEY,
            region=Config.AZURE_SPEECH_REGION
        )
        # 设置输出格式为 WAV
        self.speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
        )
        
        # 初始化音频缓存目录
        self.audio_cache_dir = Path("audio_cache")
        self.audio_cache_dir.mkdir(exist_ok=True)
        
        # 初始化对话历史
        self.conversation_history = []
        self.max_history_tokens = 6000  # 预留2000 tokens给新的对话
        logger.info("ChatService initialized with audio cache dir: %s", self.audio_cache_dir)
        
    def encode_image(self, image_path):
        with open(image_path, "rb") as f:
            image_data = f.read()
        return f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"

    def trim_conversation_history(self, messages):
        """
        裁剪对话历史，确保总长度不超过限制
        使用简单的字符长度估算 token 数量（平均1个token约等于4个字符）
        """
        total_length = 0
        trimmed_messages = []
        
        # 从最新的消息开始计算
        for message in reversed(messages):
            # 估算当前消息的token数量
            message_length = 0
            if isinstance(message["content"], str):
                message_length = len(message["content"]) // 4
            elif isinstance(message["content"], list):
                # 对于包含图片的消息，只计算文本部分
                for content in message["content"]:
                    if content["type"] == "text":
                        message_length += len(content["text"]) // 4
            
            # 如果添加这条消息后仍在限制内，则保留
            if total_length + message_length <= self.max_history_tokens:
                total_length += message_length
                trimmed_messages.insert(0, message)
            else:
                break
        
        return trimmed_messages

    async def analyze_image(self, image_path):
        try:
            image_url = self.encode_image(image_path)
            
            # 重置对话历史（新图片开始新的对话）
            self.conversation_history = []
            
            prompt = """
                你现在是一个英语老师，我是英语只有 100 个单词词汇的 6 岁小女孩儿，你在通过图片教我英语，请基于我提供的图片跟我使用交流，需要你不停的引导我沟通，要求如下：
                1、使用简答的词汇与我对话
                2、如果我回答不对，请耐心纠正
                3、输出内容请使用微软 tts 的 ssml格式化回复，比如对于难的词汇或我要求说慢点，你都要通过 ssml 来控制说话的语气，ssml 格式示例如下：
                    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
                        <voice name='en-US-AndrewMultilingualNeural'>
                            <mstts:express-as style='default'>
                                <prosody rate="0.8" pitch="+5%">
                                    你好啊，大师
                                </prosody>
                                <break time="500ms"/>
                                <prosody rate="1.2" pitch="-5%">
                                    这是一个使用SSML的示例。
                                </prosody>
                                <break time="500ms"/>
                                <prosody volume="x-loud">
                                    你可以调整语速、音调和音量。
                                </prosody>
                                <break time="500ms"/>
                                <prosody volume="x-soft">
                                    这是一个音量较小的示例。
                                </prosody>
                            </mstts:express-as>
                        </voice>
                    </speak>
                请用 20个以内的单词描述图片内容，并引导我继续对话.
            """
            
            messages = [
                {
                    "role": "system",
                    "content": "你是一个耐心的英语老师，正在教一个6岁的小女孩认识图片中的内容。请使用简单的英语单词。"
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type": "text", "text": prompt}
                    ]
                }
            ]
            
            logger.info("Sending messages to KIMI: %s", messages)

            completion = self.client.chat.completions.create(
                model="moonshot-v1-8k-vision-preview",
                messages=messages
            )
            
            response = completion.choices[0].message.content

            logger.info("Got response from KIMI: %s", response)
            
            # 更新对话历史
            self.conversation_history = messages + [
                {"role": "assistant", "content": response}
            ]
            
            return response
            
        except Exception as e:
            return f"Error in analyzing image: {str(e)}"

    async def chat_with_image(self, image_path, message):
        try:
            image_url = self.encode_image(image_path)
            
            # 构建用户消息
            user_message = {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": message}
                ]
            }
            
            # 系统提示消息
            system_message = {
                "role": "system",
                "content": """
                    你是一个耐心的英语老师，正在教一个6岁的小女孩认识图片中的内容，她的英语只有 100 个单词词汇的 6 岁小女孩儿，请基于她提供的图片进行交流，需要你不停的引导她沟通，要求如下：
                    1、使用简答的词汇与对话
                    2、如果她回答不对，请耐心纠正
                    3、输出内容请使用微软 tts 的 ssml格式化回复，比如对于难的词汇或我要求说慢点，你都要通过 ssml 来控制说话的语气，ssml 格式示例如下：
                        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
                            <voice name='en-US-AndrewMultilingualNeural'>
                                <mstts:express-as style='default'>
                                    <prosody rate="0.8" pitch="+5%">
                                        你好啊，大师
                                    </prosody>
                                    <break time="500ms"/>
                                    <prosody rate="1.2" pitch="-5%">
                                        这是一个使用SSML的示例。
                                    </prosody>
                                    <break time="500ms"/>
                                    <prosody volume="x-loud">
                                        你可以调整语速、音调和音量。
                                    </prosody>
                                    <break time="500ms"/>
                                    <prosody volume="x-soft">
                                        这是一个音量较小的示例。
                                    </prosody>
                                </mstts:express-as>
                            </voice>
                        </speak>
                """
            }
            
            # 裁剪历史消息
            trimmed_history = self.trim_conversation_history(self.conversation_history)
            
            # 构建完整的消息列表
            messages = [system_message] + trimmed_history + [user_message]
            
            logger.info("Sending messages to KIMI: %d", len(messages))

            completion = self.client.chat.completions.create(
                model="moonshot-v1-8k-vision-preview",
                messages=messages
            )
            
            response = completion.choices[0].message.content
            
            # 更新对话历史并再次裁剪
            self.conversation_history = self.trim_conversation_history(
                trimmed_history + [
                    user_message,
                    {"role": "assistant", "content": response}
                ]
            )
            
            return response
            
        except Exception as e:
            return f"Error in chat: {str(e)}"

    def get_cache_key(self, ssml):
        """生成缓存键"""
        return hashlib.md5(ssml.encode()).hexdigest()
        
    async def text_to_speech(self, text, use_cache=True):
        try:
            logger.info("Starting text_to_speech with text length: %s", text)
            
            # 确保文本是有效的 SSML
            if not text.strip().startswith("<speak"):
                logger.warning("Text is not SSML, wrapping it")
                text = f"""
                <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
                       xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
                    <voice name="en-US-JennyNeural">
                        {text}
                    </voice>
                </speak>
                """
            
            cache_key = self.get_cache_key(text)
            cache_file = self.audio_cache_dir / f"{cache_key}.wav"
            
            # 检查缓存
            if use_cache and cache_file.exists():
                logger.info("Cache hit for key: %s", cache_key)
                with open(cache_file, "rb") as f:
                    audio_data = f.read()
                logger.info("Cached audio data size: %d bytes", len(audio_data))
                return base64.b64encode(audio_data).decode('utf-8')
            
            logger.info("Cache miss or disabled, generating new audio")
            
            # 创建音频配置
            audio_config = speechsdk.audio.AudioOutputConfig(filename=str(cache_file))
            
            # 创建语音合成器
            speech_synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=self.speech_config,
                audio_config=audio_config
            )
            
            # 添加详细的错误处理
            error_msg = None
            def handle_canceled(evt):
                nonlocal error_msg
                error_msg = f"TTS canceled: {evt.error_details}"
                logger.error("TTS canceled: %s", evt.error_details)
            
            # 订阅取消事件
            speech_synthesizer.synthesis_canceled.connect(handle_canceled)
            
            logger.info("Calling Azure TTS with SSML text")
            result = speech_synthesizer.speak_ssml_async(text).get()
            
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                logger.info("TTS synthesis completed successfully")
                
                # 从文件读取音频数据
                with open(cache_file, "rb") as f:
                    audio_data = f.read()
                
                logger.info("Generated audio data size: %d bytes", len(audio_data))
                return base64.b64encode(audio_data).decode('utf-8')
            else:
                error_details = error_msg if error_msg else f"TTS failed with reason: {result.reason}"
                logger.error(error_details)
                return None
            
        except Exception as e:
            logger.exception("Error in text_to_speech: %s", str(e))
            return None 

    def speech_to_text(self, audio_data):
        try:
            # 创建临时文件保存音频数据
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            try:
                # 配置语音识别
                audio_config = speechsdk.audio.AudioConfig(filename=temp_file_path)
                
                # 配置语音识别器
                speech_recognizer = speechsdk.SpeechRecognizer(
                    speech_config=self.speech_config,
                    audio_config=audio_config,
                    language="en-US"  # 指定语言
                )
                
                # 使用 Promise 模式进行语音识别
                done = False
                recognized_text = None

                def handle_result(evt):
                    nonlocal recognized_text
                    if evt.result.text:
                        recognized_text = evt.result.text

                def stop_cb(evt):
                    nonlocal done
                    done = True

                # 注册回调
                speech_recognizer.recognized.connect(handle_result)
                speech_recognizer.session_stopped.connect(stop_cb)
                speech_recognizer.canceled.connect(stop_cb)

                # 开始识别
                result = speech_recognizer.recognize_once()
                
                # 删除临时文件
                os.unlink(temp_file_path)
                
                if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                    return result.text
                else:
                    logger.warning("Speech recognition failed with reason: %s", result.reason)
                    return None
                    
            except Exception as e:
                # 确保临时文件被删除
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                raise e
                
        except Exception as e:
            logger.exception("Error in speech_to_text: %s", str(e))
            return None 
