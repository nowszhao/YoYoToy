class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.snowflakes = [];
        this.elves = [];  // 存储黑精灵
        this.girl = null; // 小女孩对象
        this.snowmanSpot = null; // 雪人制作点
        this.leaves = [];  // 存储发射的树叶
        this.girlDirection = 1; // 1表示朝右，-1表示朝左
        this.explosions = [];  // 存储爆炸效果
        this.gameOver = false;  // 添加游戏状态
        this.elfSpawnTimer = 0; // 添加精灵生成计时器
        this.hasMagic = true;  // 添加魔法状态标志
        this.gameTime = 5 * 60; // 5分钟，以秒为单位
        this.startTime = Date.now(); // 游戏开始时间
        this.gameOverReason = ''; // 游戏结束原因
        
        // 初始化物理引擎
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        
        // 调整重力
        this.engine.world.gravity.y = 0.8;
        
        // 添加雪花收集相关状态
        this.collectedSnow = 0;  // 收集的雪花数量
        this.snowmanProgress = 0;  // 雪人完成进度(0-100)
        this.snowmanParts = [
            { name: '底座', required: 10, completed: false },
            { name: '身体', required: 80, completed: false },
            { name: '头部', required: 120, completed: false },
            { name: '装饰', required: 10, completed: false }
        ];
        this.currentPart = 0;  // 当前正在制作的部分
        this.isBuilding = false;  // 是否正在制作雪人
        
        // 初始化按键状态对象（移动到 E 键控制之前）
        this.keys = {
            left: false,
            right: false,
            up: false,
            space: false,
            e: false  // 添加 E 键状态
        };
        
        // 添加重启游戏的事件监听
        this.boundRestartGame = this.restartGame.bind(this);
        window.addEventListener('keydown', this.boundRestartGame);
        
        this.init();
        this.createSnowflakes(100);
        this.createElves(3);  // 创建3个黑精灵
        this.createGirl();
        this.createSnowmanSpot();
        this.setupPhysics();
        this.setupControls();
        this.animate();
    }

    init() {
        // 设置画布尺寸为窗口大小
        this.resizeCanvas();
        // 监听窗口调整大小事件
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
    }

    // 创建雪花
    createSnowflakes(count) {
        for (let i = 0; i < count; i++) {
            // 计算x位置，仍然只在左半边产生雪花
            const x = Math.random() * (this.canvas.width / 2);
            
            // 根据x位置计算雪花大小
            // x=0时最大(5)，x=canvas.width/2时最小(1)
            const sizeMultiplier = 1 - (x / (this.canvas.width / 2));
            const baseRadius = 1;
            const maxExtraRadius = 4;
            const radius = baseRadius + (sizeMultiplier * maxExtraRadius);
            
            // 速度也随大小变化，较大的雪花下落较
            const baseSpeed = 1;
            const maxExtraSpeed = 2;
            const speed = baseSpeed + (sizeMultiplier * maxExtraSpeed);
            
            this.snowflakes.push({
                x: x,
                y: Math.random() * this.canvas.height,
                radius: radius,
                speed: speed,
                opacity: 0.8 + (Math.random() * 0.2) // 添加一些随机透明度变化
            });
        }
    }

    // 绘制雪��
    drawSnowMountain() {
        const ctx = this.ctx;
        const baseX = this.canvas.width * 0.25; // 雪山在左半边中心
        const baseY = this.canvas.height * 0.6;  // 与地面齐平

        // 绘制主山体
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(baseX - 50, baseY - 200);  // 左侧山峰
        ctx.lineTo(baseX + 50, baseY - 250);  // 中间主峰
        ctx.lineTo(baseX + 150, baseY - 180); // 右侧山峰
        ctx.lineTo(baseX + 200, baseY);
        ctx.closePath();

        // 创建渐变色
        const gradient = ctx.createLinearGradient(0, baseY - 250, 0, baseY);
        gradient.addColorStop(0, '#ffffff');   // 山顶白雪
        gradient.addColorStop(0.6, '#e0e0e0'); // 中部浅灰
        gradient.addColorStop(1, '#a0a0a0');   // 山脚深灰

        ctx.fillStyle = gradient;
        ctx.fill();

        // 添加雪山细节
        ctx.beginPath();
        ctx.moveTo(baseX - 30, baseY - 180);
        ctx.lineTo(baseX, baseY - 200);
        ctx.lineTo(baseX + 30, baseY - 170);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 修改绘制城堡方法
    drawCastle() {
        const ctx = this.ctx;
        const baseX = this.canvas.width * 0.27; // 将城堡位置改为更靠左
        const baseY = this.canvas.height * 0.6;

        // 主体
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(baseX - 60, baseY - 150, 120, 150);

        // 塔楼
        ctx.fillStyle = '#363636';
        ctx.fillRect(baseX - 80, baseY - 200, 40, 200);
        ctx.fillRect(baseX + 40, baseY - 200, 40, 200);

        // 塔尖
        ctx.beginPath();
        ctx.moveTo(baseX - 80, baseY - 200);
        ctx.lineTo(baseX - 60, baseY - 240);
        ctx.lineTo(baseX - 40, baseY - 200);
        ctx.fillStyle = '#2c2c2c';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(baseX + 40, baseY - 200);
        ctx.lineTo(baseX + 60, baseY - 240);
        ctx.lineTo(baseX + 80, baseY - 200);
        ctx.fill();

        // 添加城堡窗户
        ctx.fillStyle = '#8B0000'; // 暗红色的窗户
        ctx.fillRect(baseX - 40, baseY - 120, 20, 30);
        ctx.fillRect(baseX + 20, baseY - 120, 20, 30);
    }

    // 绘制房子
    drawHouse() {
        const ctx = this.ctx;
        const baseX = this.canvas.width * 0.92; // 房子更靠右
        const baseY = this.canvas.height * 0.6;
        const scale = 3; // 放大系数

        // 主体
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(
            baseX - 50 * scale,
            baseY - 100 * scale,
            100 * scale,
            100 * scale
        );

        // 屋顶
        ctx.beginPath();
        ctx.moveTo(baseX - 60 * scale, baseY - 100 * scale);
        ctx.lineTo(baseX, baseY - 150 * scale);
        ctx.lineTo(baseX + 60 * scale, baseY - 100 * scale);
        ctx.fillStyle = '#A52A2A';
        ctx.fill();

        // 窗户
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(
            baseX - 30 * scale,
            baseY - 80 * scale,
            20 * scale,
            20 * scale
        );
        ctx.fillRect(
            baseX + 10 * scale,
            baseY - 80 * scale,
            20 * scale,
            20 * scale
        );

        // 门
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(
            baseX - 15 * scale,
            baseY - 50 * scale,
            30 * scale,
            50 * scale
        );
    }

    // 绘制地面
    drawGround() {
        const ctx = this.ctx;
        
        // 左侧血色地面
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(0, this.canvas.height * 0.6, this.canvas.width / 2, this.canvas.height * 0.4);
        
        // 右侧彩色地面
        ctx.fillStyle = '#90EE90';
        ctx.fillRect(this.canvas.width / 2, this.canvas.height * 0.6, this.canvas.width / 2, this.canvas.height * 0.4);
    }

    // 绘制天空
    drawSky() {
        const ctx = this.ctx;
        
        // 左侧灰暗天空
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(0, 0, this.canvas.width / 2, this.canvas.height * 0.6);
        
        // 右侧蓝色天空
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(this.canvas.width / 2, 0, this.canvas.width / 2, this.canvas.height * 0.6);
    }

    // 更新雪花位置
    updateSnowflakes() {
        this.snowflakes.forEach(snow => {
            snow.y += snow.speed;
            
            // 当雪花落到地面时，重置位置
            if (snow.y > this.canvas.height) {
                snow.y = 0;
                // 保持在原来的x轴位置重新落下，维持密度分布
                snow.x = Math.min(snow.x + (Math.random() * 20 - 10), this.canvas.width / 2);
            }
        });
    }

    // 绘制雪花
    drawSnowflakes() {
        const ctx = this.ctx;
        
        this.snowflakes.forEach(snow => {
            ctx.beginPath();
            ctx.arc(snow.x, snow.y, snow.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${snow.opacity})`;
            ctx.fill();
            
            // 为较大的雪花添加简单的光晕效果
            if (snow.radius > 3) {
                ctx.beginPath();
                ctx.arc(snow.x, snow.y, snow.radius * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${snow.opacity * 0.3})`;
                ctx.fill();
            }
        });
    }

    // 修改 createElves 方法
    createElves(count) {
        for (let i = 0; i < count; i++) {
            this.createElf();  // 使用新的 createElf 方法
        }
    }

    // 添加 createElf 方法
    createElf() {
        const castleX = this.canvas.width * 0.15; // 城堡位置
        const castleDoorX = castleX - 10;  // 城堡门的位置
        const baseY = this.canvas.height * 0.6 - 50; // 地面上方一点
        
        this.elves.push({
            x: castleDoorX,
            y: baseY,
            width: 30,
            height: 50,
            speed: 1 + Math.random(), // 随机速度 1-2
            color: '#1a1a1a',     // 黑精灵颜色
            direction: 1,         // 移动方向：1向右，-1向左
            moveTimer: 0,         // 移动计时器
            moveDuration: Math.random() * 2000 + 1000, // 随机移动持续时间(1-3秒)
            originalSpeed: 1 + Math.random() // 保存原始速度用于方向改变
        });
    }

    // 创建小女孩
    createGirl() {
        this.girl = {
            x: this.canvas.width * 0.7,
            y: this.canvas.height * 0.6 - 60,
            width: 40,
            height: 60,
            color: '#FF69B4' // 粉色
        };
    }

    // 创建雪人制作点
    createSnowmanSpot() {
        const houseX = this.canvas.width * 0.85;
        this.snowmanSpot = {
            x: houseX - 60, // 在房子门口
            y: this.canvas.height * 0.6 - 20,
            radius: 40,
            color: '#ffffff',
            border: '#cccccc'
        };
    }

    // 修改 updateElves 方法
    updateElves() {
        const currentTime = Date.now();
        const houseX = this.canvas.width * 0.92; // 房子位置
        const castleX = this.canvas.width * 0.15; // 城堡位置
        const centerX = this.canvas.width / 2;    // 画布中心

        // 每隔3-6秒随机生成一个黑精灵
        if (!this.gameOver && currentTime - this.elfSpawnTimer > Math.random() * 30000 + 30000) {
            this.createElf();
            this.elfSpawnTimer = currentTime;
        }

        // 更新所有黑精灵的位置
        for (let i = this.elves.length - 1; i >= 0; i--) {
            const elf = this.elves[i];
            
            // 检查是否需要改变方向
            if (currentTime - elf.moveTimer > elf.moveDuration) {
                // 在边界附近时强制改变方向
                if (elf.x <= castleX) {
                    elf.direction = 1;
                } else if (elf.x >= houseX - 100) {
                    elf.direction = -1;
                } else {
                    // 随机改变方向
                    elf.direction = Math.random() < 0.5 ? -1 : 1;
                }
                
                // 更新移动计时器和持续时间
                elf.moveTimer = currentTime;
                elf.moveDuration = Math.random() * 2000 + 1000;
                
                // 随机调整速度
                elf.speed = elf.originalSpeed * (0.8 + Math.random() * 0.4); // 速度在原始速度的80%-120%之间
            }

            // 更新位置
            elf.x += elf.speed * elf.direction;

            // 确保不会超出边界
            if (elf.x < castleX) {
                elf.x = castleX;
                elf.direction = 1;
            } else if (elf.x > houseX - 100) {
                this.gameOver = true;
                this.gameOverReason = '黑精灵进入了房子';
                return;
            }
        }
    }

    // 绘制黑精灵
    drawElves() {
        const ctx = this.ctx;
        this.elves.forEach(elf => {
            ctx.save();
            
            // 根据移动方向翻转
            if (elf.direction === -1) {
                ctx.translate(elf.x + elf.width, elf.y);
                ctx.scale(-1, 1);
                ctx.translate(-elf.width, 0);
            } else {
                ctx.translate(elf.x, elf.y);
            }

            // 绘制身体
            ctx.fillStyle = elf.color;
            ctx.fillRect(0, 0, elf.width, elf.height);

            // 绘制帽子
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(elf.width/2, -20);
            ctx.lineTo(elf.width, 0);
            ctx.fill();

            // 绘制红色眼睛
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(10, 10, 3, 0, Math.PI * 2);
            ctx.arc(20, 10, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    // 绘制小女孩
    drawGirl() {
        const ctx = this.ctx;
        const g = this.girl;
        
        ctx.save();
        ctx.translate(g.x + g.width/2, g.y + g.height/2);
        ctx.scale(this.girlDirection, 1);
        
        // 根据位置决定颜色
        g.color = g.x < this.canvas.width/2 ? '#808080' : '#FF69B4';  // 左侧灰色，右侧粉色
        
        // 绘制身体
        ctx.fillStyle = g.color;
        ctx.fillRect(-g.width/2, -g.height/2, g.width, g.height);
        
        // 绘制腿
        ctx.fillStyle = '#FFE4E1';
        ctx.fillRect(g.width/2 - 15, g.height - 20, 8, 20); // 左腿
        ctx.fillRect(g.width/2 + 5, g.height - 20, 8, 20);  // 右腿

        // 绘制头发 - 根据魔法状态改变颜色
        ctx.fillStyle = this.hasMagic ? '#FFD700' : '#A8A8A8';  // 有魔法是金色，无魔法是灰色
        ctx.beginPath();
        ctx.arc(g.width/2, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // 添加发丝细节
        ctx.strokeStyle = this.hasMagic ? '#DAA520' : '#696969';
        ctx.beginPath();
        ctx.moveTo(g.width/2 + 15, -5);
        ctx.quadraticCurveTo(g.width/2 + 25, 10, g.width/2 + 20, 25);
        ctx.stroke();

        // 绘制脸
        ctx.fillStyle = '#FFE4E1';
        ctx.beginPath();
        ctx.arc(g.width/2, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // 绘制侧脸轮廓
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(g.width/2 + 10, -5);
        ctx.quadraticCurveTo(g.width/2 + 15, 0, g.width/2 + 10, 5);
        ctx.stroke();

        // 绘制眼睛（侧只画一个）
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(g.width/2 + 5, -2, 2, 0, Math.PI * 2);
        ctx.fill();

        // ��制微笑
        ctx.beginPath();
        ctx.arc(g.width/2 + 5, 3, 3, 0, Math.PI);
        ctx.stroke();

        // 绘制手臂 - 根据魔法状态改变颜色
        ctx.fillStyle = this.hasMagic ? g.color : '#808080';
        ctx.fillRect(g.width/2 - 5, 15, 25, 8); // 手臂

        // 如果有魔法，添加魔法光环效果
        if (this.hasMagic) {
            ctx.beginPath();
            ctx.arc(g.width/2, g.height/2, 30, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.restore();
    }

    // 绘制雪人制作点
    drawSnowmanSpot() {
        const ctx = this.ctx;
        const spot = this.snowmanSpot;

        // 绘制圆形区域
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
        ctx.fillStyle = spot.color;
        ctx.fill();
        ctx.strokeStyle = spot.border;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 添加标记
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('雪人制作处', spot.x, spot.y + spot.radius + 20);

        // 如果有完成的部分，绘制雪人
        if (this.currentPart > 0) {
            const centerX = this.snowmanSpot.x;
            const baseY = this.snowmanSpot.y;
            
            // 绘制已完成的部分
            this.snowmanParts.forEach((part, index) => {
                if (!part.completed) return;
                
                const ctx = this.ctx;
                
                switch(index) {
                    case 0: // 底座
                        // 添加雪的纹理和阴影
                        const gradientBase = ctx.createRadialGradient(
                            centerX, baseY, 0,
                            centerX, baseY, 30
                        );
                        gradientBase.addColorStop(0, '#FFFFFF');
                        gradientBase.addColorStop(0.7, '#F0F0F0');
                        gradientBase.addColorStop(1, '#E0E0E0');
                        
                        ctx.beginPath();
                        ctx.arc(centerX, baseY, 30, 0, Math.PI * 2);
                        ctx.fillStyle = gradientBase;
                        ctx.fill();
                        
                        // 添加底部阴影
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                        ctx.shadowBlur = 10;
                        ctx.shadowOffsetY = 5;
                        ctx.stroke();
                        ctx.shadowColor = 'transparent';
                        
                        // 添加雪的颗粒感
                        for (let i = 0; i < 20; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const radius = Math.random() * 25;
                            const x = centerX + Math.cos(angle) * radius;
                            const y = baseY + Math.sin(angle) * radius;
                            
                            ctx.fillStyle = '#FFFFFF';
                            ctx.beginPath();
                            ctx.arc(x, y, 1, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;

                    case 1: // 身体
                        const gradientBody = ctx.createRadialGradient(
                            centerX, baseY - 45, 0,
                            centerX, baseY - 45, 20
                        );
                        gradientBody.addColorStop(0, '#FFFFFF');
                        gradientBody.addColorStop(0.6, '#F0F0F0');
                        gradientBody.addColorStop(1, '#E0E0E0');
                        
                        ctx.beginPath();
                        ctx.arc(centerX, baseY - 45, 20, 0, Math.PI * 2);
                        ctx.fillStyle = gradientBody;
                        ctx.fill();
                        
                        // 添加围巾
                        ctx.fillStyle = '#FF0000';
                        ctx.beginPath();
                        ctx.ellipse(centerX, baseY - 55, 22, 8, 0, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // 围巾飘带
                        ctx.beginPath();
                        ctx.moveTo(centerX + 15, baseY - 55);
                        ctx.quadraticCurveTo(
                            centerX + 25, baseY - 45,
                            centerX + 20, baseY - 35
                        );
                        ctx.quadraticCurveTo(
                            centerX + 15, baseY - 40,
                            centerX + 18, baseY - 45
                        );
                        ctx.fill();
                        break;

                    case 2: // 头部
                        const gradientHead = ctx.createRadialGradient(
                            centerX, baseY - 80, 0,
                            centerX, baseY - 80, 15
                        );
                        gradientHead.addColorStop(0, '#FFFFFF');
                        gradientHead.addColorStop(0.6, '#F0F0F0');
                        gradientHead.addColorStop(1, '#E0E0E0');
                        
                        ctx.beginPath();
                        ctx.arc(centerX, baseY - 80, 15, 0, Math.PI * 2);
                        ctx.fillStyle = gradientHead;
                        ctx.fill();
                        
                        // 添加帽子
                        ctx.fillStyle = '#4A4A4A';
                        ctx.beginPath();
                        ctx.rect(centerX - 12, baseY - 100, 24, 15);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.rect(centerX - 8, baseY - 110, 16, 10);
                        ctx.fill();
                        
                        // 添加帽子装饰
                        ctx.fillStyle = '#FF0000';
                        ctx.beginPath();
                        ctx.arc(centerX, baseY - 100, 3, 0, Math.PI * 2);
                        ctx.fill();
                        break;

                    case 3: // 装饰
                        // 眼睛
                        ctx.fillStyle = '#000';
                        ctx.beginPath();
                        ctx.arc(centerX - 5, baseY - 83, 2, 0, Math.PI * 2);
                        ctx.arc(centerX + 5, baseY - 83, 2, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // 胡萝卜鼻子带纹理
                        const noseGradient = ctx.createLinearGradient(
                            centerX, baseY - 80,
                            centerX + 8, baseY - 78
                        );
                        noseGradient.addColorStop(0, '#FFA500');
                        noseGradient.addColorStop(0.5, '#FF8C00');
                        noseGradient.addColorStop(1, '#FFA500');
                        
                        ctx.fillStyle = noseGradient;
                        ctx.beginPath();
                        ctx.moveTo(centerX, baseY - 80);
                        ctx.lineTo(centerX + 8, baseY - 78);
                        ctx.lineTo(centerX, baseY - 76);
                        ctx.closePath();
                        ctx.fill();
                        
                        // 添加树枝手臂
                        ctx.strokeStyle = '#4A2F1D';
                        ctx.lineWidth = 2;
                        
                        // 左手臂
                        ctx.beginPath();
                        ctx.moveTo(centerX - 20, baseY - 45);
                        ctx.lineTo(centerX - 35, baseY - 55);
                        ctx.moveTo(centerX - 30, baseY - 52);
                        ctx.lineTo(centerX - 35, baseY - 48);
                        ctx.stroke();
                        
                        // 右手臂
                        ctx.beginPath();
                        ctx.moveTo(centerX + 20, baseY - 45);
                        ctx.lineTo(centerX + 35, baseY - 55);
                        ctx.moveTo(centerX + 30, baseY - 52);
                        ctx.lineTo(centerX + 35, baseY - 48);
                        ctx.stroke();
                        
                        // 微笑
                        ctx.beginPath();
                        ctx.arc(centerX, baseY - 78, 8, 0.2, Math.PI - 0.2);
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        
                        // 添加纽扣
                        ctx.fillStyle = '#000';
                        ctx.beginPath();
                        ctx.arc(centerX, baseY - 45, 2, 0, Math.PI * 2);
                        ctx.arc(centerX, baseY - 35, 2, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                }
            });
        }
    }

    // 设置物理世界
    setupPhysics() {
        // 创建地面
        const ground = Matter.Bodies.rectangle(
            this.canvas.width / 2,
            this.canvas.height * 0.6,
            this.canvas.width,
            20,
            { 
                isStatic: true,
                collisionFilter: {
                    category: 0x0001  // 地面的碰撞类别
                }
            }
        );
        
        // 创建小女孩的物理
        this.girlBody = Matter.Bodies.rectangle(
            this.girl.x + this.girl.width / 2,
            this.girl.y + this.girl.height / 2,
            this.girl.width,
            this.girl.height,
            {
                inertia: Infinity,
                friction: 0.002,
                restitution: 0,
                collisionFilter: {
                    category: 0x0004  // 小女孩的碰撞类别
                }
            }
        );
        
        Matter.World.add(this.world, [ground, this.girlBody]);
    }

    // 设置控制器
    setupControls() {
        this.keys = {
            left: false,
            right: false,
            up: false,    // 改为up
            space: false  // space用于发射
        };

        window.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'ArrowLeft':
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                    this.keys.right = true;
                    break;
                case 'ArrowUp':           
                    if (!this.keys.up && this.canJump()) {
                        this.keys.up = true;
                        this.jump();
                    }
                    break;
                case 'Space':             
                    if (!this.keys.space) {
                        this.keys.space = true;
                        this.shootLeaf();
                    }
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'ArrowLeft':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                    this.keys.right = false;
                    break;
                case 'ArrowUp':          
                    this.keys.up = false;
                    break;
                case 'Space':            
                    this.keys.space = false;
                    break;
            }
        });
    }

    // 检查是否可以跳跃
    canJump() {
        return Math.abs(this.girlBody.velocity.y) < 0.5;
    }

    // 跳跃
    jump() {
        Matter.Body.setVelocity(this.girlBody, {
            x: this.girlBody.velocity.x,
            y: -12
        });
    }

    // 更新小女孩位置
    updateGirl() {
        const moveSpeed = 5;
        const leftBoundary = 0;
        const rightBoundary = this.canvas.width;
        
        // 左右移动
        if (this.keys.left) {
            // 检查左边界
            const nextX = this.girl.x - moveSpeed;
            if (nextX > leftBoundary) {
                this.girl.x = nextX;
                this.girlDirection = -1;
            } else {
                this.girl.x = leftBoundary;
            }
        }
        if (this.keys.right) {
            // 检查右边界
            const nextX = this.girl.x + moveSpeed;
            if (nextX + this.girl.width < rightBoundary) {
                this.girl.x = nextX;
                this.girlDirection = 1;
            } else {
                this.girl.x = rightBoundary - this.girl.width;
            }
        }

        // 更新物理位置到渲染位置
        this.girl.y = this.girlBody.position.y - this.girl.height/2;
    }

    // 发射树叶
    shootLeaf() {
        if (!this.hasMagic) return;  // 如果没有魔法，接返回

        const leafSize = 5;
        const shootSpeed = 15;
        const centerX = this.canvas.width / 2;
        
        // 创建树叶的物理体
        const leaf = Matter.Bodies.circle(
            this.girl.x + this.girl.width/2,
            this.girl.y + this.girl.height/2,
            leafSize/2,
            {
                friction: 0.001,
                restitution: 0.6,
                density: 0.001,
                render: {
                    fillStyle: '#228B22'
                },
                collisionFilter: {
                    category: 0x0002,  // 设置碰撞类别
                    mask: 0x0001       // 只与地面碰撞
                }
            }
        );

        // 设置树叶的初始速度
        Matter.Body.setVelocity(leaf, {
            x: shootSpeed * this.girlDirection,
            y: -2
        });

        // 添加旋转效果
        Matter.Body.setAngularVelocity(leaf, this.girlDirection * 0.3);

        // 创建左侧界墙（不可见）
        const boundaryWall = Matter.Bodies.rectangle(
            centerX,
            this.canvas.height / 2,
            10,
            this.canvas.height,
            {
                isStatic: true,
                render: { visible: false },
                collisionFilter: {
                    category: 0x0001
                }
            }
        );

        // 将树叶和边界墙添加到物理世界
        Matter.World.add(this.world, [leaf, boundaryWall]);
        
        // 设置定时器移除边界墙
        setTimeout(() => {
            Matter.World.remove(this.world, boundaryWall);
        }, 100);

        this.leaves.push({
            body: leaf,
            timeCreated: Date.now()
        });
    }

    // 更新树叶状态
    updateLeaves() {
        const currentTime = Date.now();
        const maxLeafLifetime = 3000; // 树叶存在3秒
        const centerX = this.canvas.width / 2;

        // 移除超时或越界的树叶
        this.leaves = this.leaves.filter(leaf => {
            const pos = leaf.body.position;
            
            // 检查是否超时或越过左边界
            if (currentTime - leaf.timeCreated > maxLeafLifetime || pos.x < centerX) {
                Matter.World.remove(this.world, leaf.body);
                return false;
            }
            return true;
        });
    }

    // 绘制树叶
    drawLeaves() {
        const ctx = this.ctx;
        this.leaves.forEach(leaf => {
            const pos = leaf.body.position;
            const angle = leaf.body.angle;
            
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(angle);
            
            // 绘制树叶形状
            ctx.beginPath();
            ctx.fillStyle = '#228B22';
            ctx.moveTo(0, -7.5);
            ctx.bezierCurveTo(7.5, -7.5, 7.5, 7.5, 0, 7.5);
            ctx.bezierCurveTo(-7.5, 7.5, -7.5, -7.5, 0, -7.5);
            ctx.fill();
            
            // 添加叶脉
            ctx.beginPath();
            ctx.strokeStyle = '#006400';
            ctx.moveTo(0, -7.5);
            ctx.lineTo(0, 7.5);
            ctx.stroke();
            
            ctx.restore();
        });
    }

    // 添加爆炸效果类
    createExplosion(x, y) {
        this.explosions.push({
            x: x,
            y: y,
            radius: 1,
            maxRadius: 30,
            alpha: 1,
            particles: Array.from({length: 8}, () => ({
                x: x,
                y: y,
                angle: Math.random() * Math.PI * 2,
                speed: Math.random() * 3 + 2,
                radius: Math.random() * 3 + 2,
                alpha: 1
            }))
        });
    }

    // 更新爆炸效果
    updateExplosions() {
        this.explosions = this.explosions.filter(explosion => {
            explosion.radius += 2;
            explosion.alpha -= 0.05;

            explosion.particles.forEach(particle => {
                particle.x += Math.cos(particle.angle) * particle.speed;
                particle.y += Math.sin(particle.angle) * particle.speed;
                particle.alpha -= 0.05;
            });

            return explosion.alpha > 0;
        });
    }

    // 绘制爆炸效果
    drawExplosions() {
        const ctx = this.ctx;
        this.explosions.forEach(explosion => {
            // 绘制中心爆炸圈
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 50, 0, ${explosion.alpha})`;
            ctx.fill();

            // 绘制爆炸粒子
            explosion.particles.forEach(particle => {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 100, 0, ${particle.alpha})`;
                ctx.fill();
            });
        });
    }

    // 修改 checkCollisions 方法，添加黑精灵与小女孩的碰撞检测
    checkCollisions() {
        const girlHitbox = {
            x: this.girl.x,
            y: this.girl.y,
            width: this.girl.width,
            height: this.girl.height
        };

        // 检查树叶与黑精灵的碰撞
        for (let i = this.leaves.length - 1; i >= 0; i--) {
            const leaf = this.leaves[i];
            const leafPos = leaf.body.position;
            
            for (let j = this.elves.length - 1; j >= 0; j--) {
                const elf = this.elves[j];
                
                // 树叶与黑精灵的碰撞检测
                if (leafPos.x > elf.x && 
                    leafPos.x < elf.x + elf.width &&
                    leafPos.y > elf.y && 
                    leafPos.y < elf.y + elf.height) {
                    
                    // 创建爆炸效果
                    this.createExplosion(elf.x + elf.width/2, elf.y + elf.height/2);
                    
                    // 移除黑精灵和树叶
                    this.elves.splice(j, 1);
                    Matter.World.remove(this.world, leaf.body);
                    this.leaves.splice(i, 1);
                    break;
                }
            }
        }

        // 检查黑精灵与小女孩的碰撞
        for (let i = this.elves.length - 1; i >= 0; i--) {
            const elf = this.elves[i];
            
            // 黑精灵与小女孩的碰撞检测
            if (this.isColliding(elf, girlHitbox)) {
                this.gameOver = true;
                this.gameOverReason = '被黑精灵抓住了';
                return;
            }

            // 检查是否到达房子
            const houseX = this.canvas.width * 0.92;
            if (elf.x > houseX - 100) {
                this.gameOver = true;
                this.gameOverReason = '黑精灵进入了房子';
                return;
            }
        }
    }

    // 添加碰撞检测辅助方法
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    // 添加更新时间方法
    updateGameTime() {
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - this.startTime) / 1000);
        this.gameTime = Math.max(5 * 60 - elapsedSeconds, 0);

        // 时间耗尽，游戏结束
        if (this.gameTime <= 0 && !this.gameOver) {
            this.gameOver = true;
            this.gameOverReason = '时间耗尽！没有在规定时间内完成雪人';
        }
    }

    // 添加绘制时间方法
    drawGameTime() {
        const ctx = this.ctx;
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = this.gameTime % 60;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(
            `剩余时间: ${minutes}:${seconds.toString().padStart(2, '0')}`,
            this.canvas.width - 20,
            20
        );
    }

    // 绘制场景
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制背景
        this.drawSky();
        this.drawGround();
        
        // 绘制雪山
        this.drawSnowMountain();
        
        // 绘制建筑
        this.drawCastle();
        this.drawHouse();
        
        // 绘制角色场景元素
        this.drawSnowmanSpot();
        this.drawElves();
        this.drawGirl();
        this.drawLeaves();
        this.drawExplosions();
        this.drawSnowflakes();
        
        // 绘制积雪效果
        this.drawSnowEffects();
        
        // 绘制倒计时
        this.drawGameTime();
    }

    // 动画循环
    animate() {
        if (this.gameOver) {
            this.drawGameOver();
            return;
        }

        Matter.Engine.update(this.engine);
        this.updateSnowflakes();
        this.updateElves();
        this.updateGirl();
        this.updateLeaves();
        this.checkCollisions();
        this.updateExplosions();
        this.updateGameTime();

        // 检查雪花收集
        this.checkSnowflakeCollection();

        // 自动检测是否在雪人制作范围内
        this.isBuilding = this.isNearSnowmanSpot();
        if (this.isBuilding) {
            this.buildSnowman();
        }

        this.draw();
        this.drawStatus();

        requestAnimationFrame(() => this.animate());
    }

    // 添加游戏结束画面
    drawGameOver() {
        const ctx = this.ctx;
        
        // 绘制半透明黑色背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制游戏结束文本
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('游戏结束', this.canvas.width/2, this.canvas.height/2 - 30);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.fillText(this.gameOverReason, this.canvas.width/2, this.canvas.height/2 + 20);
        ctx.fillText('按空格键重新开始', this.canvas.width/2, this.canvas.height/2 + 60);
    }

    // 修改 restartGame 方法
    restartGame(e) {
        if (e.code === 'Space' && this.gameOver) {  // 只在游戏结束状态才能重启
            // 重置游戏状态
            this.gameOver = false;
            this.gameOverReason = '';
            this.elfSpawnTimer = 0;
            this.elves = [];
            this.leaves = [];
            this.explosions = [];
            this.snowEffects = [];  // 清空雪花效果
            this.collectedSnow = 0; // 重置收集的雪花
            this.currentPart = 0;   // 重置雪人进度
            this.snowmanProgress = 0;
            this.snowmanParts.forEach(part => part.completed = false);
            this.gameTime = 5 * 60;  // 重置时间
            this.startTime = Date.now();  // 重置开始时间
            this.hasMagic = true;    // 重置魔法状态
            
            // 重置小女孩位置
            this.girl.x = this.canvas.width * 0.7;
            this.girl.y = this.canvas.height * 0.6 - 60;
            
            // 重新创建初始黑精灵
            this.createElves(3);
            
            // 重新开始动画循环
            requestAnimationFrame(() => this.animate());
        }
    }

    // 修改 checkSnowflakeCollection 方法
    checkSnowflakeCollection() {
        const girlHitbox = {
            x: this.girl.x,
            y: this.girl.y,
            width: this.girl.width,
            height: this.girl.height
        };

        // 添加积雪效果数组
        if (!this.snowEffects) {
            this.snowEffects = [];
        }

        this.snowflakes = this.snowflakes.filter(snow => {
            // 检查雪花是否与小女孩碰撞
            if (this.pointInRect(snow.x, snow.y, girlHitbox)) {
                // 在左半边时才产生积雪效果
                if (this.girl.x < this.canvas.width / 2) {
                    // 创建多个彩色效果
                    const colors = ['#FF69B4', '#87CEEB', '#90EE90', '#FFD700', '#DDA0DD'];
                    const particleCount = 5; // 每个��花产生5个彩色粒子
                    
                    for (let i = 0; i < particleCount; i++) {
                        const angle = (Math.PI * 2 * i) / particleCount; // 均匀分布在圆周上
                        const speed = Math.random() * 2 + 1;
                        
                        this.snowEffects.push({
                            x: snow.x,
                            y: snow.y,
                            radius: snow.radius * 1.5,
                            alpha: 1,
                            color: colors[i % colors.length],
                            speedX: Math.cos(angle) * speed,
                            speedY: Math.sin(angle) * speed + 1, // 向上的初始速度
                            rotation: Math.random() * Math.PI * 2,
                            rotationSpeed: (Math.random() - 0.5) * 0.2
                        });
                    }
                }
                
                this.collectedSnow += Math.ceil(snow.radius);
                return false;
            }
            return true;
        });

        // 更新积雪效果
        this.updateSnowEffects();

        // 如果雪花数量少于100，则生成新的雪花
        if (this.snowflakes.length < 100) {
            this.createSnowflakes(1);
        }
    }

    // 修改更新���雪效果的方法
    updateSnowEffects() {
        if (!this.snowEffects) return;

        for (let i = this.snowEffects.length - 1; i >= 0; i--) {
            const effect = this.snowEffects[i];
            effect.alpha -= 0.01; // 降低消失速度
            effect.radius += 0.2; // 降低扩大速度
            
            // 更新位置
            effect.x += effect.speedX;
            effect.y += effect.speedY;
            effect.speedY += 0.1; // 添加重力效果
            
            // 更新旋转
            effect.rotation += effect.rotationSpeed;

            // 如果完全透明或超出屏幕则移除
            if (effect.alpha <= 0 || effect.y > this.canvas.height) {
                this.snowEffects.splice(i, 1);
            }
        }
    }

    // 修改绘制积雪效果的方法
    drawSnowEffects() {
        if (!this.snowEffects) return;

        const ctx = this.ctx;
        this.snowEffects.forEach(effect => {
            ctx.save();
            ctx.translate(effect.x, effect.y);
            ctx.rotate(effect.rotation);
            
            // 绘制星形或花瓣形状
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5;
                const innerRadius = effect.radius * 0.4;
                const outerRadius = effect.radius;
                
                // 外点
                const outerX = Math.cos(angle) * outerRadius;
                const outerY = Math.sin(angle) * outerRadius;
                
                // 内点
                const innerAngle = angle + Math.PI / 5;
                const innerX = Math.cos(innerAngle) * innerRadius;
                const innerY = Math.sin(innerAngle) * innerRadius;
                
                if (i === 0) {
                    ctx.moveTo(outerX, outerY);
                } else {
                    ctx.lineTo(outerX, outerY);
                }
                
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            
            // 添加渐变效果
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effect.radius);
            gradient.addColorStop(0, `${effect.color}FF`);
            gradient.addColorStop(1, `${effect.color}00`);
            
            ctx.fillStyle = `${effect.color}${Math.floor(effect.alpha * 255).toString(16).padStart(2, '0')}`;
            ctx.fill();
            
            ctx.restore();
        });
    }

    // 添加点与矩形碰撞检测辅助方法
    pointInRect(x, y, rect) {
        return x >= rect.x && 
               x <= rect.x + rect.width && 
               y >= rect.y && 
               y <= rect.y + rect.height;
    }

    // 添加雪人制作方法
    buildSnowman() {
        if (!this.isNearSnowmanSpot() || this.collectedSnow <= 0) return;

        const currentPart = this.snowmanParts[this.currentPart];
        if (!currentPart) return;  // 所有部分都已完成

        // 消耗收集的雪花
        const buildSpeed = 1;  // 每帧消耗的雪花数量
        if (this.collectedSnow >= buildSpeed) {
            this.collectedSnow -= buildSpeed;
            this.snowmanProgress += (buildSpeed / currentPart.required) * 100;

            // 检查当前部分是否完成
            if (this.snowmanProgress >= 100) {
                currentPart.completed = true;
                this.currentPart++;
                this.snowmanProgress = 0;

                // 检查是否完成所有部分
                if (this.currentPart >= this.snowmanParts.length) {
                    this.gameOver = true;
                    this.gameOverReason = '恭喜！成功制作出雪人！';
                    return;
                }
            }
        }
    }

    // 检查是否在雪人制作点附近
    isNearSnowmanSpot() {
        const distance = Math.sqrt(
            Math.pow(this.girl.x + this.girl.width/2 - this.snowmanSpot.x, 2) +
            Math.pow(this.girl.y + this.girl.height/2 - this.snowmanSpot.y, 2)
        );
        return distance < this.snowmanSpot.radius + 30;
    }

    // 添加绘制雪花收集状态和雪人进度方法
    drawStatus() {
        const ctx = this.ctx;
        
        // 绘制雪花收集数量
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`收集的雪花: ${Math.floor(this.collectedSnow)}`, 20, 20);

        // 始终显示雪人制作进度
        const currentPart = this.snowmanParts[this.currentPart];
        if (currentPart) {
            // 绘制当前部分名称和进度
            ctx.fillText(
                `雪人制作进度: ${currentPart.name} (${Math.floor(this.snowmanProgress)}%)`,
                20, 50
            );

            // 绘制进度条
            const barWidth = 200;
            const barHeight = 20;
            const barX = 20;
            const barY = 80;

            // 背景
            ctx.fillStyle = '#444';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // 进度
            ctx.fillStyle = '#FFF';
            ctx.fillRect(barX, barY, barWidth * (this.snowmanProgress / 100), barHeight);

            // 显示是否在制作范围内的提示
            if (this.isNearSnowmanSpot()) {
                ctx.fillStyle = '#90EE90';  // 浅绿色
                ctx.fillText('正在制作雪人...', 20, 110);
            }
        }

        // 显示已完成的部分
        let completedText = '已完成: ';
        this.snowmanParts.forEach((part, index) => {
            if (part.completed) {
                completedText += part.name + ' ';
            }
        });
        ctx.fillStyle = '#90EE90';
        ctx.fillText(completedText, 20, 140);
    }
}

// 启动游戏
window.onload = () => {
    new Game();
}; 