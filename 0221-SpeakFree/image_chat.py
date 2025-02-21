import os
import base64
import azure.cognitiveservices.speech as speechsdk
from openai import OpenAI
import time

class ImageChatSystem:
    def __init__(self):
        # KIMI API 配置
        self.client = OpenAI(
            api_key="sk-Z6YApuZ0y89eAMLTaaySq52s9jQNT9BdgqhbLKY8bTp2CtFA",
            base_url="https://api.moonshot.cn/v1",
        )
        
        # Azure Speech 配置
        self.speech_config = speechsdk.SpeechConfig(
            subscription='2xrU1rYR0CxojnFA3VczlcEM2358EK3lnqQSPHrIhciKBwLUdvXhJQQJ99ALACYeBjFXJ3w3AAAYACOGaORK', 
            region='eastus'
        )
        self.speech_config.speech_recognition_language = "en-US"
        self.audio_config = speechsdk.audio.AudioOutputConfig(use_default_speaker=True)
        self.speech_synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=self.speech_config, 
            audio_config=self.audio_config
        )
        self.speech_recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config
        )
        
        self.conversation_history = []
        self.current_image_url = None

    def encode_image(self, image_path):
        with open(image_path, "rb") as f:
            image_data = f.read()
        return f"data:image/{os.path.splitext(image_path)[1]};base64,{base64.b64encode(image_data).decode('utf-8')}"

    def wrap_text_with_ssml(self, text):
        return f"""
           {text}
        """

    def analyze_image(self, image_path):
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

        try:
            self.current_image_url = self.encode_image(image_path)
            # 重置对话历史
            self.conversation_history = []
            
            # 添加系统提示到对话历史
            self.conversation_history.append({
                "role": "system", 
                "content": """
                你是一个耐心的英语老师，正在教一个6岁的小女孩认识图片中的内容。请使用简单的英语单词，并在回复中包含SSML标记:
                  输出内容请使用微软 tts 的 ssml格式化回复，比如对于难的词汇或我要求说慢点，你都要通过 ssml 来控制说话的语气，ssml 格式示例如下：
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
            })
            
            completion = self.client.chat.completions.create(
                model="moonshot-v1-8k-vision-preview",
                messages=[
                    *self.conversation_history,
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": self.current_image_url},
                            },
                            {
                                "type": "text",
                                "text": prompt,
                            },
                        ],
                    }
                ],
            )
            response = completion.choices[0].message.content
            
            # 将用户提问和助手回复都添加到对话历史
            self.conversation_history.append({
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": self.current_image_url},
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            })
            self.conversation_history.append({"role": "assistant", "content": response})
            
            if not response.strip().startswith("<speak"):
                response = self.wrap_text_with_ssml(response)
            
            return response
        except Exception as e:
            return f"Error analyzing image: {str(e)}"

    def chat_with_image(self, user_input):
        try:
            # 构建带有图片的用户输入
            user_message = {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": self.current_image_url},
                    },
                    {
                        "type": "text",
                        "text": user_input,
                    },
                ],
            }
            
            # 创建完整的消息历史
            messages = [
                {
                    "role": "system",
                    "content": "你是一个耐心的英语老师，正在教一个6岁的小女孩认识图片中的内容。请使用简单的英语单词，并在回复中包含SSML标记。"
                },
                *self.conversation_history,
                user_message
            ]
            
            completion = self.client.chat.completions.create(
                model="moonshot-v1-8k-vision-preview",
                messages=messages
            )
            
            response = completion.choices[0].message.content
            
            # 更新对话历史
            self.conversation_history.append(user_message)
            self.conversation_history.append({"role": "assistant", "content": response})
            
            if not response.strip().startswith("<speak"):
                response = self.wrap_text_with_ssml(response)
                
            return response
        except Exception as e:
            return f"Error in chat: {str(e)}"

    def text_to_speech(self, text):
        try:
            result = self.speech_synthesizer.speak_ssml_async(text).get()
            if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
                print(f"Speech synthesis failed: {result.reason}")
        except Exception as e:
            print(f"TTS Error: {str(e)}")

    def speech_to_text(self):
        try:
            print("Listening... Press Enter to stop speaking.")
            
            # 创建事件用于同步
            done = False
            all_results = []

            # 定义回调函数
            def handle_result(evt):
                if evt.result.text:
                    all_results.append(evt.result.text)

            def stop_cb(evt):
                print('CLOSING on {}'.format(evt))
                speech_recognizer.stop_continuous_recognition()
                nonlocal done
                done = True

            # 配置连续识别
            speech_recognizer = speechsdk.SpeechRecognizer(speech_config=self.speech_config)
            speech_recognizer.recognized.connect(handle_result)
            speech_recognizer.session_stopped.connect(stop_cb)
            speech_recognizer.canceled.connect(stop_cb)

            # 开始连续识别
            speech_recognizer.start_continuous_recognition()

            # 等待用户按回车键
            input()
            speech_recognizer.stop_continuous_recognition()

            # 等待识别完成
            while not done:
                time.sleep(.5)

            # 合并所有识别结果
            final_result = ' '.join(all_results)
            
            if final_result:
                return final_result
            else:
                print("No speech detected")
                return None

        except Exception as e:
            print(f"STT Error: {str(e)}")
            return None

    def run(self):
        print("Welcome to Image Chat System!")
        while True:
            image_path = input("\nPlease enter the image path (or 'exit' to quit): ")
            if image_path.lower() == 'exit':
                break

            if not os.path.exists(image_path):
                print("Image file not found. Please try again.")
                continue

            print("\nAnalyzing image...")
            response = self.analyze_image(image_path)
            print("\nKIMI:", response)
            self.text_to_speech(response)

            while True:
                print("\nChoose input method:")
                print("1. Type your question")
                print("2. Speak your question")
                print("3. Change image")
                print("4. Exit")
                
                choice = input("Your choice (1-4): ")
                
                if choice == '1':
                    question = input("\nYour question: ")
                elif choice == '2':
                    question = self.speech_to_text()
                    if question:
                        print(f"\nYou said: {question}")
                    else:
                        continue
                elif choice == '3':
                    break
                elif choice == '4':
                    return
                else:
                    print("Invalid choice. Please try again.")
                    continue

                response = self.chat_with_image(question)
                print("\nKIMI:", response)
                self.text_to_speech(response)

if __name__ == "__main__":
    chat_system = ImageChatSystem()
    chat_system.run() 