document.addEventListener('DOMContentLoaded', function() {
    const character = document.querySelector('.character');
    const snowContainer = document.querySelector('.snow-container');
    let horizontalPosition = 50;
    let verticalPosition = 100;
    const horizontalStep = 2;
    const verticalStep = 10;
    let isMoving = false;
    let isFlipping = false;
    let moveTimeout;

    // 用于检测双击方向键
    let lastKeyPress = {
        key: null,
        time: 0
    };

    document.addEventListener('keydown', function(event) {
        if (isFlipping) return; // 翻跟头时不响应移动

        const currentTime = new Date().getTime();
        
        // 检测双击方向键
        if (event.key === lastKeyPress.key && 
            currentTime - lastKeyPress.time < 300) { // 300ms内的双击
            
            // 处理翻跟头
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                isFlipping = true;
                
                // 移除之前的翻转类
                character.classList.remove('flip-left', 'flip-right');
                
                if (event.key === 'ArrowLeft') {
                    character.classList.add('flip-left');
                    horizontalPosition = Math.max(5, horizontalPosition - 20);
                } else {
                    character.classList.add('flip-right');
                    horizontalPosition = Math.min(95, horizontalPosition + 20);
                }
                
                // 更新位置
                character.style.left = horizontalPosition + '%';
                
                // 动画结束后清除类
                setTimeout(() => {
                    character.classList.remove('flip-left', 'flip-right');
                    isFlipping = false;
                }, 800);
                
                // 重置双击检测
                lastKeyPress.time = 0;
                return;
            }
        }

        // 更新最后一次按键信息
        lastKeyPress.key = event.key;
        lastKeyPress.time = currentTime;

        // 正常移动逻辑
        if (!isMoving) {
            character.classList.add('moving');
            isMoving = true;
        }

        clearTimeout(moveTimeout);

        switch(event.key) {
            case 'ArrowLeft':
                if (horizontalPosition > 5) {
                    horizontalPosition -= horizontalStep;
                    character.style.left = horizontalPosition + '%';
                }
                break;
            case 'ArrowRight':
                if (horizontalPosition < 95) {
                    horizontalPosition += horizontalStep;
                    character.style.left = horizontalPosition + '%';
                }
                break;
            case 'ArrowUp':
                if (verticalPosition < 400) {
                    verticalPosition += verticalStep;
                    character.style.bottom = verticalPosition + 'px';
                }
                break;
            case 'ArrowDown':
                if (verticalPosition > 100) {
                    verticalPosition -= verticalStep;
                    character.style.bottom = verticalPosition + 'px';
                }
                break;
        }

        moveTimeout = setTimeout(() => {
            character.classList.remove('moving');
            isMoving = false;
        }, 200);
    });

    // 雪花效果代码保持不变
    function createSnowflake() {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');
        snowflake.style.left = Math.random() * 100 + '%';
        snowflake.style.opacity = Math.random();
        snowflake.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
        
        snowContainer.appendChild(snowflake);
        
        setTimeout(() => {
            snowflake.remove();
        }, 5000);
    }

    setInterval(createSnowflake, 100);

    function createPetals() {
        const fallingPetals = document.createElement('div');
        fallingPetals.className = 'falling-petals';
        document.querySelector('.background').appendChild(fallingPetals);

        function addPetal() {
            const petal = document.createElement('div');
            petal.className = 'petal';
            petal.style.left = Math.random() * 100 + '%';
            petal.style.animationDelay = Math.random() * 2 + 's';
            petal.style.opacity = Math.random() * 0.5 + 0.5;
            fallingPetals.appendChild(petal);

            // 动画结束后移除花瓣
            setTimeout(() => {
                petal.remove();
            }, 4000);
        }

        // 每隔一段时间添加新的花瓣
        setInterval(addPetal, 300);
    }

    createPetals();
}); 